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
  Tooltip
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import HomeIcon from '@mui/icons-material/Home'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { apiFetch } from '../api'

export default function PathPicker({
  value = '',
  onChange,
  label = 'Select Path',
  helperText = '',
  fullWidth = true,
  mode = 'folder', // 'folder', 'file', or 'both'
}) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  // File browser state
  const [currentPath, setCurrentPath] = useState('/')
  const [parentPath, setParentPath] = useState(null)
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [filterText, setFilterText] = useState('')
  const [browserLoading, setBrowserLoading] = useState(false)

  const debounceRef = useRef(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Cleanup the debounce timer on component unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Autocomplete fetch suggestions
  const handleInputChange = (event, newInputValue) => {
    setInputValue(newInputValue)
    onChange(newInputValue)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!newInputValue) {
      setOptions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await apiFetch(`/settings/autocomplete?q=${encodeURIComponent(newInputValue)}`)
        if (response.ok) {
          const data = await response.json()
          setOptions(data.suggestions || [])
        }
      } catch (error) {
        console.error('Autocomplete fetch failed:', error)
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  const handleOptionSelect = (event, selectedOption) => {
    if (selectedOption) {
      const pathValue = typeof selectedOption === 'string' ? selectedOption : selectedOption.path
      setInputValue(pathValue)
      onChange(pathValue)
    }
  }

  // Load items in target folder
  const loadDirectory = async (path) => {
    setBrowserLoading(true)
    try {
      const response = await apiFetch(`/settings/browse?path=${encodeURIComponent(path)}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentPath(data.current_path)
        setParentPath(data.parent_path)
        setFolders(data.folders || [])
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to load directory:', error)
    } finally {
      setBrowserLoading(false)
    }
  }

  const handleOpenBrowser = () => {
    setOpen(true)
    setFilterText('')
    // Initialize file browser with current input value or default to root
    const initialPath = value && value.startsWith('/') ? value : '/'
    loadDirectory(initialPath)
  }

  const handleCloseBrowser = () => {
    setOpen(false)
  }

  const handleFolderClick = (folderPath) => {
    loadDirectory(folderPath)
  }

  const handleFileClick = (filePath) => {
    if (mode !== 'folder') {
      setInputValue(filePath)
      onChange(filePath)
      setOpen(false)
    }
  }

  const handleSelectCurrentFolder = () => {
    setInputValue(currentPath)
    onChange(currentPath)
    setOpen(false)
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

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(filterText.toLowerCase()))
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(filterText.toLowerCase()))

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', width: fullWidth ? '100%' : 'auto' }}>
      <Autocomplete
        freeSolo
        fullWidth={fullWidth}
        value={inputValue}
        onChange={handleOptionSelect}
        onInputChange={handleInputChange}
        options={options}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.path}
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <li key={key || option.path} {...rest}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {option.is_dir ? (
                  <FolderIcon sx={{ color: 'var(--accent)' }} fontSize="small" />
                ) : (
                  <InsertDriveFileIcon sx={{ color: 'text.secondary' }} fontSize="small" />
                )}
                <Typography variant="body2">{option.path}</Typography>
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            helperText={helperText}
            size="small"
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <React.Fragment>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps?.endAdornment}
                    <Tooltip title="Browse Filesystem">
                      <IconButton
                        onClick={handleOpenBrowser}
                        size="small"
                        sx={{
                          color: 'var(--accent)',
                          '&:hover': {
                            color: '#fff',
                          },
                        }}
                      >
                        <FolderOpenIcon />
                      </IconButton>
                    </Tooltip>
                  </React.Fragment>
                ),
              }
            }}
          />
        )}
      />

      {/* Premium Glassmorphic Directory Explorer Modal */}
      <Dialog
        open={open}
        onClose={handleCloseBrowser}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(22, 23, 29, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            borderRadius: '16px',
            color: '#f3f4f6',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderOpenIcon sx={{ color: 'var(--accent)' }} />
            <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
              File Explorer
            </Typography>
          </Box>
          <IconButton onClick={handleCloseBrowser} sx={{ color: '#9ca3af' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2 }}>
          {/* Path Breadcrumbs */}
          <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <IconButton size="small" onClick={() => loadDirectory('/')} sx={{ color: currentPath === '/' ? 'var(--accent)' : '#9ca3af' }}>
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
                    color: idx === arr.length - 1 ? 'var(--accent)' : '#9ca3af',
                    fontWeight: idx === arr.length - 1 ? 'bold' : 'normal',
                    fontSize: '0.875rem',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    '&:hover': {
                      color: 'var(--accent)',
                    }
                  }}
                >
                  {seg.name}
                </Link>
              ))}
            </Breadcrumbs>
          </Box>

          {/* Filtering & Navigation Action */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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
                sx: {
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  color: '#f3f4f6',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--accent)',
                  }
                }
              }}
            />
            {parentPath && (
              <Button
                variant="outlined"
                startIcon={<ArrowUpwardIcon />}
                onClick={() => loadDirectory(parentPath)}
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#9ca3af',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                    backgroundColor: 'rgba(192, 132, 252, 0.05)',
                  }
                }}
              >
                Up
              </Button>
            )}
          </Box>

          {/* File/Folder List */}
          <Box sx={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
            {browserLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
                <CircularProgress color="inherit" />
              </Box>
            ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: '#6b7280' }}>
                Empty directory or no matches found
              </Box>
            ) : (
              <List disablePadding>
                {/* Directories */}
                {filteredFolders.map((folder) => (
                  <ListItem key={folder.path} disablePadding divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}>
                    <ListItemButton onClick={() => handleFolderClick(folder.path)}>
                      <ListItemIcon sx={{ minWidth: '40px' }}>
                        <FolderIcon sx={{ color: 'var(--accent)' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={folder.name}
                        primaryTypographyProps={{ sx: { color: '#f3f4f6', fontSize: '0.9rem' } }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}

                {/* Files (render only if file or both mode enabled) */}
                {mode !== 'folder' && filteredFiles.map((file) => (
                  <ListItem key={file.path} disablePadding divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}>
                    <ListItemButton onClick={() => handleFileClick(file.path)}>
                      <ListItemIcon sx={{ minWidth: '40px' }}>
                        <InsertDriveFileIcon sx={{ color: '#9ca3af' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                        primaryTypographyProps={{ sx: { color: '#f3f4f6', fontSize: '0.9rem' } }}
                        secondaryTypographyProps={{ sx: { color: '#6b7280', fontSize: '0.75rem' } }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Typography variant="caption" sx={{ color: '#6b7280', flexGrow: 1, pl: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Current: {currentPath}
          </Typography>
          <Button onClick={handleCloseBrowser} sx={{ color: '#9ca3af', textTransform: 'none' }}>
            Cancel
          </Button>
          {mode !== 'file' && (
            <Button
              variant="contained"
              onClick={handleSelectCurrentFolder}
              sx={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: 'var(--accent)',
                  opacity: 0.9,
                }
              }}
            >
              Select Folder
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
