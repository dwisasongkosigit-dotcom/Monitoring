import { useState, useMemo } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Briefcase,
  X,
  Trash2,
  Save,
  RefreshCw,
  Shield,
} from 'lucide-react';
import {
  api,
  type DailyActivity,
  type Client,
  type Job,
  type Case,
  type CurrentUser,
  type ActivityStatus,
} from '../lib/api';
import { useToast } from './Toast';

interface DailyActivitiesViewProps {
  activities: DailyActivity[];
  clients: Client[];
  jobs: Job[];
  cases: Case[];
  currentUser: CurrentUser;
  onRefresh: () => void;
}

export function DailyActivitiesView({
  activities,
  clients,
  jobs,
  cases,
  currentUser,
  onRefresh,
}: DailyActivitiesViewProps) {
  const { success, error } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDivision, setFilterDivision] = useState<'All' | 'Accounting' | 'Tax'>('All');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New activity form
  const [newActivity, setNewActivity] = useState<Partial<DailyActivity>>({
    date: new Date().toISOString().split('T')[0],
    division: currentUser.role.includes('Tax') ? 'Tax' : 'Accounting',
    status: 'Selesai',
    durationMinutes: 60,
    clientId: clients[0]?.id || '',
    picId: currentUser.id,
    picName: currentUser.name,
  });

  const isReadOnly = currentUser.role === 'Owner' || currentUser.role === 'Manager';
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(
    new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
  );

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      setLastRefreshed(
        new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
      );
      success('Data Disinkronkan', 'Jurnal aktivitas harian berhasil disinkronkan dengan database server.');
    } catch (err: any) {
      error('Gagal Menyinkronkan', err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (filterDivision !== 'All' && a.division !== filterDivision) return false;
      if (filterDate && a.date !== filterDate) return false;
      if (filterStatus !== 'All' && a.status !== filterStatus) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const mDesc = a.description.toLowerCase().includes(q);
        const mClient = a.clientName.toLowerCase().includes(q);
        const mPic = a.picName.toLowerCase().includes(q);
        const mResult = a.resultProgress && a.resultProgress.toLowerCase().includes(q);
        if (!mDesc && !mClient && !mPic && !mResult) return false;
      }
      return true;
    });
  }, [activities, filterDivision, filterDate, filterStatus, searchTerm]);

  const handleCreateActivity = async () => {
    if (!newActivity.clientId || !newActivity.description?.trim()) {
      error('Validasi Gagal', 'Klien dan deskripsi aktivitas wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const cl = clients.find((c) => c.id === newActivity.clientId);
      await api.createDailyActivity({
        ...newActivity,
        clientName: cl?.name || 'Klien',
        picId: currentUser.id,
        picName: currentUser.name,
      });
      success('Aktivitas Dicatat', 'Jurnal aktivitas harian berhasil disimpan di database server.');
      setIsAddModalOpen(false);
      onRefresh();
    } catch (err: any) {
      error('Gagal Menyimpan', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('Hapus entri aktivitas harian ini?')) return;
    try {
      await api.deleteDailyActivity(id);
      success('Dihapus', 'Entri aktivitas berhasil dihapus.');
      onRefresh();
    } catch (err: any) {
      error('Gagal Menghapus', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari deskripsi kegiatan, klien, hasil..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline-block">
              Diperbarui: {lastRefreshed} WIB
            </span>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
            <span>{refreshing ? 'Memuat...' : 'Segarkan'}</span>
          </button>

          {isReadOnly ? (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>Mode Read-Only ({currentUser.role})</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setNewActivity({
                  date: new Date().toISOString().split('T')[0],
                  division: currentUser.role.includes('Tax') ? 'Tax' : 'Accounting',
                  status: 'Selesai',
                  durationMinutes: 60,
                  clientId: clients[0]?.id || '',
                  picId: currentUser.id,
                  picName: currentUser.name,
                });
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Aktivitas Harian</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-2.5 items-center text-xs">
        {/* Division Tab */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setFilterDivision('All')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterDivision === 'All' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
            }`}
          >
            Semua Divisi
          </button>
          <button
            onClick={() => setFilterDivision('Accounting')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterDivision === 'Accounting' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
            }`}
          >
            Accounting
          </button>
          <button
            onClick={() => setFilterDivision('Tax')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterDivision === 'Tax' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
            }`}
          >
            Tax
          </button>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1">
          <span className="text-slate-500 font-medium">Tanggal:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-transparent text-slate-700 font-mono text-xs focus:outline-none"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="text-slate-400 hover:text-slate-600 text-[10px]"
            >
              Reset
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none"
        >
          <option value="All">Semua Status</option>
          <option value="Selesai">Selesai</option>
          <option value="Perlu Follow-up">Perlu Follow-up</option>
          <option value="Berlanjut">Berlanjut</option>
        </select>

        <span className="ml-auto text-slate-400 font-mono tabular-nums text-[11px]">
          {filteredActivities.length} Aktivitas Tercatat
        </span>
      </div>

      {/* Activities Timeline / Cards */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl text-xs">
            Tidak ada aktivitas harian yang sesuai filter.
          </div>
        ) : (
          filteredActivities.map((act) => {
            const canDelete =
              !isReadOnly &&
              (currentUser.role === 'Admin' ||
                currentUser.role.startsWith('SPV') ||
                act.picId === currentUser.id);

            return (
              <div
                key={act.id}
                className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-500">{act.id}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-semibold text-amber-700">{act.division}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                      {act.date}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-bold text-slate-900">{act.clientName}</span>
                    {act.jobId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-mono">
                        Ref Job: {act.jobId}
                      </span>
                    )}
                    {act.caseId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono">
                        Ref Case: {act.caseId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        act.status === 'Selesai'
                          ? 'bg-emerald-100 text-emerald-800'
                          : act.status === 'Perlu Follow-up'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {act.status}
                    </span>

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteActivity(act.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Hapus aktivitas"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-800 font-medium leading-relaxed">
                  {act.description}
                </p>

                {/* Progress, Obstacles & Next Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                  {act.resultProgress && (
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Hasil / Progres:
                      </span>
                      <p className="text-slate-700 text-[11px] mt-0.5">{act.resultProgress}</p>
                    </div>
                  )}

                  {act.obstacles && (
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Kendala Ditemui:
                      </span>
                      <p className="text-rose-700 text-[11px] mt-0.5">{act.obstacles}</p>
                    </div>
                  )}

                  {act.followUp && (
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Rencana Tindak Lanjut:
                      </span>
                      <p className="text-amber-800 text-[11px] mt-0.5">{act.followUp}</p>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Pelaksana: {act.picName}</span>
                  {act.durationMinutes && (
                    <span className="font-mono tabular-nums">Durasi: ~{act.durationMinutes} menit</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Activity Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Catat Aktivitas Harian Baru</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={newActivity.date}
                    onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Divisi</label>
                  <select
                    value={newActivity.division}
                    onChange={(e) => setNewActivity({ ...newActivity, division: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="Accounting">Accounting</option>
                    <option value="Tax">Tax</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pilih Klien</label>
                <select
                  value={newActivity.clientId}
                  onChange={(e) => setNewActivity({ ...newActivity, clientId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tautkan ke Job (Opsional)</label>
                  <select
                    value={newActivity.jobId || ''}
                    onChange={(e) => setNewActivity({ ...newActivity, jobId: e.target.value || undefined })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="">-- Tanpa Tautan Job --</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.id} - {j.title.substring(0, 25)}...
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tautkan ke Case (Opsional)</label>
                  <select
                    value={newActivity.caseId || ''}
                    onChange={(e) => setNewActivity({ ...newActivity, caseId: e.target.value || undefined })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="">-- Tanpa Tautan Case --</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.title.substring(0, 25)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Deskripsi Aktivitas Nyata</label>
                <textarea
                  rows={2}
                  placeholder="Uraikan pekerjaan yang benar-benar Anda kerjakan hari ini..."
                  value={newActivity.description || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Hasil / Progres yang Dicapai</label>
                  <input
                    type="text"
                    placeholder="Contoh: Rekonsiliasi 120 mutasi rampung"
                    value={newActivity.resultProgress || ''}
                    onChange={(e) => setNewActivity({ ...newActivity, resultProgress: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kendala Ditemui</label>
                  <input
                    type="text"
                    placeholder="Contoh: Menunggu faktur pajak masukan supplier"
                    value={newActivity.obstacles || ''}
                    onChange={(e) => setNewActivity({ ...newActivity, obstacles: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status Aktivitas</label>
                  <select
                    value={newActivity.status}
                    onChange={(e) => setNewActivity({ ...newActivity, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="Selesai">Selesai</option>
                    <option value="Perlu Follow-up">Perlu Follow-up</option>
                    <option value="Berlanjut">Berlanjut</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Estimasi Durasi (Menit)</label>
                  <input
                    type="number"
                    value={newActivity.durationMinutes || 60}
                    onChange={(e) => setNewActivity({ ...newActivity, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateActivity}
                disabled={saving}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold"
              >
                {saving ? 'Menyimpan...' : 'Catat Aktivitas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
