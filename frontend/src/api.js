export const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api'

export const getAuthHeaders = () => {
  const jwt = localStorage.getItem('voyarr_jwt')
  if (jwt) {
    return { 'Authorization': `Bearer ${jwt}` }
  }
  let apiKey = localStorage.getItem('voyarr_api_key')
  if (apiKey) {
    try {
      apiKey = atob(apiKey)
    } catch (e) {
      // fallback
    }
  } else {
    apiKey = import.meta.env.VITE_MASTER_KEY
  }
  if (apiKey) {
    return { 'X-Voyarr-Api-Key': apiKey }
  }
  return {}
}

export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  }
  
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  // Use credentials: 'include' to ensure cookies are sent even in cross-origin requests
  const response = await fetch(url, { 
    ...options, 
    headers,
    credentials: 'include' 
  })
  
  if (response.status === 401) {
    localStorage.removeItem('voyarr_jwt');
    localStorage.removeItem('voyarr_api_key');
    window.location.reload();
  }
  
  return response
}

// Opportunistic Abstraction: Attach HTTP verb methods to apiFetch for clean axios-like consumption
apiFetch.get = async (endpoint, options = {}) => {
  const res = await apiFetch(endpoint, { ...options, method: 'GET' })
  if (!res.ok) throw res
  return res.headers.get('content-type')?.includes('application/json') ? res.json().then(data => ({ data, status: res.status, headers: res.headers })) : res.text().then(data => ({ data, status: res.status, headers: res.headers }))
}

apiFetch.post = async (endpoint, body = {}, options = {}) => {
  const isFormData = body instanceof FormData
  const res = await apiFetch(endpoint, {
    ...options,
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body)
  })
  if (!res.ok) throw res
  return res.headers.get('content-type')?.includes('application/json') ? res.json().then(data => ({ data, status: res.status, headers: res.headers })) : res.text().then(data => ({ data, status: res.status, headers: res.headers }))
}

apiFetch.put = async (endpoint, body = {}, options = {}) => {
  const isFormData = body instanceof FormData
  const res = await apiFetch(endpoint, {
    ...options,
    method: 'PUT',
    body: isFormData ? body : JSON.stringify(body)
  })
  if (!res.ok) throw res
  return res.headers.get('content-type')?.includes('application/json') ? res.json().then(data => ({ data, status: res.status, headers: res.headers })) : res.text().then(data => ({ data, status: res.status, headers: res.headers }))
}

apiFetch.delete = async (endpoint, options = {}) => {
  const res = await apiFetch(endpoint, { ...options, method: 'DELETE' })
  if (!res.ok) throw res
  return res.headers.get('content-type')?.includes('application/json') ? res.json().then(data => ({ data, status: res.status, headers: res.headers })) : res.text().then(data => ({ data, status: res.status, headers: res.headers }))
}

export const getErrorMessage = async (response, defaultMsg = 'An error occurred') => {
  try {
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      return data.detail || data.message || defaultMsg
    }
    const text = await response.text()
    return text || response.statusText || defaultMsg
  } catch (e) {
    return response.statusText || defaultMsg
  }
}

export const logErrorToSystem = async (message, stackTrace = '', path = '', statusCode = 500) => {
  try {
    await apiFetch('/logs/errors', {
      method: 'POST',
      body: JSON.stringify({
        message: typeof message === 'string' ? message : JSON.stringify(message),
        stack_trace: stackTrace || '',
        source: 'frontend',
        path: path || window.location.pathname,
        status_code: statusCode
      })
    })
  } catch (e) {
    // Avoid recursive error logging loops
  }
}

export default apiFetch
