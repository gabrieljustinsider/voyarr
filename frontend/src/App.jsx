import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { 
  CssBaseline, AppBar, Toolbar, Typography, Container, Tabs, Tab, Box, 
  Paper, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, IconButton, FormControl, InputLabel, Select, MenuItem, Switch, 
  FormControlLabel, Divider, Grid, TextField, CircularProgress, Chip,
  Badge, Avatar, Menu, Popover, List, ListItem, ListItemText
} from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, SlidersHorizontal, Bell, CircleHelp, Clapperboard, Key, Download, Bot, Wrench } from 'lucide-react'

// Synchronously load Login to keep initial login paint instant
import Login from './components/Login'

// Automatic retry helper for lazy loading components across production builds with new chunk hashes
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasBeenRefreshed = JSON.parse(
      window.sessionStorage.getItem('voyarr_lazy_retry') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('voyarr_lazy_retry', 'false');
      return component;
    } catch (error) {
      if (!pageHasBeenRefreshed) {
        window.sessionStorage.setItem('voyarr_lazy_retry', 'true');
        console.warn('Stale build chunk detected. Auto-refreshing app assets...', error);
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });

// Lazily load tab components with auto-recovery to optimize bundle size and FCP/LCP
const ProviderList = lazyWithRetry(() => import('./components/ProviderList'))
const DownloadQueue = lazyWithRetry(() => import('./components/DownloadQueue'))
const Settings = lazyWithRetry(() => import('./components/Settings'))
const UserManagement = lazyWithRetry(() => import('./components/UserManagement'))
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'))
const Library = lazyWithRetry(() => import('./components/Library'))
const Duplicates = lazyWithRetry(() => import('./components/Duplicates'))
const MetadataManager = lazyWithRetry(() => import('./components/MetadataManager'))
const ExternalAPIs = lazyWithRetry(() => import('./components/ExternalAPIs'))
const UniversalSearch = lazyWithRetry(() => import('./components/UniversalSearch'))
const SystemStatus = lazyWithRetry(() => import('./components/SystemStatus'))
const DownloadRules = lazyWithRetry(() => import('./components/DownloadRules'))
const MassRip = lazyWithRetry(() => import('./components/MassRip'))
const ScheduleManager = lazyWithRetry(() => import('./components/ScheduleManager'))
const BackupManager = lazyWithRetry(() => import('./components/BackupManager'))
const LogsViewer = lazyWithRetry(() => import('./components/LogsViewer'))
const ScraperTester = lazyWithRetry(() => import('./components/ScraperTester'))
const RequestManager = lazyWithRetry(() => import('./components/RequestManager'))

// New Feature components
const Favorites = lazyWithRetry(() => import('./components/Favorites'))
const Studios = lazyWithRetry(() => import('./components/Studios'))
const Analytics = lazyWithRetry(() => import('./components/Analytics'))
const LiveStreams = lazyWithRetry(() => import('./components/LiveStreams'))
const NotificationSettings = lazyWithRetry(() => import('./components/NotificationSettings'))
const TranscodeQueue = lazyWithRetry(() => import('./components/TranscodeQueue'))
const SubscriptionManager = lazyWithRetry(() => import('./components/SubscriptionManager'))
const BillerList = lazyWithRetry(() => import('./components/BillerList'))
const P2PSync = lazyWithRetry(() => import('./components/P2PSync'))
const HelpArea = lazyWithRetry(() => import('./components/HelpArea'))
const AdminHelpArea = lazyWithRetry(() => import('./components/AdminHelpArea'))
const AccountSecurity = lazyWithRetry(() => import('./components/AccountSecurity'))
const Performers = lazyWithRetry(() => import('./components/Performers'))
const Tags = lazyWithRetry(() => import('./components/Tags'))

import { apiFetch, getAuthHeaders } from './api'
import ErrorBoundary from './ErrorBoundary'
import DevLayoutShell from './components/DevLayoutShell'
import './App.css'

// 7 Premium Theme Configurations
const themeConfigs = {
  light: {
    palette: {
      mode: 'light',
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      background: { default: '#f5f5f5', paper: '#ffffff' }
    }
  },
  dark: {
    palette: {
      mode: 'dark',
      primary: { main: '#90caf9' },
      secondary: { main: '#f48fb1' },
      background: { default: '#121212', paper: '#1e1e1e' }
    }
  },
  material_light: {
    palette: { mode: 'light', primary: { main: '#1976d2' }, secondary: { main: '#dc004e' }, background: { default: '#f5f5f5', paper: '#ffffff' } },
    isMaterial: true
  },
  material_dark: {
    palette: { mode: 'dark', primary: { main: '#90caf9' }, secondary: { main: '#f48fb1' }, background: { default: '#121212', paper: '#1e1e1e' } },
    isMaterial: true
  },
  tailwind_light: {
    palette: { mode: 'light', primary: { main: '#3b82f6' }, secondary: { main: '#8b5cf6' }, background: { default: '#f8fafc', paper: '#ffffff' }, text: { primary: '#0f172a', secondary: '#64748b' } },
    isTailwind: true
  },
  tailwind_dark: {
    palette: { mode: 'dark', primary: { main: '#3b82f6' }, secondary: { main: '#8b5cf6' }, background: { default: '#0f172a', paper: '#1e293b' }, text: { primary: '#f8fafc', secondary: '#94a3b8' } },
    isTailwind: true
  },
  midnight_cyber: {
    palette: {
      mode: 'dark',
      primary: { main: '#00f0ff' }, // neon cyan
      secondary: { main: '#ff007f' }, // neon pink
      background: { default: '#0a0b10', paper: '#12131a' },
      text: { primary: '#ffffff', secondary: '#8a8d9b' }
    }
  },
  sunset_rose: {
    palette: {
      mode: 'dark',
      primary: { main: '#ff7b90' }, // rose gold
      secondary: { main: '#ffb86c' }, // peach
      background: { default: '#1e121e', paper: '#2c1a2c' },
      text: { primary: '#fff0f2', secondary: '#b5a1b5' }
    }
  },
  emerald_obsidian: {
    palette: {
      mode: 'dark',
      primary: { main: '#00e676' }, // glowing emerald
      secondary: { main: '#00b0ff' }, // electric blue
      background: { default: '#08100c', paper: '#0e1a14' },
      text: { primary: '#e0f2f1', secondary: '#80cbc4' }
    }
  },
  ocean_glass: {
    palette: {
      mode: 'dark',
      primary: { main: '#00b4d8' }, // ocean blue
      secondary: { main: '#90e0ef' },
      background: { default: '#0b132b', paper: 'rgba(28, 37, 65, 0.5)' },
      text: { primary: '#ffffff', secondary: '#a5a9b4' }
    }
  },
  crimson_obsidian: {
    palette: {
      mode: 'dark',
      primary: { main: '#e50914' }, // crimson red
      secondary: { main: '#ff3333' },
      background: { default: '#000000', paper: '#111111' },
      text: { primary: '#ffffff', secondary: '#888888' }
    }
  }
}

// Typography scaling settings for Smart TV mode
const getTypography = (isTv) => {
  if (isTv) {
    return {
      fontSize: 20,
      h1: { fontSize: '4.5rem', fontWeight: 800 },
      h2: { fontSize: '3.2rem', fontWeight: 700 },
      h3: { fontSize: '2.8rem', fontWeight: 700 },
      h4: { fontSize: '2.4rem', fontWeight: 700 },
      h5: { fontSize: '1.8rem', fontWeight: 700 },
      h6: { fontSize: '1.5rem', fontWeight: 700 },
      body1: { fontSize: '1.25rem' },
      body2: { fontSize: '1.15rem' },
      button: { fontSize: '1.15rem', fontWeight: 'bold' }
    }
  }
  return {
    fontSize: 14,
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 }
  }
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('voyarr_jwt') || !!localStorage.getItem('voyarr_api_key'))
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '', dailyLimit: '' })
  const [queue, setQueue] = useState([])
  const [tabValue, setTabValue] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null, onCancel: null })
  const [promptModal, setPromptModal] = useState({ open: false, message: '', value: '', onConfirm: null, onCancel: null })

  // Interactive notifications state
  const [notifications, setNotifications] = useState([])
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null)
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null)
  const [helpModalOpen, setHelpModalOpen] = useState(false)

  // Safely decode the user role from the local storage JWT token
  const userRole = useMemo(() => {
    const jwt = localStorage.getItem('voyarr_jwt')
    if (!jwt) return 'viewer'
    try {
      const payload = jwt.split('.')[1]
      const decoded = JSON.parse(atob(payload))
      return decoded.role || 'viewer'
    } catch {
      return 'viewer'
    }
  }, [])

  const userName = useMemo(() => {
    const jwt = localStorage.getItem('voyarr_jwt')
    if (!jwt) return 'Viewer'
    try {
      const payload = jwt.split('.')[1]
      const decoded = JSON.parse(atob(payload))
      return decoded.sub || 'Admin'
    } catch {
      return 'Viewer'
    }
  }, [])

  const initials = useMemo(() => {
    if (!userName) return 'V'
    return userName.slice(0, 2).toUpperCase()
  }, [userName])

  // Custom Preferences state
  const [themeName, setThemeName] = useState('dark')
  const [uiConfig, setUiConfig] = useState({
    showFavorites: true, showStudios: true, showAnalytics: true, showLive: true,
    showDashboard: true, showLibrary: true, showSearch: true,
    showDownloads: true, showTranscode: true, showMassRip: true,
    showSubscriptions: true, showSchedules: true,
    showProviders: true, showScraperTester: true, showBillers: true,
    showPerformers: true, showTags: true, showMetadata: true,
    showUserManagement: true, showAccountSecurity: true, showP2P: true,
    showBackup: true, showLogs: true, showStatus: true,
    showSettings: true, showHelp: true,
    rememberLastTab: true
  })
  const [isTvMode, setIsTvMode] = useState(false)
  const [prefDialogOpen, setPrefDialogOpen] = useState(false)
  const [prefTab, setPrefTab] = useState(0)

  // Temp dialog preferences state
  const [tempTheme, setTempTheme] = useState('dark')
  const [tempUiConfig, setTempUiConfig] = useState({
    showFavorites: true, showStudios: true, showAnalytics: true, showLive: true,
    showDashboard: true, showLibrary: true, showSearch: true,
    showDownloads: true, showTranscode: true, showMassRip: true,
    showSubscriptions: true, showSchedules: true,
    showProviders: true, showScraperTester: true, showBillers: true,
    showPerformers: true, showTags: true, showMetadata: true,
    showUserManagement: true, showAccountSecurity: true, showP2P: true,
    showBackup: true, showLogs: true, showStatus: true,
    showSettings: true, showHelp: true,
    rememberLastTab: true
  })
  const [tempTvMode, setTempTvMode] = useState(false)
  const [customThemeSettings, setCustomThemeSettings] = useState({
    mode: 'dark',
    primary: '#90caf9',
    secondary: '#f48fb1',
    isMaterial: false
  })
  const [tempCustomThemeSettings, setTempCustomThemeSettings] = useState({
    mode: 'dark',
    primary: '#90caf9',
    secondary: '#f48fb1',
    isMaterial: false
  })

  // Load preferences from DB
  const loadPreferences = useCallback(async () => {
    try {
      const res = await apiFetch('/user/stats/preferences')
      if (res.ok) {
        const data = await res.json()
        setThemeName(data.theme || 'dark')
        if (data.ui_config) {
          const allKeys = ['showFavorites','showStudios','showAnalytics','showLive',
            'showDashboard','showLibrary','showSearch','showDownloads','showTranscode',
            'showMassRip','showSubscriptions','showSchedules','showProviders',
            'showScraperTester','showBillers','showPerformers','showTags','showMetadata',
            'showUserManagement','showAccountSecurity','showP2P','showBackup',
            'showLogs','showStatus','showSettings','showHelp','rememberLastTab']
          const merged = {}
          allKeys.forEach(k => { merged[k] = data.ui_config[k] !== false })
          setUiConfig(merged)
          setIsTvMode(data.ui_config.isTvMode || false)
          if (data.ui_config.customTheme) {
            setCustomThemeSettings(data.ui_config.customTheme)
          }
        }
      }
    } catch (e) {
      console.error('Failed to load user preferences:', e)
    }
  }, [])

  const savePreferences = async (newTheme, newUi, newTv, newCustomTheme) => {
    try {
      const res = await apiFetch('/user/stats/preferences', {
        method: 'POST',
        body: JSON.stringify({
          theme: newTheme,
          ui_config: {
            ...newUi,
            isTvMode: newTv,
            customTheme: newCustomTheme
          }
        })
      })
      if (res.ok) {
        setThemeName(newTheme)
        setUiConfig(newUi)
        setIsTvMode(newTv)
        setCustomThemeSettings(newCustomTheme)
        setSnackbar({ open: true, message: 'Interface preferences updated successfully!', severity: 'success' })
      }
    } catch (e) {
      console.error(e)
      setSnackbar({ open: true, message: 'Failed to save settings.', severity: 'error' })
    }
  }

  // Create MUI theme dynamically based on configurations and TV scaling mode
  const currentMuiTheme = useMemo(() => {
    let baseConfig = themeConfigs[themeName] || themeConfigs.dark
    if (themeName === 'custom') {
      baseConfig = {
        palette: {
          mode: customThemeSettings.mode,
          primary: { main: customThemeSettings.primary },
          secondary: { main: customThemeSettings.secondary },
          background: {
            default: customThemeSettings.mode === 'dark' ? '#121212' : '#f5f5f5',
            paper: customThemeSettings.mode === 'dark' ? '#1e1e1e' : '#ffffff'
          }
        },
        isMaterial: customThemeSettings.isMaterial
      }
    }

    return createTheme({
      ...baseConfig,
      breakpoints: {
        values: {
          xs: 0,
          sm: 600,
          md: 960,
          lg: 1280,
          xl: 1920,
          tv: 2560,
          '4k': 3840,
        }
      },
      shape: {
        borderRadius: baseConfig.isTailwind ? 8 : (baseConfig.isMaterial ? 4 : 16)
      },
      typography: {
        ...getTypography(isTvMode),
        fontFamily: baseConfig.isTailwind ? '"Inter", system-ui, -apple-system, sans-serif' : undefined,
        button: {
          ...(getTypography(isTvMode).button || {}),
          textTransform: 'none',
          fontWeight: baseConfig.isTailwind ? 500 : 'bold'
        }
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            'ul, ol, li, dl, dd, dt': {
              textAlign: 'left',
            }
          }
        },
        MuiList: {
          styleOverrides: {
            root: {
              textAlign: 'left',
            }
          }
        },
        MuiListItemText: {
          styleOverrides: {
            root: {
              textAlign: 'left',
            }
          }
        },
        MuiCard: {
          styleOverrides: {
            root: ({ theme }) => {
              if (baseConfig.isTailwind) {
                return {
                  borderRadius: '8px',
                  boxShadow: theme.palette.mode === 'dark' 
                    ? '0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)'
                    : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  border: theme.palette.mode === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
                  background: theme.palette.background.paper,
                };
              }
              if (baseConfig.isMaterial) {
                return {
                  borderRadius: '16px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                  }
                };
              }
              return {
                borderRadius: '16px',
                transition: 'transform 0.2s, box-shadow 0.2s',
                background: theme.palette.mode === 'dark' 
                  ? 'linear-gradient(135deg, rgba(28, 37, 65, 0.4) 0%, rgba(10, 11, 16, 0.6) 100%)' 
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(240, 240, 240, 0.5) 100%)',
                backdropFilter: 'blur(16px)',
                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
                boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : '0 4px 20px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.palette.mode === 'dark' ? '0 12px 40px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.2)'
                }
              };
            }
          }
        },
        MuiCardContent: {
          styleOverrides: {
            root: {
              padding: '24px',
              '&:last-child': {
                paddingBottom: '24px'
              }
            }
          }
        },
        MuiPaper: {
          styleOverrides: {
            root: ({ theme, ownerState }) => {
              if (baseConfig.isTailwind) {
                if (ownerState.variant === 'outlined') {
                  return {
                    borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                  };
                }
                if (ownerState.elevation > 0 && ownerState.elevation < 24) {
                   return {
                     boxShadow: theme.palette.mode === 'dark' 
                       ? '0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)'
                       : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                     border: theme.palette.mode === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
                   };
                }
                return {};
              }
              if (baseConfig.isMaterial) return {};
              
              if (ownerState.variant === 'outlined') {
                return {
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  backdropFilter: 'blur(10px)'
                };
              }
              if (ownerState.elevation > 0 && ownerState.elevation < 24) {
                 return {
                   background: theme.palette.mode === 'dark' 
                     ? 'linear-gradient(135deg, rgba(28, 37, 65, 0.4) 0%, rgba(10, 11, 16, 0.6) 100%)' 
                     : 'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(240, 240, 240, 0.5) 100%)',
                   backdropFilter: 'blur(16px)',
                   border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
                 };
              }
              return {};
            }
          }
        },
        MuiDialog: {
          defaultProps: {
            closeAfterTransition: false
          },
          styleOverrides: {
            paper: ({ theme }) => {
              if (baseConfig.isTailwind) {
                return {
                  background: theme.palette.background.paper,
                  border: theme.palette.mode === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
                  boxShadow: theme.palette.mode === 'dark' 
                    ? '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)'
                    : '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                  borderRadius: '8px'
                };
              }
              if (baseConfig.isMaterial) return {};
              return {
                background: theme.palette.mode === 'dark' 
                  ? 'linear-gradient(135deg, #1e202c 0%, #11121a 100%)' 
                  : 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0,0,0,0.1)',
                boxShadow: theme.palette.mode === 'dark' ? '0 12px 40px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,0,0,0.2)',
                borderRadius: '16px'
              };
            }
          }
        },
        MuiDialogContent: {
          styleOverrides: {
            root: {
              padding: '32px',
            }
          }
        },
        MuiDialogActions: {
          styleOverrides: {
            root: {
              padding: '16px 32px 24px 32px',
            }
          }
        },
        MuiButton: {
          styleOverrides: {
            root: ({ theme }) => {
              if (baseConfig.isTailwind) {
                return {
                  borderRadius: '6px',
                  boxShadow: 'none',
                  padding: isTvMode ? '14px 28px' : '6px 16px',
                  '&:hover': {
                    boxShadow: theme.palette.mode === 'dark' ? '0 1px 3px 0 rgb(0 0 0 / 0.5)' : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                  }
                };
              }
              return {
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 'bold',
                padding: isTvMode ? '14px 28px' : '8px 18px'
              };
            }
          }
        },
        MuiTextField: {
          defaultProps: {
            variant: 'outlined',
            slotProps: {
              inputLabel: { shrink: true }
            }
          },
          styleOverrides: {
            root: ({ ownerState }) => {
              if (ownerState && ownerState.label && typeof ownerState.label === 'string') {
                const estimatedWidth = ownerState.label.length * 9.5 + 32;
                return {
                  minWidth: `${Math.max(180, estimatedWidth)}px`
                };
              }
              return {};
            }
          }
        },
        MuiFormControl: {
          defaultProps: {
            variant: 'outlined'
          }
        },
        MuiSelect: {
          defaultProps: {
            variant: 'outlined'
          }
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: ({ theme, ownerState }) => {
              const styles = {
                borderRadius: baseConfig.isTailwind ? '8px' : (baseConfig.isMaterial ? '4px' : '10px'),
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                  borderWidth: '2px',
                },
              };
              if (ownerState && ownerState.label && typeof ownerState.label === 'string') {
                const estimatedWidth = ownerState.label.length * 9.5 + 32;
                styles.minWidth = `${Math.max(180, estimatedWidth)}px`;
              }
              return styles;
            },
            input: {
              '&[type="number"]': {
                textAlign: 'right'
              }
            }
          }
        },
        MuiInputLabel: {
          defaultProps: {
            shrink: true
          },
          styleOverrides: {
            outlined: ({ theme }) => ({
              transform: 'translate(14px, 16px) scale(1)',
              '&.MuiInputLabel-shrink': {
                transform: 'translate(14px, -6px) scale(0.75)',
              }
            })
          }
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              textAlign: 'center',
              padding: '16px'
            },
            head: {
              fontWeight: 800
            }
          }
        }
      }
    })
  }, [themeName, isTvMode, customThemeSettings])

  const fetchProviders = useCallback(async () => {
    try {
      const response = await apiFetch('/providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data)
      } else {
        setProviders([
          { id: 1, name: 'Example Provider', base_url: 'https://example.com', automatic_limits: { daily_downloads: 50 } }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      setProviders([
        { id: 1, name: 'Example Provider', base_url: 'https://example.com', automatic_limits: { daily_downloads: 50 } }
      ])
    }
  }, [])

  const fetchQueue = useCallback(async () => {
    try {
      const response = await apiFetch('/download')
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
  }, [])

  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const token = params.get('access_token')
      const error = params.get('error')
      const message = params.get('message')

      if (token) {
        localStorage.setItem('voyarr_jwt', token)
        setIsLoggedIn(true)
        window.location.hash = ''
        setSnackbar({ open: true, message: 'Signed in successfully via SSO!', severity: 'success' })
      } else if (error) {
        setSnackbar({ open: true, message: decodeURIComponent(error), severity: 'error' })
        window.location.hash = ''
      } else if (message) {
        setSnackbar({ open: true, message: decodeURIComponent(message), severity: 'success' })
        window.location.hash = ''
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return

    const init = async () => {
      await fetchProviders()
      await fetchQueue()
      await loadPreferences()
    }
    init()
    
    const abortController = new AbortController()
    const startSSE = async () => {
      try {
        const res = await fetch(`${API_BASE}/download/stream`, {
          headers: getAuthHeaders(),
          signal: abortController.signal
        })
        if (res.status === 401) {
          localStorage.removeItem('voyarr_jwt')
          localStorage.removeItem('voyarr_api_key')
          window.location.reload()
          return
        }
        if (res.status === 403) {
          console.warn('Access forbidden to /download/stream (feature disabled or insufficient permissions). SSE streaming disabled.')
          return
        }
        if (!res.ok) {
          throw new Error(`Download stream HTTP error! Status: ${res.status}`)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { setQueue(JSON.parse(line.substring(6))) } catch (e) { console.debug('JSON Parse error', e) }
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError' && !abortController.signal.aborted) {
          setTimeout(() => {
            if (!abortController.signal.aborted) startSSE()
          }, 5000)
        }
      }
    }
    startSSE()

    return () => abortController.abort()
  }, [isLoggedIn, fetchProviders, fetchQueue, loadPreferences])

  // Notifications SSE stream to trigger global MUI Snackbars and populate notifications list
  useEffect(() => {
    if (!isLoggedIn) return

    const abortController = new AbortController()
    const startNotificationsSSE = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications/stream`, {
          headers: getAuthHeaders(),
          signal: abortController.signal
        })
        if (res.status === 401) {
          localStorage.removeItem('voyarr_jwt')
          localStorage.removeItem('voyarr_api_key')
          window.location.reload()
          return
        }
        if (res.status === 403) {
          console.warn('Access forbidden to /notifications/stream. SSE streaming disabled.')
          return
        }
        if (!res.ok) {
          throw new Error(`Notifications stream HTTP error! Status: ${res.status}`)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const notif = JSON.parse(line.substring(6))
                const notifId = notif.id || `notif-${Date.now()}-${window.crypto.getRandomValues(new Uint32Array(1))[0]}`
                const newNotif = {
                  ...notif,
                  id: notifId,
                  read: false,
                  timestamp: new Date()
                }
                setNotifications(prev => [newNotif, ...prev].slice(0, 50))
                window.dispatchEvent(new CustomEvent('show-toast', { 
                  detail: { 
                     message: `${notif.title}: ${notif.message}`, 
                    severity: notif.event_type === 'favorite_updated' ? 'success' : 'info' 
                  } 
                }))
              } catch (e) {
                console.debug('JSON Parse error for notifications SSE:', e)
              }
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError' && !abortController.signal.aborted) {
          setTimeout(() => {
            if (!abortController.signal.aborted) startNotificationsSSE()
          }, 5000)
        }
      }
    }
    startNotificationsSSE()

    return () => abortController.abort()
  }, [isLoggedIn])

  // Fetch notification history on mount/login
  useEffect(() => {
    if (!isLoggedIn) return

    const fetchNotificationHistory = async () => {
      try {
        const data = await apiFetch('/notifications/history')
        if (data && Array.isArray(data)) {
          const mapped = data.map(n => ({
            ...n,
            timestamp: n.created_at ? new Date(n.created_at) : new Date()
          }))
          setNotifications(mapped)
        }
      } catch (error) {
        console.error('Failed to fetch notification history:', error)
      }
    }

    fetchNotificationHistory()
  }, [isLoggedIn])

  const filteredProviders = useMemo(() => providers.filter(provider =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.base_url.toLowerCase().includes(searchQuery.toLowerCase())
  ), [providers, searchQuery])

  useEffect(() => {
    const handleToast = (e) => {
      setSnackbar({ open: true, message: e.detail.message, severity: e.detail.severity || 'info' })
    }
    window.addEventListener('show-toast', handleToast)

    window.alert = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: String(message), severity: 'info' } }))
    }
    
    window.appConfirm = (message) => new Promise((resolve) => {
      setConfirmModal({ open: true, message, onConfirm: () => resolve(true), onCancel: () => resolve(false) })
    })

    window.appPrompt = (message, defaultValue = '') => new Promise((resolve) => {
      setPromptModal({ open: true, message, value: defaultValue, onConfirm: (val) => resolve(val), onCancel: () => resolve(null) })
    })

    window.confirm = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Use await window.appConfirm() for async dialogs: ${message}`, severity: 'warning' } }))
      return false
    }
    window.prompt = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Use await window.appPrompt() for async prompts: ${message}`, severity: 'warning' } }))
      return null
    }

    return () => window.removeEventListener('show-toast', handleToast)
  }, [])

  const handleCredentialSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    const payload = {
      provider_id: selectedProvider,
      username: credentials.username,
      password: credentials.password,
    }
    
    if (credentials.dailyLimit) {
      payload.custom_limits = { daily_downloads: parseInt(credentials.dailyLimit, 10) }
    }

    try {
      const response = await apiFetch('/credentials', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        setSnackbar({ open: true, message: 'Credentials saved successfully!', severity: 'success' })
        setCredentials({ username: '', password: '', dailyLimit: '' })
      } else {
        setSnackbar({ open: true, message: 'Failed to save credentials.', severity: 'error' })
      }
    } catch (error) {
      console.error('Error submitting credentials:', error)
      setSnackbar({ open: true, message: 'Error saving credentials.', severity: 'error' })
    }
  }, [selectedProvider, credentials])

  const handleLogout = () => {
    localStorage.removeItem('voyarr_jwt')
    localStorage.removeItem('voyarr_api_key')
    setIsLoggedIn(false)
    window.location.reload()
  }

  const handleOpenPrefDialog = () => {
    setTempTheme(themeName)
    setTempUiConfig(uiConfig)
    setTempTvMode(isTvMode)
    setTempCustomThemeSettings(customThemeSettings)
    setPrefDialogOpen(true)
  }

  const handleSavePrefDialog = () => {
    savePreferences(tempTheme, tempUiConfig, tempTvMode, tempCustomThemeSettings)
    setPrefDialogOpen(false)
  }

  // Dynamic conditional Tab Panel Builder
  const allTabs = useMemo(() => [
    { label: "Dashboard", component: <Dashboard />, visible: true },
    { label: "Library", component: <Library />, visible: true },
    { label: "Universal Search", component: <UniversalSearch />, visible: true },
    { label: "Favorites", component: <Favorites />, visible: uiConfig.showFavorites },
    { label: "Studios", component: <Studios />, visible: uiConfig.showStudios },
    { label: "Stream Recorder", component: <LiveStreams />, visible: uiConfig.showLive },
    { label: "Analytics", component: <Analytics />, visible: uiConfig.showAnalytics },
    { label: "Providers", component: (
      <ProviderList 
        providers={filteredProviders} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefreshProviders={fetchProviders}
      />
    ), visible: true },
    { label: "Downloads", component: <DownloadQueue queue={queue} onRefresh={fetchQueue} />, visible: true },
    { label: "Mass Rip", component: <MassRip />, visible: true },
    { label: "Schedules", component: <ScheduleManager />, visible: true },
    { label: "Rules & Lists", component: <DownloadRules />, visible: true },
    { label: "Duplicates", component: <Duplicates />, visible: true },

    { label: "Metadata", component: <MetadataManager />, visible: true },
    { label: "System Status", component: <SystemStatus />, visible: true },
    { label: "Account Security", component: <AccountSecurity setSnackbar={setSnackbar} />, visible: true },
    { label: "Performers", component: <Performers setActivePage={(p) => handleNavigateToLibrary(p)} />, visible: true },
    { label: "Tags", component: <Tags setActivePage={(p) => handleNavigateToLibrary(p)} />, visible: true },
    { label: "External APIs", component: <ExternalAPIs />, visible: true },
    { label: "Settings", component: <Settings />, visible: true },
    { label: "User Management", component: <UserManagement />, visible: true },
    { label: "P2P Sync", component: <P2PSync />, visible: true },
    { label: "Notification Settings", component: <NotificationSettings />, visible: true },
    { label: "Transcode Queue", component: <TranscodeQueue />, visible: true },
    { label: "Subscriptions", component: <SubscriptionManager />, visible: true },
    { label: "Billers", component: <BillerList />, visible: true },
    { label: "Backup", component: <BackupManager />, visible: true },
    { label: "Logs", component: <LogsViewer />, visible: true },
    { label: "Scraper Tester", component: <ScraperTester />, visible: true },
    { label: "Request Manager", component: <RequestManager userRole={userRole} />, visible: true },
  ], [uiConfig, filteredProviders, queue, fetchQueue, searchQuery, userRole])

  const visibleTabs = useMemo(() => allTabs.filter(t => t.visible), [allTabs])

  // Define categorized tabs logically and alphabetically (Credentials, Session Cookies, and Admin Help are now integrated contextually)
  const categories = useMemo(() => [
    {
      id: "media",
      label: "Library & Media",
      icon: <Clapperboard size={20} />,
      tabs: ["Dashboard", "Library", "Universal Search", "Favorites", "Studios", "Stream Recorder", "Analytics", "Request Manager", "Performers", "Tags"]
    },
    {
      id: "scraping",
      label: "Providers & Auth",
      icon: <Key size={20} />,
      tabs: ["Providers", "Scraper Tester", "Subscriptions", "Billers"]
    },
    {
      id: "tasks",
      label: "Tasks & Downloads",
      icon: <Download size={20} />,
      tabs: ["Downloads", "Mass Rip", "Schedules", "Transcode Queue"]
    },
    {
      id: "data",
      label: "Data & Rules",
      icon: <Bot size={20} />,
      tabs: ["Rules & Lists", "Duplicates", "Metadata"]
    },
    {
      id: "system",
      label: "System & Admin",
      icon: <Wrench size={20} />,
      tabs: ["System Status", "External APIs", "Settings", "Account Security", "User Management", "P2P Sync", "Notification Settings", "Backup", "Logs"]
    }
  ], []);

  // Compute active category and sub-tabs dynamically based on current flat tabValue
  const currentTab = visibleTabs[tabValue >= visibleTabs.length ? 0 : tabValue];
  const currentTabLabel = currentTab?.label;

  const activeCategory = useMemo(() => {
    if (!currentTabLabel) return categories[0];
    const cat = categories.find(c => c.tabs.includes(currentTabLabel));
    return cat || categories[0];
  }, [currentTabLabel, categories]);

  const activeCategorySubTabs = useMemo(() => {
    return visibleTabs.filter(t => activeCategory.tabs.includes(t.label));
  }, [visibleTabs, activeCategory]);

  const activeSubTabIndex = useMemo(() => {
    const idx = activeCategorySubTabs.findIndex(t => t.label === currentTabLabel);
    return idx >= 0 ? idx : 0;
  }, [activeCategorySubTabs, currentTabLabel]);

  const tabIdMap = useMemo(() => ({
    dashboard: 'Dashboard',
    library: 'Library',
    search: 'Universal Search',
    favorites: 'Favorites',
    livestreams: 'Stream Recorder',
    download_queue: 'Downloads',
    transcode_queue: 'Transcode Queue',
    mass_rip: 'Mass Rip',
    subscriptions: 'Subscriptions',
    schedules: 'Schedules',
    download_rules: 'Rules & Lists',
    providers: 'Providers',
    billers: 'Billers',
    studios: 'Studios',
    metadata_manager: 'Metadata',
    duplicates: 'Metadata',
    scraper_tester: 'Scraper Tester',
    user_management: 'User Management',
    p2p_sync: 'P2P Sync',
    external_apis: 'External APIs',
    backup_manager: 'Backup',
    logs_viewer: 'Logs',
    system_status: 'System Status',
    account_security: 'Account Security',
    performers: 'Performers',
    tags: 'Tags',
    settings: 'Settings',
    help: 'Request Manager'
  }), [])

  const handleNavigateToLibrary = useCallback((performerOrTag) => {
    setPrefTab(0)
    setTabValue(1)
  }, [])

  const currentTabId = useMemo(() => {
    return Object.keys(tabIdMap).find(k => tabIdMap[k] === currentTabLabel) || 'dashboard'
  }, [tabIdMap, currentTabLabel])

  const hasRestoredTab = useRef(false)

  // Restore last selected tab from URL hash (#library), query param (?tab=library), or localStorage on initial mount
  useEffect(() => {
    if (!hasRestoredTab.current && visibleTabs.length > 0) {
      // 1. Check URL hash (#tabId) or query param (?tab=tabId)
      const hashTab = window.location.hash.replace('#', '').toLowerCase()
      const urlParams = new URLSearchParams(window.location.search)
      const queryTab = urlParams.get('tab')?.toLowerCase()
      const targetTabId = hashTab || queryTab

      if (targetTabId && tabIdMap[targetTabId]) {
        const targetLabel = tabIdMap[targetTabId]
        const targetIdx = visibleTabs.findIndex(t => t.label === targetLabel)
        if (targetIdx >= 0) {
          setTabValue(targetIdx)
          hasRestoredTab.current = true
          return
        }
      }

      // 2. Fallback to localStorage if rememberLastTab is enabled
      if (uiConfig.rememberLastTab) {
        const savedTab = localStorage.getItem('voyarr_last_tab')
        if (savedTab) {
          const targetIdx = visibleTabs.findIndex(t => t.label === savedTab)
          if (targetIdx >= 0) {
            setTabValue(targetIdx)
            hasRestoredTab.current = true
            return
          }
        }
      }

      hasRestoredTab.current = true
    }
  }, [uiConfig.rememberLastTab, visibleTabs, tabIdMap])

  // Save selected tab to localStorage and update URL hash AFTER initial restoration completes
  useEffect(() => {
    if (!hasRestoredTab.current) return

    // Don't set hash for DeoVR headsets — they need clean URLs for native rendering
    if (navigator?.userAgent?.toLowerCase().includes('deovr') || navigator?.userAgent?.toLowerCase().includes('deo/') || /\[deo[\d.]+\]/i.test(navigator?.userAgent || '')) {
      return
    }

    if (currentTabLabel) {
      if (uiConfig.rememberLastTab) {
        localStorage.setItem('voyarr_last_tab', currentTabLabel)
      }
      if (currentTabId && window.location.hash !== `#${currentTabId}`) {
        window.history.replaceState(null, '', `#${currentTabId}`)
      }
    }
  }, [currentTabLabel, currentTabId, uiConfig.rememberLastTab])

  // Support browser back / forward button navigation
  useEffect(() => {
    const handlePopState = () => {
      const hashTab = window.location.hash.replace('#', '').toLowerCase()
      if (hashTab && tabIdMap[hashTab]) {
        const targetLabel = tabIdMap[hashTab]
        const idx = visibleTabs.findIndex(t => t.label === targetLabel)
        if (idx >= 0) setTabValue(idx)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [visibleTabs, tabIdMap])

  if (!isLoggedIn) {
    return (
      <ErrorBoundary title="Authentication Error">
        <ThemeProvider theme={currentMuiTheme}>
          <CssBaseline />
          <Login onLogin={() => setIsLoggedIn(true)} />
        </ThemeProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary title="Voyarr Interface Error">
      <ThemeProvider theme={currentMuiTheme}>
        <CssBaseline />
        <DevLayoutShell
          currentTab={currentTabId}
          onSelectTab={(tabId) => {
            const targetLabel = tabIdMap[tabId] || 'Dashboard'
            const idx = visibleTabs.findIndex(t => t.label === targetLabel)
            if (idx >= 0) setTabValue(idx)
          }}
          onLogout={handleLogout}
          onOpenSettings={() => {
            setPrefTab(0)
            handleOpenPrefDialog()
          }}
          activeDownloadsCount={queue.filter(q => q.status === 'downloading' || q.status === 'queued').length}
          user={{ username: userName }}
          uiConfig={uiConfig}
        >
          <ErrorBoundary title="Tab Rendering Error">
            <Suspense fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <CircularProgress />
              </Box>
            }>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={tabValue}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {visibleTabs[tabValue >= visibleTabs.length ? 0 : tabValue]?.component}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </DevLayoutShell>

        <Dialog 
          open={prefDialogOpen} 
          onClose={() => {
            if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            setPrefDialogOpen(false)
          }} 
          disableRestoreFocus 
          maxWidth={prefTab === 1 ? "md" : "xs"} 
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 'bold' }}>User Settings</DialogTitle>
          <Box sx={{ px: 3 }}>
            <Tabs value={prefTab} onChange={(e, val) => setPrefTab(val)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tab label="Appearance & Tabs" sx={{ textTransform: 'none' }} />
              <Tab label="Account Security" sx={{ textTransform: 'none' }} />
            </Tabs>
          </Box>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minHeight: prefTab === 1 ? 400 : 'auto' }}>
            {prefTab === 0 ? (
              <>
                {/* Theme Selector */}
                <FormControl fullWidth size="small">
                  <InputLabel>Visual Theme Palette</InputLabel>
                  <Select
                    value={tempTheme}
                    label="Visual Theme Palette"
                    onChange={(e) => setTempTheme(e.target.value)}
                  >
                  <MenuItem value="light">Glassmorphic Light Mode</MenuItem>
                  <MenuItem value="dark">Glassmorphic Dark Mode</MenuItem>
                  <MenuItem value="material_light">Standard Material Light</MenuItem>
                  <MenuItem value="material_dark">Standard Material Dark</MenuItem>
                  <MenuItem value="tailwind_light">Tailwind Modern Light</MenuItem>
                  <MenuItem value="tailwind_dark">Tailwind Modern Dark</MenuItem>
                    <MenuItem value="midnight_cyber">Midnight Cyber (Cyan/Neon)</MenuItem>
                    <MenuItem value="sunset_rose">Sunset Rose (Peach/Warm Plums)</MenuItem>
                    <MenuItem value="emerald_obsidian">Emerald Obsidian (Emerald/Deep dark)</MenuItem>
                    <MenuItem value="ocean_glass">Ocean Glassmorphism (Ocean/Translucent)</MenuItem>
                    <MenuItem value="crimson_obsidian">Crimson Obsidian (High contrast Red/Black)</MenuItem>
                    <MenuItem value="custom">Custom Theme</MenuItem>
                  </Select>
                </FormControl>

                {tempTheme === 'custom' && (
                  <Box sx={{ mt: 1, p: 2, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle2" gutterBottom>Custom Theme Settings</Typography>
                    <Grid container spacing={2}>
                      <Grid xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Mode</InputLabel>
                          <Select
                            value={tempCustomThemeSettings.mode}
                            label="Mode"
                            onChange={(e) => setTempCustomThemeSettings({...tempCustomThemeSettings, mode: e.target.value})}
                          >
                            <MenuItem value="light">Light</MenuItem>
                            <MenuItem value="dark">Dark</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Style</InputLabel>
                          <Select
                            value={tempCustomThemeSettings.isMaterial ? 'true' : 'false'}
                            label="Style"
                            onChange={(e) => setTempCustomThemeSettings({...tempCustomThemeSettings, isMaterial: e.target.value === 'true'})}
                          >
                            <MenuItem value="false">Glassmorphic</MenuItem>
                            <MenuItem value="true">Flat Material</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid xs={12} sm={3}>
                        <TextField fullWidth size="small" label="Primary Color" type="color"
                          value={tempCustomThemeSettings.primary} slotProps={{ inputLabel: { shrink: true } }}
                          onChange={(e) => setTempCustomThemeSettings({...tempCustomThemeSettings, primary: e.target.value})}
                          sx={{ '& input': { padding: '4px 8px', height: '32px', cursor: 'pointer' } }} />
                      </Grid>
                      <Grid xs={12} sm={3}>
                        <TextField fullWidth size="small" label="Secondary Color" type="color"
                          value={tempCustomThemeSettings.secondary} slotProps={{ inputLabel: { shrink: true } }}
                          onChange={(e) => setTempCustomThemeSettings({...tempCustomThemeSettings, secondary: e.target.value})}
                          sx={{ '& input': { padding: '4px 8px', height: '32px', cursor: 'pointer' } }} />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* TV Breakpoints toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempTvMode}
                      onChange={(e) => setTempTvMode(e.target.checked)}
                    />
                  }
                  label="Optimized Smart TV Layout (Widescreen targets)"
                />

                <Divider sx={{ my: 1 }} />
                
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Conditional Feature Tabs</Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={tempUiConfig.showFavorites}
                        onChange={(e) => setTempUiConfig({ ...tempUiConfig, showFavorites: e.target.checked })}
                      />
                    }
                    label="Enable Favorites Hub"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={tempUiConfig.showStudios}
                        onChange={(e) => setTempUiConfig({ ...tempUiConfig, showStudios: e.target.checked })}
                      />
                    }
                    label="Enable Studios Profiles"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={tempUiConfig.showLive}
                        onChange={(e) => setTempUiConfig({ ...tempUiConfig, showLive: e.target.checked })}
                      />
                    }
                    label="Enable Live Streams capture"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={tempUiConfig.showAnalytics}
                        onChange={(e) => setTempUiConfig({ ...tempUiConfig, showAnalytics: e.target.checked })}
                      />
                    }
                    label="Enable Analytics dashboard"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={tempUiConfig.rememberLastTab || false}
                        onChange={(e) => setTempUiConfig({ ...tempUiConfig, rememberLastTab: e.target.checked })}
                      />
                    }
                    label="Remember Last Selected Tab"
                  />
                </Box>
              </>
            ) : (
              <Suspense fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              }>
                <AccountSecurity setSnackbar={setSnackbar} />
              </Suspense>
            )}
          </DialogContent>
          <DialogActions>
            {prefTab === 0 ? (
              <>
                <Button onClick={() => setPrefDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSavePrefDialog} variant="contained" color="primary">
                  Apply & Save
                </Button>
              </>
            ) : (
              <Button onClick={() => setPrefDialogOpen(false)} variant="contained">Close</Button>
            )}
          </DialogActions>
        </Dialog>

        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={6000} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>

        <Dialog 
          open={confirmModal.open} 
          onClose={() => { 
            if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            confirmModal.onCancel?.()
            setConfirmModal({ ...confirmModal, open: false }) 
          }} 
          disableRestoreFocus 
          maxWidth="xs" 
          fullWidth
        >
          <DialogTitle>Confirmation Required</DialogTitle>
          <DialogContent dividers>
            <Typography>{confirmModal.message}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { confirmModal.onCancel?.(); setConfirmModal({ ...confirmModal, open: false }) }}>
              Cancel
            </Button>
            <Button color="error" variant="contained" onClick={() => { confirmModal.onConfirm?.(); setConfirmModal({ ...confirmModal, open: false }) }}>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog 
          open={promptModal.open} 
          onClose={() => { 
            if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            promptModal.onCancel?.()
            setPromptModal({ ...promptModal, open: false }) 
          }} 
          disableRestoreFocus 
          maxWidth="xs" 
          fullWidth
        >
          <DialogTitle>Input Required</DialogTitle>
          <DialogContent dividers>
            <Typography sx={{ mb: 2 }}>{promptModal.message}</Typography>
            <TextField
              autoFocus
              margin="dense"
              label={promptModal.message}
              fullWidth
              variant="outlined"
              value={promptModal.value}
              onChange={(e) => setPromptModal({ ...promptModal, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  promptModal.onConfirm?.(promptModal.value);
                  setPromptModal({ ...promptModal, open: false });
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { promptModal.onCancel?.(); setPromptModal({ ...promptModal, open: false }) }}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={() => { promptModal.onConfirm?.(promptModal.value); setPromptModal({ ...promptModal, open: false }) }}>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* Help Dialog Modal */}
        <Dialog 
          open={helpModalOpen} 
          onClose={() => {
            if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            setHelpModalOpen(false)
          }}
          disableRestoreFocus
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '20px',
              background: 'rgba(30, 30, 40, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)'
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 'bold' }}>Voyarr Help & Documentation</DialogTitle>
          <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <Suspense fallback={<CircularProgress />}>
              <HelpArea userRole={userRole} />
            </Suspense>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHelpModalOpen(false)} variant="contained">Close</Button>
          </DialogActions>
        </Dialog>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
