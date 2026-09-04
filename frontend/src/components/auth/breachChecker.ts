/**
 * 🛡️ HaveIBeenPwned Real-Time Leak Check (K-Anonymity)
 * 
 * Uses SHA-1 client-side hashing and queries the public HIBP API with only
 * the first 5 hexadecimal characters of the hash to protect user privacy.
 */

async function sha1Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export interface BreachCheckResult {
  isPwned: boolean
  pwnedCount: number
  checked: boolean
  error?: string
}

export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  if (!password || password.length < 4) {
    return { isPwned: false, pwnedCount: 0, checked: false }
  }

  try {
    const fullHash = await sha1Hex(password)
    const prefix = fullHash.slice(0, 5)
    const suffix = fullHash.slice(5)

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true' // HIBP privacy defense against response size side-channels
      }
    })

    if (!response.ok) {
      return { isPwned: false, pwnedCount: 0, checked: false, error: 'Breach check service unavailable' }
    }

    const text = await response.text()
    const lines = text.split('\n')

    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':')
      if (hashSuffix && hashSuffix.toUpperCase() === suffix) {
        const count = parseInt(countStr, 10)
        return { isPwned: true, pwnedCount: count, checked: true }
      }
    }

    return { isPwned: false, pwnedCount: 0, checked: true }
  } catch (err: any) {
    console.warn('[BreachChecker] Leak verification skipped:', err.message)
    return { isPwned: false, pwnedCount: 0, checked: false, error: err.message }
  }
}
