import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Card, CardContent, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Paper
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import { apiFetch } from '../api'

export default function DownloadRules() {
  const [lists, setLists] = useState([])
  const [rules, setRules] = useState([])
  
  // Custom List State
  const [openListDialog, setOpenListDialog] = useState(false)
  const [currentList, setCurrentList] = useState({ name: '', item_type: 'performers', items: [] })
  const [newItem, setNewItem] = useState('')
  const [listsPage, setListsPage] = useState(0)
  const [listsLimit, setListsLimit] = useState(5)

  // Rule State
  const [openRuleDialog, setOpenRuleDialog] = useState(false)
  const [currentRule, setCurrentRule] = useState({ name: '', scope: 'global', action: 'download', criteria: {} })
  const [criteriaKey, setCriteriaKey] = useState('resolution')
  const [criteriaValue, setCriteriaValue] = useState('')
  const [criteriaListId, setCriteriaListId] = useState('')
  const [rulesPage, setRulesPage] = useState(0)
  const [rulesLimit, setRulesLimit] = useState(5)

  const fetchLists = useCallback(async () => {
    try {
      const res = await apiFetch('/rules/lists')
      if (res.ok) setLists(await res.json())
    } catch (e) {
      console.error('Failed to fetch lists:', e)
    }
  }, [])

  const fetchRules = useCallback(async () => {
    try {
      const res = await apiFetch('/rules')
      if (res.ok) setRules(await res.json())
    } catch (e) {
      console.error('Failed to fetch rules:', e)
    }
  }, [])

  useEffect(() => {
    fetchLists()
    fetchRules()
  }, [fetchLists, fetchRules])

  // --- Custom List Handlers ---
  const handleSaveList = async () => {
    try {
      const isEdit = currentList.id !== undefined
      const url = isEdit ? `/rules/lists/${currentList.id}` : '/rules/lists'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          name: currentList.name,
          item_type: currentList.item_type,
          items: currentList.items
        })
      })

      if (res.ok) {
        setOpenListDialog(false)
        fetchLists()
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to save list:', err.detail || res.statusText)
      }
    } catch (e) {
      console.error('Failed to save list:', e)
    }
  }

  const handleDeleteList = async (id) => {
    try {
      const res = await apiFetch(`/rules/lists/${id}`, { 
        method: 'DELETE'
      })
      if (res.ok) {
        fetchLists()
        // Reset page if needed
        const newLength = lists.length - 1
        if (listsPage * listsLimit >= newLength && listsPage > 0) {
          setListsPage(listsPage - 1)
        }
      }
    } catch (e) {
      console.error('Failed to delete list:', e)
    }
  }

  const handleEditList = (list) => {
    setCurrentList({ ...list })
    setNewItem('')
    setOpenListDialog(true)
  }

  const handleAddListItem = () => {
    if (newItem && !currentList.items.includes(newItem)) {
      setCurrentList({ ...currentList, items: [...currentList.items, newItem] })
      setNewItem('')
    }
  }

  const handleRemoveListItem = (itemToRemove) => {
    setCurrentList({
      ...currentList,
      items: currentList.items.filter(item => item !== itemToRemove)
    })
  }

  // --- Rule Handlers ---
  const handleSaveRule = async () => {
    try {
      const isEdit = currentRule.id !== undefined
      const url = isEdit ? `/rules/${currentRule.id}` : '/rules'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          name: currentRule.name,
          scope: currentRule.scope,
          action: currentRule.action,
          criteria: currentRule.criteria,
          is_active: currentRule.is_active !== undefined ? currentRule.is_active : true
        })
      })

      if (res.ok) {
        setOpenRuleDialog(false)
        fetchRules()
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to save rule:', err.detail || res.statusText)
      }
    } catch (e) {
      console.error('Failed to save rule:', e)
    }
  }

  const handleDeleteRule = async (id) => {
    try {
      const res = await apiFetch(`/rules/${id}`, { 
        method: 'DELETE'
      })
      if (res.ok) {
        fetchRules()
        // Reset page if needed
        const newLength = rules.length - 1
        if (rulesPage * rulesLimit >= newLength && rulesPage > 0) {
          setRulesPage(rulesPage - 1)
        }
      }
    } catch (e) {
      console.error('Failed to delete rule:', e)
    }
  }

  const handleEditRule = (rule) => {
    setCurrentRule({ ...rule })
    setCriteriaValue('')
    setCriteriaListId('')
    setOpenRuleDialog(true)
  }

  const handleAddCriteria = () => {
    let value = criteriaValue
    if (criteriaKey === 'in_list') {
      if (!criteriaListId) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'No list selected', severity: 'warning' } }))
        return
      }
      value = parseInt(criteriaListId)
    } else if (['performers', 'categories', 'series'].includes(criteriaKey)) {
      value = { contains: criteriaValue }
    } else if (criteriaKey === 'custom_terms') {
      value = criteriaValue.split(',').map(s => s.trim()).filter(Boolean)
    }
    
    setCurrentRule({
      ...currentRule,
      criteria: { ...currentRule.criteria, [criteriaKey]: value }
    })
    setCriteriaValue('')
  }

  // Sliced lists and rules for pagination
  const paginatedLists = lists.slice(listsPage * listsLimit, (listsPage + 1) * listsLimit)
  const paginatedRules = rules.slice(rulesPage * rulesLimit, (rulesPage + 1) * rulesLimit)

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom align="center" sx={{ fontWeight: 700, mb: 4 }}>
        Download Rules & Lists
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', mb: 4 }}>
        {/* Custom Lists Section */}
        <Card sx={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Custom Lists</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                setCurrentList({ name: '', item_type: 'performers', items: [] })
                setOpenListDialog(true)
              }}>Add List</Button>
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Items Count</TableCell>
                    <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedLists.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No custom lists configured.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLists.map(list => (
                      <TableRow key={list.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 500 }}>{list.name}</TableCell>
                        <TableCell>
                          <Chip size="small" label={list.item_type} variant="outlined" />
                        </TableCell>
                        <TableCell>{list.items.length} items</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="primary" onClick={() => handleEditList(list)} sx={{ mr: 0.5 }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteList(list.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={lists.length}
              rowsPerPage={listsLimit}
              page={listsPage}
              onPageChange={(e, newPage) => setListsPage(newPage)}
              onRowsPerPageChange={(e) => {
                setListsLimit(parseInt(e.target.value, 10))
                setListsPage(0)
              }}
            />
          </CardContent>
        </Card>

        {/* Download Rules Section */}
        <Card sx={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Download Rules</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                setCurrentRule({ name: '', scope: 'global', action: 'download', criteria: {} })
                setOpenRuleDialog(true)
              }}>Add Rule</Button>
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Scope</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Criteria Count</TableCell>
                    <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No rules configured.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRules.map(rule => (
                      <TableRow key={rule.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 500 }}>{rule.name}</TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={rule.action.toUpperCase()} 
                            color={rule.action === 'download' ? 'success' : rule.action === 'skip' ? 'error' : 'warning'} 
                            variant="light"
                            sx={{ fontWeight: 600, fontSize: '10px' }}
                          />
                        </TableCell>
                        <TableCell>{rule.scope}</TableCell>
                        <TableCell>{Object.keys(rule.criteria).length} fields</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="primary" onClick={() => handleEditRule(rule)} sx={{ mr: 0.5 }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteRule(rule.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={rules.length}
              rowsPerPage={rulesLimit}
              page={rulesPage}
              onPageChange={(e, newPage) => setRulesPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRulesLimit(parseInt(e.target.value, 10))
                setRulesPage(0)
              }}
            />
          </CardContent>
        </Card>
      </Box>

      {/* Add / Edit List Dialog */}
      <Dialog open={openListDialog} onClose={() => setOpenListDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{currentList.id !== undefined ? 'Edit Custom List' : 'Create Custom List'}</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth label="List Name" value={currentList.name} onChange={e => setCurrentList({...currentList, name: e.target.value})} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Item Type</InputLabel>
            <Select value={currentList.item_type} onChange={e => setCurrentList({...currentList, item_type: e.target.value})} label="Item Type">
              <MenuItem value="performers">Performers</MenuItem>
              <MenuItem value="tags">Tags/Categories</MenuItem>
              <MenuItem value="series">Series</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField fullWidth label="Add Item" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddListItem()} />
            <Button variant="contained" onClick={handleAddListItem}>Add</Button>
          </Box>
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {currentList.items.map(item => (
              <Chip key={item} label={item} onDelete={() => handleRemoveListItem(item)} />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenListDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveList} variant="contained" disabled={!currentList.name}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Add / Edit Rule Dialog */}
      <Dialog open={openRuleDialog} onClose={() => setOpenRuleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{currentRule.id !== undefined ? 'Edit Download Rule' : 'Create Download Rule'}</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth label="Rule Name" value={currentRule.name} onChange={e => setCurrentRule({...currentRule, name: e.target.value})} margin="normal" />
          
          <Grid container spacing={2}>
            <Grid xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Scope</InputLabel>
                <Select value={currentRule.scope} onChange={e => setCurrentRule({...currentRule, scope: e.target.value})} label="Scope">
                  <MenuItem value="global">Global (All Downloads)</MenuItem>
                  <MenuItem value="session">Current Session</MenuItem>
                  <MenuItem value="provider:1">Specific Provider (ID 1)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Action</InputLabel>
                <Select value={currentRule.action} onChange={e => setCurrentRule({...currentRule, action: e.target.value})} label="Action">
                  <MenuItem value="download">Force Download</MenuItem>
                  <MenuItem value="queue">Add to Queue (Pause)</MenuItem>
                  <MenuItem value="skip">Skip / Reject</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Criteria</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Type</InputLabel>
              <Select value={criteriaKey} onChange={e => setCriteriaKey(e.target.value)} label="Type">
                <MenuItem value="resolution">Resolution (Exact)</MenuItem>
                <MenuItem value="performers">Performer (Contains)</MenuItem>
                <MenuItem value="categories">Category/Tag (Contains)</MenuItem>
                <MenuItem value="series">Series (Contains)</MenuItem>
                <MenuItem value="sub_site">Sub-site (Exact)</MenuItem>
                <MenuItem value="custom_terms">Custom Terms (In Title/Desc)</MenuItem>
                <MenuItem value="in_list">Matches Custom List</MenuItem>
              </Select>
            </FormControl>
            
            {criteriaKey === 'in_list' ? (
              <FormControl fullWidth>
                <InputLabel>Select List</InputLabel>
                <Select value={criteriaListId} onChange={e => setCriteriaListId(e.target.value)} label="Select List">
                  {lists.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
            ) : (
              <TextField 
                fullWidth 
                label="Value" 
                value={criteriaValue} 
                onChange={e => setCriteriaValue(e.target.value)} 
              />
            )}
            <Button variant="contained" onClick={handleAddCriteria}>Add</Button>
          </Box>

          <Box sx={{ mt: 1 }}>
            {Object.entries(currentRule.criteria).map(([k, v]) => (
              <Chip 
                key={k} 
                label={`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`} 
                onDelete={() => {
                  const newCriteria = { ...currentRule.criteria }
                  delete newCriteria[k]
                  setCurrentRule({ ...currentRule, criteria: newCriteria })
                }}
                sx={{ m: 0.5 }}
              />
            ))}
          </Box>

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRuleDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveRule} variant="contained" disabled={!currentRule.name}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
