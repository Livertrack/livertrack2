'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Livreur, Produit, Boutique } from '@/lib/types'

type Ligne = {
  client: string
  boutique_id: string
  produit_id: string
  quantite: string
  prix: string
}

function emptyLigne(boutique_id: string): Ligne {
  return { client: '', boutique_id, produit_id: '', quantite: '', prix: '' }
}

export default function VentesPage() {
  const supabase = createClient()
  const [livreurs, setLivreurs] = useState<Livreur[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const [livreurActif, setLivreurActif] = useState<string>('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [lignes, setLignes] = useState<Ligne[]>([])

  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: p }, { data: b }] = await Promise.all([
        supabase.from('livreurs').select('*').eq('actif', true).order('nom'),
        supabase.from('produits').select('*').eq('actif', true).order('nom'),
        supabase.from('boutiques').select('*').eq('actif', true),
      ])
      setLivreurs(l || [])
      setProduits(p || [])
      setBoutiques(b || [])
      if (l && l.length > 0) setLivreurActif(l[0].id)
      if (b && b.length > 0) {
        setLignes([emptyLigne(b[0].id), emptyLigne(b[0].id), emptyLigne(b[0].id)])
      }
      setLoading(false)
    }
    load()
  }, [])

  function updateLigne(index: number, field: keyof Ligne, value: string) {
    setLignes(prev => {
      const next = prev.map((l, i) => i === index ? { ...l, [field]: value } : l)
      // Ajouter une ligne vide automatiquement si on est sur la dernière
      const defaultBoutique = boutiques[0]?.id || ''
      if (index === prev.length - 1 && value !== '') {
        next.push(emptyLigne(defaultBoutique))
      }
      return next
    })
  }

  function removeLigne(index: number) {
    setLignes(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }

  // Navigation clavier : Entrée = cellule suivante
  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, colIndex: number, totalCols: number) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const cells = tableRef.current?.querySelectorAll('input, select')
      if (!cells) return
      const currentIndex = Array.from(cells).findIndex(c => c === e.target)
      const next = cells[currentIndex + 1] as HTMLElement
      if (next) next.focus()
    }
  }

  const lignesValides = lignes.filter(l => l.client.trim() && l.produit_id && parseFloat(l.quantite) > 0 && parseFloat(l.prix) > 0)
  const total = lignesValides.reduce((s, l) => s + parseFloat(l.quantite) * parseFloat(l.prix), 0)

  async function saveAll() {
    if (!livreurActif || lignesValides.length === 0) return
    setSaving(true)

    for (const ligne of lignesValides) {
      const montant = parseFloat(ligne.quantite) * parseFloat(ligne.prix)
      const { data: vente } = await supabase.from('ventes').insert({
        livreur_id: livreurActif,
        boutique_id: ligne.boutique_id,
        client_nom: ligne.client,
        date_vente: date,
        montant_total: montant,
      }).select().single()

      if (vente) {
        await supabase.from('vente_lignes').insert({
          vente_id: vente.id,
          produit_id: ligne.produit_id,
          quantite: parseInt(ligne.quantite),
          prix_unitaire: parseFloat(ligne.prix),
        })
      }
    }

    setSaving(false)
    setSuccess(`${lignesValides.length} vente(s) enregistrée(s) !`)
    setTimeout(() => setSuccess(''), 3000)
    setLignes([emptyLigne(boutiques[0]?.id || ''), emptyLigne(boutiques[0]?.id || ''), emptyLigne(boutiques[0]?.id || '')])
  }

  const cellStyle: React.CSSProperties = { background: '#0D1117', border: '1px solid #1E2535', color: '#F1F5F9', fontSize: 13, padding: '8px 10px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Saisie rapide des ventes</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>Remplissez ligne par ligne — appuyez sur Entrée pour passer à la cellule suivante</p>
        </div>

        {success && (
          <div style={{ background: '#10B98122', border: '1px solid #10B98155', borderRadius: 12, padding: '14px 20px', color: '#10B981', marginBottom: 24, fontSize: 14 }}>
            ✓ {success}
          </div>
        )}

        {/* Sélection livreur + date */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Livreur</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {livreurs.map(l => (
                  <button key={l.id} onClick={() => setLivreurActif(l.id)} style={{
                    padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    background: livreurActif === l.id ? '#F59E0B22' : '#0D1117',
                    border: `2px solid ${livreurActif === l.id ? '#F59E0B' : '#1E2535'}`,
                    color: livreurActif === l.id ? '#F59E0B' : '#8B95A8',
                    transition: 'all 0.15s',
                  }}>{l.nom}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '8px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* Tableau saisie */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0A0F1A' }}>
                  {['#', 'Client', 'Boutique', 'Produit', 'Qté', 'Prix (€)', 'Total', ''].map(h => (
                    <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #1E2535' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, i) => {
                  const ligneTotal = parseFloat(ligne.quantite || '0') * parseFloat(ligne.prix || '0')
                  const isValide = ligne.client.trim() && ligne.produit_id && parseFloat(ligne.quantite) > 0 && parseFloat(ligne.prix) > 0
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1E253533', background: isValide ? '#10B98108' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: '#4B5563', fontSize: 12, width: 30 }}>{i + 1}</td>
                      <td style={{ padding: '4px 4px' }}>
                        <input value={ligne.client} onChange={e => updateLigne(i, 'client', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 0, 5)}
                          placeholder="Nom client" style={{ ...cellStyle, minWidth: 130 }} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <select value={ligne.boutique_id} onChange={e => updateLigne(i, 'boutique_id', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 1, 5)}
                          style={{ ...cellStyle, minWidth: 100, cursor: 'pointer' }}>
                          {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <select value={ligne.produit_id} onChange={e => updateLigne(i, 'produit_id', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 2, 5)}
                          style={{ ...cellStyle, minWidth: 130, cursor: 'pointer' }}>
                          <option value="">-- Produit --</option>
                          {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input type="number" min="1" value={ligne.quantite} onChange={e => updateLigne(i, 'quantite', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 3, 5)}
                          placeholder="0" style={{ ...cellStyle, width: 60, textAlign: 'center' }} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input type="number" min="0" step="0.01" value={ligne.prix} onChange={e => updateLigne(i, 'prix', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 4, 5)}
                          placeholder="0.00" style={{ ...cellStyle, width: 80, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '6px 10px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color: ligneTotal > 0 ? '#F59E0B' : '#1E2535', whiteSpace: 'nowrap', minWidth: 70 }}>
                        {ligneTotal > 0 ? `${ligneTotal.toLocaleString()} €` : '—'}
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <button onClick={() => removeLigne(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', fontSize: 14, padding: '4px 8px' }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Ajouter ligne */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #1E2535' }}>
            <button onClick={() => setLignes(prev => [...prev, emptyLigne(boutiques[0]?.id || '')])}
              style={{ background: 'none', border: '1px dashed #374151', borderRadius: 8, padding: '7px 16px', color: '#8B95A8', cursor: 'pointer', fontSize: 13 }}>
              + Ajouter une ligne
            </button>
          </div>
        </div>

        {/* Footer total + bouton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: '16px 24px' }}>
          <div>
            <span style={{ color: '#8B95A8', fontSize: 14 }}>{lignesValides.length} vente(s) valide(s) — Total : </span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: '#F59E0B' }}>{total.toLocaleString()} €</span>
          </div>
          <button onClick={saveAll} disabled={saving || lignesValides.length === 0}
            style={{ background: lignesValides.length > 0 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : '#1E2535', border: 'none', borderRadius: 12, padding: '12px 28px', color: lignesValides.length > 0 ? '#0D1117' : '#4B5563', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, cursor: lignesValides.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {saving ? 'Enregistrement...' : `✓ Enregistrer ${lignesValides.length > 0 ? `(${lignesValides.length})` : ''}`}
          </button>
        </div>
      </main>
    </div>
  )
}
