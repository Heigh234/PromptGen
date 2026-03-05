import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PromptGen — Web Prompt Generator',
  description: 'Generate precise AI prompts for any web page, section or feature',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg text-text font-sans antialiased">{children}</body>
    </html>
  )
}
