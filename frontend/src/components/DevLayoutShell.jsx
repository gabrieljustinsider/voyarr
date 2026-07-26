import React, { useState } from 'react'
import { 
  Box, AppBar, Toolbar, Typography, TextField, InputAdornment, 
  IconButton, Button, Chip, Badge, Avatar, Menu, MenuItem, Tooltip 
} from '@mui/material'
import { 
  Search, Bell, Sun, Moon, LogOut, SlidersHorizontal, Sparkles, LayoutGrid, Zap
} from 'lucide-react'
import SidebarNav from './SidebarNav'
import CommandPaletteModal from './CommandPaletteModal'
import FloatingMiniPlayer from './FloatingMiniPlayer'

export default function DevLayoutShell({ 
  children, 
  currentTab, 
  onSelectTab, 
  layoutMode, 
  onToggleLayoutMode,
  onLogout,
  onOpenSettings,
  activeDownloadsCount = 0,
  currentTheme,
  onChangeTheme,
  user,
  uiConfig
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [activeMedia, setActiveMedia] = useState(null)
  const [userMenuAnchor, setUserMenuAnchor] = useState(null)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 1. Glassmorphic Collapsible Left Sidebar */}
      <SidebarNav
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeDownloadsCount={activeDownloadsCount}
        uiConfig={uiConfig}
      />

      {/* 2. Main Viewport & Top Header */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <Box
          sx={{
            height: 64,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(12px)',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(18, 19, 26, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            borderBottom: '1px solid',
            borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 1100
          }}
        >
          {/* Quick Search Bar (Triggers Cmd+K Palette) */}
          <Box 
            onClick={() => setIsCommandPaletteOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 0.8,
              borderRadius: 3,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              width: { xs: 180, sm: 300 },
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.25)'
              }
            }}
          >
            <Search size={16} style={{ opacity: 0.6 }} />
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.85rem' }}>
              Search tabs & actions...
            </Typography>
            <Chip 
              label="Cmd + K" 
              size="small" 
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold', bgcolor: 'action.selected' }} 
            />
          </Box>

          {/* Right Action Icons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Active Downloads Indicator */}
            {activeDownloadsCount > 0 && (
              <Tooltip title={`${activeDownloadsCount} active downloads running`}>
                <IconButton color="primary" onClick={() => onSelectTab('download_queue')}>
                  <Badge badgeContent={activeDownloadsCount} color="secondary">
                    <Zap size={20} />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}

            {/* Notifications */}
            <IconButton onClick={() => onSelectTab('notification_settings')}>
              <Bell size={20} />
            </IconButton>

            {/* User Profile Avatar Menu */}
            <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar 
                src={user?.avatar_url} 
                alt={user?.username || 'User'}
                sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontWeight: 'bold', fontSize: '0.9rem' }}
              >
                {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={() => setUserMenuAnchor(null)}
              PaperProps={{ sx: { borderRadius: 2, minWidth: 180, mt: 1 } }}
            >
              <MenuItem onClick={() => { setUserMenuAnchor(null); onSelectTab('account_security'); }}>
                Account Security
              </MenuItem>
              <MenuItem onClick={() => { setUserMenuAnchor(null); onOpenSettings(); }}>
                Preferences & Theme
              </MenuItem>
              <MenuItem onClick={() => { setUserMenuAnchor(null); onLogout(); }} sx={{ color: 'error.main' }}>
                <LogOut size={16} style={{ marginRight: 8 }} />
                Log Out
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Dynamic Page Content Viewport */}
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
          {children}
        </Box>
      </Box>

      {/* 3. Global Command Palette Modal */}
      <CommandPaletteModal
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={onSelectTab}
        onRunQuickAction={(actionId) => {
          if (actionId === 'action_rescan') onSelectTab('library');
          else if (actionId === 'action_p2p') onSelectTab('p2p_sync');
          else if (actionId === 'action_rip') onSelectTab('mass_rip');
        }}
      />

      {/* 4. Floating Mini-Player */}
      <FloatingMiniPlayer
        mediaUrl={activeMedia?.url}
        mediaTitle={activeMedia?.title}
        onClose={() => setActiveMedia(null)}
      />
    </Box>
  )
}
