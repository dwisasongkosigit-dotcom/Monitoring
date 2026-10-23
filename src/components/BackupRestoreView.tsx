import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Download,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Clock,
  HardDrive,
  FileCheck,
  AlertTriangle,
  Calendar,
  Lock,
} from 'lucide-react';
import { api, type BackupInfo, type CurrentUser, getToken } from '../lib/api';
import { useToast } from './Toast';

interface BackupRestoreViewProps {
  currentUser: CurrentUser;
  onRefreshAllData: () => void;
}

export function BackupRestoreView({ currentUser, onRefreshAllData }: BackupRestoreViewProps) {
  const { success, error } = useToast();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  
  // Selected backup for restore confirmation modal
  const [restoreCandidate, setRestoreCandidate] = useState<BackupInfo | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const isReadOnly = currentUser.role === 'Owner' || currentUser.role === 'Manager';

  const loadBackupList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBackups();
      setBackups(data);
      setLastRefreshed(
        new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date())
      );
    } catch (err: any) {
      error('Gagal Memuat Daftar Cadangan', err.message);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadBackupList();
  }, [loadBackupList]);

  const handleCreateBackup = async () => {
    if (isReadOnly) {
      error('Akses Ditolak', 'Peran Anda bersifat Read-Only dan tidak dapat membuat cadangan.');
      return;
    }

    setBackingUp(true);
    try {
      const res = await api.createBackupNow(backupNote.trim() || undefined);
      success('Cadangan Berhasil Dibuat', res.message || 'Snapshot database tersimpan aman di disk.');
      setBackupNote('');
      await loadBackupList();
    } catch (err: any) {
      error('Gagal Membuat Cadangan', err.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/backup/download/${filename}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error('Gagal mengunduh file cadangan dari server.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      success('Unduhan Selesai', `File cadangan ${filename} berhasil diunduh ke komputer Anda.`);
    } catch (err: any) {
      error('Unduhan Gagal', err.message);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreCandidate) return;
    if (confirmText !== 'PULIHKAN') {
      error('Konfirmasi Tidak Sesuai', 'Ketik kata PULIHKAN dengan huruf kapital untuk mengonfirmasi.');
      return;
    }

    setRestoring(true);
    try {
      const res = await api.restoreBackup(restoreCandidate.filename);
      success('Pemulihan Selesai', res.message || 'Database telah dipulihkan ke versi cadangan terpilih.');
      setRestoreCandidate(null);
      setConfirmText('');
      await loadBackupList();
      onRefreshAllData();
    } catch (err: any) {
      error('Pemulihan Gagal', err.message);
    } finally {
      setRestoring(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-600" />
            <span>Cadangan Data & Pemulihan (Backup & Restore)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen snapshot database persisten server, retensi 30 hari, dan otomatisasi harian 23:00 WIB
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline-block">
              Terakhir diperbarui: {lastRefreshed} WIB
            </span>
          )}
          <button
            onClick={loadBackupList}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            <span>{loading ? 'Memuat Data...' : 'Segarkan'}</span>
          </button>
        </div>
      </div>

      {/* Info Notice & Manual Backup Creator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* System Scheduler Status */}
        <div className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-[#0a1128] text-white p-5 rounded-xl border border-slate-800 shadow-md flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Sistem Cadangan Otomatis Aktif
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Server secara berkala membuat snapshot lengkap database setiap hari pada pukul{' '}
              <span className="font-semibold text-white">23:00 WIB</span> dengan retensi penyimpanan hingga{' '}
              <span className="font-semibold text-amber-300">30 hari</span> di folder terisolasi server.
            </p>

            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Total Snapshot Tersedia:</span>
                <span className="font-mono font-bold text-amber-400">{backups.length} file</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Proteksi Pemulihan:</span>
                <span className="text-emerald-400 font-semibold">Auto Pre-Restore Backup</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Folder Server: /data/backups/</span>
          </div>
        </div>

        {/* Manual Backup Trigger Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <span>Buat Cadangan Manual Sekarang</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Simpan snapshot terkini dari seluruh 50+ klien, pekerjaan, kasus hukum/pajak, jurnal aktivitas, dan
              pengaturan branding secara instan sebelum melakukan pembaruan massal.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Cadangan (Opsional)
              </label>
              <input
                type="text"
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                disabled={backingUp || isReadOnly}
                placeholder="Misal: Sebelum update rezim PPh Badan kuartal 1"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {isReadOnly ? 'Akun Read-Only tidak dapat memicu pencadangan' : 'File snapshot akan diberi stempel waktu ISO'}
            </span>
            <button
              onClick={handleCreateBackup}
              disabled={backingUp || isReadOnly}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {backingUp ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Cadangan...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Backup Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Riwayat Berkas Cadangan Database
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {backups.length} Arsip Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Nama File & Tipe</th>
                <th className="py-3 px-3">Waktu Pembuatan</th>
                <th className="py-3 px-3">Ukuran</th>
                <th className="py-3 px-3">Cakupan Data</th>
                <th className="py-3 px-3">Keterangan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    {loading ? 'Memuat arsip cadangan...' : 'Belum ada berkas cadangan tersimpan.'}
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            b.trigger === 'scheduled'
                              ? 'bg-sky-100 text-sky-800'
                              : b.trigger === 'pre-restore'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {b.trigger}
                        </span>
                        <span className="truncate max-w-xs">{b.filename}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono tabular-nums">
                      {formatTimestamp(b.timestamp)}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 tabular-nums">
                      {formatSize(b.sizeBytes)}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {(() => {
                        const counts = b.recordCounts || b.recordsCount || { clients: 0, jobs: 0, cases: 0 };
                        return (
                          <div className="flex items-center gap-2 text-[11px] font-mono">
                            <span title="Klien">{counts.clients} Klien</span>
                            <span className="text-slate-300">·</span>
                            <span title="Pekerjaan">{counts.jobs} Jobs</span>
                            <span className="text-slate-300">·</span>
                            <span title="Kasus">{counts.cases} Cases</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                      {b.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadBackup(b.filename)}
                          title="Unduh file JSON cadangan ini"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {!isReadOnly && currentUser.role === 'Admin' && (
                          <button
                            onClick={() => {
                              setRestoreCandidate(b);
                              setConfirmText('');
                            }}
                            title="Pulihkan database ke versi ini"
                            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-md border border-rose-200 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Pulihkan</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-rose-200 animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-rose-900 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Konfirmasi Pemulihan Database (Restore)</span>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Anda akan memulihkan basis data sistem ke berkas cadangan berikut:
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
                <div className="text-slate-900 font-bold truncate">{restoreCandidate.filename}</div>
                <div className="text-slate-500">Waktu: {formatTimestamp(restoreCandidate.timestamp)}</div>
                <div className="text-slate-500">
                  Data: {(restoreCandidate.recordCounts || restoreCandidate.recordsCount)?.clients || 0} Klien, {(restoreCandidate.recordCounts || restoreCandidate.recordsCount)?.jobs || 0} Pekerjaan
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                <span className="font-bold">Mekanisme Pengaman Otomatis:</span> Sistem akan otomatis membuat
                cadangan pengaman (<code className="font-mono font-bold">pre-restore</code>) dari data saat ini sebelum
                menimpa database.
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Ketik <span className="font-bold text-rose-600">PULIHKAN</span> untuk melanjutkan:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Ketik PULIHKAN"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-rose-500 text-center tracking-wider"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRestoreCandidate(null)}
                disabled={restoring}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring || confirmText !== 'PULIHKAN'}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {restoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memulihkan...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Lanjutkan Pemulihan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
