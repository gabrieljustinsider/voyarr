import React, { useState } from 'react'
import { Tv, ShieldCheck, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface DeviceApprovalCardProps {
  appName?: string
  notify?: (message: string, type: 'success' | 'error' | 'info') => void
}

export function DeviceApprovalCard({ appName = 'Fleet Console', notify }: DeviceApprovalCardProps) {
  const [userCode, setUserCode] = useState('')
  const [approving, setApproving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault()
    const cleanCode = userCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleanCode.length < 8) {
      setError('Please enter a valid 8-character device code.')
      return
    }
    setError('')
    setApproving(true)
    try {
      const res = await fetch('/api/auth/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: cleanCode })
      })
      const data: any = await res.json()
      if (data.success) {
        setSuccess(true)
        if (notify) notify('Device successfully authorized!', 'success')
      } else {
        const msg = data.error || 'Device authorization failed.'
        setError(msg)
        if (notify) notify(msg, 'error')
      }
    } catch {
      const msg = 'Connection error while authorizing device.'
      setError(msg)
      if (notify) notify(msg, 'error')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Authorize Companion Device</h3>
            <p className="text-xs text-slate-400">Grant access to Smart TVs, game consoles, or VR headsets</p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Remote device authorized and signed into {appName}.</span>
          </div>
          <button
            type="button"
            onClick={() => { setSuccess(false); setUserCode(''); }}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
          >
            Authorize Another Device
          </button>
        </div>
      ) : (
        <form onSubmit={handleApprove} className="space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Enter the 8-character pairing code displayed on your remote device screen to authorize it with your current account credentials.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-64">
              <input
                type="text"
                maxLength={9}
                placeholder="WDJX-7829"
                value={userCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  if (val.length > 4) {
                    setUserCode(`${val.slice(0, 4)}-${val.slice(4, 8)}`)
                  } else {
                    setUserCode(val)
                  }
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-center text-sm font-mono font-bold tracking-widest text-purple-300 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={approving || userCode.replace(/[^A-Z0-9]/g, '').length < 8}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-md shadow-purple-600/20"
            >
              {approving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{approving ? 'Authorizing...' : 'Authorize Device'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
