'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type Item = { id: string; nom: string; [key: string]: any }

function Section({
  title, icon, items, onAdd, onRename, onToggle, extraFields
}: {
  title: string
  icon: string
  items: Item[]
  onAdd: (nom: string, extra?: any) => void
  onRename: (id: string, nom: string) => void
  onToggle: (id: string, actif: boolean) => void
  extraFields?: { key: string; label: string; type: string }[]
}) {
  const [newNom, setNewNom] = useState('')
  const [newExtra, setNewExtra] = useState<Record<string, string>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [editNom, setEditNom] = useState('')

  const inputStyle: React.CSSProperties = { background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '9px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none', flex: 1 }

  return (
    <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 24, marginBottom: 20 }}>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>{icon}</span> {title}
      </h2>

      {/* Liste */}
      <div style={{ marginBottom: 16 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1E253533' }}>
            {editId === item.id ? (
              <>
                <input value={editNom} onChange={e => setEditNom(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') { onRename(item.id, editNom); setEditId(null) } }}
                  autoFocus />
                <button onClick={() => { onRename(item.id, editNom); setEditId(null) }}
                  style={{ background: '#10B98122', border: '1px solid #10B98144', color: '#10B981', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  ✓
                </button>
                <button onClick={() => setEditId(null)}
                  style={{ background: '#1E2535', border: 'none', color: '#8B95A8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
                  ✕
                </button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.couleur && <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.couleur, flexShrink: 0 }} />}
                  <span style={{ fontSize: 14, color: item.actif === false ? '#4B5563' : '#F1F5F9', textDecoration: item.actif === false ? 'line-through' : 'none' }}>
                    {item.nom}
                  </span>
                  {item.actif === false && <span style={{ fontSize: 10, color: '#4B5563', background: '#1E2535', borderRadius: 4, padding: '2px 6px' }}>inactif</span>}
                </div>
                <button onClick={() => { setEditId(item.id); setEditNom(item.nom) }}
                  style={{ background: '#F59E0B11', border: '1px solid #F59E0B33', color: '#F59E0B', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                  ✎ Renommer
                </button>
                <button onClick={() => onToggle(item.id, item.actif !== false)}
                  style={{ background: item.actif !== false ? '#EF444411' : '#10B98111', border: `1px solid ${item.actif !== false ? '#EF444433' : '#10B98133'}`, color: item.actif !== false ? '#EF4444' : '#10B981', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                  {item.actif !== false ? 'Désactiver' : 'Réactiver'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Ajouter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={newNom} onChange={e => setNewNom(e.target.value)} placeholder={`Nouveau ${title.slice(0, -1).toLowerCase()}...`}
          style={inputStyle}
          onKeyDown={e => { if (e.key === 'Enter' && newNom.trim()) { onAdd(newNom.trim(), newExtra); setNewNom(''); setNewExtra({}) } }} />
        {extraFields?.map(f => (
          <input key={f.key} type={f.type} value={newExtra[f.key] || ''} onChange={e => setNewExtra(prev => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={f.label} style={{ ...inputStyle, flex: '0 0 120px' }} />
        ))}
        <button onClick={() => { if (newNom.trim()) { onAdd(newNom.trim(), newExtra); setNewNom(''); setNewExtra({}) } }}
          style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', borderRadius: 10, padding: '9px 18px', color: '#0D1117', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Syne', sans-serif", whiteSpace: 'nowrap' }}>
          + Ajouter
        </button>
      </div>
    </div>
  )
}

function ProduitsSection({ produits, dragProduit, setDragProduit, reorderProduit, onAdd, onRename, onToggle }: {
  produits: Item[]
  dragProduit: string | null
  setDragProduit: (id: string | null) => void
  reorderProduit: (dragId: string, dropId: string) => void
  onAdd: (nom: string) => void
  onRename: (id: string, nom: string) => void
  onToggle: (id: string, actif: boolean) => void
}) {
  const [newNom, setNewNom] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNom, setEditNom] = useState('')
  const inputStyle: React.CSSProperties = { background: '#0D1117', border: '1px solid #1E2535', borderRadius: 10, padding: '9px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none', flex: 1 }

  return (
    <div style={{ background: '#161B27', border: '1px solid #1E2535', borderRadius: 16, padding: 24, marginBottom: 20 }}>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>📦</span> Produits
      </h2>
      <p style={{ fontSize: 11, color: '#4B5563', marginBottom: 16 }}>⠿ Glissez pour réordonner</p>
      <div style={{ marginBottom: 16 }}>
        {produits.map(item => (
          <div key={item.id}
            draggable
            onDragStart={() => setDragProduit(item.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragProduit && dragProduit !== item.id) reorderProduit(dragProduit, item.id); setDragProduit(null) }}
            onDragEnd={() => setDragProduit(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1E253533', opacity: dragProduit === item.id ? 0.4 : 1, cursor: 'grab' }}>
            <span style={{ color: '#4B5563', fontSize: 16, userSelect: 'none', flexShrink: 0 }}>⠿</span>
            {editId === item.id ? (
              <>
                <input value={editNom} onChange={e => setEditNom(e.target.value)} style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') { onRename(item.id, editNom); setEditId(null) } }} autoFocus />
                <button onClick={() => { onRename(item.id, editNom); setEditId(null) }}
                  style={{ background: '#10B98122', border: '1px solid #10B98144', color: '#10B981', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✓</button>
                <button onClick={() => setEditId(null)}
                  style={{ background: '#1E2535', border: 'none', color: '#8B95A8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, color: item.actif === false ? '#4B5563' : '#F1F5F9', textDecoration: item.actif === false ? 'line-through' : 'none' }}>{item.nom}</span>
                {item.actif === false && <span style={{ fontSize: 10, color: '#4B5563', background: '#1E2535', borderRadius: 4, padding: '2px 6px' }}>inactif</span>}
                <button onClick={() => { setEditId(item.id); setEditNom(item.nom) }}
                  style={{ background: 'none', border: '1px solid #1E2535', color: '#8B95A8', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>✎</button>
                <button onClick={() => onToggle(item.id, item.actif !== false)}
                  style={{ background: item.actif === false ? '#10B98111' : '#EF444411', border: `1px solid ${item.actif === false ? '#10B98133' : '#EF444433'}`, color: item.actif === false ? '#10B981' : '#EF4444', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                  {item.actif === false ? 'Activer' : 'Désactiver'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newNom} onChange={e => setNewNom(e.target.value)} placeholder="Nouveau produit"
          style={inputStyle} onKeyDown={e => { if (e.key === 'Enter' && newNom.trim()) { onAdd(newNom.trim()); setNewNom('') } }} />
        <button onClick={() => { if (newNom.trim()) { onAdd(newNom.trim()); setNewNom('') } }}
          style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', borderRadius: 10, padding: '9px 18px', color: '#0D1117', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          + Ajouter
        </button>
      </div>
    </div>
  )
}

export default function ParametresPage() {
  const [dragProduit, setDragProduit] = useState<string | null>(null)
  const supabase = createClient()
  const [livreurs, setLivreurs] = useState<Item[]>([])
  const [boutiques, setBoutiques] = useState<Item[]>([])
  const [produits, setProduits] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 2500)
  }

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: b }, { data: p }] = await Promise.all([
        supabase.from('livreurs').select('*').order('nom'),
        supabase.from('boutiques').select('*').order('nom'),
        supabase.from('produits').select('*').order('ordre').order('nom'),
      ])
      setLivreurs(l || [])
      setBoutiques(b || [])
      setProduits(p || [])
      setLoading(false)
    }
    load()
  }, [])

  // LIVREURS
  async function addLivreur(nom: string, extra?: any) {
    const { data } = await supabase.from('livreurs').insert({ nom, telephone: extra?.telephone || null, actif: true }).select().single()
    if (data) { setLivreurs(prev => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom))); showSuccess(`Livreur "${nom}" ajouté !`) }
  }
  async function renameLivreur(id: string, nom: string) {
    await supabase.from('livreurs').update({ nom }).eq('id', id)
    setLivreurs(prev => prev.map(l => l.id === id ? { ...l, nom } : l))
    showSuccess('Nom mis à jour !')
  }
  async function toggleLivreur(id: string, actif: boolean) {
    await supabase.from('livreurs').update({ actif: !actif }).eq('id', id)
    setLivreurs(prev => prev.map(l => l.id === id ? { ...l, actif: !actif } : l))
    showSuccess(actif ? 'Livreur désactivé' : 'Livreur réactivé')
  }

  // BOUTIQUES
  async function addBoutique(nom: string) {
    const colors = ['#F59E0B', '#6366F1', '#10B981', '#EF4444', '#3B82F6', '#EC4899']
    const couleur = colors[boutiques.length % colors.length]
    const { data } = await supabase.from('boutiques').insert({ nom, couleur, actif: true }).select().single()
    if (data) { setBoutiques(prev => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom))); showSuccess(`Boutique "${nom}" ajoutée !`) }
  }
  async function renameBoutique(id: string, nom: string) {
    await supabase.from('boutiques').update({ nom }).eq('id', id)
    setBoutiques(prev => prev.map(b => b.id === id ? { ...b, nom } : b))
    showSuccess('Nom mis à jour !')
  }
  async function toggleBoutique(id: string, actif: boolean) {
    await supabase.from('boutiques').update({ actif: !actif }).eq('id', id)
    setBoutiques(prev => prev.map(b => b.id === id ? { ...b, actif: !actif } : b))
    showSuccess(actif ? 'Boutique désactivée' : 'Boutique réactivée')
  }

  // PRODUITS
  async function addProduit(nom: string) {
    const { data } = await supabase.from('produits').insert({ nom, actif: true, prix_unitaire: 0 }).select().single()
    if (data) { setProduits(prev => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom))); showSuccess(`Produit "${nom}" ajouté !`) }
  }
  async function renameProduit(id: string, nom: string) {
    await supabase.from('produits').update({ nom }).eq('id', id)
    setProduits(prev => prev.map(p => p.id === id ? { ...p, nom } : p))
    showSuccess('Nom mis à jour !')
  }
  async function toggleProduit(id: string, actif: boolean) {
    await supabase.from('produits').update({ actif: !actif }).eq('id', id)
    setProduits(prev => prev.map(p => p.id === id ? { ...p, actif: !actif } : p))
    showSuccess(actif ? 'Produit désactivé' : 'Produit réactivé')
  }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8B95A8' }}>Chargement...</div></main></div>

  async function reorderProduit(dragId: string, dropId: string) {
    if (dragId === dropId) return
    const arr = [...produits]
    const dragIdx = arr.findIndex(p => p.id === dragId)
    const dropIdx = arr.findIndex(p => p.id === dropId)
    const [moved] = arr.splice(dragIdx, 1)
    arr.splice(dropIdx, 0, moved)
    // Mettre à jour les ordres
    for (let i = 0; i < arr.length; i++) {
      await supabase.from('produits').update({ ordre: i + 1 }).eq('id', arr[i].id)
    }
    setProduits(arr)
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 32, minHeight: '100vh' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>Paramètres</h1>
          <p style={{ color: '#8B95A8', marginTop: 6 }}>Gérez vos livreurs, boutiques et produits</p>
        </div>

        {success && (
          <div style={{ background: '#10B98122', border: '1px solid #10B98155', borderRadius: 12, padding: '14px 20px', color: '#10B981', marginBottom: 24, fontSize: 14 }}>
            ✓ {success}
          </div>
        )}

        <Section title="Livreurs" icon="🚚" items={livreurs}
          onAdd={addLivreur} onRename={renameLivreur} onToggle={toggleLivreur}
          extraFields={[{ key: 'telephone', label: 'Téléphone', type: 'tel' }]} />

        <Section title="Boutiques" icon="🏪" items={boutiques}
          onAdd={addBoutique} onRename={renameBoutique} onToggle={toggleBoutique} />

        {/* Section Produits avec drag & drop */}
        <ProduitsSection
          produits={produits}
          dragProduit={dragProduit}
          setDragProduit={setDragProduit}
          reorderProduit={reorderProduit}
          onAdd={addProduit}
          onRename={renameProduit}
          onToggle={toggleProduit}
        />
      </main>
    </div>
  )
}
