import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_PROMPT = `You are a senior prompt engineer and software architect specialized in web development.

Your job is to take a user's request and their existing project context, and generate a highly detailed, precise, and actionable prompt that a developer can send to an AI coding assistant (Claude, ChatGPT, Cursor, Copilot, etc.) to get excellent, production-ready results.

Rules for the generated prompt:
- Be extremely specific and detailed
- Always reflect the project's actual stack, structure, conventions, and patterns
- Reference real file paths, component names, and existing patterns from the project context
- Include edge cases, accessibility, responsiveness, and TypeScript types where relevant
- If a design system or existing components are mentioned, the prompt must instruct the AI to reuse them
- Adapt the tone to the task type (building vs. refactoring vs. content vs. styling)
- The prompt must be ready to paste directly into any AI tool — no preamble, no explanation, no markdown fences
- Write the prompt in the same language the user used to describe their request

Output ONLY the prompt text. Nothing else.`

type ProjectContext = {
  overview?: string
  stack?: string
  folderStructure?: string
  codeSnippets?: string
  conventions?: string
  designSystem?: string
  existingRoutes?: string
}

function buildUserMessage({
  type, framework, description, section, extra, projectContext,
}: {
  type: string
  framework: string
  description: string
  section?: string
  extra?: string
  projectContext?: ProjectContext
}) {
  const lines: string[] = []
  lines.push('=== TASK ===')
  lines.push(`Type: ${type}`)
  lines.push(`Framework/Stack: ${framework}`)
  lines.push(`Request: ${description}`)
  if (section) lines.push(`Target section/component: ${section}`)
  if (extra)   lines.push(`Additional notes: ${extra}`)

  const ctx = projectContext
  if (ctx && Object.values(ctx).some(v => v?.trim())) {
    lines.push('')
    lines.push('=== PROJECT CONTEXT ===')
    lines.push('Use this context to make the generated prompt as specific and accurate as possible.')
    if (ctx.overview?.trim())        lines.push(`\nProject overview:\n${ctx.overview}`)
    if (ctx.stack?.trim())           lines.push(`\nStack & dependencies:\n${ctx.stack}`)
    if (ctx.folderStructure?.trim()) lines.push(`\nFolder structure:\n${ctx.folderStructure}`)
    if (ctx.existingRoutes?.trim())  lines.push(`\nExisting pages/routes:\n${ctx.existingRoutes}`)
    if (ctx.designSystem?.trim())    lines.push(`\nDesign system (colors, fonts, components):\n${ctx.designSystem}`)
    if (ctx.conventions?.trim())     lines.push(`\nConventions & rules:\n${ctx.conventions}`)
    if (ctx.codeSnippets?.trim())    lines.push(`\nCode snippets (components, config, etc.):\n${ctx.codeSnippets}`)
  }
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, framework, description, section, extra, projectContext, refineRequest, currentPrompt } = body

    if (!description) {
      return new Response(JSON.stringify({ error: 'Description is required' }), { status: 400 })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      systemInstruction: SYSTEM_PROMPT,
    })

    let streamResult

    if (refineRequest && currentPrompt) {
      // Refinement mode: multi-turn chat with history
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: buildUserMessage({ type, framework, description, section, extra, projectContext }) }],
          },
          {
            role: 'model',
            parts: [{ text: currentPrompt }],
          },
        ],
      })
      streamResult = await chat.sendMessageStream(
        `Refine the prompt you just generated with this instruction: ${refineRequest}\n\nOutput ONLY the updated prompt text. Nothing else.`
      )
    } else {
      // Normal generation mode
      streamResult = await model.generateContentStream(
        buildUserMessage({ type, framework, description, section, extra, projectContext })
      )
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
            const text = chunk.text()
            if (text) controller.enqueue(new TextEncoder().encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    console.error('[Gemini Error]', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate prompt' }),
      { status: 500 }
    )
  }
}
