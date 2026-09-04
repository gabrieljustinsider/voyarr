import React, { useEffect, useState } from 'react';
import { Check, X, Shield, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { checkPasswordBreach, type BreachCheckResult } from './breachChecker';

export interface PasswordRequirement {
  id: string;
  label: string;
  test: (p: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length', label: 'Minimum 12 characters (NIST standard)', test: (p: string) => (p || '').length >= 12 },
  { id: 'uppercase', label: 'At least one uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p || '') },
  { id: 'lowercase', label: 'At least one lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p || '') },
  { id: 'number', label: 'At least one number (0-9)', test: (p: string) => /[0-9]/.test(p || '') },
  { id: 'special', label: 'At least one special character (!@#$%^&*)', test: (p: string) => /[^A-Za-z0-9]/.test(p || '') },
];

/**
 * Validates whether all standard password requirements are met.
 */
export const isPasswordValid = (password: string, minLength = 12): boolean => {
  if ((password || '').length < minLength) return false;
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password));
};

/**
 * Calculates a strength rating score (0 to 100) and label for a password.
 */
export const getPasswordStrength = (password: string): {
  score: number;
  passedCount: number;
  label: string;
  colorClass: string;
  barColorClass: string;
} => {
  const p = password || '';
  if (!p) {
    return {
      score: 0,
      passedCount: 0,
      label: 'Enter Password',
      colorClass: 'text-slate-500',
      barColorClass: 'bg-slate-700',
    };
  }

  const passedCount = PASSWORD_REQUIREMENTS.filter((req) => req.test(p)).length;
  const score = Math.round((passedCount / PASSWORD_REQUIREMENTS.length) * 100);

  if (passedCount <= 2) {
    return {
      score,
      passedCount,
      label: 'Weak',
      colorClass: 'text-rose-400',
      barColorClass: 'bg-rose-500',
    };
  }
  if (passedCount <= 4) {
    return {
      score,
      passedCount,
      label: 'Moderate',
      colorClass: 'text-amber-400',
      barColorClass: 'bg-amber-500',
    };
  }
  return {
    score: 100,
    passedCount: 5,
    label: 'Strong',
    colorClass: 'text-emerald-400',
    barColorClass: 'bg-emerald-500',
  };
};

export function PasswordChecklist({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const [breachResult, setBreachResult] = useState<BreachCheckResult | null>(null);
  const [isCheckingBreach, setIsCheckingBreach] = useState(false);

  useEffect(() => {
    if (!password || password.length < 6) {
      setBreachResult(null);
      setIsCheckingBreach(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingBreach(true);
      const res = await checkPasswordBreach(password);
      setBreachResult(res);
      setIsCheckingBreach(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [password]);

  return (
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
          const passed = req.test(password);
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

      {/* Real-time HaveIBeenPwned Breach Status */}
      {password && password.length >= 6 && (
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Breach Corpus (HIBP):</span>
          {isCheckingBreach ? (
            <span className="text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> Checking...
            </span>
          ) : breachResult?.isPwned ? (
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Leaked {breachResult.pwnedCount.toLocaleString()} times!
            </span>
          ) : breachResult?.checked ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> No known leaks
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
