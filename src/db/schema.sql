-- ============================================================
-- SWMS Backend — Schema Migration 001
-- Matches Section 4 (Data Model) of the Week-1 Backend Design
-- Document exactly: same table names, same columns.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ---------- data_sources ----------
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  publisher VARCHAR(160) NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  publication_year INTEGER,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('dataset', 'map', 'policy', 'research')),
  usage_notes TEXT NOT NULL
);

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'planner', 'researcher')) DEFAULT 'researcher',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- habitations ----------
CREATE TABLE IF NOT EXISTS habitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('village', 'ward', 'town', 'city')),
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_habitations_owner ON habitations(owner_id);

-- ---------- 7 parameter-category tables ----------
CREATE TABLE IF NOT EXISTS demography_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL UNIQUE REFERENCES habitations(id) ON DELETE CASCADE,
  population INTEGER NOT NULL CHECK (population > 0),
  population_density_per_sq_km INTEGER NOT NULL CHECK (population_density_per_sq_km > 0),
  growth_rate_pct NUMERIC(4,2) NOT NULL DEFAULT 0,
  floating_pop_pct NUMERIC(5,2) DEFAULT 0,
  household_size NUMERIC(3,1),
  literacy_pct NUMERIC(5,2),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS infrastructure_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL UNIQUE REFERENCES habitations(id) ON DELETE CASCADE,
  road_coverage_pct NUMERIC(5,2) CHECK (road_coverage_pct BETWEEN 0 AND 100),
  roads_alleys_count INTEGER,
  residential_zone_pct NUMERIC(5,2) CHECK (residential_zone_pct BETWEEN 0 AND 100),
  industrial_zone_pct NUMERIC(5,2) CHECK (industrial_zone_pct BETWEEN 0 AND 100),
  schools_count INTEGER,
  clinics_count INTEGER,
  collection_vehicles INTEGER CHECK (collection_vehicles >= 0),
  collection_point_density_pct NUMERIC(5,2),
  existing_landfill_capacity_tonnes NUMERIC(12,2),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS industrial_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL UNIQUE REFERENCES habitations(id) ON DELETE CASCADE,
  has_organized_industry BOOLEAN DEFAULT false,
  has_unorganized_industry BOOLEAN DEFAULT false,
  industrial_activity_intensity VARCHAR(10) CHECK (industrial_activity_intensity IN ('low', 'medium', 'high')),
  industrial_waste_tonnes_per_day NUMERIC(10,2) DEFAULT 0,
  hazardous_share_pct NUMERIC(5,2) CHECK (hazardous_share_pct BETWEEN 0 AND 100),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS natural_resource_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL UNIQUE REFERENCES habitations(id) ON DELETE CASCADE,
  annual_rainfall_mm NUMERIC(7,2) CHECK (annual_rainfall_mm BETWEEN 0 AND 8000),
  water_bodies_count INTEGER DEFAULT 0,
  forest_cover_pct NUMERIC(5,2) CHECK (forest_cover_pct BETWEEN 0 AND 100),
  sensitive_area_nearby BOOLEAN DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS terrain_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL UNIQUE REFERENCES habitations(id) ON DELETE CASCADE,
  slope VARCHAR(10) CHECK (slope IN ('flat', 'moderate', 'hilly')),
  soil_type VARCHAR(15) CHECK (soil_type IN ('permeable', 'impermeable')),
  wind_condition VARCHAR(10) CHECK (wind_condition IN ('low', 'moderate', 'high')),
  accessibility VARCHAR(10) CHECK (accessibility IN ('good', 'moderate', 'poor')),
  flood_prone BOOLEAN DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS economic_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL UNIQUE REFERENCES habitations(id) ON DELETE CASCADE,
  per_capita_income_annual NUMERIC(12,2) CHECK (per_capita_income_annual >= 0),
  annual_budget_inr NUMERIC(14,2) CHECK (annual_budget_inr >= 0),
  willingness_to_pay_pct NUMERIC(5,2) CHECK (willingness_to_pay_pct BETWEEN 0 AND 100),
  cost_constraint_level VARCHAR(10) CHECK (cost_constraint_level IN ('low', 'medium', 'high')),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cultural_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL UNIQUE REFERENCES habitations(id) ON DELETE CASCADE,
  diet_type VARCHAR(10) CHECK (diet_type IN ('veg', 'nonveg', 'mixed')),
  segregation_adherence_pct NUMERIC(5,2) CHECK (segregation_adherence_pct BETWEEN 0 AND 100),
  festival_spike_pct NUMERIC(5,2) CHECK (festival_spike_pct BETWEEN 0 AND 100),
  local_practice_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

-- ---------- parameter_change_log (immutable audit trail — BR-03) ----------
CREATE TABLE IF NOT EXISTS parameter_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL REFERENCES habitations(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL,
  field_name VARCHAR(60) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_change_log_habitation ON parameter_change_log(habitation_id, category);

-- ---------- map_layers (GIS — BR-04) ----------
CREATE TABLE IF NOT EXISTS map_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL REFERENCES habitations(id) ON DELETE RESTRICT,
  layer_type VARCHAR(20) NOT NULL CHECK (layer_type IN ('road', 'water_body', 'terrain', 'settlement', 'boundary')),
  geometry geometry(Geometry, 4326),
  source_file_url VARCHAR(500) NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  failure_reason TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_map_layers_habitation ON map_layers(habitation_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'map_layers' AND column_name = 'geometry' AND data_type = 'text'
  ) THEN
    ALTER TABLE map_layers
      ALTER COLUMN geometry TYPE geometry(Geometry, 4326)
      USING CASE
        WHEN geometry IS NULL OR btrim(geometry) = '' THEN NULL
        ELSE ST_SetSRID(ST_GeomFromGeoJSON(geometry), 4326)
      END;
  END IF;
END $$;

-- ---------- upload_batches (dataset validation — BR-05/06/07) ----------
CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitation_id UUID NOT NULL REFERENCES habitations(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  source_file_url VARCHAR(500) NOT NULL,
  file_checksum VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validating', 'validated', 'partially_validated', 'failed')),
  row_count INTEGER,
  valid_row_count INTEGER,
  normalized_file_url VARCHAR(500) DEFAULT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habitation_id, category, file_checksum)
);

-- ---------- validation_issues ----------
CREATE TABLE IF NOT EXISTS validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  field_name VARCHAR(60),
  issue_type VARCHAR(20) NOT NULL CHECK (issue_type IN ('missing_value', 'invalid_range', 'invalid_format', 'duplicate')),
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_validation_issues_batch ON validation_issues(batch_id);
