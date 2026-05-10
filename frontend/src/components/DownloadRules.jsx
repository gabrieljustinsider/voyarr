import { useState, useEffect } from 'react'
import {
  Box, Typography, Card, CardContent, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Chip, List, ListItem, ListItemText, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'

export default function DownloadRules() {
  const [lists, setLists] = useState([])
  const [rules, setRules] = useState([])
  
  // Custom List State
  const [openListDialog, setOpenListDialog] = useState(false)
  const [currentList, setCurrentList] = useState({ name: '', item_type: 'performers', items: [] })
  const [newItem, setNewItem] = useState('')

  // Rule State
  const [openRuleDialog, setOpenRuleDialog] = useState(false)
  const [currentRule, setCurrentRule] = useState({ name: '', scope: 'global', action: 'download', criteria: {} })
  const [criteriaKey, setCriteriaKey] = useState('resolution')
  const [criteriaValue, setCriteriaValue] = useState('')
  const [criteriaListId, setCriteriaListId] = useState('')

  const API_BASE = 'http://localhost:8000/rules'

  const fetchLists = async () => {
    const res = await fetch(`${API_BASE}/lists`, {
      headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
    })
    if (res.ok) setLists(await res.json())
  }

  const fetchRules = async () => {
    const res = await fetch(API_BASE, {
      headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
    })
    if (res.ok) setRules(await res.json())
  }

  useEffect(() => {
    fetchLists()
    fetchRules()
  }, [])

  // --- Custom List Handlers ---
  const handleSaveList = async () => {
    await fetch(`${API_BASE}/lists`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
      },
      body: JSON.stringify(currentList)
    })
    setOpenListDialog(false)
    fetchLists()
  }

  const handleDeleteList = async (id) => {
    await fetch(`${API_BASE}/lists/${id}`, { 
      method: 'DELETE',
      headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
    })
    fetchLists()
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
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
      },
      body: JSON.stringify(currentRule)
    })
    setOpenRuleDialog(false)
    fetchRules()
  }

  const handleDeleteRule = async (id) => {
    await fetch(`${API_BASE}/${id}`, { 
      method: 'DELETE',
      headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
    })
    fetchRules()
  }

  const handleAddCriteria = () => {
    let value = criteriaValue
    if (criteriaKey === 'in_list') {
      value = parseInt(criteriaListId)
    } else if (criteriaKey === 'performers') {
      value = { contains: criteriaValue }
    }
    
    setCurrentRule({
      ...currentRule,
      criteria: { ...currentRule.criteria, [criteriaKey]: value }
    })
    setCriteriaValue('')
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Download Rules & Lists</Typography>

      <Grid container spacing={3}>
        {/* Custom Lists Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Custom Lists</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                  setCurrentList({ name: '', item_type: 'performers', items: [] })
                  setOpenListDialog(true)
                }}>Add List</Button>
              </Box>
              <List>
                {lists.map(list => (
                  <ListItem key={list.id} secondaryAction={
                    <IconButton edge="end" onClick={() => handleDeleteList(list.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }>
                    <ListItemText primary={list.name} secondary={`${list.item_type} - ${list.items.length} items`} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Download Rules Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Download Rules</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                  setCurrentRule({ name: '', scope: 'global', action: 'download', criteria: {} })
                  setOpenRuleDialog(true)
                }}>Add Rule</Button>
              </Box>
              <List>
                {rules.map(rule => (
                  <ListItem key={rule.id} secondaryAction={
                    <IconButton edge="end" onClick={() => handleDeleteRule(rule.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }>
                    <ListItemText 
                      primary={rule.name} 
                      secondary={`${rule.action.toUpperCase()} | Scope: ${rule.scope} | Criteria: ${Object.keys(rule.criteria).length}`} 
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add List Dialog */}
      <Dialog open={openListDialog} onClose={() => setOpenListDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Custom List</DialogTitle>
        <DialogContent>
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

      {/* Add Rule Dialog */}
      <Dialog open={openRuleDialog} onClose={() => setOpenRuleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Download Rule</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Rule Name" value={currentRule.name} onChange={e => setCurrentRule({...currentRule, name: e.target.value})} margin="normal" />
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Scope</InputLabel>
                <Select value={currentRule.scope} onChange={e => setCurrentRule({...currentRule, scope: e.target.value})} label="Scope">
                  <MenuItem value="global">Global (All Downloads)</MenuItem>
                  <MenuItem value="session">Current Session</MenuItem>
                  <MenuItem value="provider:1">Specific Provider (ID 1)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
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
