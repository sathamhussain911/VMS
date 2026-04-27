// ─────────────────────────────────────────────────────────────
//  FFC TMS — TypeScript types matching Supabase schema
//  Auto-generate the full version with: supabase gen types typescript
// ─────────────────────────────────────────────────────────────

export type VehicleType = 'pickup' | 'van' | 'truck_medium' | 'truck_heavy' | 'reefer' | 'tanker' | 'other'
export type VehicleStatus = 'available' | 'assigned' | 'maintenance' | 'inactive'
export type OwnershipType = 'owned' | 'rented' | 'leased'

export type DriverStatus = 'active' | 'on_leave' | 'suspended' | 'terminated'
export type DutyStatus = 'on_duty' | 'off_duty' | 'on_trip'

export type TripStatus = 'requested' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
export type TripPriority = 'normal' | 'urgent' | 'planned'
export type DeliveryStatus = 'pending' | 'delivered' | 'partial' | 'failed'

export type RoleCode = 'super_admin' | 'transport_mgr' | 'transport_supv' | 'branch_mgr' | 'driver' | 'finance' | 'maintenance' | 'readonly_mgmt'

export interface Branch {
  id: string
  code: string
  name: string
  entity: 'FFC' | 'TFM' | 'MS' | 'VS'
  city: string | null
  address: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface Vendor {
  id: string
  code: string
  name: string
  type: 'rental' | 'garage' | 'fuel' | 'gps' | 'insurance' | 'other'
  contact_name: string | null
  contact_phone: string | null
  email: string | null
  status: string
}

export interface Role {
  id: string
  code: RoleCode
  name: string
  description: string | null
}

export interface User {
  id: string
  email: string
  full_name: string
  employee_id: string | null
  role_id: string
  branch_id: string | null
  status: 'active' | 'inactive' | 'suspended'
  last_login_at: string | null
  created_at: string
  updated_at: string
  // Joined
  role?: Role
  branch?: Branch
}

export interface Vehicle {
  id: string
  vehicle_number: string
  vehicle_code: string | null
  vin: string | null
  engine_number: string | null
  vehicle_type: VehicleType
  make: string
  model: string
  year: number | null
  capacity_kg: number | null
  refrigeration_class: string | null
  color: string | null
  ownership_type: OwnershipType
  vendor_id: string | null
  lease_start: string | null
  lease_end: string | null
  monthly_rental: number | null
  branch_id: string
  current_driver_id: string | null
  status: VehicleStatus
  current_odometer: number
  mulkiya_number: string | null
  mulkiya_issue_date: string | null
  mulkiya_expiry: string | null
  insurance_policy: string | null
  insurance_expiry: string | null
  salik_tag: string | null
  gps_device_id: string | null
  gps_vendor: string | null
  gps_contract_expiry: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  branch?: Branch
  current_driver?: Driver
}

export interface VehicleDocument {
  id: string
  vehicle_id: string
  doc_type: string
  doc_number: string | null
  issue_date: string | null
  expiry_date: string | null
  file_path: string | null
  file_name: string | null
  notes: string | null
  status: 'valid' | 'expiring' | 'expired'
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface Driver {
  id: string
  driver_code: string
  employee_id: string | null
  full_name: string
  mobile: string | null
  alternate_mobile: string | null
  email: string | null
  date_of_birth: string | null
  nationality: string | null
  eid_number: string | null
  eid_expiry: string | null
  license_number: string | null
  license_class: string | null
  license_issue_date: string | null
  license_expiry: string | null
  passport_number: string | null
  passport_expiry: string | null
  employment_type: 'employee' | 'contractor'
  branch_id: string
  joining_date: string | null
  status: DriverStatus
  duty_status: DutyStatus
  performance_score: number | null
  pin_hash: string | null
  pin_expires_at: string | null
  auth_user_id: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  branch?: Branch
}

export interface Trip {
  id: string
  trip_number: string
  requester_id: string
  branch_id: string
  vehicle_id: string | null
  driver_id: string | null
  vehicle_type_needed: VehicleType | 'any' | null
  priority: TripPriority
  planned_start: string
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  status: TripStatus
  opening_odometer: number | null
  closing_odometer: number | null
  total_distance: number | null
  total_cost: number | null
  cargo_description: string | null
  cargo_weight_kg: number | null
  cancel_reason: string | null
  cancelled_at: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  branch?: Branch
  vehicle?: Vehicle
  driver?: Driver
  requester?: User
  stops?: TripStop[]
  events?: TripEvent[]
}

export interface TripStop {
  id: string
  trip_id: string
  sequence: number
  destination_name: string
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  expected_arrival: string | null
  actual_arrival: string | null
  delivery_status: DeliveryStatus
  pod_file_path: string | null
  pod_signed_at: string | null
  notes: string | null
  return_items: string | null
  created_at: string
  updated_at: string
}

export interface TripEvent {
  id: string
  trip_id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  actor_id: string | null
  occurred_at: string
  notes: string | null
  payload: Record<string, unknown> | null
  // Joined
  actor?: User
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT'
  table_name: string | null
  record_id: string | null
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  occurred_at: string
}

// Dashboard KPI types
export interface DashboardKPIs {
  totalVehicles: number
  activeVehicles: number
  vehiclesInMaintenance: number
  fleetAvailabilityPct: number
  totalDrivers: number
  activeDrivers: number
  tripsToday: number
  tripsCompleted: number
  tripsInProgress: number
  tripsPending: number
  onTimeDeliveryPct: number
  expiringDocuments: number
  expiredDocuments: number
}

// Dispatch board types
export interface DispatchBoardData {
  date: string
  vehicles: Array<Vehicle & { todayTrips: Trip[] }>
  pendingTrips: Trip[]
  availableDrivers: Driver[]
}

// Database namespace (for Supabase generic typing)
export type Database = {
  public: {
    Tables: {
      branches: { Row: Branch; Insert: Partial<Branch>; Update: Partial<Branch> }
      vehicles: { Row: Vehicle; Insert: Partial<Vehicle>; Update: Partial<Vehicle> }
      drivers: { Row: Driver; Insert: Partial<Driver>; Update: Partial<Driver> }
      trips: { Row: Trip; Insert: Partial<Trip>; Update: Partial<Trip> }
      trip_stops: { Row: TripStop; Insert: Partial<TripStop>; Update: Partial<TripStop> }
      trip_events: { Row: TripEvent; Insert: Partial<TripEvent>; Update: Partial<TripEvent> }
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog>; Update: Partial<AuditLog> }
    }
    Functions: {
      auth_role: { Returns: string }
      is_manager: { Returns: boolean }
    }
  }
}
