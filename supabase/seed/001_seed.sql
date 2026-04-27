-- ═══════════════════════════════════════════════════════════
--  FFC TMS — Seed Data
--  Run AFTER migration 001
-- ═══════════════════════════════════════════════════════════

-- Branches
INSERT INTO branches (code, name, entity, city, address) VALUES
  ('FFC-HQ',  'FFC Headquarters',  'FFC', 'Abu Dhabi', 'Mussafah Industrial Area, Abu Dhabi'),
  ('TFM-DXB', 'TFM Dubai',         'TFM', 'Dubai',     'Al Quoz Industrial Area, Dubai'),
  ('MS-SHJ',  'MS Sharjah Branch', 'MS',  'Sharjah',   'Sharjah Industrial Area, Sharjah'),
  ('VS-AJM',  'VS Ajman Branch',   'VS',  'Ajman',     'Ajman Industrial Area, Ajman'),
  ('FFC-ALN', 'Al Ain Depot',      'FFC', 'Al Ain',    'Al Ain Industrial City, Al Ain');

-- Vendors
INSERT INTO vendors (code, name, type) VALUES
  ('VND-ENOC',      'ENOC Fuel Stations',       'fuel'),
  ('VND-ADNOC',     'ADNOC Distribution',        'fuel'),
  ('VND-TOYOTA',    'Al Futtaim Motors Toyota',  'garage'),
  ('VND-ISUZU',     'Isuzu Trucks UAE',          'garage'),
  ('VND-FORD',      'Ford Service UAE',          'garage'),
  ('VND-MERCEDES',  'Mercedes-Benz UAE',         'garage'),
  ('VND-GALADARI',  'Galadari Trucks',           'garage'),
  ('VND-RSA',       'RSA Insurance',             'insurance'),
  ('VND-AXA',       'AXA/GIG Insurance',         'insurance'),
  ('VND-RENT1',     'Al Habtoor Motors Rental',  'rental'),
  ('VND-GPS1',      'Mix Telematics UAE',        'gps');

-- NOTE: Vehicles and Drivers are created via the app UI or API
-- after users are set up in Supabase Auth.
-- Sample vehicles for dev/testing only:

-- INSERT INTO vehicles (vehicle_number, vehicle_code, vehicle_type, make, model, year,
--   branch_id, status, current_odometer, mulkiya_expiry, insurance_expiry)
-- SELECT
--   'TXB-2201', 'VEH-001', 'pickup', 'Toyota', 'Hilux', 2022,
--   (SELECT id FROM branches WHERE code='FFC-HQ'), 'available', 142300,
--   '2027-04-25', '2027-05-04'
-- WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE vehicle_number='TXB-2201');
