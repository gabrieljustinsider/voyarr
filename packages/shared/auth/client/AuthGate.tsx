import React from 'react'
import { useAuth } from './AuthProvider'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-t-blue-500 border-white/10 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-bold text-white">Sign in required</h2>
          <p className="text-slate-400">You need to sign in to access this page.</p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function RoleGate({ children, minRole }: { children: React.ReactNode; minRole: string }) {
  const { user } = useAuth()
  const roleRank: Record<string, number> = { owner: 100, admin: 80, mod: 60, user: 40 }
  const userRank = roleRank[user?.globalRole?.toLowerCase() || ''] || 0
  const minRank = roleRank[minRole.toLowerCase()] || 0

  if (userRank < minRank) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Access denied</h2>
          <p className="text-slate-400">You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
