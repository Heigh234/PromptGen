'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Copy, Check, Sparkles, Zap, RotateCcw, Clock,
  ChevronDown, ChevronUp, BookOpen, Upload, FileText, Trash2, Wand2, Send,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
type PromptType = { id: string; label: string; description: string; emoji: string }
type ProjectContext = {
  overview: string; stack: string; folderStructure: string
  existingRoutes: string; designSystem: string; conventions: string; codeSnippets: string
}
type HistoryItem = { id: string; type: string; description: string; prompt: string; timestamp: string }

// ── Constants ──────────────────────────────────────────────────
const STORAGE_KEY_CTX  = 'promptgen:context'
const STORAGE_KEY_HIST = 'promptgen:history'

const PROMPT_TYPES: PromptType[] = [
  { id: 'full-page',     label: 'Full Page',  description: 'Build an entire page from scratch',    emoji: '🏗️' },
  { id: 'section',       label: 'Section',    description: 'Add or complete a specific section',   emoji: '🧩' },
  { id: 'functionality', label: 'Feature',    description: 'Add a feature or functionality',       emoji: '⚙️' },
  { id: 'content',       label: 'Content',    description: 'Fill a section with real content',     emoji: '✍️' },
  { id: 'styling',       label: 'Styling',    description: 'Improve design or UI',                 emoji: '🎨' },
  { id: 'refactor',      label: 'Refactor',   description: 'Clean up or improve existing code',    emoji: '🔧' },
]

const FRAMEWORKS = ['Next.js','React','Vue','Nuxt','Svelte','SvelteKit','Astro','HTML/CSS/JS','Angular','Remix']

const EMPTY_CONTEXT: ProjectContext = {
  overview:'', stack:'', folderStructure:'', existingRoutes:'', designSystem:'', conventions:'', codeSnippets:''
}

const CONTEXT_FIELDS: {
  key: keyof ProjectContext; label: string; placeholder: string; rows: number; emoji: string
  acceptFiles?: boolean; fileHint?: string
}[] = [
  {
    key: 'overview', emoji: '📋', label: 'Project Overview', rows: 2,
    placeholder: 'e.g. A B2B SaaS for project management. Target: small teams. Goal: replace Jira for non-technical users.',
  },
  {
    key: 'stack', emoji: '📦', label: 'Stack & Dependencies', rows: 3,
    acceptFiles: true, fileHint: 'Drop your package.json here',
    placeholder: 'e.g.\nNext.js 14 (App Router), TypeScript, Tailwind CSS\nPrisma + PostgreSQL, NextAuth v5, shadcn/ui\nzod, react-hook-form, zustand',
  },
  {
    key: 'folderStructure', emoji: '🗂️', label: 'Folder Structure', rows: 5,
    placeholder: 'e.g.\napp/\n  (auth)/login/page.tsx\n  (dashboard)/\n    layout.tsx\n    projects/[id]/page.tsx\ncomponents/ui/\nlib/db.ts',
  },
  {
    key: 'existingRoutes', emoji: '📄', label: 'Existing Pages / Routes', rows: 3,
    placeholder: 'e.g.\n/ → Landing\n/login → Auth\n/dashboard → Main\n/dashboard/projects → Project list',
  },
  {
    key: 'designSystem', emoji: '🎨', label: 'Design System', rows: 4,
    acceptFiles: true, fileHint: 'Drop tailwind.config.js or CSS file',
    placeholder: 'e.g.\nPrimary: #6366f1, Accent: #f59e0b\nFont: Inter (body), Cal Sans (headings)\nComponents: Button, Card, Input, Badge, Dialog (shadcn)',
  },
  {
    key: 'conventions', emoji: '📐', label: 'Conventions & Rules', rows: 3,
    placeholder: 'e.g.\n- Server components by default\n- API calls via /app/api/ routes\n- Zod schemas in /lib/validations/\n- Always strict TypeScript',
  },
  {
    key: 'codeSnippets', emoji: '💻', label: 'Code Snippets', rows: 6,
    acceptFiles: true, fileHint: 'Drop any .tsx, .ts, .js, .css file',
    placeholder: 'Paste or drop relevant files: components, schemas, hooks, configs…\n\n// components/ui/page-header.tsx\nexport function PageHeader({ title }: Props) {\n  return <h1>{title}</h1>\n}',
  },
]

// ── Helpers ────────────────────────────────────────────────────
function parsePackageJson(content: string): string {
  try {
    const pkg = JSON.parse(content)
    const deps    = Object.keys(pkg.dependencies    ?? {})
    const devDeps = Object.keys(pkg.devDependencies ?? {})
    const lines = [`Project: ${pkg.name ?? 'unknown'} v${pkg.version ?? '?'}`]
    if (deps.length)    lines.push(`\nDependencies:\n${deps.map(d => `- ${d}@${pkg.dependencies[d]}`).join('\n')}`)
    if (devDeps.length) lines.push(`\nDev dependencies:\n${devDeps.map(d => `- ${d}@${pkg.devDependencies[d]}`).join('\n')}`)
    return lines.join('\n')
  } catch {
    return content
  }
}

// ── Refine suggestions ─────────────────────────────────────────
const REFINE_SUGGESTIONS = [
  'Más detallado',
  'Más corto y directo',
  'Enfócate en accesibilidad',
  'Añade manejo de errores',
  'Incluye TypeScript types',
  'Mobile-first',
  'Más ejemplos de código',
  'Sin librerías extra',
]

// ── Main Component ─────────────────────────────────────────────
export default function PromptGenerator() {
  // Form
  const [selectedType, setSelectedType] = useState('full-page')
  const [framework, setFramework]       = useState('Next.js')
  const [description, setDescription]   = useState('')
  const [section, setSection]           = useState('')
  const [extra, setExtra]               = useState('')

  // Context
  const [projectContext, setProjectContext] = useState<ProjectContext>(EMPTY_CONTEXT)
  const [contextOpen, setContextOpen]       = useState(false)
  const [activeCtxField, setActiveCtxField] = useState<keyof ProjectContext | null>(null)

  // Output
  const [result, setResult]   = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [error, setError]     = useState('')

  // Refinement
  const [refineInput, setRefineInput]   = useState('')
  const [refining, setRefining]         = useState(false)
  const [refineCount, setRefineCount]   = useState(0)

  // History
  const [history, setHistory]         = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // File drag
  const [draggingOver, setDraggingOver]     = useState<keyof ProjectContext | null>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)
  const [fileTargetField, setFileTargetField] = useState<keyof ProjectContext | null>(null)
  const refineInputRef                      = useRef<HTMLInputElement>(null)
  const resultRef                           = useRef<HTMLDivElement>(null)

  // ── Load from localStorage ──
  useEffect(() => {
    try {
      const savedCtx  = localStorage.getItem(STORAGE_KEY_CTX)
      const savedHist = localStorage.getItem(STORAGE_KEY_HIST)
      if (savedCtx)  setProjectContext(JSON.parse(savedCtx))
      if (savedHist) setHistory(JSON.parse(savedHist))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_CTX, JSON.stringify(projectContext)) } catch {}
  }, [projectContext])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(history)) } catch {}
  }, [history])

  // Auto-scroll result panel when streaming
  useEffect(() => {
    if (loading || refining) {
      resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [result, loading, refining])

  const needsSection   = ['section','functionality','styling','refactor','content'].includes(selectedType)
  const filledCtxCount = Object.values(projectContext).filter(v => v.trim()).length
  const hasContext     = filledCtxCount > 0

  function updateCtx(key: keyof ProjectContext, val: string) {
    setProjectContext(p => ({ ...p, [key]: val }))
  }

  function clearContext() {
    setProjectContext(EMPTY_CONTEXT)
    try { localStorage.removeItem(STORAGE_KEY_CTX) } catch {}
  }

  // ── File handling ──
  function handleFileDrop(key: keyof ProjectContext, file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      let content = e.target?.result as string
      if (file.name === 'package.json') content = parsePackageJson(content)
      const existing = projectContext[key].trim()
      updateCtx(key, existing ? existing + '\n\n// ' + file.name + '\n' + content : '// ' + file.name + '\n' + content)
    }
    reader.readAsText(file)
  }

  function handleDragOver(e: React.DragEvent, key: keyof ProjectContext) {
    e.preventDefault(); setDraggingOver(key)
  }
  function handleDrop(e: React.DragEvent, key: keyof ProjectContext) {
    e.preventDefault(); setDraggingOver(null)
    const file = e.dataTransfer.files[0]
    if (file) handleFileDrop(key, file)
  }
  function triggerFileInput(key: keyof ProjectContext) {
    setFileTargetField(key); fileInputRef.current?.click()
  }
  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && fileTargetField) handleFileDrop(fileTargetField, file)
    e.target.value = ''
  }

  // ── Stream reader helper ──
  async function readStream(
    response: Response,
    onChunk: (text: string) => void
  ): Promise<string> {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error || 'Request failed')
    }
    const reader  = response.body!.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      full += chunk
      onChunk(full)
    }
    return full
  }

  // ── Generate ──
  async function handleGenerate() {
    if (!description.trim()) { setError('Please describe what you want to build.'); return }
    setError(''); setLoading(true); setResult(''); setRefineCount(0); setRefineInput('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType, framework, description, section, extra,
          projectContext: hasContext ? projectContext : undefined,
        }),
      })
      const full = await readStream(res, text => setResult(text))
      const newItem: HistoryItem = {
        id: Date.now().toString(), type: selectedType,
        description: description.slice(0, 60) + (description.length > 60 ? '…' : ''),
        prompt: full, timestamp: new Date().toISOString(),
      }
      setHistory(p => [newItem, ...p.slice(0, 49)])
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Refine ──
  async function handleRefine(instruction?: string) {
    const req = instruction ?? refineInput.trim()
    if (!req || !result) return
    setError(''); setRefining(true); setRefineInput('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType, framework, description, section, extra,
          projectContext: hasContext ? projectContext : undefined,
          refineRequest: req,
          currentPrompt: result,
        }),
      })
      const full = await readStream(res, text => setResult(text))
      setRefineCount(c => c + 1)
      // Update history entry
      setHistory(p => {
        const [first, ...rest] = p
        if (!first) return p
        return [{ ...first, prompt: full }, ...rest]
      })
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setRefining(false)
      setTimeout(() => refineInputRef.current?.focus(), 50)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setDescription(''); setSection(''); setExtra('')
    setResult(''); setError(''); setRefineCount(0); setRefineInput('')
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-bg">
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileInputChange}
        accept=".json,.ts,.tsx,.js,.jsx,.css,.md,.env,.txt" />

      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-bg/95 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-accent rounded-sm flex items-center justify-center">
            <Zap size={14} className="text-bg" fill="currentColor" />
          </div>
          <span className="font-sans font-extrabold text-lg text-text">PromptGen</span>
          <span className="text-dim font-mono text-xs border border-border px-2 py-0.5 rounded">web</span>
        </div>
        <div className="flex items-center gap-3">
          {hasContext && (
            <span className="flex items-center gap-1.5 text-accent font-mono text-xs border border-accent/30 bg-accent/5 px-2.5 py-1 rounded-full">
              <BookOpen size={11} />{filledCtxCount} field{filledCtxCount > 1 ? 's' : ''} · saved locally
            </span>
          )}
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-dim hover:text-text transition-colors text-sm font-mono">
            <Clock size={14} />History ({history.length})
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* ── Context Panel ── */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button onClick={() => setContextOpen(!contextOpen)}
            className="w-full flex items-center justify-between px-5 py-4 bg-surface hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-3">
              <BookOpen size={16} className={hasContext ? 'text-accent' : 'text-dim'} />
              <div className="text-left">
                <p className="font-sans font-semibold text-sm text-text">Project Context</p>
                <p className="font-mono text-xs text-dim">
                  {hasContext
                    ? `${filledCtxCount}/${CONTEXT_FIELDS.length} fields · auto-saved to your browser · persists between sessions`
                    : 'Fill once, saved forever — describe your project and every prompt will be tailored to it'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasContext && (
                <button onClick={e => { e.stopPropagation(); clearContext() }}
                  className="flex items-center gap-1 text-dim hover:text-red-400 transition-colors text-xs font-mono p-1 rounded">
                  <Trash2 size={13} />
                </button>
              )}
              {contextOpen ? <ChevronUp size={16} className="text-dim" /> : <ChevronDown size={16} className="text-dim" />}
            </div>
          </button>

          {contextOpen && (
            <div className="border-t border-border animate-fade-in">
              <div className="flex overflow-x-auto border-b border-border bg-bg/50 px-4 gap-1 pt-2">
                {CONTEXT_FIELDS.map(f => {
                  const filled = projectContext[f.key].trim().length > 0
                  const active = activeCtxField === f.key
                  return (
                    <button key={f.key} onClick={() => setActiveCtxField(active ? null : f.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono whitespace-nowrap border-b-2 transition-all -mb-px ${
                        active ? 'border-accent text-accent' : filled ? 'border-accent/40 text-text' : 'border-transparent text-dim hover:text-text'
                      }`}>
                      {f.emoji} {f.label}
                      {filled && !active && <span className="w-1.5 h-1.5 rounded-full bg-accent/70 ml-0.5" />}
                    </button>
                  )
                })}
              </div>

              {activeCtxField ? (
                <div className="p-5 animate-fade-in">
                  {CONTEXT_FIELDS.filter(f => f.key === activeCtxField).map(f => (
                    <div key={f.key}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-mono text-dim uppercase tracking-widest">{f.emoji} {f.label}</label>
                        <div className="flex items-center gap-3">
                          {f.acceptFiles && (
                            <button onClick={() => triggerFileInput(f.key)}
                              className="flex items-center gap-1.5 text-xs font-mono text-dim hover:text-accent transition-colors border border-border hover:border-accent/40 px-2.5 py-1 rounded-md">
                              <Upload size={11} /> Upload file
                            </button>
                          )}
                          {projectContext[f.key] && (
                            <button onClick={() => updateCtx(f.key, '')} className="text-dim hover:text-red-400 text-xs font-mono transition-colors">clear</button>
                          )}
                        </div>
                      </div>
                      <div
                        onDragOver={f.acceptFiles ? e => handleDragOver(e, f.key) : undefined}
                        onDragLeave={f.acceptFiles ? () => setDraggingOver(null) : undefined}
                        onDrop={f.acceptFiles ? e => handleDrop(e, f.key) : undefined}
                        className={`relative rounded-lg transition-all ${draggingOver === f.key ? 'ring-2 ring-accent/60 ring-offset-1 ring-offset-bg' : ''}`}
                      >
                        <textarea
                          value={projectContext[f.key]}
                          onChange={e => updateCtx(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          rows={f.rows + 2}
                          className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm font-mono text-text placeholder:text-muted/60 resize-y focus:outline-none focus:border-accent/50 transition-colors leading-relaxed"
                        />
                        {f.acceptFiles && draggingOver !== f.key && !projectContext[f.key] && (
                          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-muted font-mono text-xs pointer-events-none">
                            <FileText size={11} />{f.fileHint}
                          </div>
                        )}
                        {draggingOver === f.key && (
                          <div className="absolute inset-0 bg-accent/10 border-2 border-accent/50 border-dashed rounded-lg flex items-center justify-center pointer-events-none">
                            <p className="text-accent font-mono text-sm font-semibold flex items-center gap-2">
                              <Upload size={16} /> Drop to load file
                            </p>
                          </div>
                        )}
                      </div>
                      {projectContext[f.key] && (
                        <p className="text-dim font-mono text-xs mt-1.5">
                          {projectContext[f.key].split('\n').length} lines · auto-saved
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {CONTEXT_FIELDS.map(f => {
                    const filled = projectContext[f.key].trim().length > 0
                    return (
                      <button key={f.key} onClick={() => setActiveCtxField(f.key)}
                        className={`text-left p-3 rounded-lg border transition-all hover:border-muted group ${filled ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xl">{f.emoji}</span>
                          {filled ? <span className="w-2 h-2 rounded-full bg-accent" /> : f.acceptFiles && <Upload size={10} className="text-muted group-hover:text-dim transition-colors" />}
                        </div>
                        <p className="font-sans font-semibold text-xs text-text leading-tight">{f.label}</p>
                        {filled ? (
                          <p className="text-xs font-mono text-accent/70 mt-1">
                            {projectContext[f.key].split('\n').length} lines saved
                          </p>
                        ) : (
                          <p className="text-xs font-mono text-muted mt-1">
                            {f.acceptFiles ? 'type or upload' : 'click to fill'}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Generator + Result ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: Form */}
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="font-sans font-extrabold text-3xl text-text leading-tight">
                Generate prompts<br /><span className="text-accent">for any web task.</span>
              </h1>
              <p className="text-dim text-sm mt-2 font-mono">Pages · Sections · Features · Content · Styling · Refactors</p>
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-xs font-mono text-dim uppercase tracking-widest mb-3">What are you building?</label>
              <div className="grid grid-cols-2 gap-2">
                {PROMPT_TYPES.map(t => (
                  <button key={t.id} onClick={() => setSelectedType(t.id)}
                    className={`text-left p-3 rounded-lg border transition-all ${selectedType === t.id ? 'border-accent bg-accent/5 text-text' : 'border-border bg-surface text-dim hover:border-muted hover:text-text'}`}>
                    <div className="flex items-center gap-2 mb-0.5"><span>{t.emoji}</span><span className="font-sans font-semibold text-sm">{t.label}</span></div>
                    <p className="text-xs font-mono opacity-60">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Framework */}
            <div>
              <label className="block text-xs font-mono text-dim uppercase tracking-widest mb-2">Framework / Stack</label>
              <div className="flex flex-wrap gap-2">
                {FRAMEWORKS.map(fw => (
                  <button key={fw} onClick={() => setFramework(fw)}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${framework === fw ? 'bg-accent text-bg border-accent font-semibold' : 'border-border text-dim hover:border-muted hover:text-text bg-surface'}`}>
                    {fw}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-mono text-dim uppercase tracking-widest mb-2">Describe what you need</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                placeholder={
                  selectedType==='full-page'?'e.g. A landing page for a SaaS tool with hero, features, pricing and CTA':
                  selectedType==='section'?'e.g. A testimonials section with 3 cards, star ratings and photos':
                  selectedType==='functionality'?'e.g. Add a dark/light mode toggle that persists in localStorage':
                  selectedType==='content'?'e.g. Fill the hero with compelling copy for a fintech startup':
                  selectedType==='styling'?'e.g. Make the navbar more modern with a glass/blur effect':
                  'e.g. Split the auth logic into smaller reusable hooks'}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm font-mono text-text placeholder:text-muted resize-none focus:outline-none focus:border-accent/50 transition-colors" />
            </div>

            {needsSection && (
              <div className="animate-fade-in">
                <label className="block text-xs font-mono text-dim uppercase tracking-widest mb-2">Target section / component <span className="normal-case">(optional)</span></label>
                <input type="text" value={section} onChange={e => setSection(e.target.value)}
                  placeholder="e.g. Navbar, HeroSection, PricingCard…"
                  className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-dim uppercase tracking-widest mb-2">Extra notes <span className="normal-case">(optional)</span></label>
              <input type="text" value={extra} onChange={e => setExtra(e.target.value)}
                placeholder="e.g. Must be accessible, mobile-first, no extra libraries…"
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
            </div>

            {error && <p className="text-red-400 text-xs font-mono border border-red-400/20 bg-red-400/5 px-3 py-2 rounded-lg">⚠ {error}</p>}

            <div className="flex gap-3">
              <button onClick={handleGenerate} disabled={loading || refining}
                className="flex-1 flex items-center justify-center gap-2 bg-accent text-bg font-sans font-bold py-3 px-6 rounded-lg hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {loading
                  ? <><span className="animate-pulse-slow">Generating</span><span className="animate-pulse font-mono">···</span></>
                  : <><Sparkles size={16} />Generate Prompt{hasContext && <span className="text-bg/60 font-mono text-xs font-normal">with context</span>}</>}
              </button>
              {(description || result) && (
                <button onClick={handleReset} disabled={loading || refining}
                  className="p-3 border border-border text-dim hover:text-text hover:border-muted rounded-lg transition-all disabled:opacity-40" title="Reset form">
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Right: Result */}
          <div className="flex flex-col gap-4">
            {showHistory && history.length > 0 ? (
              <div className="flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-sans font-semibold text-sm text-text">History ({history.length})</h2>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setHistory([]); try { localStorage.removeItem(STORAGE_KEY_HIST) } catch {} }}
                      className="text-dim hover:text-red-400 text-xs font-mono transition-colors flex items-center gap-1">
                      <Trash2 size={11} /> clear all
                    </button>
                    <button onClick={() => setShowHistory(false)} className="text-dim hover:text-text text-xs font-mono">✕ close</button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 max-h-[560px] overflow-y-auto pr-1">
                  {history.map(item => (
                    <div key={item.id} className="flex items-start gap-2 group">
                      <button onClick={() => { setResult(item.prompt); setShowHistory(false); setRefineCount(0) }}
                        className="flex-1 text-left p-3 bg-surface border border-border rounded-lg hover:border-muted transition-all">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-accent font-mono text-xs">{PROMPT_TYPES.find(t=>t.id===item.type)?.emoji} {item.type}</span>
                          <span className="text-dim font-mono text-xs ml-auto">
                            {new Date(item.timestamp).toLocaleDateString([], { month:'short', day:'numeric' })} {new Date(item.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-dim text-xs font-mono group-hover:text-text transition-colors">{item.description}</p>
                      </button>
                      {/* Copy direct desde historial */}
                      <button
                        onClick={async () => { await navigator.clipboard.writeText(item.prompt) }}
                        className="p-2.5 border border-border text-dim hover:text-accent hover:border-accent/40 rounded-lg transition-all opacity-0 group-hover:opacity-100 mt-0.5"
                        title="Copy prompt">
                        <Copy size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Result header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="font-sans font-semibold text-sm text-text">
                      {result ? 'Your prompt is ready ✓' : 'Generated prompt'}
                    </h2>
                    {refineCount > 0 && (
                      <span className="flex items-center gap-1 text-accent font-mono text-xs border border-accent/30 bg-accent/5 px-2 py-0.5 rounded-full">
                        <Wand2 size={10} />{refineCount} refinement{refineCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {history.length > 0 && (
                      <button onClick={() => setShowHistory(true)}
                        className="text-dim text-xs font-mono hover:text-text flex items-center gap-1 border border-border px-2 py-1 rounded-md hover:border-muted transition-all">
                        <Clock size={12} /> {history.length} saved
                      </button>
                    )}
                    {result && (
                      <button onClick={handleCopy}
                        className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-md border transition-all ${copied ? 'text-accent border-accent/40 bg-accent/5' : 'text-dim border-border hover:text-text hover:border-muted'}`}>
                        {copied ? <Check size={12}/> : <Copy size={12}/>}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Result box */}
                <div ref={resultRef}
                  className={`flex-1 min-h-[400px] max-h-[480px] overflow-y-auto bg-surface border rounded-xl p-5 font-mono text-sm leading-relaxed transition-all ${result ? 'border-border text-text' : 'border-border/50 text-dim'}`}>
                  {loading ? (
                    <pre className="whitespace-pre-wrap break-words text-text animate-pulse-slow">{result}<span className="inline-block w-2 h-4 bg-accent/70 ml-0.5 animate-pulse align-middle" /></pre>
                  ) : refining ? (
                    <pre className="whitespace-pre-wrap break-words text-text">{result}<span className="inline-block w-2 h-4 bg-accent/70 ml-0.5 animate-pulse align-middle" /></pre>
                  ) : result ? (
                    <pre className="whitespace-pre-wrap break-words animate-slide-up">{result}</pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                      <Sparkles size={32} className="text-accent" />
                      <p className="text-center text-xs leading-relaxed">
                        {hasContext
                          ? `${filledCtxCount} context fields loaded\nPrompts will be tailored to your project`
                          : 'Fill the form and click\n"Generate Prompt" to get started'}
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Refinement panel ── */}
                {result && !loading && (
                  <div className="flex flex-col gap-3 animate-fade-in">
                    {/* Quick suggestions */}
                    <div className="flex flex-wrap gap-1.5">
                      {REFINE_SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => handleRefine(s)} disabled={refining}
                          className="text-xs font-mono px-2.5 py-1 rounded-full border border-border text-dim hover:border-accent/50 hover:text-accent hover:bg-accent/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* Custom refine input */}
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 focus-within:border-accent/50 transition-colors">
                        <Wand2 size={14} className="text-dim shrink-0" />
                        <input
                          ref={refineInputRef}
                          type="text"
                          value={refineInput}
                          onChange={e => setRefineInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine() } }}
                          placeholder="Refine: más detallado, añade X, sin Y…"
                          disabled={refining}
                          className="flex-1 bg-transparent text-sm font-mono text-text placeholder:text-muted focus:outline-none disabled:opacity-40"
                        />
                      </div>
                      <button onClick={() => handleRefine()} disabled={refining || !refineInput.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-accent/10 border border-accent/30 text-accent font-mono text-xs rounded-lg hover:bg-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                        {refining
                          ? <span className="animate-pulse">···</span>
                          : <><Send size={13} /> Refine</>}
                      </button>
                    </div>

                    <p className="text-dim text-xs font-mono text-center">
                      Paste directly into Claude, ChatGPT, Cursor or any AI tool →
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
