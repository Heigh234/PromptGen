# PromptGen — Web Prompt Generator

Generate precise AI prompts for any web development task: full pages, sections, features, content, styling, and refactors.

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Google Gemini API** (`gemini-1.5-flash` — free tier available)

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Get your Gemini API key
Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and create a free API key.

### 3. Configure environment
```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste your key:
```
GEMINI_API_KEY=your_api_key_here
```

### 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🚀

---

## What you can generate

| Type | Description |
|---|---|
| 🏗️ Full Page | Build an entire page from scratch |
| 🧩 Section | Add or complete a specific section |
| ⚙️ Feature | Add a functionality to an existing page |
| ✍️ Content | Fill a section with real content/copy |
| 🎨 Styling | Improve design or UI of a component |
| 🔧 Refactor | Clean up or improve existing code |

---

## Project structure

```
app/
  layout.tsx          → Root layout + fonts
  page.tsx            → Main generator UI
  globals.css         → Global styles
  api/
    generate/
      route.ts        → Gemini API route (server-side)
```
