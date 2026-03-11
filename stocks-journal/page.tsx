'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function StocksJournalPage() {
  const supabase = createClient()
  const [livreurs, setLivreurs] = useState<any[]>([])
  const [produits, setProduits] = useState<any[]>([])
  const [mouvements, setMouvements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLivreur, setFilterLivreur] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: p }, { data: s }] = await Promise.all([
        supabase.from('livreurs').select('*').eq('actif', true).order('nom'),
        supabase.from('produits').select('*').eq('actif', true).order('nom'),
        supabase.from('stocks_journal').select('*, livreur:livreurs(*), produit:produits(*)').order('created_at', { ascending: false }).limit(500),
      ])
      setLivreurs(l || [])
      setProduits(p || [])
      setMouvements(s || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = mouvements.filter(m => {
    if (filterLivreur && m.livreur_id !== filterLivreur) return false
    if (filterDateFrom && m.date_mouvement < filterDateFrom) return false
    if (filterDateTo && m.date_mouvement > filterDateTo) return false
    return true
  })

  const inputStyle: React.CSSProperties = { background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '8px 12px', color: '#F1F5F9', fontSize: 13, outline: 'none', cursor: 'pointer' }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Journal du stock</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>Historique de tous les mouvements de stock</p>
        </div>

        {/* Filtres */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterLivreur} onChange={e => setFilterLivreur(e.target.value)} style={inputStyle}>
            <option value="">Tous les livreurs</option>
            {livreurs.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={inputStyle} />
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={inputStyle} />
          {(filterLivreur || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setFilterLivreur(''); setFilterDateFrom(''); setFilterDateTo('') }}
              style={{ background: 'transparent', border: '1px solid #1E2535', color: '#8B95A8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>
              ✕ Effacer
            </button>
          )}
        </div>

        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#4B5563' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <div>Aucun mouvement de stock trouvé</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0A0F1A', borderBottom: '1px solid #1E2535' }}>
                    {['Date', 'Heure', 'Livreur', 'Type', 'Produit', 'Quantité', 'Note'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const isPositif = m.quantite > 0
                    const isInitial = m.type === 'initial'
                    const color = isInitial ? '#F59E0B' : isPositif ? '#10B981' : '#EF4444'
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #1E253533', background: i % 2 === 0 ? 'transparent' : '#0D111733' }}>
                        <td style={{ padding: '10px 14px', color: '#8B95A8', whiteSpace: 'nowrap' }}>{new Date(m.date_mouvement).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: '10px 14px', color: '#4B5563', whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{m.livreur?.nom}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                            {isInitial ? 'Initial' : isPositif ? 'Réappro' : 'Perte'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#CBD5E1', whiteSpace: 'nowrap' }}>{m.produit?.nom}</td>
                        <td style={{ padding: '10px 14px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                          {isInitial ? m.quantite : (isPositif ? '+' : '') + m.quantite}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#4B5563', fontSize: 12 }}>{m.note || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
