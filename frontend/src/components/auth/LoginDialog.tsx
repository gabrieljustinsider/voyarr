import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, Mail, Shield, Key, Tv, Smartphone, RefreshCw, CheckCircle2, AlertCircle, X, ArrowLeft, Send, KeyRound, Copy, Clock, ShieldCheck, QrCode, WifiOff, Sparkles, Mic, MicOff, Server, UserCheck, Zap, Lock, HelpCircle } from 'lucide-react'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { PasswordChecklist, isPasswordValid } from './PasswordChecklist'

interface LoginDialogProps {
  appName: string
  appLogo?: string
  appDescription?: string
  appVersion?: string
  brandGradient?: string
  providers?: Array<'discord' | 'google' | 'github' | 'microsoft'>
  onSuccess?: () => void
  isModal?: boolean
  isOpen?: boolean
  onClose?: () => void
  allowFirstUserSetup?: boolean
  mode?: 'login' | 'reauth'
  reauthActionName?: string
  defaultRedirectUri?: string
  governanceNotice?: string
}

export function LoginDialog({
  appName,
  appLogo,
  appDescription = 'Authenticate to access your workspace',
  appVersion,
  brandGradient,
  providers = ['discord', 'google', 'github'],
  onSuccess,
  isModal = false,
  isOpen = true,
  onClose,
  allowFirstUserSetup = false,
  mode = 'login',
  reauthActionName = 'proceed with this action',
  defaultRedirectUri,
  governanceNotice,
}: LoginDialogProps) {
  const [tab, setTab] = useState<'sso' | 'passkey' | 'password' | 'otp' | 'companion'>('sso')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [persistent, setPersistent] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  // Last-Used Authentication Quick-Switch State
  const [lastUsedMethod, setLastUsedMethod] = useState<{ method: string; identifier?: string; label: string } | null>(null)

  // Rate-Limit & Exponential Backoff Visualizer
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)

  // Magic Link / Email 6-Digit OTP State
  const [otpEmail, setOtpEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)

  // Hardware Security Key Troubleshooting Card
  const [showSecurityKeyTroubleshooter, setShowSecurityKeyTroubleshooter] = useState(false)

  // Voice / Speech Recognition state
  const [isListening, setIsListening] = useState(false)
  const speechRecognitionRef = useRef<any>(null)

  // MFA Recovery Code / Step-up Challenge state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSubmitting, setMfaSubmitting] = useState(false)

  // Forward Auth / Reverse Proxy Auto-Bypass Detection
  const [proxyUser, setProxyUser] = useState<string | null>(null)
  const [proxyBypassChecking, setProxyBypassChecking] = useState(false)

  // First-User Initial Admin Setup State
  const [isFirstUserSetup, setIsFirstUserSetup] = useState(false)
  const [setupStep, setSetupStep] = useState<'credentials' | 'passkey'>('credentials')
  const [setupAdminEmail, setSetupAdminEmail] = useState('')
  const [setupAdminUsername, setSetupAdminUsername] = useState('')
  const [setupAdminPassword, setSetupAdminPassword] = useState('')
  const [setupAdminConfirmPassword, setSetupAdminConfirmPassword] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  // Network Offline / Online State (Hydration safe)
  const [isOnline, setIsOnline] = useState(true)
  const [logoFailed, setLogoFailed] = useState(false)

  // Resolve default logo and brand gradient based on appName if not explicitly provided
  const resolvedLogo = appLogo || (() => {
    const key = appName.toLowerCase()
    if (key.includes('ledger')) return '/assets/icon-512.png'
    if (key.includes('food')) return '/brand/logo.png'
    if (key.includes('globot')) return '/logo.png'
    if (key.includes('groupcord')) return '/assets/groupcord_app_emblem_v2_transparent.png'
    if (key.includes('draw')) return '/assets/logo.png'
    if (key.includes('voyarr')) return '/app_icon.png'
    if (key.includes('i-am') || key.includes('i am')) return '/brand/app-icon-minimalist-transparent.png'
    if (key.includes('butlarr')) return '/assets/logo-transparent.png'
    return '/icons/foundation.png'
  })()

  const resolvedVersion = appVersion || (() => {
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PACKAGE_VERSION) {
        return (import.meta as any).env.PACKAGE_VERSION
      }
      if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_VERSION) {
        return (import.meta as any).env.VITE_APP_VERSION
      }
      if (typeof (globalThis as any).__APP_VERSION__ !== 'undefined') {
        return (globalThis as any).__APP_VERSION__
      }
    } catch {}

    const key = appName.toLowerCase()
    if (key.includes('foundation')) return '1.192.1'
    if (key.includes('ledger')) return '3.173.14'
    if (key.includes('butlarr')) return '1.1.0'
    if (key.includes('globot')) return '3.118.0'
    if (key.includes('food')) return '1.32.0'
    if (key.includes('i-am') || key.includes('i am')) return '3.27.0'
    if (key.includes('draw')) return '3.116.0'
    if (key.includes('groupcord')) return '1.35.0'
    if (key.includes('voyarr')) return '1.190.0'
    return null
  })()

  const resolvedGradient = brandGradient || (() => {
    const key = appName.toLowerCase()
    if (key.includes('ledger')) return 'from-emerald-400 via-teal-300 to-cyan-400'
    if (key.includes('food')) return 'from-amber-400 via-orange-400 to-red-400'
    if (key.includes('globot')) return 'from-red-400 via-rose-400 to-pink-500'
    if (key.includes('groupcord')) return 'from-indigo-400 via-purple-400 to-[#5865F2]'
    if (key.includes('draw')) return 'from-yellow-400 via-amber-400 to-orange-400'
    if (key.includes('voyarr')) return 'from-fuchsia-400 via-purple-400 to-indigo-400'
    if (key.includes('i-am') || key.includes('i am')) return 'from-amber-300 via-yellow-400 to-amber-500'
    if (key.includes('butlarr')) return 'from-blue-400 via-indigo-400 to-violet-400'
    return 'from-cyan-400 via-blue-400 to-indigo-400'
  })()

  // Contextual Sign In message based on app and currently presented sign-in method
  const contextualMessage = (() => {
    if (isFirstUserSetup) {
      return `Initialize the primary administrator account for ${appName}.`
    }
    if (proxyUser) {
      return `Forward-auth verified. Confirm sign-in as @${proxyUser} to continue to ${appName}.`
    }
    if (mfaRequired) {
      return `Enter your two-factor verification code to sign into ${appName}.`
    }

    switch (tab) {
      case 'passkey':
        return `Touch ID, Face ID, Windows Hello, or hardware security key sign in for ${appName}.`
      case 'password':
        return `Sign in with your ${appName} username or email and password.`
      case 'otp':
        return `Receive a secure one-time passcode via email to access ${appName}.`
      case 'companion':
        return `Pair your mobile phone or companion device to approve access to ${appName}.`
      case 'sso':
      default:
        return appDescription || `Sign in to access your ${appName} workspace.`
    }
  })()

  // Device Pairing Request State (Pair This Device)
  const [devicePin, setDevicePin] = useState('')
  const [generatingCode, setGeneratingCode] = useState(false)
  const [codeTimeLeft, setCodeTimeLeft] = useState(300)
  const [copiedPin, setCopiedPin] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const pollTimerRef = useRef<any>(null)

  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [requestingReset, setRequestingReset] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const saveSessionToken = (token: string) => {
    if (!token) return
    localStorage.setItem('foundation_session', token)
    localStorage.setItem('GLOBOT_AUTH_TOKEN', token)
    localStorage.setItem('voyarr_jwt', token)
    localStorage.setItem('FOOD_AUTH_TOKEN', token)
    localStorage.setItem('DISCORD_BOT_TOKEN', token)
    localStorage.setItem('ledger_token', token)
    localStorage.setItem('auth_token', token)
    if (typeof document !== 'undefined') {
      document.cookie = `globot_session_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
    }
  }

  const navigateOnSuccess = () => {
    if (onSuccess) {
      onSuccess()
      return
    }
    const target = defaultRedirectUri || (appName?.toLowerCase().includes('foundation') ? '/directory' : '/')
    window.location.href = target
  }

  // 1. Cross-Tab Single Sign-On Sync (BroadcastChannel)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const authChannel = new BroadcastChannel('fleet_auth_channel')
    authChannel.onmessage = (event) => {
      if (event.data?.type === 'LOGIN_SUCCESS') {
        navigateOnSuccess()
      }
    }
    return () => authChannel.close()
  }, [onSuccess, defaultRedirectUri, appName])

  // 2. Network Online / Offline Detection & Local Storage Last-Used Method
  useEffect(() => {
    try {
      const saved = localStorage.getItem('last_auth_method')
      if (saved) {
        setLastUsedMethod(JSON.parse(saved))
      }
    } catch {}

    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Rate-Limit Backoff Countdown Timer
  useEffect(() => {
    if (rateLimitSeconds > 0) {
      const timer = setInterval(() => {
        setRateLimitSeconds((prev) => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [rateLimitSeconds])

  // Email OTP Resend Countdown Timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setInterval(() => {
        setOtpCountdown((prev) => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [otpCountdown])

  // 3. WebAuthn Conditional UI (Passkey Autofill on Mount)
  useEffect(() => {
    let active = true
    async function initConditionalPasskey() {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) return
      try {
        if (window.PublicKeyCredential.isConditionalMediationAvailable) {
          const isAvailable = await window.PublicKeyCredential.isConditionalMediationAvailable()
          if (isAvailable && active) {
            let optRes = await fetch('/api/auth/passkeys/generate-authentication', { method: 'POST' })
            if (!optRes.ok) {
              optRes = await fetch('/api/auth/passkeys/login-options', { method: 'POST' })
            }
            if (!optRes.ok) {
              optRes = await fetch('/api/auth/passkeys/login/options', { method: 'POST' })
            }
            if (!optRes.ok) return
            const { options, challengeId }: any = await optRes.json()
            if (!options || !active) return

            const authResp = await startAuthentication({ optionsJSON: options, useBrowserAutofill: true })
            if (!active) return

            let verifyRes = await fetch(`/api/auth/passkeys/verify-authentication?challengeId=${encodeURIComponent(challengeId || '')}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...authResp, challengeId })
            })
            if (!verifyRes.ok) {
              verifyRes = await fetch('/api/auth/passkeys/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assertion: authResp, persistent })
              })
            }
            if (!verifyRes.ok) {
              verifyRes = await fetch('/api/auth/passkeys/login/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assertion: authResp, persistent })
              })
            }
            const verifyData: any = await verifyRes.json().catch(() => ({}))
            if (verifyData.success || verifyData.token || verifyData.sessionToken || verifyData.access_token) {
              const sid = verifyData.sessionToken || verifyData.token || verifyData.sessionId || verifyData.access_token
              if (sid) {
                saveSessionToken(sid)
              }
              if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('fleet_auth_channel')
                bc.postMessage({ type: 'LOGIN_SUCCESS' })
                bc.close()
              }
              navigateOnSuccess()
            }
          }
        }
      } catch {}
    }
    initConditionalPasskey()
    return () => { active = false }
  }, [onSuccess, defaultRedirectUri, appName, persistent])

  // 4. Forward Auth / Reverse Proxy Auto-Detection Check
  useEffect(() => {
    async function checkProxyBypass() {
      try {
        setProxyBypassChecking(true)
        const res = await fetch('/api/auth/proxy-user', { method: 'GET' })
        if (res.ok) {
          const data: any = await res.json()
          if (data.success && data.username) {
            setProxyUser(data.username)
          }
        }
      } catch {}
      finally {
        setProxyBypassChecking(false)
      }
    }
    checkProxyBypass()
  }, [])

  // 5. First-User Initial Check (if allowed by app)
  useEffect(() => {
    if (!allowFirstUserSetup) return
    async function checkFirstUser() {
      try {
        const res = await fetch('/api/auth/setup-status')
        if (res.ok) {
          const data: any = await res.json()
          if (data.success && data.hasUsers === false) {
            setIsFirstUserSetup(true)
          }
        }
      } catch {}
    }
    checkFirstUser()
  }, [allowFirstUserSetup])

  // Voice Input (Web Speech API) Toggle
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser.')
      return
    }

    if (isListening) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop()
      }
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setError('')
      }

      recognition.onresult = (event: any) => {
        const spokenText = event.results[0][0].transcript
        if (spokenText) {
          setIdentifier(spokenText.trim())
        }
      }

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      speechRecognitionRef.current = recognition
      recognition.start()
    } catch (err: any) {
      setError('Could not initialize speech recognition.')
      setIsListening(false)
    }
  }

  // Handle MFA / Step-up Code Verification
  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaCode.trim()) return
    setMfaSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code: mfaCode.trim(), persistent })
      })
      const data: any = await res.json()
      if (data.success) {
        if (data.sessionId || data.sessionToken) {
          localStorage.setItem('foundation_session', data.sessionId || data.sessionToken)
        }
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('fleet_auth_channel')
          bc.postMessage({ type: 'LOGIN_SUCCESS' })
          bc.close()
        }
        navigateOnSuccess()
      } else {
        setError(data.error || 'Invalid authentication code or recovery key.')
      }
    } catch {
      setError('Connection error during MFA verification.')
    } finally {
      setMfaSubmitting(false)
    }
  }

  // Handle First-User Initial Admin Setup
  async function handleFirstUserSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (setupAdminPassword !== setupAdminConfirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSetupLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/initial-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: setupAdminEmail.trim(),
          username: setupAdminUsername.trim(),
          password: setupAdminPassword
        })
      })
      const data: any = await res.json()
      if (data.success) {
        setIsFirstUserSetup(false)
        setIdentifier(setupAdminUsername || setupAdminEmail)
        setPassword(setupAdminPassword)
        setTab('password')
      } else {
        setError(data.error || 'Failed to initialize administrator account.')
      }
    } catch {
      setError('Connection error during initial system initialization.')
    } finally {
      setSetupLoading(false)
    }
  }

  // Auto-countdown for device PIN
  useEffect(() => {
    if (tab === 'companion' && devicePin && codeTimeLeft > 0) {
      const t = setInterval(() => setCodeTimeLeft((prev) => prev - 1), 1000)
      return () => clearInterval(t)
    }
  }, [tab, devicePin, codeTimeLeft])

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
        if (data.success && (data.sessionId || data.sessionToken || data.token || data.access_token)) {
          clearInterval(pollTimerRef.current)
          saveSessionToken(data.sessionId || data.sessionToken || data.token || data.access_token)
          navigateOnSuccess()
        }
      } catch {}
    }, 3000)
  }

  function startOAuth(provider: string) {
    // Check if running on child app that uses /api/auth/login or standard /api/auth/oauth
    // If child app without /api/auth/oauth, /api/auth/login/:provider will be aliased or called
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
    setShowSecurityKeyTroubleshooter(false)
    setPasskeyLoading(true)
    try {
      let optRes = await fetch('/api/auth/passkeys/generate-authentication', { method: 'POST' })
      if (!optRes.ok) {
        optRes = await fetch('/api/auth/passkeys/login-options', { method: 'POST' })
      }
      if (!optRes.ok) {
        optRes = await fetch('/api/auth/passkeys/login/options', { method: 'POST' })
      }
      if (!optRes.ok) {
        const errJson: any = await optRes.json().catch(() => ({}))
        throw new Error(errJson.error || errJson.detail || 'Failed to start passkey login')
      }
      const { options, challengeId }: any = await optRes.json()

      const authResp = await startAuthentication({ optionsJSON: options })
      let verifyRes = await fetch(`/api/auth/passkeys/verify-authentication?challengeId=${encodeURIComponent(challengeId || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authResp, challengeId })
      })
      if (!verifyRes.ok) {
        verifyRes = await fetch('/api/auth/passkeys/login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assertion: authResp, persistent })
        })
      }
      if (!verifyRes.ok) {
        verifyRes = await fetch('/api/auth/passkeys/login/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assertion: authResp, persistent })
        })
      }

      const verifyData: any = await verifyRes.json().catch(() => ({}))
      if (verifyData.success || verifyData.token || verifyData.sessionToken || verifyData.access_token) {
        const sid = verifyData.sessionToken || verifyData.token || verifyData.sessionId || verifyData.access_token
        if (sid) {
          saveSessionToken(sid)
        }
        try {
          localStorage.setItem('last_auth_method', JSON.stringify({ method: 'passkey', label: 'Touch ID / Passkey' }))
        } catch {}
        if (mode === 'reauth') {
          if (onClose) onClose()
          return
        }
        navigateOnSuccess()
      } else {
        setError(verifyData.error || verifyData.detail || 'Passkey verification failed.')
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || (err.message && err.message.toLowerCase().includes('cancel'))) {
        setShowSecurityKeyTroubleshooter(true)
      }
      setError(err.message || 'Passkey authentication failed.')
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    if (rateLimitSeconds > 0) return
    setError('')
    setLoggingIn(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, persistent }),
      })
      const data: any = await res.json()
      if (data.mfaRequired) {
        setMfaRequired(true)
        return
      }
      if (data.success || data.token || data.sessionToken || data.access_token) {
        setFailedAttempts(0)
        try {
          localStorage.setItem('last_auth_method', JSON.stringify({ method: 'password', identifier, label: `Password (${identifier})` }))
        } catch {}
        const sid = data.sessionId || data.sessionToken || data.token || data.access_token
        if (sid) {
          saveSessionToken(sid)
        }
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('fleet_auth_channel')
          bc.postMessage({ type: 'LOGIN_SUCCESS' })
          bc.close()
        }
        if (mode === 'reauth') {
          if (onClose) onClose()
          return
        }
        navigateOnSuccess()
      } else {
        const nextAttempts = failedAttempts + 1
        setFailedAttempts(nextAttempts)
        if (nextAttempts >= 3) {
          const backoff = Math.min(60, Math.pow(2, nextAttempts - 2) * 5)
          setRateLimitSeconds(backoff)
        }
        setError(data.error || 'Login failed.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setLoggingIn(false)
    }
  }

  // Magic Link / 6-Digit Email OTP Handlers
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otpEmail) return
    setOtpSending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim() })
      })
      const data: any = await res.json()
      if (data.success) {
        setOtpSent(true)
        setOtpCountdown(60)
      } else {
        setError(data.error || 'Failed to send one-time authentication code.')
      }
    } catch {
      setError('Network error while requesting one-time code.')
    } finally {
      setOtpSending(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otpCode.trim() || !otpEmail) return
    setOtpVerifying(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim(), code: otpCode.trim(), persistent })
      })
      const data: any = await res.json()
      if (data.success || data.token || data.sessionToken || data.access_token) {
        try {
          localStorage.setItem('last_auth_method', JSON.stringify({ method: 'otp', identifier: otpEmail, label: `Email Code (${otpEmail})` }))
        } catch {}
        const sid = data.sessionId || data.sessionToken || data.token || data.access_token
        if (sid) {
          saveSessionToken(sid)
        }
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('fleet_auth_channel')
          bc.postMessage({ type: 'LOGIN_SUCCESS' })
          bc.close()
        }
        if (mode === 'reauth') {
          if (onClose) onClose()
          return
        }
        navigateOnSuccess()
      } else {
        setError(data.error || 'Invalid or expired one-time code.')
      }
    } catch {
      setError('Connection error during one-time code verification.')
    } finally {
      setOtpVerifying(false)
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

  if (isModal && !isOpen) return null;

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl sm:rounded-[2.5rem] w-full max-w-lg md:max-w-xl p-6 sm:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] space-y-6 relative transition-all ${isModal ? 'max-h-[92vh] overflow-y-auto' : ''}`}
    >
      {isModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-slate-950/90 rounded-2xl flex items-center justify-center mx-auto border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden p-2.5 group">
          {resolvedLogo && !logoFailed ? (
            <img
              src={resolvedLogo}
              alt={appName}
              className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Shield className="w-8 h-8 text-cyan-400" />
          )}
        </div>
        <div>
          {mode === 'reauth' ? (
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <Lock className="w-3 h-3" />
                <span>Security Verification</span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Confirm Identity</h2>
              <p className="text-xs text-slate-400 font-medium">Please authenticate to {reauthActionName}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2">
                <h2 className={`text-2xl font-black tracking-tight bg-gradient-to-r ${resolvedGradient} bg-clip-text text-transparent`}>
                  {appName}
                </h2>
                {resolvedVersion && (
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-black tracking-widest text-slate-300 uppercase">
                    v{resolvedVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1.5 font-medium leading-relaxed">
                {contextualMessage}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Quick-Switch Last-Used Authentication Banner */}
      {lastUsedMethod && (
        <div className="p-3 bg-gradient-to-r from-blue-600/15 via-indigo-600/15 to-purple-600/15 border border-blue-500/20 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">Quick Sign-In</span>
              <span className="text-xs text-slate-200 font-semibold truncate block">{lastUsedMethod.label}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (lastUsedMethod.method === 'passkey') handlePasskeyLogin();
              else if (lastUsedMethod.method === 'password') {
                setTab('password');
                if (lastUsedMethod.identifier) setIdentifier(lastUsedMethod.identifier);
              } else if (lastUsedMethod.method === 'otp') {
                setTab('otp');
                if (lastUsedMethod.identifier) setOtpEmail(lastUsedMethod.identifier);
              }
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-bold shrink-0 shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            Authenticate
          </button>
        </div>
      )}

      {/* Auth Mode Tabs (5-Tab Layout) */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950/60 rounded-2xl border border-white/5">
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
          onClick={() => { setTab('otp'); setError(''); }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${tab === 'otp' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
        >
          Code
        </button>
        <button
          type="button"
          onClick={() => { setTab('companion'); setError(''); if (!devicePin) generatePairingCode(); }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${tab === 'companion' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
        >
          Device
        </button>
      </div>

        {!isOnline && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-300">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Offline mode active. You can authenticate locally using cached passkeys.</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Reverse-Proxy / Forward-Auth Auto-Detection Banner */}
        {proxyUser && (
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-2 text-xs text-indigo-300">
            <div className="flex items-center gap-2 min-w-0">
              <Server className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Proxy authenticated as <strong className="text-white">@{proxyUser}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigateOnSuccess()
              }}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold shrink-0 transition-all cursor-pointer"
            >
              Continue
            </button>
          </div>
        )}

        {/* First-User Initial Setup Wizard Screen */}
        {isFirstUserSetup ? (
          <form onSubmit={handleFirstUserSubmit} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Initial Setup Mode: Create the primary administrator account.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Admin Email</label>
              <input
                type="email"
                value={setupAdminEmail}
                onChange={e => setSetupAdminEmail(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="admin@domain.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Admin Username</label>
              <input
                type="text"
                value={setupAdminUsername}
                onChange={e => setSetupAdminUsername(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                placeholder="admin"
                required
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Master Password</label>
                <input
                  type="password"
                  value={setupAdminPassword}
                  onChange={e => setSetupAdminPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="••••••••"
                  required
                />
                <PasswordChecklist password={setupAdminPassword} minLength={12} checkBreaches={true} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Confirm Master Password</label>
                <input
                  type="password"
                  value={setupAdminConfirmPassword}
                  onChange={e => setSetupAdminConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={setupLoading || !setupAdminEmail || !setupAdminPassword || !isPasswordValid(setupAdminPassword, 12)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-600/20"
            >
              {setupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              <span>{setupLoading ? 'Initializing Administrator...' : 'Initialize System & Sign In'}</span>
            </button>
          </form>
          ) : mfaRequired ? (
            /* MFA Challenge / Step-Up Verification Screen */
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Multi-Factor Authentication required. Enter your 6-digit TOTP code or backup recovery key.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Security Code or Recovery Key</label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder="123456 or XXXX-XXXX"
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white text-center font-mono tracking-widest text-base focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setMfaRequired(false); setMfaCode(''); }}
                  className="w-1/3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={mfaSubmitting || !mfaCode.trim()}
                  className="w-2/3 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {mfaSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{mfaSubmitting ? 'Verifying...' : 'Verify MFA'}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
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

                  {/* Physical Key Troubleshooter Card */}
                  {showSecurityKeyTroubleshooter && (
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/20 text-left space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                        <HelpCircle className="w-4 h-4 shrink-0" />
                        <span>Using a Hardware Key or Synced Passkey?</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11px]">
                        Ensure your USB/NFC key (e.g. YubiKey) is plugged in, tap its gold sensor when prompted by your browser, or verify your device is connected to iCloud Keychain / Google Password Manager.
                      </p>
                    </div>
                  )}

                  {renderPersistenceSelector()}
                </div>
              )}

              {/* Tab 3: Password Authentication */}
              {tab === 'password' && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  {rateLimitSeconds > 0 && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                      <Clock className="w-4 h-4 shrink-0 animate-spin" />
                      <span>Security Cool-down Active: Please wait {rateLimitSeconds}s before retrying.</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-400">Email or Username</label>
                      <button
                        type="button"
                        onClick={toggleSpeechRecognition}
                        title="Dictate identifier using speech recognition"
                        className={`text-[10px] font-bold flex items-center gap-1 transition-colors ${isListening ? 'text-rose-400 animate-pulse' : 'text-slate-400 hover:text-white'}`}
                      >
                        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span>{isListening ? 'Listening...' : 'Voice Input'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        autoComplete="username webauthn"
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500"
                        placeholder="username or name@domain.com"
                        required
                      />
                    </div>
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
                    disabled={loggingIn || !identifier || !password || rateLimitSeconds > 0}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-600/20"
                  >
                    {loggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    <span>{rateLimitSeconds > 0 ? `Try again in ${rateLimitSeconds}s` : loggingIn ? 'Authenticating...' : 'Sign In with Password'}</span>
                  </button>

                  {renderPersistenceSelector()}
                </form>
              )}

              {/* Tab 4: Email 6-Digit One-Time Code (OTP) */}
              {tab === 'otp' && (
                <div className="space-y-4">
                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Sign in passwordlessly with a one-time verification code sent to your email.</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400">Registered Email Address</label>
                        <input
                          type="email"
                          value={otpEmail}
                          onChange={e => setOtpEmail(e.target.value)}
                          placeholder="name@domain.com"
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={otpSending || !otpEmail}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-600/20"
                      >
                        {otpSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>{otpSending ? 'Sending Code...' : 'Send Verification Code'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Code sent to <strong>{otpEmail}</strong>. Enter 6-digit code below:</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400">6-Digit Email Code</label>
                        <input
                          type="text"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value)}
                          placeholder="123456"
                          maxLength={6}
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white text-center font-mono tracking-widest text-lg focus:outline-none focus:border-blue-500"
                          required
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => { setOtpSent(false); setOtpCode(''); }}
                          className="w-1/3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={otpVerifying || !otpCode.trim()}
                          className="w-2/3 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-600/20"
                        >
                          {otpVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                          <span>{otpVerifying ? 'Verifying...' : 'Verify Code & Sign In'}</span>
                        </button>
                      </div>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          disabled={otpCountdown > 0 || otpSending}
                          onClick={handleSendOtp}
                          className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                        >
                          {otpCountdown > 0 ? `Resend code in ${otpCountdown}s` : 'Resend code'}
                        </button>
                      </div>
                    </form>
                  )}

                  {renderPersistenceSelector()}
                </div>
              )}
            </>
          )}

        {tab === 'companion' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-2.5">
              <Tv className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <p className="text-xs text-purple-200/90 leading-relaxed font-medium">
                To sign in on this screen, open your logged-in device, navigate to <strong>Settings &gt; Security &gt; Authorize Device</strong>, or scan the QR code below:
              </p>
            </div>

            <div className="p-6 bg-slate-950 rounded-2xl border border-white/10 text-center space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Your One-Time Pairing PIN</span>
              {generatingCode ? (
                <div className="flex items-center justify-center py-2 text-purple-400">
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

              {/* QR Code Instant Mobile Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/5 text-[11px] font-bold text-purple-400 hover:text-purple-300 transition-all cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQrCode ? 'Hide Instant QR' : 'Scan with Phone Camera'}</span>
                </button>

                <AnimatePresence>
                  {showQrCode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-4 bg-white rounded-2xl flex flex-col items-center justify-center space-y-2 shadow-xl"
                    >
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://${typeof window !== 'undefined' ? window.location.host : 'foundation.gpnet.dev'}/settings?action=approve_device&code=${devicePin.replace('-', '')}`)}`}
                        alt="Pairing QR Code"
                        className="w-36 h-36 rounded-lg"
                      />
                      <span className="text-[10px] font-bold text-slate-900 font-sans">
                        Scan to authorize on your phone
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button
              type="button"
              onClick={generatePairingCode}
              disabled={generatingCode}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingCode ? 'animate-spin' : ''}`} />
              <span>Generate New Code</span>
            </button>

            {renderPersistenceSelector()}
          </div>
        )}

        {governanceNotice && (
          <div className="pt-2 text-center">
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {governanceNotice}
            </p>
          </div>
        )}
      </motion.div>
  );

  const modalBackdrop = (
    <>
      {content}
      {/* Forgot Password Modal */}
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
    </>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md font-sans">
        {modalBackdrop}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-6 font-sans">
      {modalBackdrop}
    </div>
  );
}
