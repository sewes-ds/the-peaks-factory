export type AdminSession = {
  session_id: string;
  employee_id: string;
  full_name: string;
  role_name: string;
  auth_method: 'PASSWORD' | 'TELEGRAM_QR';
  must_change_password: boolean;
  created_at: string;
  last_seen_at?: string;
  idle_expires_at: string;
  expires_at: string;
};

export type AdminTelegramQrChallenge = {
  challenge_id: string;
  expires_at: string;
  poll_after_ms: number;
  qr_image_src: string;
};

export type AdminTelegramQrClaim =
  | { status: 'PENDING' | 'EXPIRED' | 'ALREADY_USED' | 'FORBIDDEN' | 'UNAVAILABLE' }
  | { status: 'AUTHENTICATED'; session: AdminSession };

export type AdminOverview = {
  counts: {
    employees: number;
    machines: number;
    skus: number;
    active_sessions: number;
  };
  attention: Array<{
    code: 'BROKEN_MACHINES' | 'SKU_PRODUCTIVITY_MISSING' | 'ADDITIONAL_WORK_OPEN';
    count: number;
  }>;
  recent_actions: Array<{
    audit_event_id: string;
    action_name: string;
    entity_table_name: string;
    entity_record_id: string;
    actor_full_name: string;
    created_at: string;
  }>;
};

export type AdminDirectory = {
  employees: Array<{
    employee_id: string;
    full_name: string;
    phone_e164: string;
    position_id: string;
    position_name: string;
    employee_status_id: string;
    employee_status_name: string;
    is_active_for_login: boolean;
    telegram_is_bound: boolean;
    role_names: string[];
  }>;
  positions: Array<{
    position_id: string;
    position_name: string;
    position_description: string | null;
    is_production_position: boolean;
    is_active: boolean;
    employee_count: number;
  }>;
  employee_statuses: Array<{
    employee_status_id: string;
    employee_status_name: string;
    is_active_for_login: boolean;
    is_final: boolean;
    is_active: boolean;
  }>;
  machines: Array<{
    machine_id: string;
    machine_name: string;
    workshop_name: string | null;
    machine_status_id: string;
    machine_status_name: string;
    machine_use_status_id: string;
    machine_use_status_name: string;
    machine_use_is_decommissioned: boolean;
    qr_is_assigned: boolean;
  }>;
  machine_use_statuses: Array<{
    machine_use_status_id: string;
    machine_use_status_name: string;
    is_decommissioned: boolean;
    is_active: boolean;
  }>;
  skus: Array<{
    sku_id: string;
    sku_code: string;
    sku_name: string | null;
    sku_unit_id: string;
    sku_unit_name: string;
    planned_productivity_per_hour: string | null;
    current_sku_tariff_uzs: string;
    is_active: boolean;
    qr_is_assigned: boolean;
  }>;
  sku_units: Array<{
    sku_unit_id: string;
    sku_unit_name: string;
    allows_fractional_quantity: boolean;
    is_active: boolean;
  }>;
  additional_work_types: Array<{
    additional_work_type_id: string;
    additional_work_type_name: string;
    is_active: boolean;
  }>;
  activity_profiles: Array<{
    activity_class: ActivityClass;
    profile_id: string;
    technical_code: string;
    profile_name: string;
    is_active: boolean;
  }>;
  activity_types: Array<{
    activity_class: ActivityClass;
    activity_type_id: string;
    technical_code: string;
    display_name: string;
    display_order: number;
    profile_id: string;
    profile_name: string;
    is_active: boolean;
  }>;
  audit_events: Array<{
    audit_event_id: string;
    action_name: string;
    entity_table_name: string;
    entity_record_id: string;
    actor_full_name: string;
    reason: string | null;
    created_at: string;
  }>;
};

export type ActivityClass = 'BREAK' | 'OPERATIONAL' | 'CRITICAL';

export type ActivityOrderDirection = 'UP' | 'DOWN';

export type AdminMutationResult = {
  created?: boolean;
  qr_rotated?: boolean;
  employee_id?: string;
  position_id?: string;
  machine_id?: string;
  sku_id?: string;
  additional_work_type_id?: string;
  activity_type_id?: string;
  activity_class?: ActivityClass;
  is_active?: boolean;
  moved?: boolean;
};
