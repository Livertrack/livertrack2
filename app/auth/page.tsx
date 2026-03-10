'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect')
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 } as React.CSSProperties,
    card: { background: '#161B27', border: '1px solid #1E2535', borderRadius: 24, padding: '48px 40px', width: '100%', maxWidth: 420 } as React.CSSProperties,
    logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36, justifyContent: 'center' } as React.CSSProperties,
    logoIcon: { width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #F59E0B, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 } as React.CSSProperties,
    title: { fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: '#F1F5F9', margin: 0 } as React.CSSProperties,
    sub: { color: '#8B95A8', fontSize: 12, letterSpacing: 1 } as React.CSSProperties,
    label: { fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    input: { width: '100%', background: '#0D1117', border: '1px solid #1E2535', borderRadius: 12, padding: '12px 16px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 20 },
    btn: { width: '100%', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', borderRadius: 12, padding: 16, color: '#0D1117', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 8 } as React.CSSProperties,
    error: { background: '#EF444422', border: '1px solid #EF444455', borderRadius: 10, padding: '12px 16px', color: '#EF4444', fontSize: 13, marginBottom: 20 } as React.CSSProperties,
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🚚</div>
          <div>
            <div style={s.title}>LiverTrack</div>
            <div style={s.sub}>GESTION LIVRAISONS</div>
          </div>
        </div>

        <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, margin: '0 0 24px', color: '#F1F5F9' }}>Connexion</h2>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="gestionnaire@example.com" required />

          <label style={s.label}>Mot de passe</label>
          <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#4B5563', fontSize: 12, marginTop: 24 }}>
          Contactez l'administrateur pour obtenir un accès.
        </p>
      </div>
    </div>
  )
}
