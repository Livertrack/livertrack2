'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Livreur, Produit, Boutique, Stock } from '@/lib/types'

export default function VentesPage() {
  const supabase = createClient()
  const [livreurs, setLivreurs] = useState<Livreur[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [livreurActif, setLivreurActif] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [formDate, setFormDate] = useState(today)
  const [formClient, setFormClient] = useState('')
  const [formBoutique, setFormBoutique] = useState('')
  const [formQtys, setFormQtys] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: p }, { data: b }, { data: s }] = await Promise.all([
        supabase.from('livreurs').select('*').eq('actif', true).order('nom'),
        supabase.from('produits').select('*').eq('actif', true).order('nom'),
        supabase.from('boutiques').select('*').eq('actif', true),
        supabase.from('stocks').select('*, produit:produits(*)').eq('date_depart', today),
      ])
      setLivreurs(l || [])
      setProduits(p || [])
      setBoutiques(b || [])
      setStocks(s || [])
      if (b && b.length > 0) setFormBoutique(b[0].id)
      if (p) setFormQtys(Object.fromEntries(p.map(pr => [pr.id, ''])))
      setLoading(false)
    }
    load()
  }, [])

  function stockLivreur(livreurId: string, produitId: string) {
    return stocks.find(s => s.livreur_id === livreurId && s.produit_id === produitId)?.quantite_actuelle || 0
  }

  function montantTotal() {
    return produits.reduce((s, p) => s + (parseInt(formQtys[p.id] || '0') || 0) * p.prix_unitaire, 0)
  }

  function openModal(livreurId: string) {
    setLivreurActif(livreurId)
    setFormClient('')
    setFormQtys(Object.fromEntries(produits.map(p => [p.id, ''])))
    setShowModal(true)
  }

  async function submitVente() {
    if (!livreurActif || !formClient || !formBoutique) return
    const total = montantTotal()
    if (total === 0) return
    setSaving(true)

    const { data: vente, error: venteErr } = await supabase.from('ventes').insert({
      livreur_id: livreurActif,
      boutique_id: formBoutique,
      client_nom: formClient,
      date_vente: formDate,
      montant_total: total,
    }).select().single()

    if (venteErr || !vente) { setSaving(false); return }

    const lignes = produits
      .filter(p => parseInt(formQtys[p.id] || '0') > 0)
      .map(p => ({ vente_id: vente.id, produit_id: p.id, quantite: parseInt(formQtys[p.id]), prix_unitaire: p.prix_unitaire }))

    await supabase.from('vente_lignes').insert(lignes)

    // Mettre à jour les stocks
    for (const p of produits) {
      const qty = parseInt(formQtys[p.id] || '0') || 0
      if (qty === 0) continue
      const stock = stocks.find(s => s.livreur_id === livreurActif && s.produit_id === p.id)
      if (stock) {
        const newQty = Math.max(0, stock.quantite_actuelle - qty)
        await supabase.from('stocks').update({ quantite_actuelle: newQty, updated_at: new Date().toISOString() }).eq('id', stock.id)
        setStocks(prev => prev.map(s => s.id === stock.id ? { ...s, quantite_actuelle: newQty } : s))
      }
    }

    setSaving(false)
    setSuccess(true)
    setShowModal(false)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Saisie des ventes</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>Sélectionnez un livreur pour enregistrer une vente</p>
        </div>

        {success && (
          <div style={{ background: '#10B98122', border: '1px solid #10B98155', borderRadius: 12, padding: '14px 20px', color: '#10B981', marginBottom: 24, fontSize: 14 }}>
            ✓ Vente enregistrée avec succès !
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          {livreurs.map(l => (
            <button key={l.id} onClick={() => openModal(l.id)} style={{
              background: '#161B27', border: '2px solid #1E2535', borderRadius: 16,
              padding: '20px 16px', cursor: 'pointer', color: '#F1F5F9', textAlign: 'left',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#F59E0B')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E2535')}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1E2535', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#F59E0B', marginBottom: 12 }}>
                {l.nom.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15 }}>{l.nom}</div>
              <div style={{ color: '#8B95A8', fontSize: 12, marginTop: 4 }}>{l.telephone}</div>
              <div style={{ marginTop: 10, color: '#F59E0B', fontWeight: 700, fontSize: 13 }}>+ Nouvelle vente</div>
            </button>
          ))}
        </div>

        {/* Modal vente */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: '#000000CC', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 20, padding: 32, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, margin: 0, fontSize: 20 }}>Nouvelle vente</h2>
                  <div style={{ color: '#F59E0B', fontSize: 13, marginTop: 4 }}>{livreurs.find(l => l.id === livreurActif)?.nom}</div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B95A8', fontSize: 20 }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[{ label: 'Date', el: <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ width: '100%', background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '10px 14px', color: '#F1F5F9', fontSize: 14, boxSizing: 'border-box' as const }} /> },
                  { label: 'Client / Boutique client', el: <input type="text" value={formClient} onChange={e => setFormClient(e.target.value)} placeholder="Nom client + boutique" style={{ width: '100%', background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '10px 14px', color: '#F1F5F9', fontSize: 14, boxSizing: 'border-box' as const }} /> }
                ].map(({ label, el }) => (
                  <div key={label}>
                    <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
                    {el}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Boutique vendeuse</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {boutiques.map(b => (
                    <button key={b.id} onClick={() => setFormBoutique(b.id)} style={{
                      flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                      background: formBoutique === b.id ? b.couleur + '22' : '#0D1117',
                      border: `2px solid ${formBoutique === b.id ? b.couleur : '#1E2535'}`,
                      color: formBoutique === b.id ? b.couleur : '#8B95A8',
                      fontSize: 12, fontWeight: formBoutique === b.id ? 700 : 400,
                    }}>{b.nom.replace('Boutique ', '')}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quantités vendues</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {produits.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', background: '#0D1117', borderRadius: 10, border: '1px solid #1E2535', overflow: 'hidden' }}>
                      <div style={{ flex: 1, padding: '0 12px', borderRight: '1px solid #1E2535' }}>
                        <div style={{ fontSize: 11, color: '#CBD5E1' }}>{p.nom}</div>
                        <div style={{ color: '#4B5563', fontSize: 10 }}>stock: {stockLivreur(livreurActif!, p.id)} | {p.prix_unitaire} DA</div>
                      </div>
                      <input type="number" min="0" value={formQtys[p.id] || ''} onChange={e => setFormQtys(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="0" style={{ width: 60, background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: 16, fontWeight: 700, padding: 12, textAlign: 'center', outline: 'none', fontFamily: "'Syne', sans-serif" }} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#F59E0B11', border: '1px solid #F59E0B33', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#8B95A8', fontSize: 14 }}>Montant total</span>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: '#F59E0B' }}>{montantTotal().toLocaleString()} DA</span>
              </div>

              <button onClick={submitVente} disabled={saving} style={{ width: '100%', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', borderRadius: 12, padding: 14, color: '#0D1117', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
                {saving ? 'Enregistrement...' : '✓ Enregistrer la vente'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
