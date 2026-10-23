import {
  LayoutDashboard,
  Building2,
  Briefcase,
  AlertCircle,
  Clock,
  CalendarCheck,
  FileSpreadsheet,
  Settings,
  Users,
  LogOut,
  Database,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { CurrentUser, BrandingConfig } from '../lib/api';

export type NavTab =
  | 'dashboard'
  | 'clients'
  | 'jobs'
  | 'cases'
  | 'followup'
  | 'activities'
  | 'reports'
  | 'backup'
  | 'audit'
  | 'branding'
  | 'users';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: CurrentUser;
  branding: BrandingConfig;
  onLogout: () => void;
  dbStatus: { status: string; storageEngine: string; lastSaved?: string; count?: number } | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  currentUser,
  branding,
  onLogout,
  dbStatus,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const isAdmin = currentUser.role === 'Admin';
  const isOwnerOrManager = currentUser.role === 'Owner' || currentUser.role === 'Manager';
  const canViewAudit = isAdmin || isOwnerOrManager;

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: any;
    adminOnly?: boolean;
    auditOnly?: boolean;
    badge?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Master Klien', icon: Building2 },
    { id: 'jobs', label: 'Job Management', icon: Briefcase },
    { id: 'cases', label: 'Case Register', icon: AlertCircle },
    { id: 'followup', label: 'Follow-up', icon: Clock },
    { id: 'activities', label: 'Daily Activity', icon: CalendarCheck },
    { id: 'reports', label: 'Laporan & Audit', icon: FileSpreadsheet },
    { id: 'backup', label: 'Cadangan & Pemulihan', icon: Database, adminOnly: true },
    { id: 'audit', label: 'Audit Log Sistem', icon: ShieldCheck, auditOnly: true },
    { id: 'branding', label: 'Pengaturan Aplikasi', icon: Settings, adminOnly: true },
    { id: 'users', label: 'Manajemen Pengguna', icon: Users, adminOnly: true },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#0a1128] border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Area */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3.5">
          <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-amber-500/30 bg-[#0f172a] shrink-0 shadow-sm flex items-center justify-center">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName || 'TMM/BMA Logo'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            {/* Fallback Monogram */}
            <span className="font-bold text-xs tracking-wider text-amber-300">TMM</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-white truncate tracking-tight">
              {branding.appName || 'TMM/BMA Control Center'}
            </h1>
            <p className="text-[11px] text-amber-400/90 font-medium truncate">
              {branding.companyName || 'TMM & BMA Advisory'}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            Menu Operasional
          </div>
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            if (item.auditOnly && !canViewAudit) return null;
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Database Persistence Status Badge */}
        <div className="px-4 py-3 mx-3 my-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-200">Database Persisten Aktif</span>
          </div>
          <p className="text-[10px] text-slate-400 line-clamp-1">
            Penyimpanan Disk ACID: Data bisnis tidak reset saat browser ditutup.
          </p>
        </div>

        {/* Current User Card */}
        <div className="p-3 border-t border-slate-800/80 bg-[#070d1e]">
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-xs font-semibold text-white truncate">{currentUser.name}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-amber-300/80 font-medium truncate">
                  {currentUser.role}
                </span>
                {isOwnerOrManager && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-semibold border border-amber-500/30">
                    Read-Only
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Keluar (Logout)"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800/70 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
