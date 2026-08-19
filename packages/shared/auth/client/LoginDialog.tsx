import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, Mail, Shield, Key, Tv, Smartphone, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { startAuthentication } from '@simplewebauthn/browser'

interface LoginDialogProps {
  appName: string
  providers: Array<'discord' | 'google' | 'github' | 'microsoft'>
  onSuccess?: () => void
}

export function LoginDialog({ appName, providers = ['discord', 'google'], onSuccess }: LoginDialogProps) {
  const [tab, setTab] = useState<'sso' | 'passkey' | 'password' | 'companion'>('sso')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  // Remote Companion State
  const [userCode, setUserCode] = useState('')
  const [approvingCode, setApprovingCode] = useState(false)
  const [approvalSuccess, setApprovalSuccess] = useState(false)

  function startOAuth(provider: string) {
    window.location.href = `/api/auth/oauth/${provider}`
  }

  async function handlePasskeyLogin() {
    setError('')
    setPasskeyLoading(true)
    try {
      const optRes = await fetch('/api/auth/passkeys/generate-authentication', { method: 'POST' })
      if (!optRes.ok) {
        const errJson: any = await optRes.json()
        throw new Error(errJson.error || 'Failed to start passkey login')
      }
      const { options, challengeId }: any = await optRes.json()

      const authResp = await startAuthentication({ optionsJSON: options })
      const verifyRes = await fetch(`/api/auth/passkeys/verify-authentication?challengeId=${encodeURIComponent(challengeId || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authResp, challengeId })
      })

      const verifyData: any = await verifyRes.json()
      if (verifyData.success) {
        if (onSuccess) onSuccess()
        window.location.href = '/directory'
      } else {
        setError(verifyData.error || 'Passkey verification failed.')
      }
    } catch (err: any) {
      setError(err.message || 'Passkey authentication failed.')
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoggingIn(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data: any = await res.json()
      if (data.success) {
        if (onSuccess) onSuccess()
        window.location.href = '/directory'
      } else {
        setError(data.error || 'Login failed.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleApproveCompanion(e: React.FormEvent) {
    e.preventDefault()
    if (!userCode || userCode.length < 8) {
      setError('Please enter a valid 8-character device code.')
      return
    }
    setError('')
    setApprovingCode(true)
    try {
      const res = await fetch('/api/auth/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: userCode.toUpperCase().trim() })
      })
      const data: any = await res.json()
      if (data.success) {
        setApprovalSuccess(true)
      } else {
        setError(data.error || 'Device approval failed.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setApprovingCode(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 rounded-3xl sm:rounded-[2.5rem] w-full max-w-md p-6 sm:p-10 shadow-2xl space-y-6"
      >
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-inner">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{appName} Access Gate</h2>
          <p className="text-xs text-slate-400 mt-1">Authenticate to access your fleet console</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/60 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => { setTab('sso'); setError(''); }}
            className={`py-2 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${tab === 'sso' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            SSO
          </button>
          <button
            type="button"
            onClick={() => { setTab('passkey'); setError(''); }}
            className={`py-2 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${tab === 'passkey' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Passkey
          </button>
          <button
            type="button"
            onClick={() => { setTab('password'); setError(''); }}
            className={`py-2 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${tab === 'password' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setTab('companion'); setError(''); }}
            className={`py-2 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${tab === 'companion' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Device
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Single Sign-On (SSO) */}
        {tab === 'sso' && (
          <div className="space-y-3">
            {providers.includes('discord') && (
              <button
                type="button"
                onClick={() => startOAuth('discord')}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-2xl text-xs font-bold transition-all shadow-[0_4px_15px_rgba(88,101,242,0.3)] active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,0,106,106,0,0,0,22.77,8.07C2.79,37.66-.57,66.49.16,94.82a106.35,106.35,0,0,0,32.32,16.34A77.49,77.49,0,0,0,39.38,98a68.68,68.68,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,13.15,105.73,105.73,0,0,0,32.35-16.34C127.84,66.49,124.47,37.66,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
                <span>Continue with Discord</span>
              </button>
            )}

            {providers.includes('google') && (
              <button
                type="button"
                onClick={() => startOAuth('google')}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl text-xs font-bold transition-all shadow-[0_4px_15px_rgba(255,255,255,0.1)] active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 2: Passkey / Biometric Authentication */}
        {tab === 'passkey' && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto border border-cyan-500/20">
              <Key className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authenticate passwordlessly using your device's Touch ID, Face ID, Windows Hello, or FIDO2 Security Key.
            </p>
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-xs font-bold transition-all shadow-[0_4px_15px_rgba(8,145,178,0.3)] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {passkeyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              <span>{passkeyLoading ? 'Authenticating...' : 'Sign in with Passkey'}</span>
            </button>
          </div>
        )}

        {/* Tab 3: Password Authentication */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Email or Username</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoComplete="username"
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="name@domain.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {loggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{loggingIn ? 'Signing in...' : 'Sign in'}</span>
            </button>
          </form>
        )}

        {tab === 'companion' && (
          <div className="space-y-4">
            {approvalSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-bold text-white">Device Authorized!</h3>
                <p className="text-xs text-slate-400">Your companion device has been successfully signed in.</p>
              </div>
            ) : (
              <form onSubmit={handleApproveCompanion} className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter the 8-character code shown on your Smart TV, VR Headset, or Console screen:
                </p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Device Code</label>
                  <input
                    type="text"
                    maxLength={9}
                    placeholder="WDJX-7829"
                    value={userCode}
                    onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-center text-base tracking-widest font-mono text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={approvingCode || userCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                >
                  {approvingCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Tv className="w-4 h-4" />}
                  <span>{approvingCode ? 'Authorizing Device...' : 'Approve Device Sign-In'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
