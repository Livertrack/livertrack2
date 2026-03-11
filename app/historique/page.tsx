'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Vente, Livreur, Boutique } from '@/lib/types'

export default function HistoriquePage() {
  const supabase = createClient()
  const [ventes, setVentes] = useState<Vente[]>([])
  const [livreurs, setLivreurs] = useState<Livreur[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [frais, setFrais] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLivreur, setFilterLivreur] = useState('')
  const [filterBoutique, setFilterBoutique] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modal frais
  const [showFraisModal, setShowFraisModal] = useState(false)
  const [fraisLivreur, setFraisLivreur] = useState('')
  const [fraisDesc, setFraisDesc] = useState('')
  const [fraisMontant, setFraisMontant] = useState('')
  const [fraisDate, setFraisDate] = useState(new Date().toISOString().split('T')[0])
  const [savingFrais, setSavingFrais] = useState(false)

  async function loadAll() {
    const [{ data: v }, { data: l }, { data: b }, { data: f }] = await Promise.all([
      supabase.from('ventes').select('*, livreur:livreurs(*), boutique:boutiques(*), vente_lignes(*, produit:produits(*))').order('created_at', { ascending: false }).limit(500),
      supabase.from('livreurs').select('*').eq('actif', true).order('nom'),
      supabase.from('boutiques').select('*').eq('actif', true),
      supabase.from('frais').select('*, livreur:livreurs(*)').order('created_at', { ascending: false }),
    ])
    setVentes(v || [])
    setLivreurs(l || [])
    setBoutiques(b || [])
    setFrais(f || [])
  }

  useEffect(() => {
    loadAll().then(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const filtered = ventes.filter(v => {
    if (filterLivreur && v.livreur_id !== filterLivreur) return false
    if (filterBoutique && v.boutique_id !== filterBoutique) return false
    if (filterDateFrom && v.date_vente < filterDateFrom) return false
    if (filterDateTo && v.date_vente > filterDateTo) return false
    return true
  })

  const totalFiltered = filtered.reduce((s, v) => s + v.montant_total, 0)

  // Résumé par livreur (ventes du jour - frais du jour)
  function resumeLivreur(lid: string) {
    const ventesLivreur = ventes.filter(v => v.livreur_id === lid && v.date_vente === today)
    const totalVentes = ventesLivreur.reduce((s, v) => s + v.montant_total, 0)
    const totalFrais = frais.filter(f => f.livreur_id === lid && f.date_frais === today).reduce((s, f) => s + f.montant, 0)
    return { totalVentes, totalFrais, net: totalVentes - totalFrais, nbVentes: ventesLivreur.length }
  }

  async function deleteVente(id: string) {
    setDeleting(true)
    await supabase.from('vente_lignes').delete().eq('vente_id', id)
    await supabase.from('ventes').delete().eq('id', id)
    setVentes(prev => prev.filter(v => v.id !== id))
    setConfirmDelete(null)
    setDeleting(false)
  }

  async function saveFrais() {
    if (!fraisLivreur || !fraisDesc || !fraisMontant) return
    setSavingFrais(true)
    await supabase.from('frais').insert({
      livreur_id: fraisLivreur,
      description: fraisDesc,
      montant: parseFloat(fraisMontant),
      date_frais: fraisDate,
    })
    await loadAll()
    setSavingFrais(false)
    setShowFraisModal(false)
    setFraisDesc('')
    setFraisMontant('')
  }

  async function deleteFrais(id: string) {
    await supabase.from('frais').delete().eq('id', id)
    setFrais(prev => prev.filter(f => f.id !== id))
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map(v => ({
      'Date': v.date_vente,
      'Heure': new Date(v.created_at).toLocaleTimeString('fr-FR'),
      'Livreur': (v.livreur as any)?.nom,
      'Client': v.client_nom,
      'Boutique': (v.boutique as any)?.nom,
      'Montant (€)': v.montant_total,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Ventes')
    XLSX.writeFile(wb, `livertrack-export-${today}.xlsx`)
  }

  const inputStyle: React.CSSProperties = { background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '8px 12px', color: '#F1F5F9', fontSize: 13, outline: 'none' }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
  const modalInputStyle: React.CSSProperties = { width: '100%', background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '10px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  const venteASupprimer = ventes.find(v => v.id === confirmDelete)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Historique des ventes</h1>
            <p style={{ color: '#8B95A8', marginTop: 6 }}>{filtered.length} vente(s) — Total : <span style={{ color: '#F59E0B', fontWeight: 700 }}>{totalFiltered.toLocaleString()} €</span></p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowFraisModal(true); setFraisLivreur(livreurs[0]?.id || '') }} style={{ background: '#EF444411', border: '1px solid #EF444433', color: '#EF4444', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              − Ajouter frais
            </button>
            <button onClick={exportExcel} style={{ background: '#10B98122', border: '1px solid #10B98144', color: '#10B981', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              ↓ Exporter Excel
            </button>
          </div>
        </div>

        {/* Résumé par livreur — aujourd'hui */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Espèces par livreur — aujourd'hui</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {livreurs.map(l => {
              const r = resumeLivreur(l.id)
              return (
                <div key={l.id} style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E2535', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>
                      {l.nom.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>{l.nom}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#8B95A8', fontSize: 12 }}>Ventes ({r.nbVentes})</span>
                    <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 13 }}>+{r.totalVentes.toLocaleString()} €</span>
                  </div>
                  {r.totalFrais > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#8B95A8', fontSize: 12 }}>Frais</span>
                      <span style={{ color: '#EF4444', fontWeight: 600, fontSize: 13 }}>−{r.totalFrais.toLocaleString()} €</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid #1E2535', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8B95A8', fontSize: 12 }}>Net sur lui</span>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: r.net >= 0 ? '#10B981' : '#EF4444' }}>{r.net.toLocaleString()} €</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Frais du jour */}
        {frais.filter(f => f.date_frais === today).length > 0 && (
          <div style={{ background: '#161B27', border: '1px solid #EF444433', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Frais du jour</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {frais.filter(f => f.date_frais === today).map(f => (
                <div key={f.id} style={{ background: '#0D1117', border: '1px solid #EF444433', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600 }}>{(f.livreur as any)?.nom}</span>
                  <span style={{ color: '#8B95A8', fontSize: 12 }}>— {f.description}</span>
                  <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 13 }}>−{f.montant} €</span>
                  <button onClick={() => deleteFrais(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', fontSize: 12, padding: 0 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={inputStyle} />
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={inputStyle} />
          {(filterLivreur || filterBoutique || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setFilterLivreur(''); setFilterBoutique(''); setFilterDateFrom(''); setFilterDateTo('') }} style={{ background: 'transparent', border: '1px solid #1E2535', color: '#8B95A8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>
              ✕ Effacer filtres
            </button>
          )}
        </div>

        {/* Tableau ventes */}
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
                    {['Date', 'Heure', 'Livreur', 'Client', 'Boutique', 'Montant', ''].map(h => (
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
                      <td style={{ padding: '10px 14px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#F59E0B', whiteSpace: 'nowrap' }}>{v.montant_total.toLocaleString()} €</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => setConfirmDelete(v.id)} style={{ background: '#EF444411', border: '1px solid #EF444433', color: '#EF4444', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                          🗑 Annuler
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#0A0F1A', borderTop: '2px solid #1E2535' }}>
                    <td colSpan={5} style={{ padding: '12px 14px', color: '#8B95A8', fontSize: 12, fontWeight: 600 }}>TOTAL ({filtered.length} ventes)</td>
                    <td style={{ padding: '12px 14px', fontFamily: "'Syne', sans-serif", fontWeight: 800, color: '#F59E0B', fontSize: 16 }}>{totalFiltered.toLocaleString()} €</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Modal ajout frais */}
        {showFraisModal && (
          <div style={{ position: 'fixed', inset: 0, background: '#000000CC', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
            onClick={e => e.target === e.currentTarget && setShowFraisModal(false)}>
            <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, margin: 0, fontSize: 20 }}>Ajouter des frais</h2>
                <button onClick={() => setShowFraisModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B95A8', fontSize: 20 }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Livreur</label>
                  <select value={fraisLivreur} onChange={e => setFraisLivreur(e.target.value)} style={{ ...modalInputStyle, cursor: 'pointer' }}>
                    {livreurs.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Date</label>
                  <input type="date" value={fraisDate} onChange={e => setFraisDate(e.target.value)} style={modalInputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Description</label>
                  <input type="text" value={fraisDesc} onChange={e => setFraisDesc(e.target.value)} placeholder="ex: Essence, Parking..." style={modalInputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Montant (€)</label>
                  <input type="number" min="0" step="0.01" value={fraisMontant} onChange={e => setFraisMontant(e.target.value)} placeholder="0.00" style={modalInputStyle} />
                </div>
              </div>

              <button onClick={saveFrais} disabled={savingFrais} style={{ width: '100%', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', borderRadius: 12, padding: 14, color: '#fff', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 24 }}>
                {savingFrais ? 'Enregistrement...' : '− Enregistrer les frais'}
              </button>
            </div>
          </div>
        )}

        {/* Modal confirmation suppression */}
        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, background: '#000000CC', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: '#161B27', border: '1px solid #EF444444', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, margin: '0 0 8px', fontSize: 20 }}>Annuler cette vente ?</h2>
              <p style={{ color: '#8B95A8', fontSize: 14, marginBottom: 8 }}>
                {(venteASupprimer?.livreur as any)?.nom} — {venteASupprimer?.client_nom}
              </p>
              <p style={{ color: '#F59E0B', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 24 }}>
                {venteASupprimer?.montant_total.toLocaleString()} €
              </p>
              <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 24 }}>Cette action est irréversible.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: '#1E2535', border: 'none', borderRadius: 12, padding: 14, color: '#F1F5F9', cursor: 'pointer', fontWeight: 600 }}>
                  Retour
                </button>
                <button onClick={() => deleteVente(confirmDelete)} disabled={deleting} style={{ flex: 1, background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', borderRadius: 12, padding: 14, color: '#fff', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
                  {deleting ? 'Suppression...' : '🗑 Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
