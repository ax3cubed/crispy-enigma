import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LTI Assessment Tool',
  description: 'LTI 1.3 Advantage tool — rubric-driven assessment with AGS score passback',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
