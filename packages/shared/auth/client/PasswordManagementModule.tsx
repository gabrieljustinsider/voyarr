/** @jsxImportSource react */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Lock, ShieldCheck, ShieldAlert, Check, X, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { PASSWORD_REQUIREMENTS, isPasswordValid, getPasswordStrength } from './PasswordChecklist';

interface PasswordManagementModuleProps {
  hasPassword?: boolean;
  onRequirePasskey?: () => void;
  notify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function PasswordManagementModule({
  hasPassword = false,
  onRequirePasskey,
  notify,
}: PasswordManagementModuleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = isPasswordValid(newPassword) && passwordsMatch && (!hasPassword || currentPassword.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setStatus(null);

    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('foundation_session') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : '',
          newPassword,
        }),
      });

      const data = await res.json() as any;

      if (data.success) {
        const msg = hasPassword ? 'Password successfully changed!' : 'Password successfully created!';
        setStatus({ type: 'success', message: msg });
        notify?.(msg, 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsEditing(false);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('foundation-auth-change'));
          window.dispatchEvent(new CustomEvent('foundation-user-updated', { detail: { hasPassword: true } }));
        }
      } else if (res.status === 403) {
        setStatus({ type: 'error', message: 'Security verification required.' });
        onRequirePasskey?.();
      } else {
        const err = data.error || 'Failed to update password.';
        setStatus({ type: 'error', message: err });
        notify?.(err, 'error');
      }
    } catch {
      const err = 'Network error — unable to save password.';
      setStatus({ type: 'error', message: err });
      notify?.(err, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 sm:p-10 rounded-[2.5rem] bg-slate-900/40 border border-white/5 space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shrink-0">
            <KeyRound className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Account Password</h3>
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                hasPassword 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {hasPassword ? 'Configured' : 'Not Set'}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              {hasPassword
                ? 'Your account has an active password for credential and SSO logins.'
                : 'You are using passwordless / OAuth sign-in. You can set a password for direct logins.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsEditing(!isEditing);
            setStatus(null);
          }}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          {isEditing ? 'Cancel' : hasPassword ? 'Change Password' : 'Create Password'}
        </button>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="pt-6 border-t border-white/5 space-y-5 overflow-hidden"
          >
            {hasPassword && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    title={showCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    title={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    title={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Strength & Match Indicators */}
            {newPassword.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Password Strength:</span>
                  <span className={`font-bold ${strength.colorClass}`}>{strength.label}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.barColorClass}`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const passed = req.test(newPassword);
                    return (
                      <div key={req.id} className="flex items-center gap-2 text-[11px]">
                        {passed ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        )}
                        <span className={passed ? 'text-slate-200' : 'text-slate-500'}>
                          {req.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {confirmPassword.length > 0 && (
                  <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-xs">
                    {passwordsMatch ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-rose-400" />
                        <span className="text-rose-400 font-medium">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {status && (
              <div className={`p-3.5 rounded-xl text-xs font-bold ${
                status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {status.message}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{hasPassword ? 'Update Password' : 'Save Password'}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
