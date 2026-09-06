import { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  Card, CardContent, CardActions, Typography, Button, Grid, TextField, Box, 
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, 
  IconButton, Alert, Paper, FormControlLabel, Switch, Avatar,
  Accordion, AccordionSummary, AccordionDetails, Menu, MenuItem, Checkbox, ListItemText, ListItemIcon, Autocomplete,
  ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select, Divider
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SettingsIcon from '@mui/icons-material/Settings'
import { Globe, LayoutGrid, List as ListIcon, Edit2, Trash2, Link as LinkIcon, ArrowUpDown, Heart } from 'lucide-react'
import { getSafeLogoUrl, getFaviconFromUrl } from '../utils/logoHelpers'
import { MediaEntityCard } from './common'
import BillerList from './BillerList'
import CookiesManager from './CookiesManager'
import ScraperTester from './ScraperTester'
import RecipeEditor from './RecipeEditor'
import { apiFetch, getErrorMessage } from '../api'

function ProviderCardLogo({ provider }) {
  const [imgError, setImgError] = useState(false)
  const primarySrc = getSafeLogoUrl(provider.logo_url || provider.favicon_url) || getFaviconFromUrl(provider.base_url)

  useEffect(() => {
    setImgError(false)
  }, [provider.logo_url, provider.favicon_url, provider.base_url])

  const initial = provider.name ? provider.name.charAt(0).toUpperCase() : '?'

  if (primarySrc && !imgError) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0.75,
          borderRadius: '12px',
          bgcolor: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          maxWidth: '85%',
          maxHeight: '85%'
        }}
      >
        <Box
          component="img"
          src={primarySrc}
          alt={provider.name}
          onError={() => setImgError(true)}
          sx={{
            maxWidth: '100%',
            maxHeight: 70,
            objectFit: 'contain',
            display: 'block',
            filter: 'drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.65)) drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.4))'
          }}
        />
      </Box>
    )
  }

  return (
    <Avatar
      sx={{ 
        width: 60, 
        height: 60, 
        bgcolor: 'primary.main', 
        color: 'primary.contrastText',
        fontSize: '1.75rem', 
        fontWeight: 'bold'
      }}
    >
      {initial}
    </Avatar>
  )
}

export default function ProviderList({ providers, searchQuery, setSearchQuery, onRefreshProviders }) {
  const [cookies, setCookies] = useState([])
  const [openDialog, setOpenDialog] = useState(false)
  const [activeProvider, setActiveProvider] = useState(null)
  const [dialogTab, setDialogTab] = useState(0)
  const [recipeProviderId, setRecipeProviderId] = useState(null)
  const [selectedRecipe, setSelectedRecipe] = useState(null)

  const fetchSelectedRecipe = useCallback(async () => {
    if (!recipeProviderId) return
    try {
      const res = await apiFetch(`/scraper/${recipeProviderId}`)
      if (res.ok) setSelectedRecipe(await res.json())
      else setSelectedRecipe(null)
    } catch { setSelectedRecipe(null) }
  }, [recipeProviderId])

  useEffect(() => { fetchSelectedRecipe() }, [fetchSelectedRecipe])

  // Billers list state for searchable dropdown
  const [billersList, setBillersList] = useState([])

  const fetchBillersList = useCallback(async () => {
    try {
      const res = await apiFetch('/billers')
      if (res.ok) {
        setBillersList(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch billers list:', e)
    }
  }, [])

  useEffect(() => {
    fetchBillersList()
  }, [fetchBillersList])

  // Credentials form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')

  // 1Password linking + TOTP state
  const [linkedItemId, setLinkedItemId] = useState(null)
  const [hasTotp, setHasTotp] = useState(false)
  const [opItems, setOpItems] = useState([])
  const [opItemsLoading, setOpItemsLoading] = useState(false)
  const [selectedOpItem, setSelectedOpItem] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpSeconds, setTotpSeconds] = useState(0)
  const [manualTotp, setManualTotp] = useState('')
  const [signInBusy, setSignInBusy] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const linkedItemTitle = linkedItemId ? opItems.find((it) => it.id === linkedItemId)?.title || linkedItemId : null

  // Cookie form state
  const [cookieText, setCookieText] = useState('')
  const [cookieLimit, setCookieLimit] = useState('')

  // Provider Billers state
  const [providerBillers, setProviderBillers] = useState([])
  const [newBillerId, setNewBillerId] = useState(null)
  const [newBillerLabel, setNewBillerLabel] = useState('')

  const fetchProviderBillers = useCallback(async (provId) => {
    if (!provId) return
    try {
      const res = await apiFetch(`/providers/${provId}/billers`)
      if (res.ok) {
        setProviderBillers(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch provider billers:', e)
    }
  }, [])

  // Provider CRUD Form State
  const [openProviderForm, setOpenProviderForm] = useState(false)
  const [editProviderMode, setEditProviderMode] = useState(false)
  const [providerFormId, setProviderFormId] = useState(null)
  const [providerForm, setProviderForm] = useState({
    name: '',
    base_url: '',
    logo_url: '',
    favicon_url: '',
    description: '',
    naming_pattern: '{title}_{performers}_{resolution}',
    separator: '_',
    space_replacement: '_',
    automatic_limits: { daily_downloads: 50 },
    transparent_logo_bg: false,
    fit_logo_to_card: false,
    default_biller_id: null
  })
  const [providerLimitEnabled, setProviderLimitEnabled] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [subTab, setSubTab] = useState(0)
  const [viewMode, setViewMode] = useState('grid')
  const [sortBy, setSortBy] = useState('name-asc')
  const [favProviders, setFavProviders] = useState([])

  const fetchFavProviders = useCallback(async () => {
    try {
      const res = await apiFetch('/favorites')
      if (res.ok) {
        const data = await res.json()
        setFavProviders(data.provider || [])
      }
    } catch (e) {
      console.error('Failed to fetch provider favorites:', e)
    }
  }, [])

  useEffect(() => {
    fetchFavProviders()
  }, [fetchFavProviders])

  const handleToggleFavorite = async (providerId, providerName) => {
    const stringId = String(providerId)
    try {
      const res = await apiFetch('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ item_type: 'provider', item_id: stringId })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.favorited) {
          setFavProviders(prev => [...prev, stringId])
          window.dispatchEvent(new CustomEvent('show-toast', { 
            detail: { message: `Favorited ${providerName}!`, severity: 'success' } 
          }))
        } else {
          setFavProviders(prev => prev.filter(x => x !== stringId))
          window.dispatchEvent(new CustomEvent('show-toast', { 
            detail: { message: `Unfavorited ${providerName}.`, severity: 'info' } 
          }))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const processedProviders = useMemo(() => {
    let result = (providers || []).filter(p => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (p.name && p.name.toLowerCase().includes(q)) || (p.base_url && p.base_url.toLowerCase().includes(q))
    })

    result.sort((a, b) => {
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'limit-desc') {
        const limitA = a.automatic_limits?.daily_downloads || 0
        const limitB = b.automatic_limits?.daily_downloads || 0
        return limitB - limitA
      }
      if (sortBy === 'sessions-desc') {
        const countA = cookies.filter(c => c.provider_id === a.id).length
        const countB = cookies.filter(c => c.provider_id === b.id).length
        return countB - countA
      }
      if (sortBy === 'id-desc') return b.id - a.id
      return 0
    })

    return result
  }, [providers, searchQuery, sortBy, cookies])

  // Card Display Settings State
  const [cardPrefs, setCardPrefs] = useState({
    showLogo: true,
    showBaseUrl: true,
    showDailyLimit: true,
    showActiveSessions: true
  })
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null)

  // Logo Crop & Pad Editor State
  const [openLogoEditor, setOpenLogoEditor] = useState(false)
  const [logoEditorImageSrc, setLogoEditorImageSrc] = useState('')
  const [logoScale, setLogoScale] = useState(100)
  const [logoPadding, setLogoPadding] = useState(20)
  const [logoOffset, setLogoOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const createCheckerboard = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#e0e0e0'
    ctx.fillRect(0, 0, 8, 8)
    ctx.fillRect(8, 8, 8, 8)
    return canvas
  }

  const drawLogoCanvas = useCallback((imageSrc, scale, padding, offset) => {
    const canvas = document.getElementById('logo-editor-canvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!imageSrc) return

    const renderImageToCanvas = (imageObj) => {
      const pattern = ctx.createPattern(createCheckerboard(), 'repeat')
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const aspect = imageObj.width / imageObj.height
      let drawW, drawH

      if (aspect > 1) {
        drawW = canvas.width
        drawH = canvas.width / aspect
      } else {
        drawH = canvas.height
        drawW = canvas.height * aspect
      }

      const padAmount = (padding / 100) * canvas.width
      drawW = Math.max(10, drawW - padAmount)
      drawH = Math.max(10, drawH - padAmount)

      drawW = drawW * (scale / 100)
      drawH = drawH * (scale / 100)

      const x = (canvas.width - drawW) / 2 + offset.x
      const y = (canvas.height - drawH) / 2 + offset.y

      ctx.drawImage(imageObj, x, y, drawW, drawH)
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => renderImageToCanvas(img)
    img.onerror = () => {
      // Fallback: retry without crossOrigin so image preview renders on canvas even if CORS is blocked
      const fallbackImg = new Image()
      fallbackImg.onload = () => renderImageToCanvas(fallbackImg)
      fallbackImg.src = imageSrc
    }
    // Append unique query string to bypass CORS caching on some servers
    img.src = imageSrc.startsWith('data:') ? imageSrc : `${imageSrc}${imageSrc.includes('?') ? '&' : '?'}v_cb=${Date.now()}`
  }, [])

  useEffect(() => {
    if (openLogoEditor && logoEditorImageSrc) {
      const timer = setTimeout(() => {
        drawLogoCanvas(logoEditorImageSrc, logoScale, logoPadding, logoOffset)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [openLogoEditor, logoEditorImageSrc, logoScale, logoPadding, logoOffset, drawLogoCanvas])

  const handleCanvasMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - logoOffset.x, y: e.clientY - logoOffset.y })
  }

  const handleCanvasMouseMove = (e) => {
    if (!isDragging) return
    setLogoOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  const handleApplyLogoEdit = () => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = 512
      exportCanvas.height = 512
      const ctx = exportCanvas.getContext('2d')
      ctx.clearRect(0, 0, 512, 512)

      const aspect = img.width / img.height
      let drawW, drawH

      if (aspect > 1) {
        drawW = 512
        drawH = 512 / aspect
      } else {
        drawH = 512
        drawW = 512 * aspect
      }

      const padAmount = (logoPadding / 100) * 512
      drawW = Math.max(10, drawW - padAmount)
      drawH = Math.max(10, drawH - padAmount)

      drawW = drawW * (logoScale / 100)
      drawH = drawH * (logoScale / 100)

      const scaleFactor = 512 / 300
      const x = (512 - drawW) / 2 + (logoOffset.x * scaleFactor)
      const y = (512 - drawH) / 2 + (logoOffset.y * scaleFactor)

      ctx.drawImage(img, x, y, drawW, drawH)
      
      try {
        const dataUrl = exportCanvas.toDataURL('image/png')
        setProviderForm(prev => ({ ...prev, logo_url: dataUrl }))
        setOpenLogoEditor(false)
      } catch (err) {
        // Tainted canvas fallback if CORS fails: set original URL and warn user
        console.error('Failed to export canvas', err)
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Image server blocked cropping. Saved original URL instead.', severity: 'warning' } 
        }))
        setOpenLogoEditor(false)
      }
    }
    img.src = logoEditorImageSrc
  }

  useEffect(() => {
    const savedPrefs = localStorage.getItem('voyarr_provider_card_prefs')
    if (savedPrefs) {
      try {
        setCardPrefs(prev => ({ ...prev, ...JSON.parse(savedPrefs) }))
      } catch (e) {
        console.error('Failed to parse card preferences', e)
      }
    }
  }, [])

  const handleToggleCardPref = (key) => {
    const newPrefs = { ...cardPrefs, [key]: !cardPrefs[key] }
    setCardPrefs(newPrefs)
    localStorage.setItem('voyarr_provider_card_prefs', JSON.stringify(newPrefs))
  }

  const fetchCookies = useCallback(async () => {
    try {
      const response = await apiFetch('/cookies')
      if (response.ok) {
        const data = await response.json()
        setCookies(data)
      }
    } catch (error) {
      console.error('Failed to fetch cookies:', error)
    }
  }, [])

  useEffect(() => {
    fetchCookies()
  }, [fetchCookies])

  // Open dialog and load existing credentials & details
  const handleOpenConfig = async (provider) => {
    setActiveProvider(provider)
    setDialogTab(0)

    // Load Provider Form for Details tab
    setProviderFormId(provider.id)
    setProviderForm({
      name: provider.name,
      base_url: provider.base_url,
      logo_url: provider.logo_url || '',
      favicon_url: provider.favicon_url || '',
      description: provider.description || '',
      naming_pattern: provider.naming_pattern || '{title}_{performers}_{resolution}',
      separator: provider.separator || '_',
      space_replacement: provider.space_replacement || '_',
      automatic_limits: provider.automatic_limits || { daily_downloads: 50 },
      transparent_logo_bg: provider.transparent_logo_bg || false,
      fit_logo_to_card: provider.fit_logo_to_card || false,
      default_biller_id: provider.default_biller_id || null
    })
    setProviderLimitEnabled(!!provider.automatic_limits?.daily_downloads)
    setEditProviderMode(true)

    setUsername('')
    setPassword('')
    setDailyLimit('')
    setCookieText('')
    setCookieLimit('')
    setLinkedItemId(null)
    setHasTotp(false)
    setSelectedOpItem(null)
    setTestResult(null)
    setNewBillerId(null)
    setNewBillerLabel('')

    fetchProviderBillers(provider.id)

    try {
      const response = await apiFetch(`/credentials/${provider.id}`)
      if (response.ok) {
        const data = await response.json()
        setUsername(data.username || '')
        setPassword(data.password || '')
        setDailyLimit(data.custom_limits?.daily_downloads || '')
        setLinkedItemId(data.external_item_id || null)
        setHasTotp(!!data.has_totp)
        if (data.external_item_id && opItems.length) {
          const match = opItems.find((it) => it.id === data.external_item_id)
          if (match) setSelectedOpItem(match)
        }
      }
    } catch (err) {
      // 404 expected if no credentials exist yet
      console.log('No credentials configured yet for this provider.', err.message)
    }
    setOpenDialog(true)
  }

  // Save Credentials
  const handleSaveCredentials = async (e) => {
    e.preventDefault()
    if (!activeProvider) return

    const payload = {
      provider_id: activeProvider.id,
      username,
      password,
    }
    
    if (dailyLimit) {
      payload.custom_limits = { daily_downloads: parseInt(dailyLimit, 10) }
    }

    try {
      const response = await apiFetch('/credentials', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Credentials saved successfully!', severity: 'success' } 
        }))
        setOpenDialog(false)
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Failed to save credentials.', severity: 'error' } 
        }))
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: error.message, severity: 'error' } 
      }))
    }
  }

  // 1Password linking handlers
  const loadOpItems = async () => {
    setOpItemsLoading(true)
    try {
      const res = await apiFetch('/settings/op/items')
      if (res.ok) {
        const data = await res.json()
        setOpItems(data.items || [])
      } else {
        const errMsg = await getErrorMessage(res, 'Failed to load 1Password items')
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: errMsg, severity: 'error' } }))
        setOpItems([])
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }))
      setOpItems([])
    } finally {
      setOpItemsLoading(false)
    }
  }

  const handleLinkItem = async () => {
    if (!activeProvider || !selectedOpItem) return
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/link`, {
        method: 'POST',
        body: JSON.stringify({ item_id: selectedOpItem.id, vault_id: selectedOpItem.vault_id || null })
      })
      if (res.ok) {
        setLinkedItemId(selectedOpItem.id)
        setHasTotp(true)
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Credential linked to 1Password item.', severity: 'success' } }))
        // reload stored values to show the fetched username
        const credRes = await apiFetch(`/credentials/${activeProvider.id}`)
        if (credRes.ok) {
          const data = await credRes.json()
          setUsername(data.username || '')
          setPassword(data.password || '')
          setHasTotp(!!data.has_totp)
        }
      } else {
        const errMsg = await getErrorMessage(res, 'Failed to link credential')
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: errMsg, severity: 'error' } }))
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }))
    }
  }

  const handleRefreshLink = async () => {
    if (!activeProvider) return
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/refresh`, { method: 'POST' })
      const msg = res.ok ? 'Credential refreshed from 1Password.' : await getErrorMessage(res, 'Failed to refresh credential')
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: msg, severity: res.ok ? 'success' : 'error' } }))
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }))
    }
  }

  const handleUnlink = async () => {
    if (!activeProvider) return
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/unlink`, { method: 'POST' })
      const msg = res.ok ? 'Credential unlinked (stored copy kept).' : await getErrorMessage(res, 'Failed to unlink credential')
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: msg, severity: res.ok ? 'success' : 'error' } }))
      if (res.ok) {
        setLinkedItemId(null)
        setSelectedOpItem(null)
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }))
    }
  }

  const handleSaveManualTotp = async () => {
    if (!activeProvider || !manualTotp) return
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/totp`, {
        method: 'POST',
        body: JSON.stringify({ secret: manualTotp })
      })
      const msg = res.ok ? 'TOTP secret stored.' : await getErrorMessage(res, 'Failed to store TOTP')
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: msg, severity: res.ok ? 'success' : 'error' } }))
      if (res.ok) {
        setHasTotp(true)
        setManualTotp('')
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }))
    }
  }

  const handleDeleteTotp = async () => {
    if (!activeProvider) return
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/totp`, { method: 'DELETE' })
      const msg = res.ok ? 'TOTP secret removed.' : await getErrorMessage(res, 'Failed to remove TOTP')
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: msg, severity: res.ok ? 'success' : 'error' } }))
      if (res.ok) {
        setHasTotp(false)
        setTotpCode('')
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }))
    }
  }

  const handleGetTotpCode = async () => {
    if (!activeProvider) return
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/totp/code`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTotpCode(data.code)
        setTotpSeconds(data.seconds_remaining || 0)
      } else {
        const errMsg = await getErrorMessage(res, 'Failed to generate code')
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: errMsg, severity: 'error' } }))
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }))
    }
  }

  const handleTestSignIn = async () => {
    if (!activeProvider) return
    setSignInBusy(true)
    setTestResult(null)
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/test`, { method: 'POST' })
      if (res.ok) {
        setTestResult(await res.json())
      } else {
        setTestResult({ status: 'error', message: await getErrorMessage(res, 'Sign-in test failed') })
      }
    } catch (e) {
      setTestResult({ status: 'error', message: e.message })
    } finally {
      setSignInBusy(false)
    }
  }

  const handleSignIn = async () => {
    if (!activeProvider) return
    setSignInBusy(true)
    setTestResult(null)
    try {
      const res = await apiFetch(`/credentials/${activeProvider.id}/sign-in`, { method: 'POST' })
      if (res.ok) {
        setTestResult(await res.json())
        fetchCookies()
      } else {
        setTestResult({ status: 'error', message: await getErrorMessage(res, 'Sign-in failed') })
      }
    } catch (e) {
      setTestResult({ status: 'error', message: e.message })
    } finally {
      setSignInBusy(false)
    }
  }

  // Add Cookie
  const handleAddCookie = async () => {
    if (!activeProvider) return

    try {
      const payload = {
        provider_id: activeProvider.id,
        cookie_text: cookieText,
        download_limit: cookieLimit ? parseInt(cookieLimit, 10) : null
      }
      
      const res = await apiFetch('/cookies', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Session cookie added successfully', severity: 'success' } 
        }))
        setCookieText('')
        setCookieLimit('')
        fetchCookies()
      } else {
        const errMsg = await getErrorMessage(res, 'Failed to add cookie')
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: errMsg, severity: 'error' } 
        }))
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: e.message, severity: 'error' } 
      }))
    }
  }

  // Delete Cookie
  const handleDeleteCookie = async (id) => {
    const confirmed = await window.appConfirm('Are you sure you want to delete this session cookie?')
    if (!confirmed) return
    
    try {
      const res = await apiFetch(`/cookies/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCookies()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Cookie deleted successfully', severity: 'success' } 
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Provider CRUD actions
  const handleOpenCreateProvider = () => {
    setEditProviderMode(false)
    setProviderFormId(null)
    setProviderForm({
      name: '',
      base_url: '',
      logo_url: '',
      favicon_url: '',
      description: '',
      naming_pattern: '{title}_{performers}_{resolution}',
      separator: '_',
      space_replacement: '_',
      automatic_limits: { daily_downloads: 50 },
      transparent_logo_bg: false,
      fit_logo_to_card: false,
      default_biller_id: null
    })
    setProviderLimitEnabled(false)
    setOpenProviderForm(true)
  }

  const handleScrapeSiteDetails = async () => {
    if (!providerForm.base_url) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Please enter a Base URL first.', severity: 'warning' } 
      }))
      return
    }
    
    setIsScraping(true)
    try {
      const res = await apiFetch(`/providers/scrape-url`, {
        method: 'POST',
        body: JSON.stringify({ url: providerForm.base_url })
      })
      if (res.ok) {
        const data = await res.json()
        setProviderForm(prev => ({
          ...prev,
          name: data.site_name || prev.name,
          logo_url: data.logo_url || prev.logo_url,
          favicon_url: data.favicon_url || prev.favicon_url,
          description: data.description || prev.description
        }))
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Site details scraped successfully!', severity: 'success' } 
        }))
      } else {
        const errMsg = await getErrorMessage(res, 'Failed to scrape site details.')
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: errMsg, severity: 'error' } 
        }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: err.message, severity: 'error' } 
      }))
    } finally {
      setIsScraping(false)
    }
  }

  const handleSaveProvider = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    try {
      const method = editProviderMode ? 'PUT' : 'POST'
      const endpoint = editProviderMode ? `/providers/${providerFormId}` : '/providers'
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(providerForm)
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `Provider successfully ${editProviderMode ? 'updated' : 'created'}!`, severity: 'success' } 
        }))
        setOpenProviderForm(false)
        setOpenDialog(false)
        if (onRefreshProviders) onRefreshProviders()
      } else {
        const errMsg = await getErrorMessage(res, 'Failed to save provider.')
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: errMsg, severity: 'error' } 
        }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: err.message || 'An error occurred while saving provider.', severity: 'error' } 
      }))
    }
  }

  const handleDeleteProvider = async (provider) => {
    const confirmed = await window.appConfirm(`Are you sure you want to delete the provider "${provider.name}"?`)
    if (!confirmed) return

    try {
      const res = await apiFetch(`/providers/${provider.id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Provider deleted successfully!', severity: 'success' } 
        }))
        if (onRefreshProviders) onRefreshProviders()
      } else {
        const errMsg = await getErrorMessage(res, 'Failed to delete provider.')
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: errMsg, severity: 'error' } 
        }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: err.message, severity: 'error' } 
      }))
    }
  }

  const renderProviderFormDetails = (isModal = false) => (
    <Box component="form" onSubmit={handleSaveProvider} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      <TextField
        fullWidth
        label="Provider Name"
        required
        value={providerForm.name}
        onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
      />
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        <TextField
          fullWidth
          label="Base URL"
          required
          value={providerForm.base_url}
          placeholder="https://example.com"
          onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
        />
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={handleScrapeSiteDetails}
          disabled={!providerForm.base_url || isScraping}
          sx={{ minWidth: { sm: '180px' } }}
        >
          {isScraping ? 'Scraping...' : 'Scrape Site Details'}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: '100%' }}>
        <TextField
          fullWidth
          label="Logo URL"
          value={providerForm.logo_url}
          placeholder="https://example.com/logo.png"
          onChange={(e) => setProviderForm({ ...providerForm, logo_url: e.target.value })}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          {(providerForm.logo_url || providerForm.favicon_url) ? (
            <Avatar
              src={providerForm.logo_url || providerForm.favicon_url}
              alt="Logo preview"
              slotProps={{ img: { style: { objectFit: 'contain', padding: '2px' } } }}
              onClick={() => {
                setLogoEditorImageSrc(providerForm.logo_url || providerForm.favicon_url)
                setLogoScale(100)
                setLogoPadding(20)
                setLogoOffset({ x: 0, y: 0 })
                setOpenLogoEditor(true)
              }}
              sx={{ width: 56, height: 56, cursor: 'pointer', border: '1px dashed', borderColor: 'primary.main', bgcolor: 'action.hover', '&:hover': { opacity: 0.8 } }}
            >
              {providerForm.name?.charAt(0)?.toUpperCase() || '?'}
            </Avatar>
          ) : (
            <Box sx={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed grey', borderRadius: '50%' }}>
              ❓
            </Box>
          )}
          {(providerForm.logo_url || providerForm.favicon_url) && (
            <Button 
              size="small" 
              variant="text" 
              onClick={() => {
                setLogoEditorImageSrc(providerForm.logo_url || providerForm.favicon_url)
                setLogoScale(100)
                setLogoPadding(20)
                setLogoOffset({ x: 0, y: 0 })
                setOpenLogoEditor(true)
              }}
              sx={{ fontSize: '0.65rem', p: 0 }}
            >
              Autofit / Crop
            </Button>
          )}
        </Box>
      </Box>
      <TextField
        fullWidth
        label="Favicon URL"
        value={providerForm.favicon_url}
        placeholder="https://example.com/favicon.ico"
        onChange={(e) => setProviderForm({ ...providerForm, favicon_url: e.target.value })}
      />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', my: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={providerForm.transparent_logo_bg}
              onChange={(e) => setProviderForm({ ...providerForm, transparent_logo_bg: e.target.checked })}
              color="primary"
            />
          }
          label="Use Transparent Background for Logo"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={providerForm.fit_logo_to_card}
              onChange={(e) => setProviderForm({ ...providerForm, fit_logo_to_card: e.target.checked })}
              color="primary"
            />
          }
          label="Fit Logo to Card Layout (Rectangular)"
        />
      </Box>
      <TextField
        fullWidth
        label="Description"
        multiline
        rows={3}
        value={providerForm.description}
        placeholder="Site description..."
        onChange={(e) => setProviderForm({ ...providerForm, description: e.target.value })}
      />

      <Autocomplete
        options={billersList}
        getOptionLabel={(option) => option.name || ''}
        value={billersList.find(b => b.id === providerForm.default_biller_id) || null}
        onChange={(event, newValue) => {
          setProviderForm(prev => ({
            ...prev,
            default_biller_id: newValue ? newValue.id : null
          }))
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Default Payment Gateway / Biller (Searchable)"
            placeholder="Type to search payment gateway..."
            fullWidth
            margin="normal"
          />
        )}
      />
      <Accordion variant="outlined" sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Advanced Settings</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1, pb: 2 }}>
          <TextField
            fullWidth
            label="File Naming Pattern"
            required
            value={providerForm.naming_pattern}
            onChange={(e) => setProviderForm({ ...providerForm, naming_pattern: e.target.value })}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Separator"
              required
              value={providerForm.separator}
              onChange={(e) => setProviderForm({ ...providerForm, separator: e.target.value })}
            />
            <TextField
              fullWidth
              label="Space Replacement"
              required
              value={providerForm.space_replacement}
              onChange={(e) => setProviderForm({ ...providerForm, space_replacement: e.target.value })}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={providerLimitEnabled}
                  onChange={(e) => {
                    setProviderLimitEnabled(e.target.checked);
                    if (!e.target.checked) {
                      setProviderForm(prev => ({ ...prev, automatic_limits: { ...prev.automatic_limits, daily_downloads: 0 } }));
                    }
                  }}
                />
              }
              label="Enable Daily Limit"
              sx={{ minWidth: '180px', whiteSpace: 'nowrap' }}
            />
            <TextField
              fullWidth
              label="Daily Limit"
              type="number"
              disabled={!providerLimitEnabled}
              required={providerLimitEnabled}
              value={providerForm.automatic_limits.daily_downloads || ''}
              onChange={(e) => setProviderForm({ 
                ...providerForm, 
                automatic_limits: { daily_downloads: parseInt(e.target.value, 10) || 0 } 
              })}
            />
          </Box>
        </AccordionDetails>
      </Accordion>
      {!isModal && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button type="submit" variant="contained" color="secondary">
            {providerFormId ? 'Save Details' : 'Create Provider'}
          </Button>
        </Box>
      )}
    </Box>
  )

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', textAlign: { xs: 'center', sm: 'left' } }}>
          Media Providers Hub
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%', sm: 'auto' }, flexDirection: { xs: 'column', sm: 'row' } }}>
          {subTab === 0 && (
            <>
              <Button 
                variant="outlined" 
                color="primary" 
                startIcon={<SettingsIcon />} 
                onClick={(e) => setSettingsAnchorEl(e.currentTarget)}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Display
              </Button>
              <Menu
                anchorEl={settingsAnchorEl}
                open={Boolean(settingsAnchorEl)}
                onClose={() => setSettingsAnchorEl(null)}
              >
                <MenuItem onClick={() => handleToggleCardPref('showLogo')}>
                  <ListItemIcon>
                    <Checkbox checked={cardPrefs.showLogo} size="small" disableRipple />
                  </ListItemIcon>
                  <ListItemText primary="Show Logo" />
                </MenuItem>
                <MenuItem onClick={() => handleToggleCardPref('showBaseUrl')}>
                  <ListItemIcon>
                    <Checkbox checked={cardPrefs.showBaseUrl} size="small" disableRipple />
                  </ListItemIcon>
                  <ListItemText primary="Show Base URL" />
                </MenuItem>
                <MenuItem onClick={() => handleToggleCardPref('showDailyLimit')}>
                  <ListItemIcon>
                    <Checkbox checked={cardPrefs.showDailyLimit} size="small" disableRipple />
                  </ListItemIcon>
                  <ListItemText primary="Show Daily Limit" />
                </MenuItem>
                <MenuItem onClick={() => handleToggleCardPref('showActiveSessions')}>
                  <ListItemIcon>
                    <Checkbox checked={cardPrefs.showActiveSessions} size="small" disableRipple />
                  </ListItemIcon>
                  <ListItemText primary="Show Active Sessions" />
                </MenuItem>
              </Menu>
              <Button 
                variant="contained" 
                color="secondary" 
                startIcon={<AddIcon />} 
                onClick={handleOpenCreateProvider}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Create Provider
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Navigation Sub-Tabs */}
      <Paper sx={{ mb: 3, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}>
        <Tabs 
          value={subTab} 
          onChange={(e, val) => setSubTab(val)} 
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2, '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minHeight: 48 } }}
        >
          <Tab label="Media Providers & Sites" />
          <Tab label="Payment Billers & Gateways" />
          <Tab label="Session Cookies & Auth" />
          <Tab label="Recipe" />
        </Tabs>
      </Paper>

      {subTab === 0 && (
        <>
          {/* Purpose Banner */}
          <Alert 
            severity="info" 
            icon={<Globe size={20} />} 
            sx={{ 
              mb: 3, 
              borderRadius: '12px', 
              bgcolor: 'rgba(14, 165, 233, 0.08)', 
              color: '#38bdf8',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              '& .MuiAlert-icon': { color: '#0284c7' } 
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
              📡 Media Download Providers & Hosts (Where Content is Downloaded From)
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
              Providers represent the streaming sites and download hosts where Voyarr scrapes and downloads media files. Use Providers to manage login credentials, active session cookies, download quotas, and daily limits.
            </Typography>
          </Alert>

          {/* Search, Sort, and View Controls */}
          <Paper sx={{ p: 2, mb: 3, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <TextField
                fullWidth
                size="small"
                label="Search Providers"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by provider name or domain URL..."
                sx={{ flex: 1, minWidth: { xs: '100%', md: 280 }, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
              <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', md: 'auto' }, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200, flex: { xs: 1, md: 'none' } }}>
                  <InputLabel id="provider-sort-label">Sort Providers</InputLabel>
                  <Select
                    labelId="provider-sort-label"
                    value={sortBy}
                    label="Sort Providers"
                    onChange={(e) => setSortBy(e.target.value)}
                    sx={{ borderRadius: '10px' }}
                  >
                    <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                    <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                    <MenuItem value="limit-desc">Daily Download Limit (High to Low)</MenuItem>
                    <MenuItem value="sessions-desc">Active Sessions (Most First)</MenuItem>
                    <MenuItem value="id-desc">Recently Added</MenuItem>
                  </Select>
                </FormControl>

                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, val) => val && setViewMode(val)}
                  size="small"
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    borderRadius: '10px',
                    p: 0.5,
                    border: '1px solid rgba(255,255,255,0.1)',
                    '& .MuiToggleButton-root': {
                      border: 'none',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 0.5,
                      color: 'text.secondary',
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' }
                      }
                    }
                  }}
                >
                  <ToggleButton value="grid">
                    <LayoutGrid size={18} />
                  </ToggleButton>
                  <ToggleButton value="list">
                    <ListIcon size={18} />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>
          </Paper>

          {/* Render Providers (Grid or List View) */}
          {processedProviders.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.15)' }}>
              <Globe size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <Typography variant="h6" color="text.secondary">No media providers found matching your search.</Typography>
            </Paper>
          ) : viewMode === 'grid' ? (
            <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
              {processedProviders.map(provider => {
                const providerCookies = cookies.filter(c => c.provider_id === provider.id)

                return (
                  <Grid size={{ xs: 12, sm: 6, md: 6, lg: 4 }} xs={12} sm={6} md={6} lg={4} key={provider.id} sx={{ display: 'flex', minWidth: 0 }}>
                    <MediaEntityCard
                      mediaHeader={<ProviderCardLogo provider={provider} />}
                      topBadges={
                        <>
                          {provider.default_biller && (
                            <Chip 
                              label={`Biller: ${provider.default_biller.name}`} 
                              size="small" 
                              variant="outlined"
                              sx={{ fontWeight: 'bold', fontSize: '0.65rem', height: 22, border: '1px solid rgba(236, 72, 153, 0.4)', color: '#ec4899', bgcolor: 'rgba(236, 72, 153, 0.08)' }}
                            />
                          )}
                        </>
                      }
                      topActions={
                        <IconButton 
                          size="small"
                          sx={{ 
                            backgroundColor: 'rgba(0,0,0,0.5)', 
                            backdropFilter: 'blur(6px)',
                            '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' } 
                          }}
                          onClick={() => handleToggleFavorite(provider.id, provider.name)}
                          color={favProviders.includes(String(provider.id)) ? "error" : "default"}
                        >
                          {favProviders.includes(String(provider.id)) ? <Heart size={18} fill="currentColor" /> : <Heart size={18} />}
                        </IconButton>
                      }
                      title={provider.name}
                      subtitle={
                        cardPrefs.showBaseUrl && provider.base_url && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, minWidth: 0, width: '100%' }}>
                            <LinkIcon size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                            <Typography 
                              variant="caption" 
                              component="a" 
                              href={provider.base_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              sx={{ 
                                textDecoration: 'none', 
                                color: '#818cf8', 
                                fontWeight: '600', 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0
                              }}
                            >
                              {provider.base_url.replace(/^https?:\/\/(www\.)?/, '')}
                            </Typography>
                          </Box>
                        )
                      }
                      description={provider.description || `Naming pattern: ${provider.naming_pattern || 'Default'}`}
                      bodySections={
                        <>
                          {cardPrefs.showDailyLimit && provider.automatic_limits && (
                            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">Daily Download Limit:</Typography>
                              <Chip
                                label={provider.automatic_limits.daily_downloads ? `${provider.automatic_limits.daily_downloads} / day` : 'Unlimited'}
                                size="small"
                                sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 22, bgcolor: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8' }}
                              />
                            </Box>
                          )}
                          {cardPrefs.showActiveSessions && providerCookies.length > 0 && (
                            <Box sx={{ mb: 2, width: '100%' }}>
                              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#a5b4fc' }}>Active Session Quotas</Typography>
                              {providerCookies.map(cookie => {
                                const limit = cookie.download_limit || 0;
                                const used = cookie.downloads_used || 0;
                                const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                                const isUnlimited = limit === 0;

                                return (
                                  <Box key={cookie.id} sx={{ mb: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                      <Typography variant="caption" color="text.secondary">
                                        {cookie.status === 'active' ? 'Active' : cookie.status === 'expired' ? 'Expired' : cookie.status}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
                                      </Typography>
                                    </Box>
                                    <LinearProgress 
                                      variant="determinate" 
                                      value={isUnlimited ? 100 : percentage} 
                                      color={isUnlimited ? 'primary' : percentage >= 90 ? 'error' : percentage >= 75 ? 'warning' : 'primary'}
                                      sx={{ height: 6, borderRadius: 3, ...(isUnlimited && { opacity: 0.5 }) }}
                                    />
                                  </Box>
                                )
                              })}
                            </Box>
                          )}
                        </>
                      }
                      footerActions={
                        <>
                          <IconButton size="small" color="primary" onClick={() => handleOpenConfig(provider)}>
                            <Edit2 size={16} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteProvider(provider)}>
                            <Trash2 size={16} />
                          </IconButton>
                        </>
                      }
                    />
                  </Grid>
                )
              })}
            </Grid>
          ) : (
            /* List View */
            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Provider Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Base URL</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Default Biller</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Daily Limit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Sessions</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {processedProviders.map(provider => {
                    const providerCookies = cookies.filter(c => c.provider_id === provider.id)

                    return (
                      <TableRow key={provider.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ProviderCardLogo provider={provider} />
                            </Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{provider.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {provider.base_url ? (
                            <Box component="a" href={provider.base_url} target="_blank" rel="noopener noreferrer" sx={{ color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500, fontSize: '0.85rem' }}>
                              <LinkIcon size={14} /> {provider.base_url.replace(/^https?:\/\/(www\.)?/, '')}
                            </Box>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {provider.default_biller ? (
                            <Chip label={provider.default_biller.name} size="small" sx={{ fontWeight: 'bold', border: '1px solid rgba(236, 72, 153, 0.4)', color: '#ec4899', bgcolor: 'rgba(236, 72, 153, 0.08)' }} />
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={provider.automatic_limits?.daily_downloads ? `${provider.automatic_limits.daily_downloads} / day` : 'Unlimited'}
                            size="small"
                            sx={{ fontWeight: 'bold', fontSize: '0.75rem', bgcolor: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`${providerCookies.length} Active`} 
                            size="small" 
                            color={providerCookies.length > 0 ? "success" : "default"} 
                            variant="outlined" 
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <IconButton size="small" color="primary" onClick={() => handleOpenConfig(provider)}>
                              <Edit2 size={16} />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteProvider(provider)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {subTab === 1 && <BillerList />}
      {subTab === 2 && <CookiesManager />}
      {subTab === 3 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3, borderRadius: '12px', bgcolor: 'rgba(99,102,241,0.08)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', '& .MuiAlert-icon': { color: '#818cf8' } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>🧪 Scraping Recipe Editor</Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
              Configure CSS selectors, XPath patterns, and regex rules that Voyarr uses to scrape metadata from each provider's pages. Select a provider below to manage its recipe.
            </Typography>
          </Alert>
          <FormControl size="small" sx={{ mb: 3, minWidth: 300 }}>
            <InputLabel>Select Provider</InputLabel>
            <Select value={recipeProviderId || ''} label="Select Provider" onChange={e => setRecipeProviderId(e.target.value || null)} sx={{ borderRadius: '10px' }}>
              <MenuItem value=""><em>None</em></MenuItem>
              {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <RecipeEditor providerId={recipeProviderId} recipe={selectedRecipe} onSave={fetchSelectedRecipe} />
        </Box>
      )}

      {/* Unified Manage Auth & Session Modal */}
      <Dialog 
        open={openDialog} 
        onClose={() => {
          if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          setOpenDialog(false)
        }} 
        disableRestoreFocus 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={activeProvider?.logo_url || activeProvider?.favicon_url || ''}
            alt={activeProvider?.name}
            slotProps={{ img: { style: { objectFit: 'contain', padding: '2px' } } }}
            sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem' }}
          >
            {activeProvider?.name ? activeProvider.name.charAt(0).toUpperCase() : '?'}
          </Avatar>
          Manage: {activeProvider?.name}
        </DialogTitle>
        
        <Tabs 
          value={dialogTab} 
          onChange={(e, val) => setDialogTab(val)}
          variant="fullWidth"
          sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Tab label="Details" />
          <Tab label="Billers" />
          <Tab label="Credentials" />
          <Tab label="Session Cookies" />
        </Tabs>

        <DialogContent dividers>
          {dialogTab === 0 && renderProviderFormDetails()}
          
          {dialogTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Configure payment gateways and billers supported by this provider. Subscriptions for this provider can link to any of these billing instances.
              </Typography>

              <TableContainer component={Paper} sx={{ maxHeight: 200, overflowX: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Biller</TableCell>
                      <TableCell>Merchant Account Label</TableCell>
                      <TableCell align="center">Default</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {providerBillers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">No billers linked to this provider yet.</TableCell>
                      </TableRow>
                    ) : (
                      providerBillers.map((pb) => (
                        <TableRow key={pb.id}>
                          <TableCell sx={{ fontWeight: 'bold' }}>{pb.biller?.name || `Biller #${pb.biller_id}`}</TableCell>
                          <TableCell>{pb.merchant_account_label || 'Direct / Standard'}</TableCell>
                          <TableCell align="center">
                            {pb.is_default && <Chip label="Default" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={async () => {
                                const confirmed = await window.appConfirm('Remove this biller from this provider?')
                                if (!confirmed) return
                                try {
                                  const res = await apiFetch(`/providers/${activeProvider.id}/billers/${pb.id}`, { method: 'DELETE' })
                                  if (res.ok) {
                                    fetchProviderBillers(activeProvider.id)
                                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Biller removed.', severity: 'success' } }))
                                  }
                                } catch (err) {
                                  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message, severity: 'error' } }))
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 1 }}>
                Link New Biller
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Autocomplete
                  options={billersList}
                  getOptionLabel={(o) => o?.name || ''}
                  value={billersList.find(b => b.id === newBillerId) || null}
                  onChange={(e, val) => setNewBillerId(val ? val.id : null)}
                  renderInput={(params) => <TextField {...params} label="Select Biller" size="small" />}
                  sx={{ minWidth: 200, flex: 1 }}
                />
                <TextField
                  label="Merchant Label (e.g. CCB*PROVIDER)"
                  size="small"
                  value={newBillerLabel}
                  onChange={e => setNewBillerLabel(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  disabled={!newBillerId}
                  onClick={async () => {
                    if (!newBillerId || !activeProvider) return
                    try {
                      const res = await apiFetch(`/providers/${activeProvider.id}/billers`, {
                        method: 'POST',
                        body: JSON.stringify({
                          provider_id: activeProvider.id,
                          biller_id: newBillerId,
                          merchant_account_label: newBillerLabel.trim() || null,
                          is_default: providerBillers.length === 0
                        })
                      })
                      if (res.ok) {
                        setNewBillerId(null)
                        setNewBillerLabel('')
                        fetchProviderBillers(activeProvider.id)
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Biller linked to provider!', severity: 'success' } }))
                      } else {
                        const err = await res.json()
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.detail || 'Failed to link biller.', severity: 'error' } }))
                      }
                    } catch (err) {
                      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message, severity: 'error' } }))
                    }
                  }}
                >
                  Link
                </Button>
              </Box>
            </Box>
          )}

          {dialogTab === 2 && (
            <Box component="form" onSubmit={handleSaveCredentials} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configure credentials to let Voyarr query metadata, index search categories, and authenticate API connections contextually.
              </Typography>

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 1 }}>
                Link from 1Password
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={opItems}
                  getOptionLabel={(it) => it?.vault_name ? `${it.title} (${it.vault_name})` : (it?.title || '')}
                  loading={opItemsLoading}
                  value={selectedOpItem || null}
                  onChange={(e, val) => setSelectedOpItem(val)}
                  onOpen={loadOpItems}
                  renderOption={(props, it) => (
                    <Box component="li" {...props}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it?.title || ''}
                        </Typography>
                        {it?.username && (
                          <Typography variant="caption" color="text.secondary">
                            {it.username}
                          </Typography>
                        )}
                      </Box>
                      {it?.vault_name && (
                        <Chip label={it.vault_name} size="small" sx={{ ml: 1, fontSize: '0.65rem' }} />
                      )}
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="1Password login items"
                      placeholder={linkedItemId ? 'Linked to an item' : 'Search items...'}
                      slotProps={{ input: params.InputProps }}
                    />
                  )}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleLinkItem}
                  disabled={!selectedOpItem || opItemsLoading}
                  startIcon={<LinkIcon size={16} />}
                >
                  Link
                </Button>
                {linkedItemId && (
                  <Button variant="outlined" color="secondary" onClick={handleRefreshLink}>
                    Refresh
                  </Button>
                )}
              </Box>

              {linkedItemId ? (
                <Alert severity="success" sx={{ mt: 1 }} onClose={handleUnlink}>
                  Linked to 1Password item{linkedItemTitle ? `: ${linkedItemTitle}` : ''}. Credentials are encrypted locally.
                </Alert>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No 1Password item linked. Credentials below are saved locally.
                </Typography>
              )}

              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Custom Daily Limit (Optional)"
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                margin="normal"
                placeholder="Override default limit"
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button type="submit" variant="contained" color="success">
                  Save Credentials
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Two-Factor Authentication (TOTP)
              </Typography>
              {hasTotp ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', letterSpacing: 3 }}>
                    {totpCode || '------'}
                  </Typography>
                  <Button size="small" variant="outlined" onClick={handleGetTotpCode}>
                    Show Code {totpSeconds > 0 ? `(${totpSeconds}s)` : ''}
                  </Button>
                  <Button size="small" color="error" onClick={handleDeleteTotp}>
                    Remove
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="TOTP secret or otpauth:// URL (manual)"
                    value={manualTotp}
                    onChange={(e) => setManualTotp(e.target.value)}
                  />
                  <Button onClick={handleSaveManualTotp} variant="outlined" disabled={!manualTotp}>
                    Save
                  </Button>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleSignIn}
                  disabled={signInBusy}
                  startIcon={<LinkIcon size={16} />}
                >
                  {signInBusy ? 'Working...' : 'Sign In & Get Session'}
                </Button>
                <Button variant="outlined" onClick={handleTestSignIn} disabled={signInBusy}>
                  Test Sign-in
                </Button>
              </Box>
              {testResult && (
                <Alert severity={testResult.status === 'success' ? 'success' : testResult.status === 'error' ? 'error' : 'info'} sx={{ mt: 1 }}>
                  {testResult.message || testResult.status}
                </Alert>
              )}
            </Box>
          )}

          {dialogTab === 3 && (
            <Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Add session cookie text to authenticate downloads, bypassed links, or rate-limited direct feeds securely.
              </Typography>
              
              <Box sx={{ mt: 3, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  Configured Cookies
                </Typography>
              </Box>
          <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 180, overflowX: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Usage / Limit</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cookies.filter(c => c.provider_id === activeProvider?.id).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">No active cookies found.</TableCell>
                      </TableRow>
                    ) : (
                      cookies.filter(c => c.provider_id === activeProvider?.id).map((cookie) => (
                        <TableRow key={cookie.id}>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Chip 
                              label={cookie.status} 
                              color={cookie.status === 'active' ? 'success' : cookie.status === 'expired' ? 'error' : 'warning'} 
                              size="small" 
                            />
                          </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{cookie.downloads_used} / {cookie.download_limit || '∞'}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <IconButton size="small" color="error" onClick={() => handleDeleteCookie(cookie.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Add Cookie Form */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Add Session Cookie
              </Typography>
              <TextField 
                fullWidth 
                margin="dense" 
                label="Netscape Cookie Text / Token" 
                multiline 
                rows={3} 
                value={cookieText} 
                onChange={e => setCookieText(e.target.value)} 
              />
              <TextField 
                fullWidth 
                margin="dense" 
                type="number" 
                label="Max Downloads Limit (Optional)" 
                value={cookieLimit} 
                onChange={e => setCookieLimit(e.target.value)} 
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button 
                  onClick={handleAddCookie} 
                  variant="contained" 
                  color="primary"
                  startIcon={<AddIcon />}
                  disabled={!cookieText}
                >
                  Add Cookie
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          {dialogTab === 0 && (
            <Button onClick={handleSaveProvider} variant="contained" color="secondary">
              {providerFormId ? 'Save Details' : 'Create Provider'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Logo Crop & Autofit Dialog Modal */}
      <Dialog open={openLogoEditor} onClose={() => setOpenLogoEditor(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Logo Crop & Pad Editor</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Drag the image to center/pan, and use the controls below to resize and pad your logo into a perfect square.
          </Typography>
          <Box sx={{ position: 'relative', width: 300, height: 300, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
            <canvas 
              id="logo-editor-canvas" 
              width={300} 
              height={300} 
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'block' }}
            />
          </Box>
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Zoom / Scale ({logoScale}%)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: '0.8rem' }}>➖</span>
                <input 
                  type="range" 
                  min="10" 
                  max="200" 
                  value={logoScale} 
                  onChange={(e) => setLogoScale(Number(e.target.value))} 
                  style={{ flexGrow: 1 }}
                />
                <span style={{ fontSize: '0.8rem' }}>➕</span>
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Transparent Padding ({logoPadding}%)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: '0.8rem' }}>🔲</span>
                <input 
                  type="range" 
                  min="0" 
                  max="80" 
                  value={logoPadding} 
                  onChange={(e) => setLogoPadding(Number(e.target.value))} 
                  style={{ flexGrow: 1 }}
                />
                <span style={{ fontSize: '0.8rem' }}>🔳</span>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setLogoScale(100)
            setLogoPadding(20)
            setLogoOffset({ x: 0, y: 0 })
          }} color="warning">Reset</Button>
          <Button onClick={() => setOpenLogoEditor(false)}>Cancel</Button>
          <Button onClick={handleApplyLogoEdit} variant="contained" color="primary">Apply</Button>
        </DialogActions>
      </Dialog>

      {/* Provider Create Modal */}
      <Dialog open={openProviderForm} onClose={() => setOpenProviderForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Create Provider
        </DialogTitle>
        <DialogContent dividers>
          {renderProviderFormDetails(true)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProviderForm(false)}>Cancel</Button>
          <Button onClick={handleSaveProvider} variant="contained" color="secondary">
            Create Provider
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
