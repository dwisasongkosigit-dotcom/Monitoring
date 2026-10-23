export type UserRole =
  | 'Owner'
  | 'Manager'
  | 'Admin'
  | 'SPV Accounting'
  | 'SPV Tax'
  | 'Staff Accounting'
  | 'Staff Tax';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  email: string;
  active: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandingConfig {
  appName: string;
  companyName: string;
  subtitle: string;
  logoUrl: string;
  faviconUrl?: string;
  updatedAt: string;
  updatedBy: string;
}

export type ClientType = 'Badan' | 'OP';
export type EntityType = 'PT' | 'CV' | 'Firma' | 'Lainnya' | '-';
export type PkpStatus = 'PKP' | 'Non-PKP' | 'Belum Diisi';
export type PphRegime =
  | 'PPh Final UMKM'
  | 'PPh Badan Tarif Umum'
  | 'PPh OP Tarif Umum'
  | 'PPh Final Lainnya'
  | 'Belum Ditentukan';
export type RiskLevel = 'High' | 'Medium' | 'Low' | 'Not Assessed';

export interface RiskHistoryItem {
  id: string;
  date: string;
  division: 'Accounting' | 'Tax';
  previousLevel: RiskLevel;
  newLevel: RiskLevel;
  reason: string;
  recommendation: string;
  assessedBy: string;
}

export interface PicHistoryItem {
  id: string;
  timestamp: string;
  changedBy: string;
  accountingStaff: string;
  taxStaff: string;
  accountingSpv: string;
  taxSpv: string;
  notes?: string;
}

export interface Client {
  id: string; // e.g. CLI-001
  name: string;
  type: ClientType;
  entityType: EntityType;

  // 4 PIC Assignments (Prompt 2 requirement)
  accountingStaffPicId: string;
  accountingStaffPicName: string;
  taxStaffPicId: string;
  taxStaffPicName: string;
  accountingSpvId: string;
  accountingSpvName: string;
  taxSpvId: string;
  taxSpvName: string;
  picAssignmentStatus: 'Lengkap' | 'Belum Lengkap';
  picHistory: PicHistoryItem[];
  picChangeNotes?: string;

  // Backward compatibility alias fields
  accountingPicId: string;
  accountingPicName: string;
  taxPicId: string;
  taxPicName: string;
  spvId: string;
  spvName: string;

  status: 'Aktif' | 'Tidak Aktif' | 'Putus Kontrak';
  terminationDate?: string;
  terminationReason?: string;
  notes: string;
  npwp?: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;

  // Tax Profile (PKP separated from PPh regime)
  pkpStatus: PkpStatus;
  pphRegime: PphRegime;
  taxYearEffective: number;
  umkmFacilityStartYear?: number | null;
  umkmFacilityEndYear?: number | null;
  taxProfileNotes: string;
  taxProfileSource: string;

  // Accounting Risk Assessment
  accountingRisk: RiskLevel;
  accountingRiskReason: string;
  accountingRiskRecommendation: string;
  accountingRiskDate: string;
  accountingRiskAssessedBy: string;

  // Tax Risk Assessment
  taxRisk: RiskLevel;
  taxRiskReason: string;
  taxRiskRecommendation: string;
  taxRiskDate: string;
  taxRiskAssessedBy: string;

  riskHistory: RiskHistoryItem[];
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export type JobDivision = 'Accounting' | 'Tax';
export type JobPriority = 'Rendah' | 'Sedang' | 'Tinggi' | 'Mendesak';
export type JobStatus =
  | 'Belum Dimulai'
  | 'Dalam Proses'
  | 'Menunggu Klien'
  | 'Siap Direview'
  | 'Perlu Revisi'
  | 'Selesai';

export interface JobHistoryItem {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  fromStatus?: JobStatus;
  toStatus?: JobStatus;
  notes?: string;
}

export interface Job {
  id: string; // e.g. JOB-2026-001
  clientId: string;
  clientName: string;
  division: JobDivision;
  title: string;
  picId: string;
  picName: string;
  spvId: string;
  spvName: string;
  createdAt: string;
  startDate: string;
  deadline: string;
  priority: JobPriority;
  description: string;
  notes: string;
  status: JobStatus;
  progressPercent: number;
  reviewNotes?: string;
  completedAt?: string;
  approvedBy?: string;
  history: JobHistoryItem[];
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export type CaseStatus =
  | 'Open'
  | 'In Progress'
  | 'Waiting for Client'
  | 'Waiting Internal'
  | 'Resolved'
  | 'Closed';

export interface CaseTimelineItem {
  id: string;
  date: string;
  userId: string;
  userName: string;
  activity: string;
  notes: string;
  nextStep?: string;
}

export interface Case {
  id: string; // e.g. CAS-2026-001
  createdAt: string;
  clientId: string;
  clientName: string;
  division: JobDivision;
  title: string;
  description: string;
  priority: 'Tinggi' | 'Sedang' | 'Rendah';
  picId: string;
  picName: string;
  rootCause: string;
  actionsTaken: string;
  latestProgress: string;
  status: CaseStatus;
  followUpPlan: string;
  nextFollowUpDate: string;
  followUpPicId: string;
  followUpPicName: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  timeline: CaseTimelineItem[];
  version?: number;
  updatedAt: string;
  updatedBy?: string;
}

export type ActivityStatus = 'Selesai' | 'Perlu Follow-up' | 'Berlanjut';

export interface DailyActivity {
  id: string; // e.g. ACT-2026-001
  date: string;
  clientId: string;
  clientName: string;
  division: JobDivision;
  picId: string;
  picName: string;
  jobId?: string;
  caseId?: string;
  description: string;
  resultProgress: string;
  obstacles: string;
  followUp: string;
  status: ActivityStatus;
  durationMinutes?: number;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  action: string;
  targetType: 'Client' | 'Job' | 'Case' | 'Activity' | 'User' | 'Branding' | 'Backup' | 'Auth' | 'System';
  target?: string;
  targetId?: string;
  targetName?: string;
  details: any;
  ip?: string;
}

export interface BackupInfo {
  id: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  type: 'manual' | 'scheduled' | 'pre-restore';
  trigger?: 'manual' | 'scheduled' | 'pre-restore';
  recordsCount: {
    clients: number;
    jobs: number;
    cases: number;
    activities: number;
    users?: number;
  };
  recordCounts?: {
    clients: number;
    jobs: number;
    cases: number;
    activities: number;
  };
  status: 'valid' | 'corrupt';
  notes?: string;
}

export interface DatabaseSchema {
  branding: BrandingConfig;
  users: User[];
  clients: Client[];
  jobs: Job[];
  cases: Case[];
  activities: DailyActivity[];
  auditLogs: AuditLog[];
  backups: BackupInfo[];
  version: number;
  lastSaved: string;
}
