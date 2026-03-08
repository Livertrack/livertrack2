'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Vente, Livreur, Boutique } from '@/lib/types'

export default function HistoriquePage() {
  const supabase = createClient()
  const [ventes, setVentes] = useState<Vente[]>([])
  const [livreurs, setLivreurs] = useState<Livreur[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLivreur, setFilterLivreur] = useState('')
  const [filterBoutique, setFilterBoutique] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: v }, { data: l }, { data: b }] = await Promise.all([
        supabase.from('ventes').select('*, livreur:livreurs(*), boutique:boutiques(*), vente_lignes(*, produit:produits(*))').order('created_at', { ascending: false }).limit(500),
        supabase.from('livreurs').select('*').eq('actif', true).order('nom'),
        supabase.from('boutiques').select('*').eq('actif', true),
      ])
      setVentes(v || [])
      setLivreurs(l || [])
      setBoutiques(b || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = ventes.filter(v => {
    if (filterLivreur && v.livreur_id !== filterLivreur) return false
    if (filterBoutique && v.boutique_id !== filterBoutique) return false
    if (filterDateFrom && v.date_vente < filterDateFrom) return false
    if (filterDateTo && v.date_vente > filterDateTo) return false
    return true
  })

  const totalFiltered = filtered.reduce((s, v) => s + v.montant_total, 0)

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map(v => ({
      'Date': v.date_vente,
      'Heure': new Date(v.created_at).toLocaleTimeString('fr-FR'),
      'Livreur': (v.livreur as any)?.nom,
      'Client': v.client_nom,
      'Boutique': (v.boutique as any)?.nom,
      'Montant (DA)': v.montant_total,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Ventes')
    XLSX.writeFile(wb, `livertrack-export-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const inputStyle: React.CSSProperties = { background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '8px 12px', color: '#F1F5F9', fontSize: 13, outline: 'none' }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Historique des ventes</h1>
            <p style={{ color: '#8B95A8', marginTop: 6 }}>{filtered.length} vente(s) — Total : <span style={{ color: '#F59E0B', fontWeight: 700 }}>{totalFiltered.toLocaleString()} DA</span></p>
          </div>
          <button onClick={exportExcel} style={{ background: '#10B98122', border: '1px solid #10B98144', color: '#10B981', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ↓ Exporter Excel
          </button>
        </div>

        {/* Filtres */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterLivreur} onChange={e => setFilterLivreur(e.target.value)} style={selectStyle}>
            <option value="">Tous les livreurs</option>
            {livreurs.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
          <select value={filterBoutique} onChange={e => setFilterBoutique(e.target.value)} style={selectStyle}>
            <option value="">Toutes les boutiques</option>
            {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={inputStyle} placeholder="Du" />
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={inputStyle} placeholder="Au" />
          {(filterLivreur || filterBoutique || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setFilterLivreur(''); setFilterBoutique(''); setFilterDateFrom(''); setFilterDateTo('') }} style={{ background: 'transparent', border: '1px solid #1E2535', color: '#8B95A8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>
              ✕ Effacer filtres
            </button>
          )}
        </div>

        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#4B5563' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div>Aucune vente trouvée</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0A0F1A', color: '#8B95A8', borderBottom: '1px solid #1E2535' }}>
                    {['Date', 'Heure', 'Livreur', 'Client', 'Boutique', 'Montant'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1E253533', background: i % 2 === 0 ? 'transparent' : '#0D111733' }}>
                      <td style={{ padding: '10px 14px', color: '#8B95A8', whiteSpace: 'nowrap' }}>{new Date(v.date_vente).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '10px 14px', color: '#4B5563', whiteSpace: 'nowrap' }}>{new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{(v.livreur as any)?.nom}</td>
                      <td style={{ padding: '10px 14px', color: '#CBD5E1', whiteSpace: 'nowrap' }}>{v.client_nom}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ background: (v.boutique as any)?.couleur + '22', color: (v.boutique as any)?.couleur, border: `1px solid ${(v.boutique as any)?.couleur}44`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                          {(v.boutique as any)?.nom}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#F59E0B', whiteSpace: 'nowrap' }}>{v.montant_total.toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#0A0F1A', borderTop: '2px solid #1E2535' }}>
                    <td colSpan={5} style={{ padding: '12px 14px', color: '#8B95A8', fontSize: 12, fontWeight: 600 }}>TOTAL ({filtered.length} ventes)</td>
                    <td style={{ padding: '12px 14px', fontFamily: "'Syne', sans-serif", fontWeight: 800, color: '#F59E0B', fontSize: 16 }}>{totalFiltered.toLocaleString()} DA</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
