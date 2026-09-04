import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, RefreshCw, AlertTriangle, Clock, Activity, Globe, MapPin, Cpu, Shield, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'

interface PasskeyEntry {
  id: string
  name: string | null
  aaguid: string | null
  createdAt: string
  lastUsedAt: string | null
  lastUsedIpV4: string | null
  lastUsedIpV6: string | null
  lastUsedUa: string | null
  browser: string | null
  os: string | null
  deviceName: string | null
  city: string | null
  country: string | null
  region: string | null
  latitude: string | null
  longitude: string | null
  providerName: string | null
  icon: string | null
  securityLevel: string | null
  manufacturer: string | null
  logo: string | null
  counter: number
  transports: string | null
  registrationIpV4: string | null
  registrationIpV6: string | null
  registrationCity: string | null
  registrationCountry: string | null
  registrationUa: string | null
  lastUsedCity: string | null
  lastUsedCountry: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatLocation(city: string | null, country: string | null, region: string | null): string {
  const parts = [city, region, country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Unknown location'
}

type NotifyFn = (message: string, type: 'success' | 'error' | 'info') => void

export function PasskeyManager({ appName, notify: addToast }: { appName: string; notify?: NotifyFn }) {
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { fetchPasskeys() }, [])

  async function fetchPasskeys() {
    try {
      const res = await fetch('/api/auth/passkeys')
      if (!res.ok) throw new Error('Failed to fetch passkeys')
      const data = await res.json() as any
      setPasskeys(data.passkeys || [])
    } catch {
      addToast?.('Could not load security keys.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    setRegistering(true)
    try {
      const genRes = await fetch('/api/auth/passkeys/generate-registration', { method: 'POST' })
      if (!genRes.ok) { const e: any = await genRes.json(); throw new Error(e.error || 'Failed to start registration') }
      const { options }: any = await genRes.json()

      const authResponse = await startRegistration({ optionsJSON: options })
      const verifyRes = await fetch('/api/auth/passkeys/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResponse),
      })

      if (!verifyRes.ok) { const e: any = await verifyRes.json(); throw new Error(e.error || 'Verification failed') }
      addToast?.('Security key registered.', 'success')
      await fetchPasskeys()
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelled')) return
      addToast?.(err.message || 'Registration failed.', 'error')
    } finally {
      setRegistering(false)
    }
  }

  async function saveName(id: string) {
    try {
      const res = await fetch(`/api/auth/passkeys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      })
      if (!res.ok) throw new Error('Failed to rename')
      setEditingId(null)
      await fetchPasskeys()
    } catch {
      addToast?.('Failed to rename security key.', 'error')
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/auth/passkeys/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke')
      addToast?.('Security key revoked.', 'success')
      setConfirmingId(null)
      await fetchPasskeys()
    } catch {
      addToast?.('Failed to revoke security key.', 'error')
    }
  }

  function copyCredentialId(id: string) {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading security keys...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Security Keys</h3>
        </div>
        <button
          onClick={handleRegister}
          disabled={registering}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
        >
          {registering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {registering ? 'Registering...' : 'Add Key'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Security keys let you verify your identity using a hardware key, biometrics, or your device's built-in authenticator.
      </p>

      {passkeys.length === 0 ? (
        <div className="py-8 text-center">
          <Shield className="w-10 h-10 text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No security keys registered.</p>
          <p className="text-xs text-slate-600 mt-1">Add a key to enable step-up authentication.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {passkeys.map((pk) => {
            const isExpanded = expandedId === pk.id
            return (
              <div key={pk.id} className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center text-lg shrink-0">
                        {pk.logo ? (
                          <img src={pk.logo} alt="" className="w-6 h-6" />
                        ) : pk.icon ? (
                          <span>{pk.icon}</span>
                        ) : (
                          <Shield className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingId === pk.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-white w-full"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveName(pk.id); if (e.key === 'Escape') setEditingId(null) }}
                            />
                            <button onClick={() => saveName(pk.id)} className="text-xs text-blue-400 font-bold hover:text-white">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 hover:text-white">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(pk.id); setEditName(pk.name || '') }}
                            className="text-sm font-bold text-white hover:text-blue-400 transition-colors text-left"
                          >
                            {pk.name || 'Security Key'}
                          </button>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 font-medium">{pk.providerName || 'Security Key'}</span>
                          {pk.securityLevel && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                              pk.securityLevel.includes('Hardware') || pk.securityLevel.includes('TPM') || pk.securityLevel.includes('Enclave')
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {pk.securityLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : pk.id)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all"
                      >
                        {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {confirmingId === pk.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleRevoke(pk.id)} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmingId(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition-all">
                            <span className="text-[10px] font-bold">Cancel</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(pk.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-white/5">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Registered
                      </span>
                      <span className="text-xs text-slate-300">{relativeTime(pk.createdAt)}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Last used
                      </span>
                      <span className="text-xs text-slate-300">{relativeTime(pk.lastUsedAt)}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> Uses
                      </span>
                      <span className="text-xs text-slate-300">{pk.counter}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Location
                      </span>
                      <span className="text-xs text-slate-300 truncate">
                        {pk.lastUsedCity ? formatLocation(pk.lastUsedCity, pk.lastUsedCountry, pk.region) : (pk.city ? formatLocation(pk.city, pk.country, pk.region) : '—')}
                      </span>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-slate-950/60"
                    >
                      <div className="p-4 space-y-3">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Extended details</h4>

                        <DetailRow label="Credential ID" value={pk.id} mono copyable onCopy={() => copyCredentialId(pk.id)} copied={copiedId === pk.id} />
                        {pk.manufacturer && <DetailRow label="Manufacturer" value={pk.manufacturer} />}
                        {pk.aaguid && <DetailRow label="AAGUID" value={pk.aaguid} mono />}
                        {pk.transports && <DetailRow label="Transports" value={JSON.parse(pk.transports).join(', ') || 'None'} />}
                        {pk.securityLevel && <DetailRow label="Security level" value={pk.securityLevel} />}

                        <div className="pt-2 border-t border-white/5">
                          <h5 className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-2">Registration</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {pk.registrationIpV4 && <DetailRow label="IPv4" value={pk.registrationIpV4} mono />}
                            {pk.registrationIpV6 && <DetailRow label="IPv6" value={pk.registrationIpV6} mono />}
                            {pk.registrationCity && <DetailRow label="Location" value={formatLocation(pk.registrationCity, pk.registrationCountry, pk.region)} />}
                            {pk.latitude && pk.longitude && <DetailRow label="Coordinates" value={`${pk.latitude}, ${pk.longitude}`} mono />}
                            {pk.registrationUa && <DetailRow label="User agent" value={pk.registrationUa} />}
                          </div>
                        </div>

                        {pk.lastUsedIpV4 && (
                          <div className="pt-2 border-t border-white/5">
                            <h5 className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-2">Last use</h5>
                            <div className="grid grid-cols-2 gap-2">
                              {pk.lastUsedIpV4 && <DetailRow label="IPv4" value={pk.lastUsedIpV4} mono />}
                              {pk.lastUsedIpV6 && <DetailRow label="IPv6" value={pk.lastUsedIpV6} mono />}
                              {pk.lastUsedUa && <DetailRow label="Device" value={parseUA(pk.lastUsedUa)} />}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono, copyable, onCopy, copied }: { label: string; value: string; mono?: boolean; copyable?: boolean; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-500 font-medium shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[11px] text-slate-300 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
        {copyable && onCopy && (
          <button onClick={onCopy} className="p-0.5 rounded hover:bg-white/5 text-slate-500 hover:text-white shrink-0">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  )
}

function parseUA(ua: string): string {
  const match = ua.match(/(Chrome|Firefox|Safari|Edge)\/(\S+)/)
  if (match) return `${match[1]} ${match[2]}`
  return ua.slice(0, 60)
}
