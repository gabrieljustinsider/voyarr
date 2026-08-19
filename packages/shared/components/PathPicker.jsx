import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Breadcrumbs,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Autocomplete,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Chip,
  Checkbox,
  Alert,
  Grid,
  Card,
  CardActionArea,
  Paper
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import HomeIcon from '@mui/icons-material/Home'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LockIcon from '@mui/icons-material/Lock'
import StorageIcon from '@mui/icons-material/Storage'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import DownloadIcon from '@mui/icons-material/Download'
import SaveIcon from '@mui/icons-material/Save'
import FileUploadIcon from '@mui/icons-material/FileUpload'

const CONTEXT_CONFIGS = {
  import: {
    title: 'Select Media Location to Import',
    actionText: 'Import Selected',
    helperText: 'Choose a folder or file to scan and import into your media collection.',
    icon: <DownloadIcon sx={{ color: 'var(--accent, #6366f1)' }} />
  },
  open: {
    title: 'Open File or Folder',
    actionText: 'Open Selected',
    helperText: 'Choose a file or directory to open.',
    icon: <FolderOpenIcon sx={{ color: 'var(--accent, #6366f1)' }} />
  },
  save: {
    title: 'Select Storage Destination',
    actionText: 'Save Here',
    helperText: 'Choose where downloads and files will be saved.',
    icon: <SaveIcon sx={{ color: 'var(--accent, #6366f1)' }} />
  },
  export: {
    title: 'Select Export Destination',
    actionText: 'Export to Folder',
    helperText: 'Select destination directory for exported content.',
    icon: <FileUploadIcon sx={{ color: 'var(--accent, #6366f1)' }} />
  },
  browse: {
    title: 'File Explorer',
    actionText: 'Select Path',
    helperText: 'Browse system directories and storage drives.',
    icon: <FolderOpenIcon sx={{ color: 'var(--accent, #6366f1)' }} />
  }
}

export default function SharedPathPicker({
  value = '',
  onChange,
  label,
  helperText,
  purpose = 'browse',
  mode = 'folder', // 'folder', 'file', or 'both'
  multiple = false,
  fullWidth = true,
  fetcher = null, // Custom apiFetch implementation
  browseEndpoint = '/settings/browse',
  autocompleteEndpoint = '/settings/autocomplete',
  mkdirEndpoint = '/settings/mkdir',
  validateEndpoint = '/settings/validate-path',
  showVolumePills = true,
  showCapacityBadges = true,
  showPermissionBadge = true,
  enableHistoryNavigation = true,
  enableViewToggle = true,
  enableBookmarks = true
}) {
  const contextConfig = CONTEXT_CONFIGS[purpose] || CONTEXT_CONFIGS.browse
  const effectiveLabel = label || (mode === 'folder' ? 'Folder Path' : 'File Path')
  const effectiveHelperText = helperText || contextConfig.helperText

  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState(Array.isArray(value) ? value.join(', ') : (value || ''))

  // Browser State
  const [currentPath, setCurrentPath] = useState('/')
  const [parentPath, setParentPath] = useState(null)
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [volumes, setVolumes] = useState([])
  const [isWritable, setIsWritable] = useState(true)
  const [diskSpace, setDiskSpace] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [browserLoading, setBrowserLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  
  // Navigation & Multi-select & View Mode
  const [history, setHistory] = useState(['/'])
  const [historyIdx, setHistoryIdx] = useState(0)
  const [viewMode, setViewMode] = useState('list')
  const [showHidden, setShowHidden] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState(new Set(Array.isArray(value) ? value : (value ? [value] : [])))
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('path_picker_bookmarks') || '[]')
    } catch {
      return ['/media/storage', '/downloads', '/']
    }
  })
  const [copiedToast, setCopiedToast] = useState(false)

  // Folder Creation State
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderError, setFolderError] = useState('')
  const [validationError, setValidationError] = useState('')

  const debounceRef = useRef(null)

  // Default API fetch wrapper
  const doFetch = async (url, opts = {}) => {
    if (fetcher) return fetcher(url, opts)
    return fetch(url, opts)
  }

  // Handle Value Updates
  useEffect(() => {
    const formatted = Array.isArray(value) ? value.join(', ') : (value || '')
    setInputValue(formatted)
    if (!multiple && typeof value === 'string' && value.startsWith('/')) {
      doFetch(`${validateEndpoint}?path=${encodeURIComponent(value)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && !data.valid && data.error) {
            setValidationError(data.error)
          } else {
            setValidationError('')
          }
        })
        .catch(() => setValidationError(''))
    } else {
      setValidationError('')
    }
  }, [value, multiple])

  // Save Bookmarks
  useEffect(() => {
    try {
      localStorage.setItem('path_picker_bookmarks', JSON.stringify(bookmarks))
    } catch (e) {
      console.error('Failed to save bookmarks:', e)
    }
  }, [bookmarks])

  // Directory Browser Loader
  const loadDirectory = async (targetPath, addToHistory = true) => {
    setBrowserLoading(true)
    setFetchError('')
    try {
      const res = await doFetch(`${browseEndpoint}?path=${encodeURIComponent(targetPath)}`)
      if (res.ok) {
        const data = await res.json()
        const newPath = data.current_path || targetPath
        setCurrentPath(newPath)
        setParentPath(data.parent_path)
        setFolders(data.folders || [])
        setFiles(data.files || [])
        if (data.volumes) setVolumes(data.volumes)
        if (data.is_writable !== undefined) setIsWritable(data.is_writable)
        if (data.disk_space) setDiskSpace(data.disk_space)

        if (addToHistory) {
          setHistory(prev => [...prev.slice(0, historyIdx + 1), newPath])
          setHistoryIdx(prev => prev + 1)
        }
      } else {
        setFetchError('Unable to access folder due to system permission restrictions.')
      }
    } catch (err) {
      setFetchError('Network error loading directory.')
    } finally {
      setBrowserLoading(false)
    }
  }

  const handleOpenBrowser = () => {
    setOpen(true)
    setFilterText('')
    const startPath = (typeof value === 'string' && value.startsWith('/')) ? value : '/'
    loadDirectory(startPath, false)
  }

  const handleHistoryBack = () => {
    if (historyIdx > 0) {
      const prevPath = history[historyIdx - 1]
      setHistoryIdx(historyIdx - 1)
      loadDirectory(prevPath, false)
    }
  }

  const handleHistoryForward = () => {
    if (historyIdx < history.length - 1) {
      const nextPath = history[historyIdx + 1]
      setHistoryIdx(historyIdx + 1)
      loadDirectory(nextPath, false)
    }
  }

  const handleToggleBookmark = (path) => {
    setBookmarks(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentPath)
    setCopiedToast(true)
    setTimeout(() => setCopiedToast(false), 2000)
  }

  const handleSelectToggle = (path) => {
    if (!multiple) {
      setInputValue(path)
      onChange(path)
      setOpen(false)
      return
    }
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleConfirmSelection = () => {
    if (multiple) {
      const arr = Array.from(selectedPaths)
      onChange(arr)
    } else {
      onChange(currentPath)
    }
    setOpen(false)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const res = await doFetch(mkdirEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, name: newFolderName.trim() })
      })
      if (res.ok) {
        setNewFolderName('')
        setShowNewFolderInput(false)
        setFolderError('')
        loadDirectory(currentPath, false)
      } else {
        const err = await res.json()
        setFolderError(err.detail || 'Failed to create folder')
      }
    } catch {
      setFolderError('Network error creating folder.')
    }
  }

  // Autocomplete fetcher
  const handleInputChange = (event, newInputValue) => {
    setInputValue(newInputValue)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!newInputValue) { setOptions([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await doFetch(`${autocompleteEndpoint}?q=${encodeURIComponent(newInputValue)}`)
        if (response.ok) {
          const data = await response.json()
          setOptions(data.suggestions || [])
        }
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  const getPathSegments = () => {
    if (!currentPath || currentPath === '/') return []
    const parts = currentPath.split('/').filter(Boolean)
    const segments = []
    let accumulated = ''
    for (let part of parts) {
      accumulated += '/' + part
      segments.push({ name: part, path: accumulated })
    }
    return segments
  }

  const filteredFolders = folders.filter(f => showHidden || !f.name.startsWith('.')).filter(f => f.name.toLowerCase().includes(filterText.toLowerCase()))
  const filteredFiles = files.filter(f => showHidden || !f.name.startsWith('.')).filter(f => f.name.toLowerCase().includes(filterText.toLowerCase()))

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', width: fullWidth ? '100%' : 'auto' }}>
      <Autocomplete
        freeSolo
        fullWidth={fullWidth}
        value={inputValue || ''}
        inputValue={inputValue || ''}
        onChange={(e, val) => {
          const pathVal = typeof val === 'string' ? val : val?.path
          if (pathVal) {
            setInputValue(pathVal)
            onChange(pathVal)
          }
        }}
        onInputChange={handleInputChange}
        options={options}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.path}
        renderOption={(props, option) => {
          const { key, ...rest } = props
          return (
            <li key={key || option.path} {...rest}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {option.is_dir ? (
                  <FolderIcon sx={{ color: 'var(--accent, #6366f1)' }} fontSize="small" />
                ) : (
                  <InsertDriveFileIcon sx={{ color: 'text.secondary' }} fontSize="small" />
                )}
                <Typography variant="body2">{option.path}</Typography>
              </Box>
            </li>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={effectiveLabel}
            helperText={validationError ? (
              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⚠️ {validationError}
              </span>
            ) : effectiveHelperText}
            error={!!validationError}
            size="small"
            onBlur={() => { if (inputValue !== value) onChange(inputValue) }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <React.Fragment>
                  <InputAdornment position="start" sx={{ pl: 0.5, mr: 0.5 }}>
                    <FolderIcon sx={{ color: 'var(--accent, #6366f1)', opacity: 0.8 }} fontSize="small" />
                  </InputAdornment>
                  {params.InputProps?.startAdornment}
                </React.Fragment>
              ),
              endAdornment: (
                <React.Fragment>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps?.endAdornment}
                </React.Fragment>
              )
            }}
          />
        )}
      />

      <Tooltip title="Open Interactive File Explorer">
        <IconButton
          onClick={handleOpenBrowser}
          sx={{
            width: '40px',
            height: '40px',
            flexShrink: 0,
            color: 'var(--accent, #6366f1)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            '&:hover': {
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              borderColor: 'var(--accent, #6366f1)'
            }
          }}
        >
          <FolderOpenIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Explorer Modal */}
      <Dialog
        open={open}
        onClose={() => {
          if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          setOpen(false)
        }}
        disableRestoreFocus
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backdropFilter: 'blur(24px)',
            backgroundColor: 'rgba(18, 19, 26, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
            borderRadius: '20px',
            color: '#f3f4f6',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {contextConfig.icon}
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {contextConfig.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {contextConfig.helperText}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpen(false)} sx={{ color: '#9ca3af' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5 }}>
          {/* Quick Access Volume Pills */}
          {showVolumePills && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', display: 'block', mb: 1 }}>
                Quick Access Storage Drives
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(volumes.length > 0 ? volumes : [
                  { label: 'Media Library', path: '/media' },
                  { label: 'Root (/)', path: '/' },
                  { label: 'Downloads', path: '/downloads' },
                  { label: 'Library', path: '/library' },
                  { label: 'Scan / Import', path: '/scan' },
                  { label: 'Mounts', path: '/mnt' }
                ]).map(vol => {
                  const isActive = currentPath === vol.path || currentPath.startsWith(vol.path + '/')
                  return (
                    <Chip
                      key={vol.path}
                      icon={<StorageIcon fontSize="small" />}
                      label={`${vol.label}${showCapacityBadges && vol.free_gb ? ` · ${vol.free_gb} GB free` : ''}`}
                      onClick={() => loadDirectory(vol.path)}
                      sx={{
                        cursor: 'pointer',
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        borderColor: isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                        borderStyle: 'solid',
                        borderWidth: 1,
                        color: isActive ? '#a5b4fc' : '#e5e7eb',
                        '&:hover': {
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          borderColor: '#818cf8'
                        }
                      }}
                    />
                  )
                })}
              </Box>
            </Box>
          )}

          {/* Breadcrumbs & Controls Row */}
          <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', flexGrow: 1 }}>
              {enableHistoryNavigation && (
                <React.Fragment>
                  <IconButton size="small" disabled={historyIdx <= 0} onClick={handleHistoryBack} sx={{ color: historyIdx > 0 ? '#f3f4f6' : 'rgba(255,255,255,0.2)' }}>
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={historyIdx >= history.length - 1} onClick={handleHistoryForward} sx={{ color: historyIdx < history.length - 1 ? '#f3f4f6' : 'rgba(255,255,255,0.2)' }}>
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </React.Fragment>
              )}
              <IconButton size="small" onClick={() => loadDirectory('/')} sx={{ color: currentPath === '/' ? 'var(--accent, #6366f1)' : '#9ca3af' }}>
                <HomeIcon fontSize="small" />
              </IconButton>
              <Breadcrumbs separator="/" sx={{ color: '#f3f4f6', '& .MuiBreadcrumbs-separator': { color: '#6b7280' } }}>
                {getPathSegments().map((seg, idx, arr) => (
                  <Link
                    key={seg.path}
                    underline="hover"
                    component="button"
                    onClick={() => loadDirectory(seg.path)}
                    sx={{
                      color: idx === arr.length - 1 ? 'var(--accent, #6366f1)' : '#9ca3af',
                      fontWeight: idx === arr.length - 1 ? 800 : 500,
                      fontSize: '0.875rem'
                    }}
                  >
                    {seg.name}
                  </Link>
                ))}
              </Breadcrumbs>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showPermissionBadge && (
                <Chip
                  size="small"
                  icon={isWritable ? <CheckCircleIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                  label={isWritable ? "Ready to write" : "Read-only"}
                  color={isWritable ? "success" : "warning"}
                  variant="outlined"
                  sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700 }}
                />
              )}
              <Tooltip title={copiedToast ? "Copied!" : "Copy Absolute Path"}>
                <IconButton size="small" onClick={handleCopyPath} sx={{ color: copiedToast ? '#4ade80' : '#9ca3af' }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {enableBookmarks && (
                <Tooltip title={bookmarks.includes(currentPath) ? "Remove Bookmark" : "Bookmark Path"}>
                  <IconButton size="small" onClick={() => handleToggleBookmark(currentPath)} sx={{ color: bookmarks.includes(currentPath) ? '#f59e0b' : '#9ca3af' }}>
                    {bookmarks.includes(currentPath) ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Search, Filter & Action Toolbar */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search folders or files..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#6b7280' }} />
                  </InputAdornment>
                ),
                sx: { backgroundColor: 'rgba(255, 255, 255, 0.03)', color: '#f3f4f6' }
              }}
            />

            <Tooltip title={showHidden ? "Hide Hidden Files" : "Show Hidden Files"}>
              <IconButton size="small" onClick={() => setShowHidden(!showHidden)} sx={{ color: showHidden ? 'var(--accent, #6366f1)' : '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', p: 1 }}>
                {showHidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {enableViewToggle && (
              <Box sx={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                <IconButton size="small" onClick={() => setViewMode('list')} sx={{ color: viewMode === 'list' ? 'var(--accent, #6366f1)' : '#9ca3af', borderRadius: 0 }}>
                  <ViewListIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setViewMode('grid')} sx={{ color: viewMode === 'grid' ? 'var(--accent, #6366f1)' : '#9ca3af', borderRadius: 0 }}>
                  <ViewModuleIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            <Button
              variant="outlined"
              color="secondary"
              startIcon={<CreateNewFolderIcon />}
              onClick={() => setShowNewFolderInput(true)}
              sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
            >
              New Folder
            </Button>
            {parentPath && (
              <Button
                variant="outlined"
                startIcon={<ArrowUpwardIcon />}
                onClick={() => loadDirectory(parentPath)}
                sx={{ whiteSpace: 'nowrap', textTransform: 'none', color: '#9ca3af', borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Up
              </Button>
            )}
          </Box>

          {/* New Folder Creation Input */}
          {showNewFolderInput && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <TextField
                size="small"
                fullWidth
                autoFocus
                placeholder="Enter folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                error={!!folderError}
                helperText={folderError}
              />
              <Button variant="contained" size="small" onClick={handleCreateFolder}>Create</Button>
              <Button variant="text" size="small" onClick={() => setShowNewFolderInput(false)}>Cancel</Button>
            </Box>
          )}

          {/* Fetch Error Retry Banner */}
          {fetchError && (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => loadDirectory(currentPath, false)}>Retry</Button>} sx={{ mb: 2 }}>
              {fetchError}
            </Alert>
          )}

          {/* Directory Content Listing */}
          {browserLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (filteredFolders.length === 0 && filteredFiles.length === 0) ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#9ca3af' }}>
              <FolderOpenIcon sx={{ fontSize: 48, opacity: 0.4, mb: 1 }} />
              <Typography variant="body2">No matching files or folders found.</Typography>
              {filterText && (
                <Button size="small" onClick={() => setFilterText('')} sx={{ mt: 1 }}>Clear Search Filter</Button>
              )}
            </Box>
          ) : viewMode === 'list' ? (
            <Paper variant="outlined" sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', borderColor: 'rgba(255,255,255,0.08)', maxHeight: 340, overflowY: 'auto' }}>
              <List disablePadding>
                {filteredFolders.map(folder => (
                  <ListItem key={folder.path} disablePadding>
                    <ListItemButton onClick={() => loadDirectory(folder.path)}>
                      {multiple && (
                        <Checkbox
                          checked={selectedPaths.has(folder.path)}
                          onChange={() => handleSelectToggle(folder.path)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                        />
                      )}
                      <ListItemIcon><FolderIcon sx={{ color: 'var(--accent, #6366f1)' }} /></ListItemIcon>
                      <ListItemText primary={folder.name} primaryTypographyProps={{ fontWeight: 600 }} />
                    </ListItemButton>
                  </ListItem>
                ))}
                {(mode === 'file' || mode === 'both') && filteredFiles.map(file => (
                  <ListItem key={file.path} disablePadding>
                    <ListItemButton onClick={() => handleSelectToggle(file.path)}>
                      {multiple && (
                        <Checkbox
                          checked={selectedPaths.has(file.path)}
                          onChange={() => handleSelectToggle(file.path)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                        />
                      )}
                      <ListItemIcon><InsertDriveFileIcon sx={{ color: '#9ca3af' }} /></ListItemIcon>
                      <ListItemText primary={file.name} secondary={file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          ) : (
            <Grid container spacing={1.5} sx={{ maxHeight: 340, overflowY: 'auto', pr: 0.5 }}>
              {filteredFolders.map(folder => (
                <Grid item xs={6} sm={4} md={3} key={folder.path}>
                  <Card variant="outlined" sx={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                    <CardActionArea onClick={() => loadDirectory(folder.path)} sx={{ p: 1.5, textAlign: 'center' }}>
                      <FolderIcon sx={{ fontSize: 40, color: 'var(--accent, #6366f1)', mb: 0.5 }} />
                      <Typography variant="caption" display="block" noWrap sx={{ fontWeight: 600, color: '#f3f4f6' }}>
                        {folder.name}
                      </Typography>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 1, borderTop: '1px solid rgba(255,255,255,0.08)', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {multiple && (
              <Chip
                label={`${selectedPaths.size} item(s) selected`}
                color="primary"
                size="small"
                sx={{ fontWeight: 700 }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setOpen(false)} sx={{ color: '#9ca3af' }}>Cancel</Button>
            <Button variant="contained" color="primary" onClick={handleConfirmSelection} sx={{ fontWeight: 700 }}>
              {contextConfig.actionText}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
