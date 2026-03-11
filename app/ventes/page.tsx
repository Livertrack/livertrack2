'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Livreur, Produit, Boutique } from '@/lib/types'

type LigneType = 'vente' | 'frais'
type Ligne = {
  type: LigneType
  client: string
  boutique_id: string
  qtys: Record<string, string>
  prix: string
}

function emptyVente(boutique_id: string, produits: Produit[]): Ligne {
  return { type: 'vente', client: '', boutique_id, qtys: Object.fromEntries(produits.map(p => [p.id, ''])), prix: '' }
}
function emptyFrais(boutique_id: string, produits: Produit[]): Ligne {
  return { type: 'frais', client: '', boutique_id, qtys: Object.fromEntries(produits.map(p => [p.id, ''])), prix: '' }
}

export default function JournalPage() {
  const supabase = createClient()
  const [livreurs, setLivreurs] = useState<Livreur[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [stocks, setStocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const [livreurActif, setLivreurActif] = useState<string>('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [lignes, setLignes] = useState<Ligne[]>([])

  async function loadStocks(livId: string, prods: Produit[], d: string) {
    const { data } = await supabase.from('stocks').select('*').eq('livreur_id', livId).eq('date_depart', d)
    setStocks(data || [])
  }

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
      const defaultL = l?.[0]?.id || ''
      const defaultB = b?.[0]?.id || ''
      setLivreurActif(defaultL)
      setLignes([emptyVente(defaultB, p || []), emptyVente(defaultB, p || []), emptyVente(defaultB, p || [])])
      if (defaultL) await loadStocks(defaultL, p || [], new Date().toISOString().split('T')[0])
      setLoading(false)
    }
    load()
  }, [])

  async function switchLivreur(id: string) {
    setLivreurActif(id)
    await loadStocks(id, produits, date)
  }

  function getStock(produitId: string) {
    return stocks.find(s => s.produit_id === produitId)?.quantite_actuelle ?? null
  }

  function updateField(index: number, field: 'client' | 'boutique_id' | 'prix', value: string) {
    setLignes(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function updateQty(lineIndex: number, produitId: string, value: string) {
    setLignes(prev => prev.map((l, i) => i !== lineIndex ? l : { ...l, qtys: { ...l.qtys, [produitId]: value } }))
  }

  function addLigne(type: LigneType) {
    const defaultB = boutiques[0]?.id || ''
    setLignes(prev => [...prev, type === 'vente' ? emptyVente(defaultB, produits) : emptyFrais(defaultB, produits)])
  }

  function removeLigne(index: number) {
    setLignes(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }

  function hasProducts(ligne: Ligne) {
    return Object.values(ligne.qtys).some(q => parseInt(q) > 0)
  }

  function isLigneValide(l: Ligne) {
    if (l.type === 'frais') return parseFloat(l.prix) > 0
    return l.client.trim() && hasProducts(l) && parseFloat(l.prix) > 0
  }

  const lignesValides = lignes.filter(isLigneValide)
  const totalVentes = lignes.filter(l => l.type === 'vente' && isLigneValide(l)).reduce((s, l) => s + parseFloat(l.prix), 0)
  const totalFrais = lignes.filter(l => l.type === 'frais' && isLigneValide(l)).reduce((s, l) => s + parseFloat(l.prix), 0)

  async function saveAll() {
    if (!livreurActif || lignesValides.length === 0) return
    setSaving(true)

    for (const ligne of lignesValides) {
      if (ligne.type === 'frais') {
        await supabase.from('frais').insert({
          livreur_id: livreurActif,
          description: ligne.client.trim() || 'Frais',
          montant: parseFloat(ligne.prix),
          date_frais: date,
        })
      } else {
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
            .map(p => ({ vente_id: vente.id, produit_id: p.id, quantite: parseInt(ligne.qtys[p.id]), prix_unitaire: 0 }))
          if (lignesInsert.length > 0) await supabase.from('vente_lignes').insert(lignesInsert)

          // Mettre à jour les stocks en temps réel
          for (const p of produits) {
            const qty = parseInt(ligne.qtys[p.id] || '0') || 0
            if (qty === 0) continue
            const stock = stocks.find(s => s.produit_id === p.id)
            if (stock) {
              const newQty = Math.max(0, stock.quantite_actuelle - qty)
              await supabase.from('stocks').update({ quantite_actuelle: newQty }).eq('id', stock.id)
              setStocks(prev => prev.map(s => s.id === stock.id ? { ...s, quantite_actuelle: newQty } : s))
            }
          }
        }
      }
    }

    setSaving(false)
    setSuccess(`${lignesValides.length} entrée(s) enregistrée(s) !`)
    setTimeout(() => setSuccess(''), 3000)
    const defaultB = boutiques[0]?.id || ''
    setLignes([emptyVente(defaultB, produits), emptyVente(defaultB, produits), emptyVente(defaultB, produits)])
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
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Journal du jour</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {success && (
          <div style={{ background: '#10B98122', border: '1px solid #10B98155', borderRadius: 12, padding: '14px 20px', color: '#10B981', marginBottom: 20, fontSize: 14 }}>
            ✓ {success}
          </div>
        )}

        {/* Livreur + date */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Livreur</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {livreurs.map(l => (
                  <button key={l.id} onClick={() => switchLivreur(l.id)} style={{
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

        {/* BARRE STOCK EN DIRECT */}
        <div style={{ background: '#161B27', border: '1px solid #6366F133', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginRight: 4 }}>📦 Stock en direct</span>
          {produits.map(p => {
            const qty = getStock(p.id)
            const color = qty === null ? '#4B5563' : qty > 5 ? '#10B981' : qty > 0 ? '#F59E0B' : '#EF4444'
            return (
              <div key={p.id} style={{ background: '#0D1117', border: `1px solid ${color}44`, borderRadius: 8, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8B95A8' }}>{p.nom}</span>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color }}>{qty === null ? '—' : qty}</span>
              </div>
            )
          })}
        </div>

        {/* Tableau */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0A0F1A', borderBottom: '1px solid #1E2535' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', fontWeight: 600, minWidth: 28 }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', fontWeight: 600, minWidth: 80 }}>Type</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', fontWeight: 600, minWidth: 130 }}>Libellé</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', fontWeight: 600, minWidth: 160 }}>Boutique</th>
                  {produits.map(p => (
                    <th key={p.id} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: '#6366F1', textTransform: 'uppercase', fontWeight: 600, minWidth: 70 }}>{p.nom}</th>
                  ))}
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: '#F59E0B', textTransform: 'uppercase', fontWeight: 600, minWidth: 90 }}>Total €</th>
                  <th style={{ minWidth: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, i) => {
                  const isFrais = ligne.type === 'frais'
                  const isValide = isLigneValide(ligne)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1E253533', background: isFrais ? '#EF444408' : isValide ? '#10B98108' : 'transparent' }}>
                      <td style={{ padding: '6px 12px', color: '#4B5563', fontSize: 12 }}>{i + 1}</td>

                      {/* Badge type */}
                      <td style={{ padding: '4px 6px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                          background: isFrais ? '#EF444422' : '#10B98122',
                          color: isFrais ? '#EF4444' : '#10B981',
                          border: `1px solid ${isFrais ? '#EF444444' : '#10B98144'}`,
                        }}>{isFrais ? 'Frais' : 'Vente'}</span>
                      </td>

                      <td style={{ padding: '4px 6px' }}>
                        <input value={ligne.client} onChange={e => updateField(i, 'client', e.target.value)}
                          placeholder={isFrais ? "Ex: Essence, Péage..." : "Nom client"}
                          style={inputStyle} />
                      </td>

                      {/* Boutique (masquée pour frais) */}
                      <td style={{ padding: '4px 6px' }}>
                        {!isFrais && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {boutiques.map(b => {
                              const sel = ligne.boutique_id === b.id
                              return (
                                <button key={b.id} onClick={() => updateField(i, 'boutique_id', b.id)} style={{
                                  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: sel ? 700 : 400,
                                  background: sel ? b.couleur + '33' : '#0D1117',
                                  border: `2px solid ${sel ? b.couleur : '#1E2535'}`,
                                  color: sel ? b.couleur : '#8B95A8', whiteSpace: 'nowrap',
                                }}>{b.nom}</button>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* Cases quantité (masquées pour frais) */}
                      {produits.map(p => {
                        const qty = ligne.qtys[p.id] || ''
                        const hasQty = parseInt(qty) > 0
                        return (
                          <td key={p.id} style={{ padding: '4px 4px', textAlign: 'center' }}>
                            {!isFrais && (
                              <input type="number" min="0" value={qty}
                                onChange={e => updateQty(i, p.id, e.target.value)}
                                placeholder="—"
                                style={{
                                  width: 60, textAlign: 'center',
                                  background: hasQty ? '#6366F122' : '#0D1117',
                                  border: `1px solid ${hasQty ? '#6366F155' : '#1E2535'}`,
                                  color: hasQty ? '#818CF8' : '#4B5563',
                                  fontSize: 14, fontWeight: hasQty ? 700 : 400,
                                  padding: '7px 4px', outline: 'none', borderRadius: 8,
                                  fontFamily: "'Syne', sans-serif",
                                }} />
                            )}
                          </td>
                        )
                      })}

                      {/* Prix */}
                      <td style={{ padding: '4px 6px' }}>
                        <input type="number" min="0" step="0.01" value={ligne.prix}
                          onChange={e => updateField(i, 'prix', e.target.value)}
                          placeholder="0.00"
                          style={{
                            ...inputStyle, textAlign: 'right', width: 90,
                            fontFamily: "'Syne', sans-serif", fontWeight: 700,
                            color: parseFloat(ligne.prix) > 0 ? (isFrais ? '#EF4444' : '#F59E0B') : '#4B5563',
                            border: `1px solid ${parseFloat(ligne.prix) > 0 ? (isFrais ? '#EF444455' : '#F59E0B55') : '#1E2535'}`,
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

          {/* Boutons ajouter */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1E2535', display: 'flex', gap: 10 }}>
            <button onClick={() => addLigne('vente')}
              style={{ background: '#10B98111', border: '1px solid #10B98133', borderRadius: 8, padding: '7px 16px', color: '#10B981', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              + Vente
            </button>
            <button onClick={() => addLigne('frais')}
              style={{ background: '#EF444411', border: '1px solid #EF444433', borderRadius: 8, padding: '7px 16px', color: '#EF4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              − Frais
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <span style={{ color: '#8B95A8', fontSize: 12 }}>Ventes</span>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#10B981' }}>+{totalVentes.toLocaleString()} €</div>
            </div>
            {totalFrais > 0 && (
              <div>
                <span style={{ color: '#8B95A8', fontSize: 12 }}>Frais</span>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#EF4444' }}>−{totalFrais.toLocaleString()} €</div>
              </div>
            )}
            <div>
              <span style={{ color: '#8B95A8', fontSize: 12 }}>Net</span>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#F59E0B' }}>{(totalVentes - totalFrais).toLocaleString()} €</div>
            </div>

            {/* Séparateur */}
            <div style={{ width: 1, background: '#1E2535', alignSelf: 'stretch' }} />

            {/* Total par boutique */}
            {boutiques.map(b => {
              const totalB = lignes
                .filter(l => l.type === 'vente' && isLigneValide(l) && l.boutique_id === b.id)
                .reduce((s, l) => s + parseFloat(l.prix), 0)
              if (totalB === 0) return null
              return (
                <div key={b.id}>
                  <span style={{ fontSize: 12, color: b.couleur }}>{b.nom}</span>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: b.couleur }}>{totalB.toLocaleString()} €</div>
                </div>
              )
            })}
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
