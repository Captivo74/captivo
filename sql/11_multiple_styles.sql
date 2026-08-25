-- ============================================
-- CAPTIVO — Permettre à un photographe de sélectionner plusieurs styles
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

-- Nouvelle colonne : liste de tous les styles proposés par le photographe.
-- La colonne "style" existante est conservée (elle devient le style "principal",
-- affiché en priorité), pour ne rien casser de ce qui existe déjà.
alter table photographers add column if not exists styles text[];

-- Pour les fiches déjà existantes : on reprend leur style actuel comme
-- seul élément de la nouvelle liste, le temps qu'elles en ajoutent d'autres.
update photographers set styles = array[style] where styles is null or array_length(styles, 1) is null;
