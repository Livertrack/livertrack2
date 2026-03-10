import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LiverTrack - Gestion Livraisons',
  description: 'Application de gestion des ventes livreurs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: '#0D1117', fontFamily: "'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
