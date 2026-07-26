import { useState, useEffect } from 'react'
import { Box, Typography, Tabs, Tab, TextField, Button, IconButton, Divider, CircularProgress, Alert, Paper } from '@mui/material'
import { Plus, Trash2, Save, TestTube, Copy } from 'lucide-react'
import GlassCard from './common/GlassCard'
import { apiFetch } from '../api'

const GROUPS = ['css_selectors', 'xpath_selectors', 'regex_patterns', 'map_mode_data']
const GROUP_LABELS = {
  css_selectors: 'CSS Selectors',
  xpath_selectors: 'XPath Selectors',
  regex_patterns: 'Regex Patterns',
  map_mode_data: 'Map Mode Data',
}

function SelectorGroup({ group, selectors, onChange }) {
  const entries = Object.entries(selectors || {})

  const update = (key, newKey, value) => {
    const next = { ...(selectors || {}) }
    if (key !== undefined) delete next[key]
    if (newKey) next[newKey] = value || ''
    onChange(group, next)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {entries.length === 0 && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 3 }}>
          No {GROUP_LABELS[group].toLowerCase()} defined.
        </Typography>
      )}
      {entries.map(([key, val]) => (
        <Box key={key} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" placeholder="Field name" value={key}
            onChange={e => { const v = e.target.value; delete selectors[key]; update(undefined, v, val) }}
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.78rem' } }} />
          <TextField size="small" placeholder="Selector / pattern" value={String(val || '')}
            onChange={e => update(key, key, e.target.value)}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.78rem', fontFamily: 'monospace' } }} />
          <IconButton size="small" onClick={() => update(key, undefined, undefined)}
            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ef4444' } }}>
            <Trash2 size={14} />
          </IconButton>
        </Box>
      ))}
      <Button size="small" variant="text" startIcon={<Plus size={14} />} onClick={() => update(undefined, '', '')}
        sx={{ alignSelf: 'flex-start', borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', mt: 0.5 }}>
        Add {GROUP_LABELS[group].toLowerCase()} rule
      </Button>
    </Box>
  )
}

export default function RecipeEditor({ providerId, recipe, onSave }) {
  const [tab, setTab] = useState(0)
  const [data, setData] = useState({
    css_selectors: null,
    xpath_selectors: null,
    regex_patterns: null,
    map_mode_data: null,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testUrl, setTestUrl] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (recipe) {
      setData({
        css_selectors: recipe.css_selectors || null,
        xpath_selectors: recipe.xpath_selectors || null,
        regex_patterns: recipe.regex_patterns || null,
        map_mode_data: recipe.map_mode_data || null,
      })
    }
  }, [recipe])

  const handleUpdate = (group, value) => {
    setData(d => ({ ...d, [group]: value && Object.keys(value).length > 0 ? value : null }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {}
      for (const g of GROUPS) {
        if (data[g] !== null) body[g] = data[g]
      }
      await apiFetch(`/scraper/by-provider/${providerId}`, { method: 'PUT', body })
      setSaved(true)
      if (onSave) onSave()
    } catch (e) {}
    setSaving(false)
  }

  const handleTest = async () => {
    if (!testUrl.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiFetch('/scraper/parse-url', { method: 'POST', body: { url: testUrl.trim() } })
      setTestResult(await res.json())
    } catch (e) {
      setTestResult({ error: e.message || 'Test failed' })
    }
    setTesting(false)
  }

  const handleCopyJson = () => {
    const payload = {}
    for (const g of GROUPS) {
      if (data[g]) payload[g] = data[g]
    }
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  if (!providerId) {
    return (
      <GlassCard sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Select a provider to manage its scraping recipe.</Typography>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: '700' }}>
          Recipe — Provider #{providerId}
          {recipe ? ` (ID: ${recipe.id})` : ' (not yet created)'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<Copy size={14} />} onClick={handleCopyJson}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>
            Copy JSON
          </Button>
          <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={14} /> : <Save size={14} />}
            onClick={handleSave} disabled={saving}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', fontWeight: 'bold' }}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </Button>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

      <Tabs value={tab} onChange={(e, v) => setTab(v)}
        sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', minHeight: 36 } }}>
        {GROUPS.map(g => <Tab key={g} label={GROUP_LABELS[g]} />)}
      </Tabs>

      {GROUPS.map((g, i) => (
        <Box key={g} sx={{ display: tab === i ? 'block' : 'none' }}>
          <SelectorGroup group={g} selectors={data[g]} onChange={handleUpdate} />
        </Box>
      ))}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2 }} />

      {/* Test section */}
      <Typography variant="subtitle2" sx={{ fontWeight: '600', mb: 1, color: 'rgba(255,255,255,0.6)' }}>
        🧪 Test Recipe
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField size="small" placeholder="https://example.com/video-page" value={testUrl}
          onChange={e => setTestUrl(e.target.value)}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
        <Button size="small" variant="outlined" startIcon={testing ? <CircularProgress size={14} /> : <TestTube size={14} />}
          onClick={handleTest} disabled={testing || !testUrl.trim()}
          sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>
          Test
        </Button>
      </Box>
      {testResult && (
        <Paper sx={{ mt: 1.5, p: 1.5, borderRadius: '8px', bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 300, overflow: 'auto' }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(testResult, null, 2)}
          </Typography>
        </Paper>
      )}
    </GlassCard>
  )
}
