'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const navItems = [
  { id: '/', label: 'Tableau de bord', icon: '▦' },
  { id: '/ventes', label: 'Saisie ventes', icon: '+' },
  { id: '/stocks', label: 'Stocks', icon: '◻' },
  { id: '/historique', label: 'Historique', icon: '⏱' },
  { id: '/stats', label: 'Statistiques', icon: '↑' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <aside style={{
      width: 240, background: '#0A0F1A', borderRight: '1px solid #1E2535',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      top: 0, left: 0, bottom: 0, zIndex: 100,
    }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #1E2535' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚚</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: '#F1F5F9' }}>LiverTrack</div>
            <div style={{ fontSize: 10, color: '#8B95A8', letterSpacing: 1 }}>GESTION LIVRAISONS</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {navItems.map(item => {
          const active = pathname === item.id
          return (
            <button key={item.id} onClick={() => router.push(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none',
              cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
              background: active ? '#F59E0B11' : 'transparent',
              color: active ? '#F59E0B' : '#8B95A8',
              fontWeight: active ? 600 : 400, fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
              borderLeft: active ? '3px solid #F59E0B' : '3px solid transparent',
            }}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid #1E2535' }}>
        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none',
          cursor: 'pointer', background: 'transparent', color: '#4B5563',
          fontSize: 14, fontFamily: "'DM Sans', sans-serif", textAlign: 'left',
        }}>
          <span>⎋</span> Déconnexion
        </button>
      </div>
    </aside>
  )
}
