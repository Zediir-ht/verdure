-- =============================================================================
-- Verdure — "Coco et Cam font pousser"
-- Supabase SQL Schema — à exécuter dans Supabase > SQL Editor
-- Jardin commun : toutes les données lisibles et modifiables par tous
-- =============================================================================

-- 1. Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: plants
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.plants (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identité
  name                  TEXT NOT NULL,                        -- Nom commun (traduit FR)
  scientific_name       TEXT,                                 -- Nom scientifique
  family                TEXT,                                 -- Famille botanique
  slug                  TEXT,                                 -- Slug Perenual
  perenual_id           INTEGER,                              -- ID Perenual

  -- Photo
  photo_url             TEXT,                                 -- URL Supabase Storage ou Perenual
  emoji                 TEXT DEFAULT '🪴',

  -- Soins / arrosage
  watering_frequency    TEXT,                                 -- Texte descriptif (FR)
  watering_interval_days INTEGER DEFAULT 7,                  -- Intervalle en jours calculé
  sunlight              TEXT,                                 -- Luminosité requise (FR)
  soil_type             TEXT,                                 -- Type de sol (FR)
  fertilizer_type       TEXT,                                 -- Type d'engrais (FR)
  fertilizer_season     TEXT,                                 -- Saison fertilisation (FR)
  pruning_month         TEXT,                                 -- Mois d'élagage (FR)
  pruning_description   TEXT,                                 -- Description élagage (FR)

  -- Caractéristiques
  origin                TEXT,                                 -- Origine géographique (FR)
  indoor                BOOLEAN DEFAULT TRUE,
  outdoor               BOOLEAN DEFAULT FALSE,
  cycle                 TEXT,                                 -- Annuelle, vivace… (FR)
  growth_rate           TEXT,
  maintenance           TEXT,

  -- Toxicité
  toxic_humans          BOOLEAN DEFAULT FALSE,
  toxic_dogs            BOOLEAN DEFAULT FALSE,
  toxic_cats            BOOLEAN DEFAULT FALSE,

  -- Températures
  min_temperature       NUMERIC,
  max_temperature       NUMERIC,

  -- Taille adulte
  height_min_cm         NUMERIC,
  height_max_cm         NUMERIC,
  width_min_cm          NUMERIC,
  width_max_cm          NUMERIC,

  -- Saisons
  flowering_season      TEXT,                                 -- Saison floraison (FR)
  dormant_season        TEXT,                                 -- Saison dormance (FR)
  hardiness_zone        TEXT,

  -- Données utilisateur
  location              TEXT DEFAULT 'interieur',             -- interieur / balcon / exterieur
  room                  TEXT,                                 -- Pièce (ex: salon, cuisine…)
  pot_size              TEXT DEFAULT 'medium',               -- small / medium / large

  -- Dates de soins
  last_watered          TIMESTAMPTZ,
  last_fertilized       TIMESTAMPTZ,
  last_repotted         TIMESTAMPTZ,

  -- Notes
  notes                 TEXT,

  -- Données Perenual brutes (JSON)
  perenual_raw          JSONB
);

-- Index
CREATE INDEX IF NOT EXISTS plants_location_idx ON public.plants(location);
CREATE INDEX IF NOT EXISTS plants_perenual_id_idx ON public.plants(perenual_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plants_updated_at
  BEFORE UPDATE ON public.plants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: watering_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.watering_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id   UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  watered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note       TEXT,                                            -- Note optionnelle
  amount_ml  INTEGER                                         -- Quantité optionnelle
);

CREATE INDEX IF NOT EXISTS watering_logs_plant_id_idx ON public.watering_logs(plant_id);
CREATE INDEX IF NOT EXISTS watering_logs_watered_at_idx ON public.watering_logs(watered_at DESC);

-- =============================================================================
-- TABLE: verdure_store
-- Stockage du blob JSON pour backward-compat avec l'ancien système
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.verdure_store (
  id   INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB
);

INSERT INTO public.verdure_store (id, data) VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STORAGE BUCKET: plant-photos
-- =============================================================================
-- À exécuter depuis Supabase Dashboard > Storage > New Bucket
-- Nom: plant-photos | Public: true
-- Ou via SQL :
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Jardin commun : toute personne authentifiée peut tout lire/écrire
-- =============================================================================

-- plants
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jardin commun — lecture" ON public.plants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Jardin commun — insertion" ON public.plants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Jardin commun — modification" ON public.plants
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Jardin commun — suppression" ON public.plants
  FOR DELETE TO authenticated USING (true);

-- watering_logs
ALTER TABLE public.watering_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jardin commun — lecture logs" ON public.watering_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Jardin commun — insertion logs" ON public.watering_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Jardin commun — suppression logs" ON public.watering_logs
  FOR DELETE TO authenticated USING (true);

-- verdure_store (legacy)
ALTER TABLE public.verdure_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire verdure_store" ON public.verdure_store
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tout le monde peut modifier verdure_store" ON public.verdure_store
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Storage policies
CREATE POLICY "Lecture publique photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'plant-photos');

CREATE POLICY "Upload photos authentifié" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'plant-photos');

CREATE POLICY "Suppression photos authentifié" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'plant-photos');

-- =============================================================================
-- GRANTS (lecture/écriture pour le rôle anon aussi, si password gate uniquement)
-- Décommentez si vous n'utilisez PAS l'auth Supabase native pour les utilisateurs
-- =============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.plants TO anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.watering_logs TO anon;
-- GRANT SELECT, UPDATE ON public.verdure_store TO anon;
