export type Livreur = {
  id: string
  nom: string
  telephone: string | null
  actif: boolean
  created_at: string
}

export type Produit = {
  id: string
  nom: string
  prix_unitaire: number
  actif: boolean
}

export type Boutique = {
  id: string
  nom: string
  couleur: string
  actif: boolean
}

export type Stock = {
  id: string
  livreur_id: string
  produit_id: string
  quantite_depart: number
  quantite_actuelle: number
  date_depart: string
  produit?: Produit
}

export type VenteLigne = {
  id: string
  vente_id: string
  produit_id: string
  quantite: number
  prix_unitaire: number
  sous_total: number
  produit?: Produit
}

export type Vente = {
  id: string
  livreur_id: string
  boutique_id: string
  client_nom: string
  date_vente: string
  montant_total: number
  created_at: string
  livreur?: Livreur
  boutique?: Boutique
  vente_lignes?: VenteLigne[]
}

export type Gestionnaire = {
  id: string
  nom: string
  email: string
  role: 'admin' | 'gestionnaire'
}
