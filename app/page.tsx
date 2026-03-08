'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Livreur, Boutique, Vente } from '@/lib/types'

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{ background: '#161B27', border: `1px solid ${accent}33`, borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '16px 16px 0 0' }} />
      <div style={{ color: '#8B95A8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#F1F5F9', fontSize: 28, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: accent, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const supabase = createClient()
  const [livreurs, setLivreurs] = useState<Livreur[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [ventes, setVentes] = useState<Vente[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: b }, { data: v }] = await Promise.all([
        supabase.from('livreurs').select('*').eq('actif', true).order('nom'),
        supabase.from('boutiques').select('*').eq('actif', true),
        supabase.from('ventes').select('*, livreur:livreurs(*), boutique:boutiques(*)').eq('date_vente', today),
      ])
      setLivreurs(l || [])
      setBoutiques(b || [])
      setVentes(v || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalVentes = ventes.reduce((s, v) => s + v.montant_total, 0)
  const argentParBoutique = boutiques.reduce((acc, b) => {
    acc[b.id] = ventes.filter(v => v.boutique_id === b.id).reduce((s, v) => s + v.montant_total, 0)
    return acc
  }, {} as Record<string, number>)
  const argentParLivreur = livreurs.reduce((acc, l) => {
    acc[l.id] = boutiques.reduce((ba, b) => {
      ba[b.id] = ventes.filter(v => v.livreur_id === l.id && v.boutique_id === b.id).reduce((s, v) => s + v.montant_total, 0)
      return ba
    }, {} as Record<string, number>)
    return acc
  }, {} as Record<string, Record<string, number>>)

  function totalLivreur(lid: string) {
    return boutiques.reduce((s, b) => s + (argentParLivreur[lid]?.[b.id] || 0), 0)
  }

  if (loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: '#8B95A8' }}>Chargement...</div>
      </main>
    </div>
  )

  const topLivreur = livreurs.sort((a, b) => totalLivreur(b.id) - totalLivreur(a.id))[0]
  const topBoutique = boutiques.sort((a, b) => (argentParBoutique[b.id] || 0) - (argentParBoutique[a.id] || 0))[0]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Tableau de bord</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard label="Total du jour" value={`${totalVentes.toLocaleString()} DA`} sub="Toutes boutiques" accent="#F59E0B" />
          <StatCard label="Nb ventes" value={ventes.length} sub={`${livreurs.length} livreurs actifs`} accent="#10B981" />
          <StatCard label="Boutique top" value={topBoutique?.nom?.split(' ')[1] || '—'} sub={`${(argentParBoutique[topBoutique?.id] || 0).toLocaleString()} DA`} accent="#6366F1" />
          <StatCard label="Livreur top" value={topLivreur?.nom?.split(' ')[0] || '—'} sub={`${totalLivreur(topLivreur?.id || '').toLocaleString()} DA`} accent="#EF4444" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, margin: '0 0 20px', fontSize: 16 }}>Argent par boutique</h3>
            {boutiques.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.couleur }} />
                  <span style={{ fontSize: 14, color: '#CBD5E1' }}>{b.nom}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ height: 6, borderRadius: 3, background: b.couleur + '33', width: 80, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: b.couleur, borderRadius: 3, width: totalVentes > 0 ? `${((argentParBoutique[b.id] || 0) / totalVentes) * 100}%` : '0%', transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: b.couleur, minWidth: 90, textAlign: 'right', fontSize: 14 }}>
                    {(argentParBoutique[b.id] || 0).toLocaleString()} DA
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, margin: '0 0 20px', fontSize: 16 }}>Livreurs — Espèces</h3>
            {livreurs.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1E253522' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E2535', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>
                    {l.nom.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span style={{ fontSize: 13, color: '#CBD5E1' }}>{l.nom}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#F59E0B', fontSize: 14 }}>
                    {totalLivreur(l.id).toLocaleString()} DA
                  </div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 2 }}>
                    {boutiques.map(b => (argentParLivreur[l.id]?.[b.id] || 0) > 0 && (
                      <span key={b.id} style={{ background: b.couleur + '22', color: b.couleur, border: `1px solid ${b.couleur}44`, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                        {(argentParLivreur[l.id][b.id]).toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dernières ventes */}
        <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, margin: '0 0 16px', fontSize: 16 }}>Dernières ventes du jour</h3>
          {ventes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#4B5563' }}>Aucune vente enregistrée aujourd'hui</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#8B95A8', borderBottom: '1px solid #1E2535' }}>
                    {['Heure', 'Livreur', 'Client', 'Boutique', 'Montant'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...ventes].reverse().slice(0, 10).map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1E253533' }}>
                      <td style={{ padding: '10px 12px', color: '#4B5563' }}>{new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '10px 12px' }}>{(v.livreur as any)?.nom}</td>
                      <td style={{ padding: '10px 12px', color: '#CBD5E1' }}>{v.client_nom}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: (v.boutique as any)?.couleur + '22', color: (v.boutique as any)?.couleur, border: `1px solid ${(v.boutique as any)?.couleur}44`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                          {(v.boutique as any)?.nom}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#F59E0B' }}>{v.montant_total.toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
