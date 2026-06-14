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
  
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('voyarr_jwt');
    localStorage.removeItem('voyarr_api_key');
    window.location.reload();
  }
  
  return response
}

export default apiFetch
