export type Role = 'super_admin' | 'admin' | 'instructor';

export interface Facility {
  id: string;
  name: string;
  short_code: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  active?: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  title: string | null;
  phone: string | null;
  role: Role;
  hwc_cert_number: string | null;
  hwc_cert_expires: string | null;
  signature_id: string | null;
  active: boolean;
  invited_by: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  facility_id: string;
  first_name: string;
  middle_initial: string | null;
  last_name: string;
  preferred_name: string | null;
  employee_id: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  student_type: string | null;
  hire_date: string | null;
  status: 'active' | 'inactive' | 'on_leave' | 'separated';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Personnel {
  name: string;
  title: string;
}

/** Theme id from the THEMES catalogue in lib/certificate.ts (27 colour & style options). */
export type CertTheme = string;
export type CertLayout = 'classic' | 'modern' | 'heritage';

export interface Certificate {
  id: string;
  cert_number: string;
  verify_code: string;
  student_id: string;
  enrollment_id: string | null;
  facility_id: string;
  student_name: string;
  facility_name: string;
  program_verbal: boolean;
  program_physical: boolean;
  program_label: string;
  issue_date: string;
  expiration_date: string;
  signature_id: string | null;
  signer_name: string | null;
  signer_title: string;
  instructor_cert_number: string | null;
  personnel: Personnel[];
  theme: CertTheme;
  layout: CertLayout;
  status: 'active' | 'revoked';
  revoked_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  facility_id: string;
  title: string | null;
  course_type: string;
  program_verbal: boolean;
  program_physical: boolean;
  location: string | null;
  start_date: string;
  end_date: string | null;
  hours: number | null;
  capacity: number | null;
  lead_instructor_id: string | null;
  co_instructor_ids: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  session_id: string;
  student_id: string;
  attendance: 'present' | 'absent' | 'partial';
  verbal_passed: boolean | null;
  physical_passed: boolean | null;
  written_score: number | null;
  result: 'pending' | 'pass' | 'fail' | 'incomplete';
  attempt: number;
  remediation_notes: string | null;
}

export interface Incident {
  id: string;
  facility_id: string;
  session_id: string | null;
  occurred_at: string;
  location: string | null;
  involved_role: 'student' | 'instructor' | 'observer';
  student_id: string | null;
  involved_instructor_id: string | null;
  incident_type: string;
  technique: string | null;
  body_part: string | null;
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  injury: boolean;
  first_aid: boolean;
  medical_referral: boolean;
  lost_time: boolean;
  description: string;
  contributing_factors: string[];
  corrective_action: string | null;
  followup_owner: string | null;
  followup_due: string | null;
  followup_status: 'open' | 'in_progress' | 'closed';
  reported_by: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  facility_ids: string[];
  invited_by: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'failed';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export type LookupCategory =
  | 'student_type'
  | 'department'
  | 'course_type'
  | 'technique'
  | 'incident_type'
  | 'body_part'
  | 'location'
  | 'job_title'
  | 'contributing_factor';

export interface LookupValue {
  id: string;
  category: LookupCategory;
  value: string;
  sort_order: number;
  active: boolean;
}

export interface CertificateSettings {
  expiration_months: number;
  default_theme: CertTheme;
  default_layout: CertLayout;
  program_label: string;
  signer_title: string;
  footer_text: string;
  show_qr: boolean;
}

export interface MyContext {
  profile: Profile;
  is_super_admin: boolean;
  facilities: Pick<Facility, 'id' | 'name' | 'short_code'>[];
}
