import { useState, useEffect, useCallback } from 'react';
import {
  api,
  removeToken,
  type CurrentUser,
  type BrandingConfig,
  type Client,
  type Job,
  type Case,
  type DailyActivity,
} from './lib/api';
import { ToastProvider, useToast } from './components/Toast';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { ClientsView } from './components/ClientsView';
import { JobsView } from './components/JobsView';
import { CasesView } from './components/CasesView';
import { FollowUpView } from './components/FollowUpView';
import { DailyActivitiesView } from './components/DailyActivitiesView';
import { ReportsView } from './components/ReportsView';
import { BackupRestoreView } from './components/BackupRestoreView';
import { AuditLogView } from './components/AuditLogView';
import { BrandingSettingsView } from './components/BrandingSettingsView';
import { UserManagementView } from './components/UserManagementView';
import { AlertCircle, RefreshCw, Database } from 'lucide-react';

function MainApp() {
  const { error, success } = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branding, setBranding] = useState<BrandingConfig>({
    appName: 'TMM/BMA Client Control Center',
    companyName: 'TMM & BMA Advisory',
    subtitle: 'Tax & Accounting Client Control Center',
    logoUrl: '/src/assets/images/tmm_bma_logo_1792761458459.jpg',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System',
  });

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);

  // States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Fetch initial branding and check auth session
  const initializeAuthAndBranding = useCallback(async () => {
    try {
      const [brandData, healthData] = await Promise.all([
        api.getBranding().catch(() => null),
        api.getHealth().catch(() => null),
      ]);

      if (brandData) setBranding(brandData);
      if (healthData) setDbHealth(healthData);

      // Check current session
      const meRes = await api.getMe();
      if (meRes?.user) {
        setCurrentUser(meRes.user);
        if (meRes.branding) setBranding(meRes.branding);
      }
    } catch {
      // Not logged in or session expired
      setCurrentUser(null);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  // Fetch all business operational data from persistent database
  const loadAllBusinessData = useCallback(async () => {
    if (!currentUser) return;
    setIsRefreshing(true);
    setConnectionError(null);

    try {
      const [clientsData, jobsData, casesData, activitiesData, statsData, healthData] =
        await Promise.all([
          api.getClients(),
          api.getJobs(),
          api.getCases(),
          api.getDailyActivities(),
          api.getStats(),
          api.getHealth(),
        ]);

      setClients(clientsData);
      setJobs(jobsData);
      setCases(casesData);
      setActivities(activitiesData);
      setStats(statsData);
      setDbHealth(healthData);
    } catch (err: any) {
      console.error('[App] Gagal memuat data dari database server:', err);
      setConnectionError(
        err.message || 'Koneksi ke database server terputus. Data Anda aman di disk server.'
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    initializeAuthAndBranding();
  }, [initializeAuthAndBranding]);

  useEffect(() => {
    if (currentUser) {
      loadAllBusinessData();
    }
  }, [currentUser, loadAllBusinessData]);

  const handleLoginSuccess = (user: CurrentUser, brandData: BrandingConfig) => {
    setCurrentUser(user);
    if (brandData) setBranding(brandData);
    success('Login Berhasil', `Selamat datang kembali, ${user.name} (${user.role}).`);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    removeToken();
    setCurrentUser(null);
    setCurrentTab('dashboard');
    success('Logout Berhasil', 'Sesi Anda telah aman ditutup.');
  };

  // Initial loading screen
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#070d1e] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold tracking-tight">Memverifikasi Database Persisten Server...</h2>
        <p className="text-xs text-slate-400 mt-1">TMM/BMA Client Control Center</p>
      </div>
    );
  }

  // Not logged in: Show luxury login view
  if (!currentUser) {
    return <LoginView branding={branding} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        branding={branding}
        onLogout={handleLogout}
        dbStatus={dbHealth}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 transition-all">
        {/* Header */}
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          currentUser={currentUser}
          branding={branding}
          onRefreshData={loadAllBusinessData}
          isRefreshing={isRefreshing}
        />

        {/* Connection Failure Error Banner (Rule I.4) */}
        {connectionError && (
          <div className="m-4 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center justify-between gap-4 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">Gagal Mengakses Database Server</p>
                <p className="text-slate-700 mt-0.5">{connectionError}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sistem tidak akan menimpa data yang tersimpan. Harap klik Coba Lagi untuk menyambung kembali.
                </p>
              </div>
            </div>
            <button
              onClick={loadAllBusinessData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg font-semibold shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              currentUser={currentUser}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onRefresh={loadAllBusinessData}
            />
          )}

          {currentTab === 'clients' && (
            <ClientsView
              clients={clients}
              currentUser={currentUser}
              onRefresh={loadAllBusinessData}
            />
          )}

          {currentTab === 'jobs' && (
            <JobsView
              jobs={jobs}
              clients={clients}
              currentUser={currentUser}
              onRefresh={loadAllBusinessData}
            />
          )}

          {currentTab === 'cases' && (
            <CasesView
              cases={cases}
              clients={clients}
              currentUser={currentUser}
              onRefresh={loadAllBusinessData}
            />
          )}

          {currentTab === 'followup' && (
            <FollowUpView
              cases={cases}
              currentUser={currentUser}
              onRefresh={loadAllBusinessData}
              onOpenCaseDetail={() => setCurrentTab('cases')}
            />
          )}

          {currentTab === 'activities' && (
            <DailyActivitiesView
              activities={activities}
              clients={clients}
              jobs={jobs}
              cases={cases}
              currentUser={currentUser}
              onRefresh={loadAllBusinessData}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              clients={clients}
              jobs={jobs}
              cases={cases}
              activities={activities}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'backup' && currentUser.role === 'Admin' && (
            <BackupRestoreView
              currentUser={currentUser}
              onRefreshAllData={loadAllBusinessData}
            />
          )}

          {currentTab === 'audit' &&
            (currentUser.role === 'Admin' ||
              currentUser.role === 'Owner' ||
              currentUser.role === 'Manager') && (
              <AuditLogView currentUser={currentUser} />
            )}

          {currentTab === 'branding' && currentUser.role === 'Admin' && (
            <BrandingSettingsView
              branding={branding}
              onBrandingUpdated={(newB) => setBranding(newB)}
            />
          )}

          {currentTab === 'users' && currentUser.role === 'Admin' && (
            <UserManagementView currentUser={currentUser} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
