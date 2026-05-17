export const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

export const getAuthHeaders = () => {
  const jwt = localStorage.getItem('voyarr_jwt')
  if (jwt) {
    return { 'Authorization': `Bearer ${jwt}` }
  }
  const apiKey = localStorage.getItem('voyarr_api_key') || import.meta.env.VITE_MASTER_KEY
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

  const response = await fetch(url, { ...options, headers })
  
  if (response.status === 401 || response.status === 403) {
    // Optional: handle session expiration
    // localStorage.removeItem('voyarr_jwt');
    // window.location.reload();
  }
  
  return response
}

export default apiFetch
