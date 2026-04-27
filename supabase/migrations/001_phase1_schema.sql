-- ═══════════════════════════════════════════════════════════
--  FFC TMS — Phase 1 Database Schema
--  Migration: 001_phase1_schema.sql
--  Run in Supabase SQL Editor or via supabase db push
-- ═══════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- fuzzy search

-- ─────────────────────────────────────────────────────────────
--  LOOKUP TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  entity      TEXT NOT NULL CHECK (entity IN ('FFC','TFM','MS','VS')),
  city        TEXT,
  address     TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vendors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('rental','garage','fuel','gps','insurance','other')),
  contact_name TEXT,
  contact_phone TEXT,
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  IDENTITY & ROLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (code, name, description) VALUES
  ('super_admin',     'Super Admin',        'Full system access'),
  ('transport_mgr',   'Transport Manager',  'Full operational + approval access'),
  ('transport_supv',  'Transport Supervisor','Operational + dispatch access'),
  ('branch_mgr',      'Branch Manager',     'Branch-level read + approve'),
  ('driver',          'Driver',             'Driver portal access only'),
  ('finance',         'Finance',            'Cost & reports access'),
  ('maintenance',     'Maintenance',        'Maintenance module access'),
  ('readonly_mgmt',   'Read-only (Mgmt)',   'View-only access for management');

-- Users table mirrors Supabase auth.users
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  employee_id     TEXT UNIQUE,
  role_id         UUID NOT NULL REFERENCES roles(id),
  branch_id       UUID REFERENCES branches(id),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────────
--  VEHICLE MASTER (M01)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE vehicles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_number      TEXT UNIQUE NOT NULL,          -- plate number e.g. TXB-2201
  vehicle_code        TEXT UNIQUE,                   -- internal code
  vin                 TEXT,                          -- chassis/VIN
  engine_number       TEXT,
  vehicle_type        TEXT NOT NULL CHECK (vehicle_type IN ('pickup','van','truck_medium','truck_heavy','reefer','tanker','other')),
  make                TEXT NOT NULL,
  model               TEXT NOT NULL,
  year                INTEGER CHECK (year >= 1990 AND year <= 2030),
  capacity_kg         INTEGER,
  refrigeration_class TEXT,
  color               TEXT,
  ownership_type      TEXT NOT NULL DEFAULT 'owned' CHECK (ownership_type IN ('owned','rented','leased')),
  vendor_id           UUID REFERENCES vendors(id),
  lease_start         DATE,
  lease_end           DATE,
  monthly_rental      NUMERIC(10,2),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  current_driver_id   UUID,                          -- FK added after drivers table
  status              TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','assigned','maintenance','inactive')),
  current_odometer    INTEGER NOT NULL DEFAULT 0,
  -- Compliance
  mulkiya_number      TEXT,
  mulkiya_issue_date  DATE,
  mulkiya_expiry      DATE,
  insurance_policy    TEXT,
  insurance_expiry    DATE,
  salik_tag           TEXT,
  -- GPS
  gps_device_id       TEXT,
  gps_vendor          TEXT,
  gps_contract_expiry DATE,
  -- Audit
  notes               TEXT,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id)
);

CREATE INDEX idx_vehicles_branch ON vehicles(branch_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_mulkiya_expiry ON vehicles(mulkiya_expiry);
CREATE INDEX idx_vehicles_insurance_expiry ON vehicles(insurance_expiry);
CREATE INDEX idx_vehicles_number_trgm ON vehicles USING GIN (vehicle_number gin_trgm_ops);

-- Vehicle documents
CREATE TABLE vehicle_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id),
  doc_type      TEXT NOT NULL CHECK (doc_type IN ('mulkiya','insurance','lease','photo_front','photo_rear','photo_side_l','photo_side_r','gps_contract','other')),
  doc_number    TEXT,
  issue_date    DATE,
  expiry_date   DATE,
  file_path     TEXT,                               -- Supabase Storage path
  file_name     TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','expiring','expired')),
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vdocs_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX idx_vdocs_expiry ON vehicle_documents(expiry_date);

-- ─────────────────────────────────────────────────────────────
--  DRIVER MASTER (M02)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE drivers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_code         TEXT UNIQUE NOT NULL,
  employee_id         TEXT UNIQUE,
  full_name           TEXT NOT NULL,
  mobile              TEXT,
  alternate_mobile    TEXT,
  email               TEXT,
  date_of_birth       DATE,
  nationality         TEXT,
  -- Documents
  eid_number          TEXT,
  eid_expiry          DATE,
  license_number      TEXT,
  license_class       TEXT,
  license_issue_date  DATE,
  license_expiry      DATE,
  passport_number     TEXT,
  passport_expiry     DATE,
  -- Employment
  employment_type     TEXT NOT NULL DEFAULT 'employee' CHECK (employment_type IN ('employee','contractor')),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  joining_date        DATE,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','suspended','terminated')),
  duty_status         TEXT NOT NULL DEFAULT 'off_duty' CHECK (duty_status IN ('on_duty','off_duty','on_trip')),
  -- Performance (recalculated weekly)
  performance_score   NUMERIC(5,2) DEFAULT 100 CHECK (performance_score >= 0 AND performance_score <= 100),
  -- Driver portal PIN (hashed)
  pin_hash            TEXT,
  pin_expires_at      TIMESTAMPTZ,
  -- Supabase auth link (optional — for portal login)
  auth_user_id        UUID REFERENCES auth.users(id),
  -- Audit
  notes               TEXT,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id)
);

-- Back-fill FK on vehicles
ALTER TABLE vehicles ADD CONSTRAINT fk_vehicles_driver
  FOREIGN KEY (current_driver_id) REFERENCES drivers(id);

CREATE INDEX idx_drivers_branch ON drivers(branch_id);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_eid_expiry ON drivers(eid_expiry);
CREATE INDEX idx_drivers_license_expiry ON drivers(license_expiry);
CREATE INDEX idx_drivers_name_trgm ON drivers USING GIN (full_name gin_trgm_ops);

-- Driver documents
CREATE TABLE driver_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id     UUID NOT NULL REFERENCES drivers(id),
  doc_type      TEXT NOT NULL CHECK (doc_type IN ('eid','driving_license','passport','visa','other')),
  doc_number    TEXT,
  expiry_date   DATE,
  file_path     TEXT,
  file_name     TEXT,
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ddocs_driver ON driver_documents(driver_id);

-- ─────────────────────────────────────────────────────────────
--  TRIP & DELIVERY MANAGEMENT (M03)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE trips (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_number         TEXT UNIQUE NOT NULL,          -- e.g. TRP-0001
  requester_id        UUID NOT NULL REFERENCES users(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  vehicle_id          UUID REFERENCES vehicles(id),
  driver_id           UUID REFERENCES drivers(id),
  vehicle_type_needed TEXT CHECK (vehicle_type_needed IN ('pickup','van','truck_medium','truck_heavy','reefer','tanker','any')),
  priority            TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent','planned')),
  -- Schedule
  planned_start       TIMESTAMPTZ NOT NULL,
  planned_end         TIMESTAMPTZ,
  actual_start        TIMESTAMPTZ,
  actual_end          TIMESTAMPTZ,
  -- State machine
  status              TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','assigned','in_progress','completed','delayed','cancelled')),
  -- Odometer
  opening_odometer    INTEGER,
  closing_odometer    INTEGER,
  total_distance      INTEGER GENERATED ALWAYS AS (
    CASE WHEN closing_odometer IS NOT NULL AND opening_odometer IS NOT NULL
         THEN closing_odometer - opening_odometer ELSE NULL END
  ) STORED,
  -- Cost
  total_cost          NUMERIC(12,2),
  -- Cargo
  cargo_description   TEXT,
  cargo_weight_kg     INTEGER,
  -- Cancellation
  cancel_reason       TEXT,
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID REFERENCES users(id),
  -- Notes
  notes               TEXT,
  -- Audit
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id)
);

CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_branch ON trips(branch_id);
CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_planned_start ON trips(planned_start);
CREATE INDEX idx_trips_number_trgm ON trips USING GIN (trip_number gin_trgm_ops);

-- Prevent overlapping trip assignments per vehicle
-- (Active trips cannot overlap for same vehicle)
CREATE OR REPLACE FUNCTION check_vehicle_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vehicle_id IS NOT NULL AND NEW.status NOT IN ('cancelled','completed') THEN
    IF EXISTS (
      SELECT 1 FROM trips
      WHERE vehicle_id = NEW.vehicle_id
        AND id != NEW.id
        AND status NOT IN ('cancelled','completed')
        AND planned_start < COALESCE(NEW.planned_end, NEW.planned_start + INTERVAL '12 hours')
        AND COALESCE(planned_end, planned_start + INTERVAL '12 hours') > NEW.planned_start
    ) THEN
      RAISE EXCEPTION 'Vehicle % is already assigned to another trip in this time window', NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_overlap
  BEFORE INSERT OR UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION check_vehicle_overlap();

-- Auto-generate trip number
CREATE SEQUENCE trip_number_seq START 1;
CREATE OR REPLACE FUNCTION generate_trip_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trip_number := 'TRP-' || LPAD(nextval('trip_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trip_number
  BEFORE INSERT ON trips
  FOR EACH ROW
  WHEN (NEW.trip_number IS NULL OR NEW.trip_number = '')
  EXECUTE FUNCTION generate_trip_number();

-- Trip stops (delivery points)
CREATE TABLE trip_stops (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sequence            INTEGER NOT NULL,
  destination_name    TEXT NOT NULL,
  address             TEXT,
  contact_name        TEXT,
  contact_phone       TEXT,
  expected_arrival    TIMESTAMPTZ,
  actual_arrival      TIMESTAMPTZ,
  delivery_status     TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','partial','failed')),
  pod_file_path       TEXT,                          -- proof of delivery photo
  pod_signed_at       TIMESTAMPTZ,
  notes               TEXT,
  return_items        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stops_trip ON trip_stops(trip_id);
CREATE UNIQUE INDEX idx_stops_sequence ON trip_stops(trip_id, sequence);

-- Trip events (state machine log)
CREATE TABLE trip_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,                       -- 'status_change','assignment','note'
  from_status   TEXT,
  to_status     TEXT,
  actor_id      UUID REFERENCES users(id),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT,
  payload       JSONB
);

CREATE INDEX idx_events_trip ON trip_events(trip_id);
CREATE INDEX idx_events_occurred ON trip_events(occurred_at);

-- ─────────────────────────────────────────────────────────────
--  DISPATCH PLANNING (M04)
-- ─────────────────────────────────────────────────────────────

-- Dispatch calendar (daily planning notes)
CREATE TABLE dispatch_calendar (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date        DATE NOT NULL,
  branch_id   UUID NOT NULL REFERENCES branches(id),
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, branch_id)
);

-- ─────────────────────────────────────────────────────────────
--  AUDIT LOG — foundation (full UI in Phase 3)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES users(id),
  actor_email   TEXT,
  action        TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT')),
  table_name    TEXT,
  record_id     TEXT,
  before_value  JSONB,
  after_value   JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_occurred ON audit_logs(occurred_at DESC);

-- ─────────────────────────────────────────────────────────────
--  UPDATED_AT trigger (apply to all tables)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'branches','vendors','users','vehicles','vehicle_documents',
    'drivers','driver_documents','trips','trip_stops','dispatch_calendar'
  ]) LOOP
    EXECUTE format('
      CREATE TRIGGER trg_updated_at_%s
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
--  ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;

-- Helper function: get role code for current user
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT r.code FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is user super_admin or transport_mgr?
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('super_admin','transport_mgr');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Branches: everyone can read
CREATE POLICY "branches_read" ON branches FOR SELECT USING (true);
CREATE POLICY "branches_write" ON branches FOR ALL USING (is_manager());

-- Vehicles: all authenticated can read; managers+supervisors can write
CREATE POLICY "vehicles_read" ON vehicles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vehicles_write" ON vehicles FOR ALL
  USING (auth_role() IN ('super_admin','transport_mgr','transport_supv'));

-- Vehicle documents: same as vehicles
CREATE POLICY "vdocs_read" ON vehicle_documents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vdocs_write" ON vehicle_documents FOR ALL
  USING (auth_role() IN ('super_admin','transport_mgr','transport_supv'));

-- Drivers: all authenticated can read; managers+supervisors can write
CREATE POLICY "drivers_read" ON drivers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "drivers_write" ON drivers FOR ALL
  USING (auth_role() IN ('super_admin','transport_mgr','transport_supv'));

-- Driver documents
CREATE POLICY "ddocs_read" ON driver_documents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ddocs_write" ON driver_documents FOR ALL
  USING (auth_role() IN ('super_admin','transport_mgr','transport_supv'));

-- Trips: all authenticated can read; drivers can update own trip
CREATE POLICY "trips_read" ON trips FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "trips_update" ON trips FOR UPDATE
  USING (
    auth_role() IN ('super_admin','transport_mgr','transport_supv','branch_mgr')
    OR (auth_role() = 'driver' AND driver_id IN (
      SELECT id FROM drivers WHERE auth_user_id = auth.uid()
    ))
  );

-- Trip stops and events
CREATE POLICY "stops_all" ON trip_stops FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "events_all" ON trip_events FOR ALL USING (auth.uid() IS NOT NULL);

-- Audit logs: only admins
CREATE POLICY "audit_read" ON audit_logs FOR SELECT
  USING (auth_role() IN ('super_admin','transport_mgr'));
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users: own row + managers
CREATE POLICY "users_read_self" ON users FOR SELECT
  USING (id = auth.uid() OR is_manager());
CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (id = auth.uid() OR is_manager());
CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (is_manager());

-- ─────────────────────────────────────────────────────────────
--  FUEL ENTRIES — Phase 1 basic table (full module in Phase 2)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE fuel_entries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id        UUID NOT NULL REFERENCES vehicles(id),
  driver_id         UUID NOT NULL REFERENCES drivers(id),
  station_vendor_id UUID REFERENCES vendors(id),
  fuel_type         TEXT NOT NULL DEFAULT 'diesel',
  litres            NUMERIC(8,2) NOT NULL CHECK (litres > 0),
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  odometer          INTEGER NOT NULL CHECK (odometer > 0),
  station_name      TEXT,
  receipt_file_path TEXT,
  efficiency_kmpl   NUMERIC(6,2),
  anomaly_flag      BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_reason    TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id)
);

CREATE INDEX idx_fuel_vehicle ON fuel_entries(vehicle_id);
CREATE INDEX idx_fuel_driver  ON fuel_entries(driver_id);
CREATE INDEX idx_fuel_date    ON fuel_entries(created_at DESC);

ALTER TABLE fuel_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_read"  ON fuel_entries FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fuel_write" ON fuel_entries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "fuel_mgr"   ON fuel_entries FOR UPDATE USING (auth_role() IN ('super_admin','transport_mgr','transport_supv'));

CREATE TRIGGER trg_updated_at_fuel_entries
  BEFORE UPDATE ON fuel_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
