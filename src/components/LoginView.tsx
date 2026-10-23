import { useState } from 'react';
import { Lock, User, ArrowRight, AlertCircle, Building2, KeyRound } from 'lucide-react';
import { api, setToken, type CurrentUser, type BrandingConfig } from '../lib/api';

interface LoginViewProps {
  branding: BrandingConfig;
  onLoginSuccess: (user: CurrentUser, branding: BrandingConfig) => void;
}

export function LoginView({ branding, onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forced password change modal
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
  const [pendingBranding, setPendingBranding] = useState<BrandingConfig | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Harap masukkan username dan kata sandi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login({ username: username.trim(), password });
      setToken(res.token);

      if (res.user.mustChangePassword) {
        setPendingUser(res.user);
        setPendingBranding(res.branding);
      } else {
        onLoginSuccess(res.user, res.branding);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa username dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleForcedPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setChangingPass(true);
    setError(null);

    try {
      await api.changePassword({ currentPassword: password, newPassword });
      if (pendingUser && pendingBranding) {
        onLoginSuccess({ ...pendingUser, mustChangePassword: false }, pendingBranding);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui kata sandi.');
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d1e] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background visual asset */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <img
          src="/src/assets/images/tmm_bma_login_backdrop_1792761460059.jpg"
          alt="Office backdrop"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070d1e] via-[#070d1e]/80 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-slate-900 border border-amber-500/30 p-2 shadow-xl mb-4">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.appName}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Building2 className="w-8 h-8 text-amber-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {branding.appName || 'TMM/BMA Client Control Center'}
          </h1>
          <p className="text-sm text-amber-300/90 font-medium mt-1">
            {branding.companyName || 'TMM & BMA Advisory'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Portal Kendali Terpadu Pekerjaan Akuntansi & Perpajakan
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6 pb-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              {pendingUser ? 'Wajib Perbarui Kata Sandi' : 'Autentikasi Pengguna'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {pendingUser
                ? 'Sistem mewajibkan penggantian kata sandi pada login pertama Anda.'
                : 'Gunakan Employee ID atau username terdaftar Anda.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!pendingUser ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Username / ID Pegawai
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username..."
                    autoComplete="username"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs tracking-wide transition-all shadow-md hover:shadow-amber-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <span>Memverifikasi...</span>
                ) : (
                  <>
                    <span>Masuk ke Control Center</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForcedPasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Kata Sandi Baru (Minimal 8 karakter)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Konfirmasi Kata Sandi Baru
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPass}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs tracking-wide transition-all disabled:opacity-50"
              >
                {changingPass ? 'Memperbarui...' : 'Simpan Kata Sandi & Lanjutkan'}
              </button>
            </form>
          )}
        </div>

        {/* Security & Database Notice */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>TMM & BMA Advisory Internal Enterprise Platform</p>
          <p className="text-[11px] text-slate-600 mt-1">
            Penyimpanan data persisten ACID di disk server · Kata sandi terenkripsi PBKDF2
          </p>
        </div>
      </div>
    </div>
  );
}
