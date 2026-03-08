  'use client'
export const dynamic = 'force-dynamic'
  import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Livreur, Produit, Stock } from '@/lib/types'

export default function StocksPage() {
  const supabase = createClient()
  const [livreurs, setLivreurs] = useState<Livreur[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedLivreur, setSelectedLivreur] = useState<string | null>(null)
  const [stockForm, setStockForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  async function loadStocks() {
    const { data } = await supabase.from('stocks').select('*, produit:produits(*)').eq('date_depart', today)
    setStocks(data || [])
  }

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from('livreurs').select('*').eq('actif', true).order('nom'),
        supabase.from('produits').select('*').eq('actif', true).order('nom'),
      ])
      setLivreurs(l || [])
      setProduits(p || [])
      await loadStocks()
      setLoading(false)
    }
    load()
  }, [])

  function getStock(livreurId: string, produitId: string) {
    return stocks.find(s => s.livreur_id === livreurId && s.produit_id === produitId)
  }

  function openStockModal(livreurId: string) {
    setSelectedLivreur(livreurId)
    const form: Record<string, string> = {}
    produits.forEach(p => {
      const s = getStock(livreurId, p.id)
      form[p.id] = s ? String(s.quantite_depart) : '0'
    })
    setStockForm(form)
    setShowModal(true)
  }

  async function saveStock() {
    if (!selectedLivreur) return
    setSaving(true)
    for (const p of produits) {
      const qty = parseInt(stockForm[p.id] || '0') || 0
      const existing = getStock(selectedLivreur, p.id)
      if (existing) {
        await supabase.from('stocks').update({ quantite_depart: qty, quantite_actuelle: qty, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('stocks').insert({ livreur_id: selectedLivreur, produit_id: p.id, quantite_depart: qty, quantite_actuelle: qty, date_depart: today })
      }
    }
    await loadStocks()
    setSaving(false)
    setShowModal(false)
  }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Gestion des stocks</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>Stock actuel et stock de départ — {new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        {livreurs.map(l => (
          <div key={l.id} style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1E2535', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>
                  {l.nom.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{l.nom}</div>
                  <div style={{ color: '#8B95A8', fontSize: 12 }}>{l.telephone}</div>
                </div>
              </div>
              <button onClick={() => openStockModal(l.id)} style={{ background: '#F59E0B11', border: '1px solid #F59E0B44', color: '#F59E0B', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                ✎ Définir stock départ
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {produits.map(p => {
                const stock = getStock(l.id, p.id)
                const actuel = stock?.quantite_actuelle ?? 0
                const depart = stock?.quantite_depart ?? 0
                const pct = depart > 0 ? actuel / depart : 0
                const color = pct > 0.5 ? '#10B981' : pct > 0.2 ? '#F59E0B' : '#EF4444'
                return (
                  <div key={p.id} style={{ background: '#0D1117', borderRadius: 10, padding: '12px 14px', border: `1px solid ${color}33` }}>
                    <div style={{ fontSize: 11, color: '#8B95A8', marginBottom: 6 }}>{p.nom}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, color }}>
                      {actuel}<span style={{ fontSize: 12, color: '#4B5563', fontWeight: 400 }}>/{depart}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: '#1E2535', marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: color, borderRadius: 2, width: `${pct * 100}%`, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: '#000000CC', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, margin: 0, fontSize: 20 }}>Stock de départ</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B95A8', fontSize: 20 }}>✕</button>
              </div>
              <p style={{ color: '#F59E0B', fontSize: 13, marginBottom: 20 }}>{livreurs.find(l => l.id === selectedLivreur)?.nom}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                {produits.map(p => (
                  <div key={p.id} style={{ background: '#0D1117', borderRadius: 10, padding: '10px 14px', border: '1px solid #1E2535' }}>
                    <div style={{ fontSize: 11, color: '#8B95A8', marginBottom: 6 }}>{p.nom}</div>
                    <input type="number" min="0" value={stockForm[p.id] || '0'} onChange={e => setStockForm(prev => ({ ...prev, [p.id]: e.target.value }))}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: 18, fontWeight: 700, outline: 'none', fontFamily: "'Syne', sans-serif" }} />
                  </div>
                ))}
              </div>

              <button onClick={saveStock} disabled={saving} style={{ width: '100%', background: 'linear-gradient(135deg, #10B981, #6366F1)', border: 'none', borderRadius: 12, padding: 14, color: '#fff', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
                {saving ? 'Sauvegarde...' : '✓ Valider le stock de départ'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
