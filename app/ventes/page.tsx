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
  const [ventesEnregistrees, setVentesEnregistrees] = useState<any[]>([])
  const [fraisEnregistres, setFraisEnregistres] = useState<any[]>([])

  // Section stock pliable
  const [stockOpen, setStockOpen] = useState(false)
  const [stockAjust, setStockAjust] = useState<Record<string, string>>({})
  const [savingStock, setSavingStock] = useState(false)
  const [stockMode, setStockMode] = useState<'initial' | 'ajust'>('initial')
  const [journalStock, setJournalStock] = useState<any[]>([])

  async function loadStocks(livId: string, d: string) {
    const { data } = await supabase.from('stocks').select('*').eq('livreur_id', livId).eq('date_depart', d)
    setStocks(data || [])
  }

  async function loadJournalStock(livId: string) {
    const { data } = await supabase.from('stocks_journal')
      .select('*, produit:produits(nom)')
      .eq('livreur_id', livId)
      .order('created_at', { ascending: false })
      .limit(50)
    setJournalStock(data || [])
  }

  async function loadVentesJour(livId: string, d: string) {
    const [{ data: v }, { data: f }] = await Promise.all([
      supabase.from('ventes').select('*, boutique:boutiques(*), vente_lignes(quantite, produit:produits(nom))').eq('livreur_id', livId).eq('date_vente', d).order('created_at', { ascending: false }),
      supabase.from('frais').select('*').eq('livreur_id', livId).eq('date_frais', d).order('created_at', { ascending: false }),
    ])
    setVentesEnregistrees(v || [])
    setFraisEnregistres(f || [])
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
      const today = new Date().toISOString().split('T')[0]
      setLivreurActif(defaultL)
      setLignes([emptyVente(defaultB, p || []), emptyVente(defaultB, p || []), emptyVente(defaultB, p || [])])
      setStockAjust(Object.fromEntries((p || []).map(pr => [pr.id, ''])))
      if (defaultL) {
        await loadStocks(defaultL, today)
        await loadVentesJour(defaultL, today)
        await loadJournalStock(defaultL)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function switchLivreur(id: string) {
    setLivreurActif(id)
    setStockAjust(Object.fromEntries(produits.map(p => [p.id, ''])))
    await Promise.all([loadStocks(id, date), loadVentesJour(id, date), loadJournalStock(id)])
  }

  function getStock(produitId: string) {
    return stocks.find(s => s.produit_id === produitId)
  }

  // Sauvegarder stock initial OU ajustement
  async function saveStock() {
    if (!livreurActif) return
    setSavingStock(true)
    for (const p of produits) {
      const val = parseInt(stockAjust[p.id] || '0') || 0
      if (val === 0 && stockMode === 'ajust') continue
      const existing = getStock(p.id)
      if (stockMode === 'initial') {
        if (existing) {
          await supabase.from('stocks').update({ quantite_depart: val, quantite_actuelle: val }).eq('id', existing.id)
        } else {
          await supabase.from('stocks').insert({ livreur_id: livreurActif, produit_id: p.id, quantite_depart: val, quantite_actuelle: val, date_depart: date })
        }
      } else {
        if (existing) {
          const newQty = Math.max(0, existing.quantite_actuelle + val)
          const newDepart = Math.max(0, existing.quantite_depart + val)
          await supabase.from('stocks').update({ quantite_actuelle: newQty, quantite_depart: newDepart }).eq('id', existing.id)
        } else if (val > 0) {
          await supabase.from('stocks').insert({ livreur_id: livreurActif, produit_id: p.id, quantite_depart: val, quantite_actuelle: val, date_depart: date })
        }
      }
    }
    // Enregistrer dans le journal du stock
    for (const p of produits) {
      const val = parseInt(stockAjust[p.id] || '0') || 0
      if (val === 0 && stockMode === 'ajust') continue
      if (val === 0 && stockMode === 'initial') continue
      await supabase.from('stocks_journal').insert({
        livreur_id: livreurActif,
        produit_id: p.id,
        quantite: val,
        type: stockMode,
        date_mouvement: date,
      })
    }
    await loadStocks(livreurActif, date)
    await loadJournalStock(livreurActif)
    setStockAjust(Object.fromEntries(produits.map(p => [p.id, ''])))
    setSavingStock(false)
    setStockOpen(false)
    setSuccess(stockMode === 'initial' ? 'Stock initial défini !' : 'Stock ajusté !')
    setTimeout(() => setSuccess(''), 2500)
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
        await supabase.from('frais').insert({ livreur_id: livreurActif, description: ligne.client.trim() || 'Frais', montant: parseFloat(ligne.prix), date_frais: date })
      } else {
        const montant = parseFloat(ligne.prix)
        const { data: vente } = await supabase.from('ventes').insert({ livreur_id: livreurActif, boutique_id: ligne.boutique_id, client_nom: ligne.client, date_vente: date, montant_total: montant }).select().single()
        if (vente) {
          const lignesInsert = produits.filter(p => parseInt(ligne.qtys[p.id] || '0') > 0).map(p => ({ vente_id: vente.id, produit_id: p.id, quantite: parseInt(ligne.qtys[p.id]), prix_unitaire: 0 }))
          if (lignesInsert.length > 0) await supabase.from('vente_lignes').insert(lignesInsert)
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
    await loadVentesJour(livreurActif, date)
    setSaving(false)
    setSuccess(`${lignesValides.length} entrée(s) enregistrée(s) !`)
    setTimeout(() => setSuccess(''), 3000)
    const defaultB = boutiques[0]?.id || ''
    setLignes([emptyVente(defaultB, produits), emptyVente(defaultB, produits), emptyVente(defaultB, produits)])
  }

  const inputStyle: React.CSSProperties = { background: '#0D1117', border: '1px solid #1E2535', color: '#F1F5F9', fontSize: 13, padding: '7px 8px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", borderRadius: 8 }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Journal du jour</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {success && <div style={{ background: '#10B98122', border: '1px solid #10B98155', borderRadius: 12, padding: '14px 20px', color: '#10B981', marginBottom: 20, fontSize: 14 }}>✓ {success}</div>}

        {/* Livreur + date */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Livreur</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {livreurs.map(l => (
                  <button key={l.id} onClick={() => switchLivreur(l.id)} style={{ padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: livreurActif === l.id ? '#F59E0B22' : '#0D1117', border: `2px solid ${livreurActif === l.id ? '#F59E0B' : '#1E2535'}`, color: livreurActif === l.id ? '#F59E0B' : '#8B95A8' }}>{l.nom}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '8px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* ── SECTION STOCK PLIABLE ── */}
        <div style={{ background: '#161B27', border: `1px solid ${stockOpen ? '#6366F155' : '#1E2535'}`, borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
          {/* Header cliquable */}
          <button onClick={() => setStockOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6366F1', fontFamily: "'Syne', sans-serif" }}>📦 Stock en direct</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {produits.map(p => {
                  const s = getStock(p.id)
                  const qty = s?.quantite_actuelle ?? null
                  const color = qty === null ? '#4B5563' : qty > 5 ? '#10B981' : qty > 0 ? '#F59E0B' : '#EF4444'
                  return (
                    <div key={p.id} style={{ background: '#0D1117', border: `1px solid ${color}44`, borderRadius: 8, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, color: '#8B95A8' }}>{p.nom}</span>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color }}>{qty === null ? '—' : qty}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <span style={{ color: '#6366F1', fontSize: 16 }}>{stockOpen ? '▲' : '▼'}</span>
          </button>

          {/* Contenu déplié */}
          {stockOpen && (
            <div style={{ borderTop: '1px solid #1E2535', padding: '20px' }}>
              {/* Onglets initial / ajustement */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button onClick={() => setStockMode('initial')} style={{ padding: '7px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: stockMode === 'initial' ? '#F59E0B22' : '#0D1117', border: `2px solid ${stockMode === 'initial' ? '#F59E0B' : '#1E2535'}`, color: stockMode === 'initial' ? '#F59E0B' : '#8B95A8' }}>
                  Définir stock initial
                </button>
                <button onClick={() => setStockMode('ajust')} style={{ padding: '7px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: stockMode === 'ajust' ? '#6366F122' : '#0D1117', border: `2px solid ${stockMode === 'ajust' ? '#6366F1' : '#1E2535'}`, color: stockMode === 'ajust' ? '#6366F1' : '#8B95A8' }}>
                  ± Réajuster
                </button>
              </div>

              <p style={{ fontSize: 12, color: '#4B5563', marginBottom: 16 }}>
                {stockMode === 'initial' ? 'Définissez les quantités de départ pour ce livreur aujourd\'hui.' : 'Entrez un nombre positif (+) pour réappro ou négatif (−) pour une perte.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
                {produits.map(p => {
                  const s = getStock(p.id)
                  const val = stockAjust[p.id] || ''
                  const delta = parseInt(val) || 0
                  const color = stockMode === 'ajust' ? (delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : '#4B5563') : '#F59E0B'
                  return (
                    <div key={p.id} style={{ background: '#0D1117', borderRadius: 12, padding: '12px 14px', border: `1px solid ${val !== '' ? color + '55' : '#1E2535'}` }}>
                      <div style={{ fontSize: 11, color: '#8B95A8', marginBottom: 4 }}>{p.nom}</div>
                      {stockMode === 'initial' && s && (
                        <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 6 }}>actuel : {s.quantite_actuelle}</div>
                      )}
                      {stockMode === 'ajust' && s && val !== '' && delta !== 0 && (
                        <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 6 }}>{s.quantite_actuelle} → <span style={{ color }}>{Math.max(0, s.quantite_actuelle + delta)}</span></div>
                      )}
                      <input type="number" value={val} onChange={e => setStockAjust(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={stockMode === 'ajust' ? "+5 ou -3" : "0"}
                        style={{ width: '100%', textAlign: 'center', background: '#0D1117', border: `1px solid ${val !== '' && val !== '0' ? color + '66' : '#1E2535'}`, borderRadius: 8, color, fontSize: 18, fontWeight: 700, outline: 'none', fontFamily: "'Syne', sans-serif", padding: '8px 4px', boxSizing: 'border-box' as const }} />
                    </div>
                  )
                })}
              </div>

              <button onClick={saveStock} disabled={savingStock} style={{ background: stockMode === 'initial' ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'linear-gradient(135deg, #6366F1, #10B981)', border: 'none', borderRadius: 12, padding: '11px 24px', color: '#fff', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                {savingStock ? 'Sauvegarde...' : stockMode === 'initial' ? '✓ Valider stock initial' : '✓ Appliquer réajustement'}
              </button>

              {/* Journal des mouvements */}
              {journalStock.length > 0 && (
                <div style={{ marginTop: 24, borderTop: '1px solid #1E2535', paddingTop: 18 }}>
                  <div style={{ fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Journal des mouvements</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1E2535' }}>
                        {['Date', 'Heure', 'Type', 'Produit', 'Qté'].map(h => (
                          <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: '#4B5563', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {journalStock
                        .filter(m => m.livreur_id === livreurActif)
                        .map((m, i) => {
                          const isInitial = m.type === 'initial'
                          const isPositif = m.quantite > 0
                          const color = isInitial ? '#F59E0B' : isPositif ? '#10B981' : '#EF4444'
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #1E253522' }}>
                              <td style={{ padding: '7px 10px', color: '#4B5563', whiteSpace: 'nowrap' }}>{new Date(m.date_mouvement).toLocaleDateString('fr-FR')}</td>
                              <td style={{ padding: '7px 10px', color: '#4B5563', whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{ padding: '7px 10px' }}>
                                <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                                  {isInitial ? 'Initial' : isPositif ? '▲ Réappro' : '▼ Perte'}
                                </span>
                              </td>
                              <td style={{ padding: '7px 10px', color: '#CBD5E1' }}>{m.produit?.nom}</td>
                              <td style={{ padding: '7px 10px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color }}>
                                {isInitial ? m.quantite : (isPositif ? '+' : '') + m.quantite}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RÉCAP DES VENTES DÉJÀ ENREGISTRÉES */}
        {(ventesEnregistrees.length > 0 || fraisEnregistres.length > 0) && (
          <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', fontFamily: "'Syne', sans-serif" }}>✓ Déjà enregistré — {livreurs.find(l => l.id === livreurActif)?.nom}</span>
              <span style={{ fontSize: 12, color: '#8B95A8' }}>{ventesEnregistrees.length} vente(s) · {fraisEnregistres.length} frais</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E2535' }}>
                    {['Heure', 'Type', 'Libellé', 'Boutique', 'Produits', 'Montant'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#8B95A8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventesEnregistrees.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1E253522' }}>
                      <td style={{ padding: '7px 10px', color: '#4B5563', whiteSpace: 'nowrap' }}>{new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '7px 10px' }}><span style={{ background: '#10B98122', color: '#10B981', border: '1px solid #10B98133', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>Vente</span></td>
                      <td style={{ padding: '7px 10px', color: '#CBD5E1' }}>{v.client_nom}</td>
                      <td style={{ padding: '7px 10px' }}><span style={{ background: (v.boutique as any)?.couleur + '22', color: (v.boutique as any)?.couleur, border: `1px solid ${(v.boutique as any)?.couleur}33`, borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{(v.boutique as any)?.nom}</span></td>
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(v.vente_lignes || []).map((vl: any, idx: number) => (
                            <span key={idx} style={{ background: '#6366F122', color: '#818CF8', border: '1px solid #6366F133', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{vl.quantite}× {vl.produit?.nom}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '7px 10px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#F59E0B', whiteSpace: 'nowrap' }}>{v.montant_total.toLocaleString()} €</td>
                    </tr>
                  ))}
                  {fraisEnregistres.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #1E253522' }}>
                      <td style={{ padding: '7px 10px', color: '#4B5563', whiteSpace: 'nowrap' }}>{new Date(f.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '7px 10px' }}><span style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444433', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>Frais</span></td>
                      <td style={{ padding: '7px 10px', color: '#CBD5E1' }}>{f.description}</td>
                      <td style={{ padding: '7px 10px', color: '#4B5563' }}>—</td>
                      <td style={{ padding: '7px 10px', color: '#4B5563' }}>—</td>
                      <td style={{ padding: '7px 10px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#EF4444', whiteSpace: 'nowrap' }}>−{f.montant.toLocaleString()} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #1E2535', background: '#0A0F1A' }}>
                    <td colSpan={5} style={{ padding: '8px 10px', color: '#8B95A8', fontSize: 11 }}>TOTAL NET</td>
                    <td style={{ padding: '8px 10px', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: '#F59E0B' }}>
                      {(ventesEnregistrees.reduce((s, v) => s + v.montant_total, 0) - fraisEnregistres.reduce((s, f) => s + f.montant, 0)).toLocaleString()} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Tableau saisie */}
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
                      <td style={{ padding: '4px 6px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: isFrais ? '#EF444422' : '#10B98122', color: isFrais ? '#EF4444' : '#10B981', border: `1px solid ${isFrais ? '#EF444444' : '#10B98144'}` }}>
                          {isFrais ? 'Frais' : 'Vente'}
                        </span>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input value={ligne.client} onChange={e => updateField(i, 'client', e.target.value)}
                          placeholder={isFrais ? "Ex: Essence, Péage..." : "Nom client"} style={inputStyle} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        {!isFrais && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {boutiques.map(b => {
                              const sel = ligne.boutique_id === b.id
                              return <button key={b.id} onClick={() => updateField(i, 'boutique_id', b.id)} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: sel ? 700 : 400, background: sel ? b.couleur + '33' : '#0D1117', border: `2px solid ${sel ? b.couleur : '#1E2535'}`, color: sel ? b.couleur : '#8B95A8', whiteSpace: 'nowrap' }}>{b.nom}</button>
                            })}
                          </div>
                        )}
                      </td>
                      {produits.map(p => {
                        const qty = ligne.qtys[p.id] || ''
                        const hasQty = parseInt(qty) > 0
                        return (
                          <td key={p.id} style={{ padding: '4px 4px', textAlign: 'center' }}>
                            {!isFrais && (
                              <input type="number" min="0" value={qty} onChange={e => updateQty(i, p.id, e.target.value)} placeholder="—"
                                style={{ width: 60, textAlign: 'center', background: hasQty ? '#6366F122' : '#0D1117', border: `1px solid ${hasQty ? '#6366F155' : '#1E2535'}`, color: hasQty ? '#818CF8' : '#4B5563', fontSize: 14, fontWeight: hasQty ? 700 : 400, padding: '7px 4px', outline: 'none', borderRadius: 8, fontFamily: "'Syne', sans-serif" }} />
                            )}
                          </td>
                        )
                      })}
                      <td style={{ padding: '4px 6px' }}>
                        <input type="number" min="0" step="0.01" value={ligne.prix} onChange={e => updateField(i, 'prix', e.target.value)} placeholder="0.00"
                          style={{ ...inputStyle, textAlign: 'right', width: 90, fontFamily: "'Syne', sans-serif", fontWeight: 700, color: parseFloat(ligne.prix) > 0 ? (isFrais ? '#EF4444' : '#F59E0B') : '#4B5563', border: `1px solid ${parseFloat(ligne.prix) > 0 ? (isFrais ? '#EF444455' : '#F59E0B55') : '#1E2535'}` }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <button onClick={() => removeLigne(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', fontSize: 14 }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1E2535', display: 'flex', gap: 10 }}>
            <button onClick={() => addLigne('vente')} style={{ background: '#10B98111', border: '1px solid #10B98133', borderRadius: 8, padding: '7px 16px', color: '#10B981', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Vente</button>
            <button onClick={() => addLigne('frais')} style={{ background: '#EF444411', border: '1px solid #EF444433', borderRadius: 8, padding: '7px 16px', color: '#EF4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>− Frais</button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <span style={{ color: '#8B95A8', fontSize: 12 }}>Ventes</span>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#10B981' }}>+{totalVentes.toLocaleString()} €</div>
            </div>
            {totalFrais > 0 && <div><span style={{ color: '#8B95A8', fontSize: 12 }}>Frais</span><div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#EF4444' }}>−{totalFrais.toLocaleString()} €</div></div>}
            <div><span style={{ color: '#8B95A8', fontSize: 12 }}>Net</span><div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#F59E0B' }}>{(totalVentes - totalFrais).toLocaleString()} €</div></div>
            <div style={{ width: 1, background: '#1E2535', alignSelf: 'stretch' }} />
            {boutiques.map(b => {
              const totalB = lignes.filter(l => l.type === 'vente' && isLigneValide(l) && l.boutique_id === b.id).reduce((s, l) => s + parseFloat(l.prix), 0)
              if (totalB === 0) return null
              return <div key={b.id}><span style={{ fontSize: 12, color: b.couleur }}>{b.nom}</span><div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: b.couleur }}>{totalB.toLocaleString()} €</div></div>
            })}
          </div>
          <button onClick={saveAll} disabled={saving || lignesValides.length === 0} style={{ background: lignesValides.length > 0 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : '#1E2535', border: 'none', borderRadius: 12, padding: '12px 28px', color: lignesValides.length > 0 ? '#0D1117' : '#4B5563', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, cursor: lignesValides.length > 0 ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Enregistrement...' : `✓ Enregistrer ${lignesValides.length > 0 ? `(${lignesValides.length})` : ''}`}
          </button>
        </div>
      </main>
    </div>
  )
}
