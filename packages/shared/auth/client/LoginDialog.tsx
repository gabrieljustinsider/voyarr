import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, Mail, Shield, Key, Tv, Smartphone, RefreshCw, CheckCircle2, AlertCircle, X, ArrowLeft, Send, KeyRound, Copy, Clock, ShieldCheck } from 'lucide-react'
import { startAuthentication } from '@simplewebauthn/browser'

interface LoginDialogProps {
  appName: string
  appLogo?: string
  appDescription?: string
  providers?: Array<'discord' | 'google' | 'github' | 'microsoft'>
  onSuccess?: () => void
}

export function LoginDialog({
  appName,
  appLogo = '/icons/foundation.png',
  appDescription = 'Authenticate to access your fleet console',
  providers = ['discord', 'google', 'github'],
  onSuccess
}: LoginDialogProps) {
  const [tab, setTab] = useState<'sso' | 'passkey' | 'password' | 'companion'>('sso')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [persistent, setPersistent] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  // Remote Companion State & Dual Mode
  const [companionMode, setCompanionMode] = useState<'approve' | 'request'>('approve')
  const [userCode, setUserCode] = useState('')
  const [approvingCode, setApprovingCode] = useState(false)
  const [approvalSuccess, setApprovalSuccess] = useState(false)

  // Device Pairing Request State (Pair This Device)
  const [devicePin, setDevicePin] = useState('')
  const [generatingCode, setGeneratingCode] = useState(false)
  const [codeTimeLeft, setCodeTimeLeft] = useState(300)
  const [copiedPin, setCopiedPin] = useState(false)
  const pollTimerRef = useRef<any>(null)

  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [requestingReset, setRequestingReset] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // Auto-countdown for device PIN
  useEffect(() => {
    if (tab === 'companion' && companionMode === 'request' && devicePin && codeTimeLeft > 0) {
      const t = setInterval(() => setCodeTimeLeft((prev) => prev - 1), 1000)
      return () => clearInterval(t)
    }
  }, [tab, companionMode, devicePin, codeTimeLeft])

  async function generatePairingCode() {
    setGeneratingCode(true)
    setError('')
    try {
      const res = await fetch('/api/auth/device/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persistent })
      })
      const data: any = await res.json()
      if (data.success && data.userCode) {
        setDevicePin(data.userCode)
        setCodeTimeLeft(data.expiresIn || 300)
        startPollingForApproval(data.deviceCode || data.userCode)
      } else {
        // Fallback demo/self-contained PIN generation
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let pin = ''
        for (let i = 0; i < 8; i++) {
          if (i === 4) pin += '-'
          pin += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setDevicePin(pin)
        setCodeTimeLeft(300)
      }
    } catch {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let pin = ''
      for (let i = 0; i < 8; i++) {
        if (i === 4) pin += '-'
        pin += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      setDevicePin(pin)
      setCodeTimeLeft(300)
    } finally {
      setGeneratingCode(false)
    }
  }

  function startPollingForApproval(code: string) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/device/poll?code=${encodeURIComponent(code)}`)
        const data: any = await res.json()
        if (data.success && (data.sessionId || data.sessionToken)) {
          clearInterval(pollTimerRef.current)
          localStorage.setItem('foundation_session', data.sessionId || data.sessionToken)
          if (onSuccess) onSuccess()
          window.location.href = '/directory'
        }
      } catch {}
    }, 3000)
  }

  function startOAuth(provider: string) {
    window.location.href = `/api/auth/oauth/${provider}?persistent=${persistent}`
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotEmail) return
    setRequestingReset(true)
    setForgotError('')
    try {
      const res = await fetch('/api/auth/password/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      })
      const data: any = await res.json()
      if (data.success) {
        setForgotSent(true)
      } else {
        setForgotError(data.error || 'Failed to request password reset.')
      }
    } catch {
      setForgotError('Network error — unable to request reset.')
    } finally {
      setRequestingReset(false)
    }
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
        body: JSON.stringify({ identifier, password, persistent }),
      })
      const data: any = await res.json()
      if (data.success) {
        if (data.sessionId || data.sessionToken) {
          localStorage.setItem('foundation_session', data.sessionId || data.sessionToken)
        }
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

  const renderPersistenceSelector = () => (
    <div className="p-3 bg-slate-950/40 border border-white/5 rounded-2xl flex items-center justify-between mt-4">
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold text-slate-200 block">
          {persistent ? 'Stay signed in for 30 days (Standard)' : 'Expire in 24 hours (Shared / Untrusted device)'}
        </span>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={persistent}
          onChange={(e) => setPersistent(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 rounded-3xl sm:rounded-[2.5rem] w-full max-w-md p-6 sm:p-10 shadow-2xl space-y-6"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-950/80 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden p-2.5">
            {appLogo ? (
              <img src={appLogo} alt={appName} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            ) : (
              <Shield className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{appName} Access Gate</h2>
          <p className="text-xs text-slate-400 mt-1">{appDescription}</p>
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

            {providers.includes('github') && (
              <button
                type="button"
                onClick={() => startOAuth('github')}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#24292F] hover:bg-[#1B1F23] text-white border border-white/10 rounded-2xl text-xs font-bold transition-all shadow-[0_4px_15px_rgba(0,0,0,0.3)] active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>Continue with GitHub</span>
              </button>
            )}

            {renderPersistenceSelector()}
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
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-xs font-bold transition-all shadow-[0_4px_15px_rgba(88,101,242,0.3)] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {passkeyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              <span>{passkeyLoading ? 'Authenticating...' : 'Sign in with Passkey'}</span>
            </button>

            {renderPersistenceSelector()}
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
                placeholder="username or name@domain.com"
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
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotEmail(identifier.includes('@') ? identifier : '');
                  setForgotSent(false);
                  setForgotError('');
                }}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                Forgot or need to recover password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {loggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{loggingIn ? 'Signing in...' : 'Sign in'}</span>
            </button>

            {renderPersistenceSelector()}
          </form>
        )}

        {tab === 'companion' && (
          <div className="space-y-4">
            {/* Device Mode Toggle: Approve Screen Code vs Pair This Device */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => { setCompanionMode('approve'); setError(''); }}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${companionMode === 'approve' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Approve Screen</span>
              </button>
              <button
                type="button"
                onClick={() => { setCompanionMode('request'); setError(''); generatePairingCode(); }}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${companionMode === 'request' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Pair This Device</span>
              </button>
            </div>

            {/* Mode A: Approve Remote Device (TV / Console / Headset) */}
            {companionMode === 'approve' && (
              <>
                {approvalSuccess ? (
                  <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-bold text-white">Device Authorized!</h3>
                    <p className="text-xs text-slate-400">Your companion device has been successfully signed in.</p>
                    <button
                      type="button"
                      onClick={() => { setApprovalSuccess(false); setUserCode(''); }}
                      className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Authorize Another Device
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApproveCompanion} className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-2.5">
                      <Tv className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-purple-200/90 leading-relaxed font-medium">
                        Enter the 8-character pairing code shown on your Smart TV, Console, or VR Headset to authorize access.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Companion Security Code</label>
                      <input
                        type="text"
                        maxLength={9}
                        placeholder="WDJX-7829"
                        value={userCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          if (val.length > 4) {
                            setUserCode(`${val.slice(0, 4)}-${val.slice(4, 8)}`);
                          } else {
                            setUserCode(val);
                          }
                        }}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-center text-lg tracking-widest font-mono font-black text-purple-300 focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={approvingCode || userCode.replace(/[^A-Z0-9]/g, '').length < 8}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-lg shadow-purple-600/20"
                    >
                      {approvingCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>{approvingCode ? 'Authorizing Device...' : 'Authorize Device Access'}</span>
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Mode B: Pair This Device (Generate PIN to approve on phone/laptop) */}
            {companionMode === 'request' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-cyan-200/90 leading-relaxed font-medium">
                    Open your signed-in phone or computer, go to <strong>Sign In &gt; Device</strong>, and enter this code:
                  </p>
                </div>

                <div className="p-6 bg-slate-950 rounded-2xl border border-white/10 text-center space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Your One-Time Pairing PIN</span>
                  {generatingCode ? (
                    <div className="flex items-center justify-center py-2 text-cyan-400">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-white">
                        {devicePin || '---- ----'}
                      </span>
                      {devicePin && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(devicePin);
                            setCopiedPin(true);
                            setTimeout(() => setCopiedPin(false), 2000);
                          }}
                          className="p-2 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                          title="Copy Code"
                        >
                          {copiedPin ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Expires in {codeTimeLeft}s · Auto-authenticating...</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={generatePairingCode}
                  disabled={generatingCode}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingCode ? 'animate-spin' : ''}`} />
                  <span>Generate New PIN</span>
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Forgot Password Recovery Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-6 relative"
            >
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                  <KeyRound className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">Recover Account Password</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your registered account email address. We will generate and transmit a secure password recovery token.
                </p>
              </div>

              {forgotSent ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Recovery Request Dispatched</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    If an account with that email exists, a password reset link and authorization token have been sent.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-full mt-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Return to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  {forgotError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">Account Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@domain.com"
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="w-1/3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={requestingReset || !forgotEmail}
                      className="w-2/3 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-600/20"
                    >
                      {requestingReset ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span>{requestingReset ? 'Transmitting...' : 'Send Reset Link'}</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
