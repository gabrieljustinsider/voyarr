import React, { useState } from 'react'
import { 
  Box, Typography, IconButton, Button, Chip, Badge, Avatar, 
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, 
  Divider, Tooltip
} from '@mui/material'
import { 
  Search, Bell, LogOut, SlidersHorizontal, Zap,
  LayoutDashboard, Library, Heart, Download, RefreshCw, 
  Disc, Repeat, ShieldCheck, Globe, CreditCard, Film, 
  Database, Users, Share2, Save, Terminal, Activity, 
  Settings as SettingsIcon, HelpCircle, Shield, User, 
  Tag, TestTube, X, Menu as MenuIcon, Radio
} from 'lucide-react'
import CommandPaletteModal from './CommandPaletteModal'
import FloatingMiniPlayer from './FloatingMiniPlayer'

// Primary bottom navigation pill items (Core RomM style hubs)
const BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'download_queue', label: 'Downloads', icon: Download },
  { id: 'mass_rip', label: 'Rip', icon: Disc },
]

// Administration Drawer grouped items (matching RomM's slide-out Admin Drawer)
const ADMIN_DRAWER_GROUPS = [
  {
    group: 'Operations & Queues',
    items: [
      { id: 'download_queue', label: 'Download Queue', icon: Download },
      { id: 'transcode_queue', label: 'Transcode Queue', icon: RefreshCw },
      { id: 'mass_rip', label: 'Mass Ripper', icon: Disc },
      { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
      { id: 'schedules', label: 'Schedules', icon: ShieldCheck },
      { id: 'livestreams', label: 'Stream Recorder', icon: Radio },
    ]
  },
  {
    group: 'Metadata & Content',
    items: [
      { id: 'providers', label: 'Media Providers', icon: Globe },
      { id: 'scraper_tester', label: 'Scraper Tester', icon: TestTube },
      { id: 'billers', label: 'Billers', icon: CreditCard },
      { id: 'performers', label: 'Performers', icon: User },
      { id: 'tags', label: 'Tags', icon: Tag },
      { id: 'studios', label: 'Studios & Networks', icon: Film },
      { id: 'metadata_manager', label: 'Metadata Manager', icon: Database },
    ]
  },
  {
    group: 'System Administration',
    items: [
      { id: 'user_management', label: 'User Management', icon: Users },
      { id: 'account_security', label: 'Account Security', icon: Shield },
      { id: 'p2p_sync', label: 'P2P Sync Nodes', icon: Share2 },
      { id: 'backup_manager', label: 'Backup Manager', icon: Save },
      { id: 'logs_viewer', label: 'System Logs', icon: Terminal },
      { id: 'system_status', label: 'System Status', icon: Activity },
      { id: 'settings', label: 'System Settings', icon: SettingsIcon },
      { id: 'help', label: 'Help & Docs', icon: HelpCircle },
    ]
  }
]

export default function RomMLayoutShell({
  children,
  currentTab,
  onSelectTab,
  onLogout,
  onOpenSettings,
  activeDownloadsCount = 0,
  user,
  uiConfig
}) {
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [activeMedia, setActiveMedia] = useState(null)

  const handleTabClick = (tabId) => {
    onSelectTab(tabId)
  }

  const handleDrawerTabClick = (tabId) => {
    onSelectTab(tabId)
    setIsAdminDrawerOpen(false)
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh', 
        bgcolor: 'background.default',
        color: 'text.primary',
        pb: 11 // Padding for the floating bottom navigation bar
      }}
    >
      {/* ============================================================ */}
      {/* 1. TOP APP BAR (v-app-bar style)                             */}
      {/* ============================================================ */}
      <Box
        component="header"
        sx={{
          height: 64,
          px: { xs: 2, sm: 3, md: 4 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: 'rgba(24, 27, 32, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Brand & Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box 
            component="img" 
            src="/app_icon.png" 
            alt="Voyarr Logo" 
            onClick={() => handleTabClick('dashboard')}
            sx={{ 
              height: 36, 
              width: 36, 
              borderRadius: '8px', 
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }} 
          />
          <Box 
            onClick={() => handleTabClick('dashboard')} 
            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 900,
                letterSpacing: '1px',
                background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2
              }}
            >
              VOYARR
            </Typography>
            <Chip 
              label="ROMM" 
              size="small" 
              sx={{ 
                height: 18, 
                fontSize: '0.65rem', 
                fontWeight: 800, 
                bgcolor: 'rgba(129, 140, 248, 0.15)', 
                color: '#818cf8',
                border: '1px solid rgba(129, 140, 248, 0.3)',
                borderRadius: '4px'
              }} 
            />
          </Box>
        </Box>

        {/* Global Search Bar Trigger (Cmd + K) */}
        <Box 
          onClick={() => setIsCommandPaletteOpen(true)}
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 0.8,
            borderRadius: 2,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            width: { sm: 260, md: 360 },
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              boxShadow: '0 0 12px rgba(129, 140, 248, 0.2)'
            }
          }}
        >
          <Search size={16} style={{ opacity: 0.6 }} />
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.85rem' }}>
            Quick Search &amp; Jump...
          </Typography>
          <Chip 
            label="Cmd + K" 
            size="small" 
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold', bgcolor: 'rgba(255,255,255,0.08)' }} 
          />
        </Box>

        {/* Action Controls & Profile Trigger */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Mobile search icon */}
          <IconButton 
            onClick={() => setIsCommandPaletteOpen(true)} 
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
          >
            <Search size={20} />
          </IconButton>

          {/* Active Downloads Indicator */}
          {activeDownloadsCount > 0 && (
            <Tooltip title={`${activeDownloadsCount} active downloads running`}>
              <IconButton color="primary" onClick={() => handleTabClick('download_queue')}>
                <Badge badgeContent={activeDownloadsCount} color="secondary">
                  <Zap size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton onClick={() => handleTabClick('notification_settings')}>
              <Bell size={20} />
            </IconButton>
          </Tooltip>

          {/* RomM Administration Drawer Trigger */}
          <Tooltip title="Administration &amp; System Menu">
            <Button
              onClick={() => setIsAdminDrawerOpen(true)}
              variant="outlined"
              size="small"
              startIcon={
                <Avatar 
                  src={user?.avatar_url} 
                  alt={user?.username || 'User'}
                  sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '0.75rem', fontWeight: 'bold' }}
                >
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </Avatar>
              }
              endIcon={<MenuIcon size={16} />}
              sx={{
                ml: 0.5,
                borderRadius: 2,
                textTransform: 'none',
                px: 1.5,
                py: 0.6,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                color: 'text.primary',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'primary.main'
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'inline' } }}>
                {user?.username || 'Admin'}
              </Typography>
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT VIEWPORT                                     */}
      {/* ============================================================ */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, sm: 3, md: 4 },
          maxWidth: 1920,
          mx: 'auto',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {children}
      </Box>

      {/* ============================================================ */}
      {/* 3. FLOATING BOTTOM NAVIGATION PILL (v-bottom-navigation)    */}
      {/* ============================================================ */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.8,
          borderRadius: 8,
          bgcolor: 'rgba(24, 27, 32, 0.92)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          maxWidth: 'calc(100vw - 32px)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isSelected = currentTab === item.id

          return (
            <Button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              variant={isSelected ? 'contained' : 'text'}
              color={isSelected ? 'primary' : 'inherit'}
              size="small"
              startIcon={<Icon size={18} />}
              sx={{
                borderRadius: 6,
                px: { xs: 1.5, sm: 2 },
                py: 0.8,
                textTransform: 'none',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '0.85rem',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                ...(isSelected ? {
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  color: '#ffffff'
                } : {
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: 'text.primary'
                  }
                })
              }}
            >
              {item.label}
              {item.id === 'download_queue' && activeDownloadsCount > 0 && (
                <Chip 
                  label={activeDownloadsCount} 
                  size="small" 
                  color="secondary" 
                  sx={{ height: 16, fontSize: '0.65rem', fontWeight: 800, ml: 0.75 }} 
                />
              )}
            </Button>
          )
        })}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Quick Menu Button for opening full drawer */}
        <Tooltip title="Open Full Menu">
          <IconButton 
            size="small" 
            onClick={() => setIsAdminDrawerOpen(true)}
            sx={{ 
              color: 'text.secondary', 
              '&:hover': { color: 'primary.main', bgcolor: 'rgba(255, 255, 255, 0.08)' } 
            }}
          >
            <SlidersHorizontal size={18} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ============================================================ */}
      {/* 4. ROMM ADMINISTRATION DRAWER (v-navigation-drawer style)    */}
      {/* ============================================================ */}
      <Drawer
        anchor="right"
        open={isAdminDrawerOpen}
        onClose={() => setIsAdminDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '85vw', sm: 360 },
              maxWidth: 380,
              bgcolor: '#1a1d24',
              backgroundImage: 'none',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              p: 0,
              display: 'flex',
              flexDirection: 'column'
            }
          }
        }}
      >
        {/* Drawer Header with User Profile Details */}
        <Box 
          sx={{ 
            p: 3, 
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar 
              src={user?.avatar_url} 
              alt={user?.username || 'User'}
              sx={{ width: 44, height: 44, bgcolor: 'primary.main', fontWeight: 'bold' }}
            >
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {user?.username || 'Admin User'}
              </Typography>
              <Chip 
                label="Administrator" 
                size="small" 
                sx={{ 
                  height: 18, 
                  fontSize: '0.65rem', 
                  bgcolor: 'rgba(99, 102, 241, 0.15)', 
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  mt: 0.5
                }} 
              />
            </Box>
          </Box>
          <IconButton onClick={() => setIsAdminDrawerOpen(false)} size="small">
            <X size={20} />
          </IconButton>
        </Box>

        {/* Quick Drawer Action Bar */}
        <Box sx={{ p: 2, display: 'flex', gap: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<SlidersHorizontal size={16} />}
            onClick={() => {
              setIsAdminDrawerOpen(false)
              onOpenSettings()
            }}
            sx={{ textTransform: 'none', borderRadius: 2, fontSize: '0.8rem' }}
          >
            Preferences
          </Button>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            color="error"
            startIcon={<LogOut size={16} />}
            onClick={() => {
              setIsAdminDrawerOpen(false)
              onLogout()
            }}
            sx={{ textTransform: 'none', borderRadius: 2, fontSize: '0.8rem' }}
          >
            Log Out
          </Button>
        </Box>

        {/* Grouped Admin Navigation Links */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, '&::-webkit-scrollbar': { width: 4 } }}>
          {ADMIN_DRAWER_GROUPS.map((group) => (
            <Box key={group.group} sx={{ mb: 2.5 }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  px: 1.5, 
                  py: 0.5, 
                  display: 'block', 
                  fontWeight: 700, 
                  letterSpacing: 1, 
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  fontSize: '0.68rem'
                }}
              >
                {group.group}
              </Typography>
              <List disablePadding>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isSelected = currentTab === item.id

                  return (
                    <ListItemButton
                      key={item.id}
                      onClick={() => handleDrawerTabClick(item.id)}
                      selected={isSelected}
                      sx={{
                        borderRadius: 2,
                        mb: 0.5,
                        px: 1.5,
                        py: 0.9,
                        transition: 'all 0.2s ease',
                        ...(isSelected && {
                          bgcolor: 'primary.main',
                          color: '#ffffff',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                          '&:hover': {
                            bgcolor: 'primary.dark'
                          }
                        }),
                        ...(!isSelected && {
                          color: 'text.secondary',
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                            color: 'text.primary'
                          }
                        })
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 0, mr: 1.5, color: isSelected ? '#ffffff' : 'inherit' }}>
                        <Icon size={18} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={item.label} 
                        slotProps={{
                          primary: {
                            fontSize: '0.85rem',
                            fontWeight: isSelected ? 700 : 500
                          }
                        }}
                      />
                      {item.id === 'download_queue' && activeDownloadsCount > 0 && (
                        <Chip 
                          label={activeDownloadsCount} 
                          size="small" 
                          color="secondary" 
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} 
                        />
                      )}
                    </ListItemButton>
                  )
                })}
              </List>
            </Box>
          ))}
        </Box>
      </Drawer>

      {/* Global Command Palette */}
      <CommandPaletteModal
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tabId) => {
          onSelectTab(tabId)
        }}
        onRunQuickAction={(actionId) => {
          if (actionId === 'action_rescan') onSelectTab('library');
          else if (actionId === 'action_p2p') onSelectTab('p2p_sync');
          else if (actionId === 'action_rip') onSelectTab('mass_rip');
        }}
      />

      {/* Floating Mini-Player */}
      <FloatingMiniPlayer
        mediaUrl={activeMedia?.url}
        mediaTitle={activeMedia?.title}
        onClose={() => setActiveMedia(null)}
      />
    </Box>
  )
}
