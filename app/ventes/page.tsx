'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Livreur, Produit, Boutique } from '@/lib/types'

type Ligne = {
  client: string
  boutique_id: string
  qtys: Record<string, string>  // produit_id -> quantite
  prix: string
}

function emptyLigne(boutique_id: string, produits: Produit[]): Ligne {
  return {
    client: '',
    boutique_id,
    qtys: Object.fromEntries(produits.map(p => [p.id, ''])),
    prix: ''
  }
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
      const defaultB = b?.[0]?.id || ''
      setLignes([
        emptyLigne(defaultB, p || []),
        emptyLigne(defaultB, p || []),
        emptyLigne(defaultB, p || []),
      ])
      setLoading(false)
    }
    load()
  }, [])

  function updateField(index: number, field: 'client' | 'boutique_id' | 'prix', value: string) {
    setLignes(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function updateQty(lineIndex: number, produitId: string, value: string) {
    setLignes(prev => prev.map((l, i) => {
      if (i !== lineIndex) return l
      return { ...l, qtys: { ...l.qtys, [produitId]: value } }
    }))
  }

  function addLigne() {
    setLignes(prev => [...prev, emptyLigne(boutiques[0]?.id || '', produits)])
  }

  function removeLigne(index: number) {
    setLignes(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }

  function hasProducts(ligne: Ligne) {
    return Object.values(ligne.qtys).some(q => parseInt(q) > 0)
  }

  const lignesValides = lignes.filter(l => l.client.trim() && hasProducts(l) && parseFloat(l.prix) > 0)
  const total = lignesValides.reduce((s, l) => s + parseFloat(l.prix), 0)

  async function saveAll() {
    if (!livreurActif || lignesValides.length === 0) return
    setSaving(true)

    for (const ligne of lignesValides) {
      const montant = parseFloat(ligne.prix)
      const { data: vente } = await supabase.from('ventes').insert({
        livreur_id: livreurActif,
        boutique_id: ligne.boutique_id,
        client_nom: ligne.client,
        date_vente: date,
        montant_total: montant,
      }).select().single()

      if (vente) {
        const lignesInsert = produits
          .filter(p => parseInt(ligne.qtys[p.id] || '0') > 0)
          .map(p => ({
            vente_id: vente.id,
            produit_id: p.id,
            quantite: parseInt(ligne.qtys[p.id]),
            prix_unitaire: 0,
          }))
        if (lignesInsert.length > 0) {
          await supabase.from('vente_lignes').insert(lignesInsert)
        }
      }
    }

    setSaving(false)
    setSuccess(`${lignesValides.length} vente(s) enregistrée(s) !`)
    setTimeout(() => setSuccess(''), 3000)
    const defaultB = boutiques[0]?.id || ''
    setLignes([emptyLigne(defaultB, produits), emptyLigne(defaultB, produits), emptyLigne(defaultB, produits)])
  }

  const inputStyle: React.CSSProperties = {
    background: '#0D1117', border: '1px solid #1E2535', color: '#F1F5F9',
    fontSize: 13, padding: '7px 8px', outline: 'none', width: '100%',
    boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", borderRadius: 8,
  }

  if (loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8B95A8' }}>Chargement...</div>
      </main>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Saisie rapide des ventes</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>Indiquez la quantité dans chaque case produit — laissez vide si non vendu</p>
        </div>

        {success && (
          <div style={{ background: '#10B98122', border: '1px solid #10B98155', borderRadius: 12, padding: '14px 20px', color: '#10B981', marginBottom: 24, fontSize: 14 }}>
            ✓ {success}
          </div>
        )}

        {/* Livreur + date */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Livreur</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {livreurs.map(l => (
                  <button key={l.id} onClick={() => setLivreurActif(l.id)} style={{
                    padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    background: livreurActif === l.id ? '#F59E0B22' : '#0D1117',
                    border: `2px solid ${livreurActif === l.id ? '#F59E0B' : '#1E2535'}`,
                    color: livreurActif === l.id ? '#F59E0B' : '#8B95A8',
                  }}>{l.nom}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '8px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0A0F1A', borderBottom: '1px solid #1E2535' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 28 }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 130 }}>Client</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 160 }}>Boutique</th>
                  {produits.map(p => (
                    <th key={p.id} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 70 }}>{p.nom}</th>
                  ))}
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 90 }}>Total €</th>
                  <th style={{ minWidth: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, i) => {
                  const isValide = ligne.client.trim() && hasProducts(ligne) && parseFloat(ligne.prix) > 0
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1E253533', background: isValide ? '#10B98108' : 'transparent' }}>
                      <td style={{ padding: '6px 12px', color: '#4B5563', fontSize: 12 }}>{i + 1}</td>

                      {/* Client */}
                      <td style={{ padding: '4px 6px' }}>
                        <input value={ligne.client} onChange={e => updateField(i, 'client', e.target.value)}
                          placeholder="Nom client" style={inputStyle} />
                      </td>

                      {/* Boutique — boutons */}
                      <td style={{ padding: '4px 6px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {boutiques.map(b => {
                            const sel = ligne.boutique_id === b.id
                            return (
                              <button key={b.id} onClick={() => updateField(i, 'boutique_id', b.id)} style={{
                                padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: sel ? 700 : 400,
                                background: sel ? b.couleur + '33' : '#0D1117',
                                border: `2px solid ${sel ? b.couleur : '#1E2535'}`,
                                color: sel ? b.couleur : '#8B95A8',
                                whiteSpace: 'nowrap',
                              }}>{b.nom}</button>
                            )
                          })}
                        </div>
                      </td>

                      {/* Cases quantité par produit */}
                      {produits.map(p => {
                        const qty = ligne.qtys[p.id] || ''
                        const hasQty = parseInt(qty) > 0
                        return (
                          <td key={p.id} style={{ padding: '4px 4px', textAlign: 'center' }}>
                            <input
                              type="number" min="0" value={qty}
                              onChange={e => updateQty(i, p.id, e.target.value)}
                              placeholder="—"
                              style={{
                                width: 60, textAlign: 'center', background: hasQty ? '#6366F122' : '#0D1117',
                                border: `1px solid ${hasQty ? '#6366F155' : '#1E2535'}`,
                                color: hasQty ? '#818CF8' : '#4B5563',
                                fontSize: 14, fontWeight: hasQty ? 700 : 400,
                                padding: '7px 4px', outline: 'none', borderRadius: 8,
                                fontFamily: "'Syne', sans-serif",
                              }}
                            />
                          </td>
                        )
                      })}

                      {/* Prix total */}
                      <td style={{ padding: '4px 6px' }}>
                        <input type="number" min="0" step="0.01" value={ligne.prix}
                          onChange={e => updateField(i, 'prix', e.target.value)}
                          placeholder="0.00"
                          style={{
                            ...inputStyle, textAlign: 'right', width: 90,
                            fontFamily: "'Syne', sans-serif", fontWeight: 700,
                            color: parseFloat(ligne.prix) > 0 ? '#F59E0B' : '#4B5563',
                            border: `1px solid ${parseFloat(ligne.prix) > 0 ? '#F59E0B55' : '#1E2535'}`,
                          }} />
                      </td>

                      {/* Supprimer */}
                      <td style={{ padding: '4px 8px' }}>
                        <button onClick={() => removeLigne(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', fontSize: 14 }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid #1E2535' }}>
            <button onClick={addLigne}
              style={{ background: 'none', border: '1px dashed #374151', borderRadius: 8, padding: '7px 16px', color: '#8B95A8', cursor: 'pointer', fontSize: 13 }}>
              + Ajouter une ligne
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: '16px 24px' }}>
          <div>
            <span style={{ color: '#8B95A8', fontSize: 14 }}>{lignesValides.length} vente(s) — Total : </span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: '#F59E0B' }}>{total.toLocaleString()} €</span>
          </div>
          <button onClick={saveAll} disabled={saving || lignesValides.length === 0} style={{
            background: lignesValides.length > 0 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : '#1E2535',
            border: 'none', borderRadius: 12, padding: '12px 28px',
            color: lignesValides.length > 0 ? '#0D1117' : '#4B5563',
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16,
            cursor: lignesValides.length > 0 ? 'pointer' : 'not-allowed',
          }}>
            {saving ? 'Enregistrement...' : `✓ Enregistrer ${lignesValides.length > 0 ? `(${lignesValides.length})` : ''}`}
          </button>
        </div>
      </main>
    </div>
  )
}
