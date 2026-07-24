import React from 'react'
import { 
  Box, List, ListItemButton, ListItemIcon, ListItemText, 
  Typography, Tooltip, IconButton, Divider, Chip, Avatar
} from '@mui/material'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, Library, Search, Heart, Radio,
  Download, RefreshCw, Disc, Repeat, ShieldCheck,
  Globe, CreditCard, Film, Database, Copy, Sliders,
  Users, Share2, Key, Save, Terminal, Activity, Settings, HelpCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react'

const MENU_GROUPS = [
  {
    group: 'Media Hub',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'library', label: 'Library', icon: Library },
      { id: 'search', label: 'Universal Search', icon: Search },
      { id: 'favorites', label: 'Favorites', icon: Heart },
      { id: 'livestreams', label: 'Live Streams', icon: Radio },
    ]
  },
  {
    group: 'Operations & Queues',
    items: [
      { id: 'download_queue', label: 'Download Queue', icon: Download },
      { id: 'transcode_queue', label: 'Transcode Queue', icon: RefreshCw },
      { id: 'mass_rip', label: 'Mass Ripper', icon: Disc },
      { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
      { id: 'download_rules', label: 'Download Rules', icon: ShieldCheck },
    ]
  },
  {
    group: 'Metadata & Intelligence',
    items: [
      { id: 'providers', label: 'Media Providers', icon: Globe },
      { id: 'billers', label: 'Payment Billers', icon: CreditCard },
      { id: 'studios', label: 'Studios', icon: Film },
      { id: 'metadata_manager', label: 'Metadata Manager', icon: Database },
      { id: 'duplicates', label: 'Duplicates Engine', icon: Copy },
      { id: 'scraper_tester', label: 'Scraper Tester', icon: Sliders },
    ]
  },
  {
    group: 'System Administration',
    items: [
      { id: 'user_management', label: 'User Management', icon: Users },
      { id: 'p2p_sync', label: 'P2P Sync Nodes', icon: Share2 },
      { id: 'external_apis', label: 'External API Keys', icon: Key },
      { id: 'backup_manager', label: 'Backup Manager', icon: Save },
      { id: 'logs_viewer', label: 'System Logs', icon: Terminal },
      { id: 'system_status', label: 'System Status', icon: Activity },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help & Docs', icon: HelpCircle },
    ]
  }
]

export default function SidebarNav({ currentTab, onSelectTab, isCollapsed, onToggleCollapse, activeDownloadsCount = 0 }) {
  return (
    <Box
      component={motion.div}
      animate={{ width: isCollapsed ? 76 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      sx={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        backdropFilter: 'blur(16px)',
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(18, 19, 26, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        borderRight: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.12)',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Sidebar Header / Brand */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box 
              component="img" 
              src="/app_icon.png" 
              alt="Voyarr Logo" 
              sx={{ 
                height: 32, 
                width: 32, 
                borderRadius: '8px', 
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'rotate(15deg) scale(1.1)'
                }
              }} 
            />
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography
                variant="h6"
                component="div"
                sx={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 900,
                  letterSpacing: '1.5px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.1
                }}
              >
                VOYARR
              </Typography>
            </Box>
          </Box>
        )}
        {isCollapsed && (
          <Box 
            component="img" 
            src="/app_icon.png" 
            alt="Voyarr Logo" 
            sx={{ 
              height: 32, 
              width: 32, 
              borderRadius: '8px', 
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: 'rotate(15deg) scale(1.1)'
              }
            }} 
          />
        )}
        <IconButton onClick={onToggleCollapse} size="small" sx={{ color: 'text.secondary', ml: isCollapsed ? 0 : 1 }}>
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </IconButton>
      </Box>

      <Divider sx={{ opacity: 0.15 }} />

      {/* Navigation List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1, py: 1.5, '&::-webkit-scrollbar': { width: 4 } }}>
        {MENU_GROUPS.map((group) => (
          <Box key={group.group} sx={{ mb: 2 }}>
            {!isCollapsed && (
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
                  fontSize: '0.65rem'
                }}
              >
                {group.group}
              </Typography>
            )}
            <List disablePadding>
              {group.items.map((item) => {
                const Icon = item.icon
                const isSelected = currentTab === item.id

                const buttonContent = (
                  <ListItemButton
                    onClick={() => onSelectTab(item.id)}
                    selected={isSelected}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      px: isCollapsed ? 1.5 : 2,
                      py: 1,
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      ...(isSelected && {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontWeight: 'bold',
                        boxShadow: (theme) => `0 4px 14px ${theme.palette.primary.main}40`,
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        }
                      }),
                      ...(!isSelected && {
                        '&:hover': {
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
                        }
                      })
                    }}
                  >
                    <ListItemIcon 
                      sx={{ 
                        minWidth: 0, 
                        mr: isCollapsed ? 0 : 1.5, 
                        color: isSelected ? 'inherit' : 'text.secondary',
                        justifyContent: 'center'
                      }}
                    >
                      <Icon size={20} />
                    </ListItemIcon>

                    {!isCollapsed && (
                      <ListItemText 
                        primary={item.label} 
                        slotProps={{
                          primary: {
                            fontSize: '0.875rem', 
                            fontWeight: isSelected ? 700 : 500 
                          }
                        }} 
                      />
                    )}

                    {!isCollapsed && item.id === 'download_queue' && activeDownloadsCount > 0 && (
                      <Chip 
                        label={activeDownloadsCount} 
                        size="small" 
                        color="secondary" 
                        sx={{ height: 18, fontSize: '0.7rem', fontWeight: 'bold' }} 
                      />
                    )}
                  </ListItemButton>
                )

                return isCollapsed ? (
                  <Tooltip key={item.id} title={item.label} placement="right" arrow>
                    <Box>{buttonContent}</Box>
                  </Tooltip>
                ) : (
                  <React.Fragment key={item.id}>
                    {buttonContent}
                  </React.Fragment>
                )
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
