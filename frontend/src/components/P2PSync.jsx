import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, TextField, Button, Paper, Grid, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Card, CardContent,
  CardActions, Chip, CircularProgress, Collapse, Checkbox, ListItemText, OutlinedInput, Alert
} from '@mui/material'
import { Trash2, RefreshCw, Plus, Edit2, Wifi, History, CheckCircle, TriangleAlert, Hourglass, ChevronDown, ChevronUp } from 'lucide-react'
import { apiFetch } from '../api'
import { describeCron, formatScheduleDisplay } from '../utils/cron'

export default function P2PSync() {
  const [nodes, setNodes] = useState([])
  const [providers, setProviders] = useState([])
  const [proposedRecipes, setProposedRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncingNodes, setSyncingNodes] = useState({}) // node_id -> boolean
  const [testingNodes, setTestingNodes] = useState({}) // node_id -> boolean
  const [expandedLogs, setExpandedLogs] = useState({}) // node_id -> boolean
  const [nodeLogs, setNodeLogs] = useState({}) // node_id -> array of logs
  
  // Dialog Form states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editNodeId, setEditNodeId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formOutboundKey, setFormOutboundKey] = useState('')
  const [formInboundToken, setFormInboundToken] = useState('')
  const [formRecipeMode, setFormRecipeMode] = useState('auto_merge')
  const [formSchedule, setFormSchedule] = useState('manual')
  const [formScope, setFormScope] = useState('all_entries')
  const [formAllowedProviders, setFormAllowedProviders] = useState([])

  const showToast = (message, severity = 'info') => {
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message, severity }
    }))
  }

  const fetchNodes = useCallback(async () => {
    try {
      const res = await apiFetch('/p2p/nodes')
      if (res.ok) {
        setNodes(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch P2P nodes:', err)
    }
  }, [])

  const fetchProviders = useCallback(async () => {
    try {
      const res = await apiFetch('/providers')
      if (res.ok) {
        setProviders(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch providers:', err)
    }
  }, [])

  const fetchProposedRecipes = useCallback(async () => {
    try {
      const res = await apiFetch('/p2p/proposed-recipes')
      if (res.ok) {
        setProposedRecipes(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch proposed recipes:', err)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchNodes(), fetchProviders(), fetchProposedRecipes()])
      .finally(() => setLoading(false))
  }, [fetchNodes, fetchProviders, fetchProposedRecipes])

  // Periodic status poll to capture syncing -> active / error updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNodes()
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchNodes])

  const handleOpenCreate = () => {
    setEditNodeId(null)
    setFormName('')
    setFormUrl('')
    
    // Auto-generate safe tokens for convenience
    const randToken1 = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const randToken2 = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    
    setFormOutboundKey(randToken1)
    setFormInboundToken(randToken2)
    setFormRecipeMode('auto_merge')
    setFormSchedule('manual')
    setFormScope('all_entries')
    setFormAllowedProviders([])
    setDialogOpen(true)
  }

  const handleOpenEdit = (node) => {
    setEditNodeId(node.id)
    setFormName(node.name)
    setFormUrl(node.peer_url)
    setFormOutboundKey(node.outbound_key)
    setFormInboundToken(node.inbound_token)
    setFormRecipeMode(node.recipe_sync_mode)
    setFormSchedule(node.sync_schedule)
    setFormScope(node.library_scope)
    setFormAllowedProviders(node.allowed_providers || [])
    setDialogOpen(true)
  }

  const handleSaveNode = async () => {
    if (!formName.trim() || !formUrl.trim() || !formOutboundKey.trim() || !formInboundToken.trim()) {
      showToast('Please fill out all required fields.', 'warning')
      return
    }

    const payload = {
      name: formName.trim(),
      peer_url: formUrl.trim(),
      outbound_key: formOutboundKey.trim(),
      inbound_token: formInboundToken.trim(),
      recipe_sync_mode: formRecipeMode,
      sync_schedule: formSchedule,
      library_scope: formScope,
      allowed_providers: formAllowedProviders
    }

    try {
      let res
      if (editNodeId) {
        res = await apiFetch(`/p2p/nodes/${editNodeId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        res = await apiFetch('/p2p/nodes', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }

      if (res.ok) {
        showToast(editNodeId ? 'Peer updated successfully!' : 'Peer registered successfully!', 'success')
        setDialogOpen(false)
        fetchNodes()
      } else {
        const err = await res.json()
        showToast(`Failed to save: ${err.detail || 'Unknown error'}`, 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Network error saving peer.', 'error')
    }
  }

  const handleDeleteNode = async (id, name) => {
    const confirm = await window.appConfirm(`Are you sure you want to remove peer "${name}"?`)
    if (!confirm) return

    try {
      const res = await apiFetch(`/p2p/nodes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast(`Peer "${name}" removed.`, 'success')
        fetchNodes()
      } else {
        showToast('Failed to delete peer.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Network error deleting peer.', 'error')
    }
  }

  const handleTestConnection = async (id) => {
    setTestingNodes(prev => ({ ...prev, [id]: true }))
    try {
      const res = await apiFetch(`/p2p/nodes/${id}/test-connection`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.connected) {
          showToast(`Connection successful! Connected to ${data.peer_details?.peer_name || 'peer'}`, 'success')
        } else {
          showToast(`Connection failed: ${data.message}`, 'error')
        }
        fetchNodes()
      } else {
        showToast('Failed to execute connection test.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Connection test encountered a network error.', 'error')
    } finally {
      setTestingNodes(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleTriggerSync = async (id, name) => {
    setSyncingNodes(prev => ({ ...prev, [id]: true }))
    try {
      const res = await apiFetch(`/p2p/nodes/${id}/sync`, { method: 'POST' })
      if (res.ok) {
        showToast(`Sync enqueued for "${name}".`, 'info')
        fetchNodes()
      } else {
        showToast('Failed to trigger sync.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Sync trigger network error.', 'error')
    } finally {
      setSyncingNodes(prev => ({ ...prev, [id]: false }))
    }
  }

  const toggleLogs = async (id) => {
    const isExpanded = !expandedLogs[id]
    setExpandedLogs(prev => ({ ...prev, [id]: isExpanded }))
    
    if (isExpanded) {
      try {
        const res = await apiFetch(`/p2p/nodes/${id}/logs`)
        if (res.ok) {
          const data = await res.json()
          setNodeLogs(prev => ({ ...prev, [id]: data }))
        }
      } catch (err) {
        console.error('Failed to load logs:', err)
      }
    }
  }

  const handleResolveProposed = async (peerId, providerName, action) => {
    try {
      const res = await apiFetch('/p2p/proposed-recipes/resolve', {
        method: 'POST',
        body: JSON.stringify({
          peer_id: peerId,
          provider_name: providerName,
          action
        })
      })
      if (res.ok) {
        showToast(`Proposed recipe for "${providerName}" has been ${action}d.`, 'success')
        fetchProposedRecipes()
      } else {
        showToast('Failed to resolve proposed recipe.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Network error resolving proposed recipe.', 'error')
    }
  }

  const getStatusChipColor = (status) => {
    switch (status) {
      case 'active': return 'success'
      case 'syncing': return 'info'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  return (
    <Box sx={{ pb: 5, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Dynamic visual page header with subtle glassmorphic backdrop */}
      <Box sx={{
        background: 'linear-gradient(135deg, rgba(0,240,255,0.05) 0%, rgba(255,0,127,0.05) 100%)',
        p: 4,
        borderRadius: '24px',
        mb: 4,
        border: '1px solid rgba(255,255,255,0.04)',
        backdropFilter: 'blur(10px)'
      }}>
        <Grid container sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Grid>
            <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-1px' }} gutterBottom>
              P2P Synchronization Console
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Securely share scraper recipes and reconcile media catalog lists with trusted Voyarr nodes.
            </Typography>
          </Grid>
          <Grid>
            <Button
              variant="contained"
              startIcon={<Plus size={20} />}
              onClick={handleOpenCreate}
              sx={{
                background: 'linear-gradient(45deg, #00f0ff 0%, #ff007f 100%)',
                color: '#fff',
                '&:hover': {
                  background: 'linear-gradient(45deg, #00d0df 0%, #df006f 100%)'
                }
              }}
            >
              Add Trusted Peer
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<Wifi size={20} />} 
        sx={{ 
          mb: 3, 
          borderRadius: '12px', 
          bgcolor: 'rgba(0, 240, 255, 0.08)', 
          color: '#38bdf8',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          '& .MuiAlert-icon': { color: '#00f0ff' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          🔄 Peer-to-Peer Catalog Sync &amp; Instance Replication
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          P2P Sync allows multiple isolated Voyarr nodes to securely exchange scraper recipes, reconcile library metadata, and mirror provider configurations over encrypted peer-to-peer tokens.
        </Typography>
      </Alert>

      {/* Nodes list dashboard */}
      <Typography variant="h5" fontWeight="700" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}><Wifi size={24} /></Box> Peer Connections
      </Typography>

      {loading && nodes.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : nodes.length === 0 ? (
        <Paper sx={{
          p: 5,
          textAlign: 'center',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.1)',
          mb: 4
        }}>
          <Box sx={{ color: 'text.secondary', display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Hourglass size={50} />
          </Box>
          <Typography variant="h6" color="text.secondary">No trusted peers registered yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Register Voyarr installations on other devices to begin sharing metadata.
          </Typography>
          <Button variant="outlined" startIcon={<Plus size={20} />} onClick={handleOpenCreate}>
            Register Your First Peer
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ mb: 5 }}>
          {nodes.map(node => (
            <Grid xs={12} key={node.id}>
              <Card sx={{
                background: 'rgba(30, 30, 30, 0.4)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px',
                position: 'relative',
                overflow: 'visible',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: node.status === 'active' ? 'rgba(0, 240, 255, 0.3)' : node.status === 'error' ? 'rgba(255, 0, 127, 0.3)' : 'rgba(255,255,255,0.15)',
                  boxShadow: node.status === 'active' ? '0 0 20px rgba(0, 240, 255, 0.1)' : '0 4px 20px rgba(0,0,0,0.2)'
                }
              }}>
                <CardContent>
                  <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                    <Grid xs={12} sm={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="h6" fontWeight="700">{node.name}</Typography>
                        <Chip
                          size="small"
                          label={node.status.toUpperCase()}
                          color={getStatusChipColor(node.status)}
                          icon={node.status === 'syncing' ? <CircularProgress size={12} /> : undefined}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                        {node.peer_url}
                      </Typography>
                    </Grid>

                    <Grid xs={12} sm={5}>
                      <Grid container spacing={1}>
                        <Grid xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">Recipe Sync Mode</Typography>
                          <Typography variant="body2" fontWeight="500">
                            {node.recipe_sync_mode === 'auto_merge' ? 'Auto-Merge Selectors' : 'Hold for Review'}
                          </Typography>
                        </Grid>
                        <Grid xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">Sync Scope</Typography>
                          <Typography variant="body2" fontWeight="500">
                            {node.library_scope === 'all_entries' ? 'All Catalog Data' : `Restricted (${node.allowed_providers?.length || 0} providers)`}
                          </Typography>
                        </Grid>
                        <Grid xs={6} sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary" display="block">Sync Schedule</Typography>
                          <Typography variant="body2" fontWeight="500">
                            {formatScheduleDisplay(node.sync_schedule, localStorage.getItem('fleet_schedule_display_mode') || 'hybrid')}
                          </Typography>
                        </Grid>
                        <Grid xs={6} sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary" display="block">Last Synced</Typography>
                          <Typography variant="body2" fontWeight="500">
                            {node.last_sync_at ? new Date(node.last_sync_at).toLocaleString() : 'Never'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Grid>

                    <Grid xs={12} sm={3} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
                      <IconButton color="primary" onClick={() => handleTestConnection(node.id)} disabled={testingNodes[node.id]} title="Verify connection">
                        {testingNodes[node.id] ? <CircularProgress size={20} /> : <Wifi size={20} />}
                      </IconButton>
                      <IconButton color="info" onClick={() => handleTriggerSync(node.id, node.name)} disabled={syncingNodes[node.id] || node.status === 'syncing'} title="Trigger synchronization now">
                        {syncingNodes[node.id] ? <CircularProgress size={20} /> : <RefreshCw size={20} />}
                      </IconButton>
                      <IconButton color="warning" onClick={() => handleOpenEdit(node)} title="Edit configuration">
                        <Edit2 size={20} />
                      </IconButton>
                      <IconButton color="error" onClick={() => handleDeleteNode(node.id, node.name)} title="Remove trusted peer">
                        <Trash2 size={20} />
                      </IconButton>
                    </Grid>
                  </Grid>
                </CardContent>

                <Divider />

                <CardActions sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    startIcon={<History size={18} />}
                    endIcon={expandedLogs[node.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    onClick={() => toggleLogs(node.id)}
                  >
                    Sync Log History
                  </Button>
                  
                  {node.next_run && (
                    <Typography variant="caption" color="text.secondary">
                      Next Automated Run: {new Date(node.next_run).toLocaleString()}
                    </Typography>
                  )}
                </CardActions>

                {/* Logs Expansion console */}
                <Collapse in={expandedLogs[node.id]}>
                  <Box sx={{ p: 2, background: 'rgba(0,0,0,0.15)', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Recent Sync Runs</Typography>
                    
                    {!nodeLogs[node.id] ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : nodeLogs[node.id].length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No sync history logged yet.</Typography>
                    ) : (
                    <TableContainer component={Paper} sx={{ maxHeight: 200, background: 'transparent', boxShadow: 'none', overflowX: 'auto' }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                            <TableCell align="center" sx={{ background: '#1e1e1e', whiteSpace: 'nowrap' }}>Run Time</TableCell>
                            <TableCell align="center" sx={{ background: '#1e1e1e', whiteSpace: 'nowrap' }}>Direction</TableCell>
                            <TableCell align="center" sx={{ background: '#1e1e1e', whiteSpace: 'nowrap' }}>Recipes</TableCell>
                            <TableCell align="center" sx={{ background: '#1e1e1e', whiteSpace: 'nowrap' }}>Media Reconciled</TableCell>
                            <TableCell align="center" sx={{ background: '#1e1e1e', whiteSpace: 'nowrap' }}>Status</TableCell>
                            <TableCell align="center" sx={{ background: '#1e1e1e', whiteSpace: 'nowrap' }}>Details</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {nodeLogs[node.id].map(log => (
                              <TableRow key={log.id}>
                              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</TableCell>
                              <TableCell align="center" sx={{ textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{log.direction}</TableCell>
                              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{log.recipes_synced}</TableCell>
                              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{log.media_synced}</TableCell>
                              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                                  <Chip
                                    size="small"
                                    label={log.status.toUpperCase()}
                                    color={log.status === 'success' ? 'success' : 'error'}
                                    variant="outlined"
                                  />
                                </TableCell>
                              <TableCell align="center" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {log.error_message || 'OK'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                </Collapse>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Proposed Recipes Queue review panel */}
      <Typography variant="h5" fontWeight="700" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ color: 'secondary.main', display: 'flex' }}><History size={24} /></Box> Proposed Recipes Review Queue
      </Typography>

      {proposedRecipes.length === 0 ? (
        <Paper sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.05)',
          mb: 4
        }}>
          <CheckCircle size={40} color="#10b981" style={{ marginBottom: '8px' }} />
          <Typography variant="subtitle1" fontWeight="bold">Review Queue Empty</Typography>
          <Typography variant="body2" color="text.secondary">
            All pushed selectors from peers have been resolved or auto-merged automatically.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {proposedRecipes.map((peerBlock, blockIdx) => (
            <Grid xs={12} key={blockIdx}>
              <Paper sx={{
                p: 3,
                borderRadius: '20px',
                background: 'rgba(40, 30, 40, 0.3)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,0,127,0.06)'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Recipes Pushed by "{peerBlock.peer_name}"
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Received: {new Date(peerBlock.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                  <Chip size="small" color="secondary" label={`${peerBlock.recipes?.length || 0} recipes pending`} />
                </Box>

                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Provider</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>CSS Selectors</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>XPath Selectors</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Regex Patterns</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {peerBlock.recipes?.map((recipe, rIdx) => (
                        <TableRow key={rIdx}>
                          <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{recipe.provider_name}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{Object.keys(recipe.css_selectors || {}).length} keys</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{Object.keys(recipe.xpath_selectors || {}).length} keys</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{Object.keys(recipe.regex_patterns || {}).length} keys</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                              startIcon={<CheckCircle size={18} />}
                                onClick={() => handleResolveProposed(peerBlock.peer_id, recipe.provider_name, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                              startIcon={<Trash2 size={18} />}
                                onClick={() => handleResolveProposed(peerBlock.peer_id, recipe.provider_name, 'reject')}
                              >
                                Reject
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* CREATE & EDIT PEER DIALOG */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight="bold">
          {editNodeId ? 'Edit Trusted Peer Connection' : 'Register Trusted Peer Connection'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Friendly Peer Name"
                placeholder="e.g. Living Room HTPC"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Peer Base URL"
                placeholder="e.g. http://192.168.1.100:8000"
                helperText="Base endpoint URL of the target Voyarr installation."
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
              />
            </Grid>

            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                required
                type="password"
                label="Outbound Auth Token"
                helperText="Token sent in the 'x-api-key' header to authenticate requests sent to this peer."
                value={formOutboundKey}
                onChange={e => setFormOutboundKey(e.target.value)}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                required
                type="password"
                label="Inbound Auth Token"
                helperText="Token peer must use when making sync requests to this instance."
                value={formInboundToken}
                onChange={e => setFormInboundToken(e.target.value)}
              />
            </Grid>

            <Grid xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>Configurable Behaviors</Typography>
            </Grid>

            <Grid xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Recipe Sync Mode</InputLabel>
                <Select
                  value={formRecipeMode}
                  label="Recipe Sync Mode"
                  onChange={e => setFormRecipeMode(e.target.value)}
                >
                  <MenuItem value="auto_merge">Auto-Merge (Write Immediately)</MenuItem>
                  <MenuItem value="manual_review">Manual Review (Review Queue)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Sync Schedule</InputLabel>
                <Select
                  value={formSchedule}
                  label="Sync Schedule"
                  onChange={e => setFormSchedule(e.target.value)}
                >
                  <MenuItem value="manual">Manual Trigger Only</MenuItem>
                  <MenuItem value="daily">Daily (Nightly at 2:00 AM)</MenuItem>
                  <MenuItem value="weekly">Weekly (Sundays at 2:00 AM)</MenuItem>
                  {/* Allow edit schedules that were already custom */}
                  {formSchedule !== 'manual' && formSchedule !== 'daily' && formSchedule !== 'weekly' && (
                    <MenuItem value={formSchedule}>Custom: {describeCron(formSchedule)} ({formSchedule})</MenuItem>
                  )}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Note: Advanced cron scheduler is supported. Current: {describeCron(formSchedule)}
              </Typography>
            </Grid>

            <Grid xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Library Sync Scope</InputLabel>
                <Select
                  value={formScope}
                  label="Library Sync Scope"
                  onChange={e => setFormScope(e.target.value)}
                >
                  <MenuItem value="all_entries">Reconcile All Media</MenuItem>
                  <MenuItem value="specific_providers">Restrict to Providers</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {formScope === 'specific_providers' && (
              <Grid xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Allowed Providers</InputLabel>
                  <Select
                    multiple
                    value={formAllowedProviders}
                    onChange={e => setFormAllowedProviders(e.target.value)}
                    input={<OutlinedInput label="Allowed Providers" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const prov = providers.find(p => p.id === value)
                          return <Chip key={value} size="small" label={prov ? prov.name : `ID: ${value}`} />
                        })}
                      </Box>
                    )}
                  >
                    {providers.map((prov) => (
                      <MenuItem key={prov.id} value={prov.id}>
                        <Checkbox checked={formAllowedProviders.indexOf(prov.id) > -1} />
                        <ListItemText primary={prov.name} secondary={prov.base_url} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" display="block" color="secondary" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TriangleAlert size={14} /> Privacy Guard: Visual hashes and names from providers not selected in this list will be excluded from the outbound reconcile payloads.
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveNode} color="primary">
            {editNodeId ? 'Save Configurations' : 'Register Peer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
