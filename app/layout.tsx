// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter, DM_Serif_Text } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })
const dmSerif = DM_Serif_Text({
  weight: '400',           // DM Serif Text ships as 400/italic; we'll style “bold” visually
  subsets: ['latin'],
  variable: '--font-intants', // expose as CSS var
})

export const metadata: Metadata = {
  title: 'NeuroSense • Report Builder',
  description: 'AI-assisted clinical report generation (CYP ADHD RTC)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${dmSerif.variable} bg-gradient-to-b from-sky-50 to-white text-slate-900`}>
        {children}
      </body>
    </html>
  )
}
