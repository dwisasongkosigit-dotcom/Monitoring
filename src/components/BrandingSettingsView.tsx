import { useState } from 'react';
import {
  Settings,
  Upload,
  RotateCcw,
  Save,
  CheckCircle2,
  Building2,
  Image as ImageIcon,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { api, type BrandingConfig } from '../lib/api';
import { useToast } from './Toast';

interface BrandingSettingsViewProps {
  branding: BrandingConfig;
  onBrandingUpdated: (newBranding: BrandingConfig) => void;
}

export function BrandingSettingsView({ branding, onBrandingUpdated }: BrandingSettingsViewProps) {
  const { success, error, warning } = useToast();

  const [appName, setAppName] = useState(branding.appName || 'TMM/BMA Client Control Center');
  const [companyName, setCompanyName] = useState(branding.companyName || 'TMM & BMA Advisory');
  const [subtitle, setSubtitle] = useState(
    branding.subtitle || 'Tax & Accounting Client Control Center'
  );
  const [logoPreview, setLogoPreview] = useState(branding.logoUrl || '');
  const [faviconUrl, setFaviconUrl] = useState(branding.faviconUrl || '');
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // File upload handler with validation
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      error('File Tidak Didukung', 'Harap gunakan file gambar PNG, JPG, WebP, atau SVG.');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      error('File Terlalu Besar', 'Ukuran maksimal file logo adalah 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoPreview(reader.result);
        success('Logo Dimuat', 'Preview logo berhasil dimuat. Klik "Simpan Perubahan" untuk menyimpan ke database server.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!appName.trim() || !companyName.trim()) {
      error('Validasi Gagal', 'Judul aplikasi dan nama perusahaan tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateBranding({
        appName: appName.trim(),
        companyName: companyName.trim(),
        subtitle: subtitle.trim(),
        logoUrl: logoPreview,
        faviconUrl: faviconUrl.trim() || undefined,
      });

      onBrandingUpdated(res.branding);
      success('Branding Tersimpan', 'Pengaturan branding berhasil disimpan secara persisten di database.');
    } catch (err: any) {
      error('Gagal Menyimpan', err.message || 'Gagal menyimpan ke server.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    try {
      const res = await api.updateBranding({ resetToDefault: true });
      setAppName(res.branding.appName);
      setCompanyName(res.branding.companyName);
      setSubtitle(res.branding.subtitle);
      setLogoPreview(res.branding.logoUrl);
      setFaviconUrl('');
      onBrandingUpdated(res.branding);
      setResetConfirmOpen(false);
      success('Branding Direset', 'Pengaturan branding telah dikembalikan ke pengaturan default pabrikan.');
    } catch (err: any) {
      error('Gagal Reset', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Pengaturan Aplikasi & Branding Perusahaan
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Khusus Administrator. Perubahan disimpan secara persisten di server dan berlaku untuk semua pengguna.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Inputs */}
        <div className="md:col-span-2 space-y-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Judul Aplikasi Web</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Ditampilkan pada header, tab browser, dan meta title aplikasi.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Nama Perusahaan Konsultan</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Subtitle / Slogan Portal</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Logo Upload Section */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-slate-700 font-semibold mb-1">
              Unggah Logo Perusahaan (PNG, JPG, SVG, WebP)
            </label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors font-medium">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Pilih File Logo...</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-slate-400">Maksimal 5 MB</span>
            </div>
          </div>

          {/* Favicon URL */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Favicon URL (Opsional)</label>
            <input
              type="text"
              placeholder="https://..."
              value={faviconUrl}
              onChange={(e) => setFaviconUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-[11px]"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 hover:text-rose-600 hover:border-rose-300 rounded-lg transition-colors font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ke Default</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan ke Server...' : 'Simpan Pengaturan Persisten'}</span>
            </button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-4">
          <div className="bg-[#0a1128] border border-slate-800 rounded-xl p-5 text-white shadow-xl">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
              <Eye className="w-4 h-4" />
              <span>Live Preview di Sidebar</span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-amber-500/30 bg-[#0f172a] shrink-0 flex items-center justify-center">
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{appName || 'Judul Aplikasi'}</p>
                <p className="text-[11px] text-amber-300 truncate mt-0.5">
                  {companyName || 'Nama Perusahaan'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p>
                <strong>Terakhir Diperbarui:</strong>{' '}
                <span className="font-mono">{branding.updatedAt?.split('T')[0] || '2026-01-05'}</span>
              </p>
              <p>
                <strong>Diubah Oleh:</strong> {branding.updatedBy || 'Admin'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Konfirmasi Reset Branding ke Pengaturan Pabrik?
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Semua kustomisasi judul, logo, dan subtitle akan dikembalikan ke identitas standar
                  TMM/BMA Advisory. Tindakan ini akan langsung diterapkan ke database.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={saving}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold"
              >
                {saving ? 'Mereset...' : 'Ya, Kembalikan ke Default'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
