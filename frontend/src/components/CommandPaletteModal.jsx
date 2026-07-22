import React, { useState, useEffect } from 'react'
import { 
  Dialog, DialogContent, TextField, Box, Typography, List, ListItemButton, 
  ListItemIcon, ListItemText, Chip, InputAdornment 
} from '@mui/material'
import { 
  Search, ArrowRight, LayoutDashboard, Library, Globe, CreditCard, Film, 
  Download, RefreshCw, Sparkles, Sliders, Users, Settings, Zap
} from 'lucide-react'

const COMMAND_ITEMS = [
  { id: 'dashboard', category: 'Navigation', label: 'Go to Dashboard', icon: LayoutDashboard },
  { id: 'library', category: 'Navigation', label: 'Open Media Library', icon: Library },
  { id: 'search', category: 'Navigation', label: 'Universal Search', icon: Search },
  { id: 'providers', category: 'Navigation', label: 'Manage Media Providers', icon: Globe },
  { id: 'billers', category: 'Navigation', label: 'Manage Payment Billers', icon: CreditCard },
  { id: 'studios', category: 'Navigation', label: 'Manage Studios & Networks', icon: Film },
  { id: 'download_queue', category: 'Navigation', label: 'View Download Queue', icon: Download },
  { id: 'transcode_queue', category: 'Navigation', label: 'View Transcode Queue', icon: RefreshCw },
  { id: 'user_management', category: 'Navigation', label: 'User Management & Permissions', icon: Users },
  { id: 'settings', category: 'Navigation', label: 'Global System Settings', icon: Settings },
  { id: 'action_rescan', category: 'Quick Action', label: 'Rescan Missing Hashes & Thumbnails', icon: Zap },
  { id: 'action_p2p', category: 'Quick Action', label: 'Trigger P2P Node Sync', icon: Sparkles },
  { id: 'action_rip', category: 'Quick Action', label: 'Open Mass Ripper', icon: Sliders },
]

export default function CommandPaletteModal({ open, onClose, onSelectTab, onRunQuickAction }) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
        else setSearch('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const filteredItems = COMMAND_ITEMS.filter(item => 
    item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  )

  const handleItemClick = (item) => {
    onClose()
    if (item.category === 'Navigation') {
      onSelectTab(item.id)
    } else if (onRunQuickAction) {
      onRunQuickAction(item.id)
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth 
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#14161f' : '#ffffff',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }
      }}
    >
      <Box sx={{ p: 2, pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <TextField
          autoFocus
          fullWidth
          variant="standard"
          placeholder="Type a command or search tabs... (Cmd + K)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <InputAdornment position="start">
                <Search size={20} style={{ opacity: 0.6 }} />
              </InputAdornment>
            ),
            endAdornment: (
              <Chip label="ESC" size="small" sx={{ fontSize: '0.65rem', fontWeight: 'bold', height: 20 }} />
            ),
            sx: { fontSize: '1.1rem', py: 0.5 }
          }}
        />
      </Box>

      <DialogContent sx={{ p: 1, maxHeight: 360, overflowY: 'auto' }}>
        {filteredItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            No matching commands found.
          </Typography>
        ) : (
          <List disablePadding>
            {filteredItems.map((item) => {
              const Icon = item.icon
              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    px: 2,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    '&:hover': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': { color: 'inherit' }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ListItemIcon sx={{ minWidth: 0, color: 'text.secondary' }}>
                      <Icon size={18} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label} 
                      primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} 
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={item.category} 
                      size="small" 
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.65rem', opacity: 0.7 }} 
                    />
                    <ArrowRight size={16} style={{ opacity: 0.5 }} />
                  </Box>
                </ListItemButton>
              )
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
