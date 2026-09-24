import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface AuthUser {
  id: string
  email: string | null
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  globalRole: string
  status: string
  parentUserId?: string | null
  linkedAt?: string | null
  linkType?: string | null
  parentUser?: {
    id: string
    email?: string | null
    username?: string | null
    displayName: string
    avatarUrl?: string | null
    globalRole: string
  } | null
  linkedAccounts?: Array<{
    id: string
    email?: string | null
    username?: string | null
    displayName: string
    avatarUrl?: string | null
    globalRole: string
    status: string
    linkedAt?: string | null
    linkType?: string | null
  }>
  linkedAccountsCount?: number
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children, appName }: { children: React.ReactNode; appName: string }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSession = useCallback(async () => {
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('foundation_session') : null
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`
      }

      const res = await fetch('/api/auth/session', {
        credentials: 'include',
        headers
      })
      const data = await res.json() as any
      if (data.authenticated) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = async () => {
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('foundation_session') : null
      if (typeof window !== 'undefined') {
        localStorage.removeItem('foundation_session')
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}
      })
      setUser(null)
      window.location.href = '/'
    } catch {
      setUser(null)
    }
  }

  useEffect(() => { 
    fetchSession() 

    const handleAuthEvent = (e: any) => {
      if (!e.detail?.path || e.detail.path.includes('profile') || e.detail.path.includes('user') || e.detail.path.includes('auth')) {
        fetchSession()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('foundation-auth-change', fetchSession)
      window.addEventListener('foundation-user-updated', fetchSession)
      window.addEventListener('foundation-api-mutate', handleAuthEvent)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('foundation-auth-change', fetchSession)
        window.removeEventListener('foundation-user-updated', fetchSession)
        window.removeEventListener('foundation-api-mutate', handleAuthEvent)
      }
    }
  }, [fetchSession])

  return (
    <AuthContext.Provider value={{ user, loading, refresh: fetchSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
