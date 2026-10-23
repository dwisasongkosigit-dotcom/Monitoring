export type UserRole =
  | 'Owner'
  | 'Manager'
  | 'Admin'
  | 'SPV Accounting'
  | 'SPV Tax'
  | 'Staff Accounting'
  | 'Staff Tax';

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  email: string;
  mustChangePassword?: boolean;
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
  id: string;
  name: string;
  type: 'Badan' | 'OP';
  entityType: 'PT' | 'CV' | 'Firma' | 'Lainnya' | '-';

  // 4 PIC Assignments
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

  // Aliases for compatibility
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
  pkpStatus: 'PKP' | 'Non-PKP' | 'Belum Diisi';
  pphRegime:
    | 'PPh Final UMKM'
    | 'PPh Badan Tarif Umum'
    | 'PPh OP Tarif Umum'
    | 'PPh Final Lainnya'
    | 'Belum Ditentukan';
  taxYearEffective: number;
  umkmFacilityStartYear?: number | null;
  umkmFacilityEndYear?: number | null;
  taxProfileNotes: string;
  taxProfileSource: string;
  accountingRisk: 'High' | 'Medium' | 'Low' | 'Not Assessed';
  accountingRiskReason: string;
  accountingRiskRecommendation: string;
  accountingRiskDate: string;
  accountingRiskAssessedBy: string;
  taxRisk: 'High' | 'Medium' | 'Low' | 'Not Assessed';
  taxRiskReason: string;
  taxRiskRecommendation: string;
  taxRiskDate: string;
  taxRiskAssessedBy: string;
  riskHistory: Array<{
    id: string;
    date: string;
    division: 'Accounting' | 'Tax';
    previousLevel: string;
    newLevel: string;
    reason: string;
    recommendation: string;
    assessedBy: string;
  }>;
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

export interface Job {
  id: string;
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
  history: Array<{
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    notes?: string;
  }>;
  version: number;
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

export interface Case {
  id: string;
  createdAt: string;
  clientId: string;
  clientName: string;
  division: 'Accounting' | 'Tax';
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
  timeline: Array<{
    id: string;
    date: string;
    userId: string;
    userName: string;
    activity: string;
    notes: string;
    nextStep?: string;
  }>;
  version: number;
  updatedAt: string;
  updatedBy?: string;
}

export type ActivityStatus = 'Selesai' | 'Perlu Follow-up' | 'Berlanjut';

export interface DailyActivity {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  division: 'Accounting' | 'Tax';
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

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  email: string;
  active: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  targetType?: string;
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
  type?: 'manual' | 'scheduled' | 'pre-restore';
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
  status?: 'valid' | 'corrupt';
  notes?: string;
}

const TOKEN_KEY = 'tmm_bma_session_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'Terjadi kesalahan pada sistem.';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorData.message || errorMsg;
    } catch {
      // response might not be JSON
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: () => request<any>('/api/health'),

  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ token: string; user: CurrentUser; branding: BrandingConfig }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getMe: () => request<{ user: CurrentUser; branding: BrandingConfig }>('/api/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  // Branding
  getBranding: () => request<BrandingConfig>('/api/branding'),
  updateBranding: (data: Partial<BrandingConfig> & { resetToDefault?: boolean }) =>
    request<{ success: boolean; branding: BrandingConfig; message: string }>('/api/branding', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Users
  getUsers: () => request<UserAccount[]>('/api/users'),
  createUser: (data: any) =>
    request<{ success: boolean; user: UserAccount; message: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: any) =>
    request<{ success: boolean; user: UserAccount; message: string }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Clients
  getClients: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Client[]>(`/api/clients${qs}`);
  },
  getClient: (id: string) => request<Client>(`/api/clients/${id}`),
  createClient: (data: Partial<Client>) =>
    request<{ success: boolean; client: Client; message: string }>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateClient: (id: string, data: Partial<Client> & { expectedVersion?: number }) =>
    request<{ success: boolean; client: Client; message: string }>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  terminateClient: (id: string, data: { terminationReason: string; terminationDate?: string }) =>
    request<{ success: boolean; client: Client; message: string }>(`/api/clients/${id}/terminate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteClient: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/clients/${id}`, {
      method: 'DELETE',
    }),

  // Jobs
  getJobs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Job[]>(`/api/jobs${qs}`);
  },
  createJob: (data: Partial<Job>) =>
    request<{ success: boolean; job: Job; message: string }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateJob: (id: string, data: any) =>
    request<{ success: boolean; job: Job; message: string }>(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteJob: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/jobs/${id}`, {
      method: 'DELETE',
    }),

  // Cases
  getCases: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Case[]>(`/api/cases${qs}`);
  },
  createCase: (data: Partial<Case>) =>
    request<{ success: boolean; case: Case; message: string }>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCase: (id: string, data: Partial<Case>) =>
    request<{ success: boolean; case: Case; message: string }>(`/api/cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCase: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/cases/${id}`, {
      method: 'DELETE',
    }),
  addCaseTimeline: (id: string, data: { activity: string; notes?: string; nextStep?: string; date?: string }) =>
    request<{ success: boolean; case: Case; message: string }>(`/api/cases/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCaseTimeline: (caseId: string, timelineId: string) =>
    request<{ success: boolean; case: Case; message: string }>(`/api/cases/${caseId}/timeline/${timelineId}`, {
      method: 'DELETE',
    }),

  // Daily Activities
  getDailyActivities: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<DailyActivity[]>(`/api/daily-activities${qs}`);
  },
  createDailyActivity: (data: Partial<DailyActivity>) =>
    request<{ success: boolean; activity: DailyActivity; message: string }>('/api/daily-activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDailyActivity: (id: string, data: Partial<DailyActivity>) =>
    request<{ success: boolean; activity: DailyActivity; message: string }>(`/api/daily-activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDailyActivity: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/daily-activities/${id}`, {
      method: 'DELETE',
    }),

  // Stats
  getStats: () => request<any>('/api/stats'),

  // Backup & Restore
  createBackupNow: (notes?: string) =>
    request<{ success: boolean; backup: BackupInfo; message: string }>('/api/backup/now', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  getBackups: () => request<BackupInfo[]>('/api/backup/list'),
  restoreBackup: (filename: string) =>
    request<{ success: boolean; message: string; version: number }>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    }),

  // Audit Logs
  getAuditLogs: (limit = 200) => request<AuditLog[]>(`/api/audit-logs?limit=${limit}`),

  // Excel Report Download
  downloadExcelReport: async () => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/reports/excel', { headers });
    if (!res.ok) {
      throw new Error('Gagal menghasilkan file Excel.');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TMM_BMA_Management_Activity_Report_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
