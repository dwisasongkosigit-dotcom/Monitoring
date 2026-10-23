import { Menu, RefreshCw, Database, Shield } from 'lucide-react';
import type { CurrentUser, BrandingConfig } from '../lib/api';

interface HeaderProps {
  currentTab: string;
  onOpenMobileSidebar: () => void;
  currentUser: CurrentUser;
  branding: BrandingConfig;
  onRefreshData: () => void;
  isRefreshing?: boolean;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard Eksekutif', subtitle: 'Kendali operasional & matriks risiko klien terkini' },
  clients: { title: 'Master Klien', subtitle: 'Kelola basis 50+ klien, profil PKP, rezim PPh & asesmen risiko' },
  jobs: { title: 'Job Management', subtitle: 'Pendelegasian, tracking progres, dan alur approval SPV' },
  cases: { title: 'Case Register', subtitle: 'Pencatatan masalah, akar penyebab, dan kronologi penanganan' },
  followup: { title: 'Follow-up Tracker', subtitle: 'Pengawasan tindak lanjut jatuh tempo & mitigasi keterlambatan' },
  activities: { title: 'Daily Activity Log', subtitle: 'Jurnal harian penanganan pekerjaan staf akuntansi dan pajak' },
  reports: { title: 'Laporan & Rekapitulasi', subtitle: 'Audit kepatuhan, pemenuhan SLA, dan eksposur risiko fiskal' },
  backup: { title: 'Cadangan & Pemulihan Data', subtitle: 'Manajemen snapshot database, retensi 30 hari & restorasi aman' },
  audit: { title: 'Audit Log Sistem Terpadu', subtitle: 'Rekam jejak mutasi data, login, dan aktivitas operasional staf' },
  branding: { title: 'Pengaturan Aplikasi & Branding', subtitle: 'Kustomisasi judul, logo, dan identitas perusahaan konsultan' },
  users: { title: 'Manajemen Pengguna & Hak Akses', subtitle: 'Pengaturan akun, peran (RBAC), dan otorisasi sistem' },
};

export function Header({
  currentTab,
  onOpenMobileSidebar,
  currentUser,
  branding,
  onRefreshData,
  isRefreshing = false,
}: HeaderProps) {
  const meta = TAB_TITLES[currentTab] || { title: 'Control Center', subtitle: 'Sistem Terpadu' };

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
              {meta.title}
            </h2>
            <span className="hidden md:inline-block text-xs text-slate-300 font-normal">|</span>
            <span className="hidden md:inline-block text-xs text-slate-500 font-normal truncate">
              {meta.subtitle}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Date display */}
        <div className="hidden sm:flex items-center text-xs text-slate-500 font-medium">
          {todayStr}
        </div>

        {/* Database Live Persistence Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>Server DB: Tersimpan</span>
        </div>

        {/* Role Tag & Read-Only Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span>{currentUser.role}</span>
          {(currentUser.role === 'Owner' || currentUser.role === 'Manager') && (
            <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-bold">
              Read-Only
            </span>
          )}
        </div>

        {/* Refresh Data Button */}
        <button
          onClick={onRefreshData}
          disabled={isRefreshing}
          title="Sinkronkan data dengan database server"
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
        </button>
      </div>
    </header>
  );
}
