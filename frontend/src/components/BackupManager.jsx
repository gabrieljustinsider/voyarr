import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Divider,
  TextField,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import StorageIcon from '@mui/icons-material/Storage'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import FolderZipIcon from '@mui/icons-material/FolderZip'
import { apiFetch } from '../api'

const BACKUP_API = '/backup'

export default function BackupManager() {
  const [tables, setTables] = useState([])
  const [selectedTables, setSelectedTables] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [exportPassword, setExportPassword] = useState('')
  const [showExportPassword, setShowExportPassword] = useState(false)

  // Restore states
  const [uploadFile, setUploadFile] = useState(null)
  const [selectedLocalBackup, setSelectedLocalBackup] = useState(null)
  const [verifyData, setVerifyData] = useState(null)
  const [restorePassword, setRestorePassword] = useState('')
  const [showRestorePassword, setShowRestorePassword] = useState(false)
  const [decryptLoading, setDecryptLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState(null)
  
  // Local backups state
  const [localBackups, setLocalBackups] = useState([])
  const [localLoading, setLocalLoading] = useState(false)

  const fileInputRef = useRef(null)

  const fetchLocalBackups = async () => {
    setLocalLoading(true)
    try {
      const res = await apiFetch(`${BACKUP_API}/local-list`)
      if (res.ok) {
        const data = await res.json()
        setLocalBackups(data.backups || [])
      }
    } catch (err) {
      console.error("Failed to fetch local backups:", err)
    } finally {
      setLocalLoading(false)
    }
  }

  useEffect(() => {
    // Fetch tables info
    apiFetch(`${BACKUP_API}/tables`)
      .then(res => res.json())
      .then(data => {
        if (data.tables) {
          setTables(data.tables)
          setSelectedTables(data.tables) // Select all by default
        }
      })
      .catch(err => console.error("Failed to fetch tables:", err))

    // Fetch local backups saved on server
    fetchLocalBackups()
  }, [])

  const handleToggleTable = (tableName) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    )
  }

  const handleToggleAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([])
    } else {
      setSelectedTables(tables)
    }
  }

  const handleExport = async (type) => {
    setLoading(true)
    setMessage(null)
    try {
      let url = `${BACKUP_API}/export?type=${type}`
      if (type === 'custom') {
        if (selectedTables.length === 0) {
          setMessage({ type: 'error', text: 'Please select at least one table for a custom backup.' })
          setLoading(false)
          return
        }
        url += `&tables=${selectedTables.join(',')}`
      }

      if (exportPassword) {
        url += `&password=${encodeURIComponent(exportPassword)}`
      }

      const res = await apiFetch(url)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Export failed')
      }
      
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `voyarr_${type}_backup_${new Date().toISOString().slice(0,10)}${exportPassword ? '.enc' : ''}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
      
      setMessage({ type: 'success', text: `Successfully exported ${type} backup!` })
      // Refresh local list since docker backup volume is shared or saves locally
      fetchLocalBackups()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    setLoading(false)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadFile(file)
    setSelectedLocalBackup(null)
    setVerifyData(null)
    setRestoreMessage(null)
    setRestorePassword('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await apiFetch(`${BACKUP_API}/verify`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setVerifyData(data)
      } else {
        setRestoreMessage({ type: 'error', text: data.message || 'Invalid backup file' })
      }
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message })
    }
  }

  const handleVerifyLocal = async (backup) => {
    setSelectedLocalBackup(backup)
    setUploadFile(null)
    setVerifyData(null)
    setRestoreMessage(null)
    setRestorePassword('')

    try {
      const res = await apiFetch(`${BACKUP_API}/verify-local?filepath=${encodeURIComponent(backup.path)}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setVerifyData(data)
      } else {
        setRestoreMessage({ type: 'error', text: data.message || 'Invalid local backup file' })
      }
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message })
    }
  }

  const handleDecryptVerify = async () => {
    setDecryptLoading(true)
    setRestoreMessage(null)

    try {
      let res
      if (uploadFile) {
        const formData = new FormData()
        formData.append('file', uploadFile)
        res = await apiFetch(`${BACKUP_API}/verify?password=${encodeURIComponent(restorePassword)}`, {
          method: 'POST',
          body: formData
        })
      } else if (selectedLocalBackup) {
        res = await apiFetch(`${BACKUP_API}/verify-local?filepath=${encodeURIComponent(selectedLocalBackup.path)}&password=${encodeURIComponent(restorePassword)}`, {
          method: 'POST'
        })
      }

      if (!res) throw new Error("No backup file selected for decryption")

      const data = await res.json()
      if (res.ok && data.valid) {
        if (data.decrypted_data) {
          setVerifyData(data)
          setRestoreMessage({ type: 'success', text: 'Backup successfully decrypted and verified!' })
        } else {
          setRestoreMessage({ type: 'error', text: 'Decryption passphrase was incorrect or invalid.' })
        }
      } else {
        setRestoreMessage({ type: 'error', text: data.message || 'Decryption failed' })
      }
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message })
    } finally {
      setDecryptLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!uploadFile && !selectedLocalBackup) return
    setRestoreLoading(true)
    setRestoreMessage(null)

    try {
      let res
      if (uploadFile) {
        const formData = new FormData()
        formData.append('file', uploadFile)
        let url = `${BACKUP_API}/restore`
        if (restorePassword) {
          url += `?password=${encodeURIComponent(restorePassword)}`
        }
        res = await apiFetch(url, {
          method: 'POST',
          body: formData
        })
      } else if (selectedLocalBackup) {
        let url = `${BACKUP_API}/restore-local?filepath=${encodeURIComponent(selectedLocalBackup.path)}`
        if (restorePassword) {
          url += `&password=${encodeURIComponent(restorePassword)}`
        }
        res = await apiFetch(url, {
          method: 'POST'
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Restore failed')
      
      setRestoreMessage({ type: 'success', text: data.message || 'Restore completed successfully!' })
      setUploadFile(null)
      setSelectedLocalBackup(null)
      setVerifyData(null)
      setRestorePassword('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message })
    } finally {
      setRestoreLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    // Simple alert or feedback could go here, but a console or general state is clean
  }

  const pythonVerifierSnippet = `# Save as verify_backup.py and run: python verify_backup.py <backup_file_path> [<passphrase>]
import json, sys, hashlib, hmac, base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

if len(sys.argv) < 2:
    print("Usage: python verify_backup.py <backup.json> [<passphrase>]")
    sys.exit(1)

with open(sys.argv[1], 'r') as f:
    data = json.load(f)

is_enc = data.get("encrypted", False)
if is_enc:
    if len(sys.argv) < 3:
        print("Error: Backup is encrypted but no passphrase was provided.")
        sys.exit(1)
    pw = sys.argv[2]
    salt = bytes.fromhex(data["salt"])
    ciphertext = data["ciphertext"]
    sig = data["signature"]
    checksum = data.get("checksum", "")

    # Derive key from password
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000)
    key = base64.urlsafe_b64encode(kdf.derive(pw.encode()))

    # Verify HMAC signature
    expected_sig = hmac.new(key, ciphertext.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, sig):
        print("❌ Signature verification FAILED! Invalid password or corrupted payload.")
        sys.exit(1)
    print("✅ Signature successfully verified via derived passphrase key.")

    # Decrypt Fernet cipher
    try:
        cipher = Fernet(key)
        dec_bytes = cipher.decrypt(ciphertext.encode())
        print("✅ Ciphertext successfully decrypted.")
    except Exception as e:
        print(f"❌ Decryption failed: {e}")
        sys.exit(1)

    # Verify sha256 checksum of decrypted data
    if checksum:
        expected_chk = hashlib.sha256(dec_bytes).hexdigest()
        if expected_chk != checksum:
            print("❌ Integrity check FAILED! Plaintext checksum mismatch.")
            sys.exit(1)
        print(f"✅ Checksum matched: {checksum}")
    else:
        print("⚠️ No plaintext checksum embedded in backup.")
else:
    print("ℹ️ Backup is unencrypted.")
    chk = data.get("checksum", "")
    if chk:
        print(f"Embedded Checksum: {chk}")
        # Standard unencrypted backup can be verified manually:
        # sha256(json.dumps(data["data"]))
`

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Backup & Restore
      </Typography>
      
      <Grid container spacing={3}>
        {/* Left Side: Export Controls */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', boxSizing: 'border-box' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Export Data</Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
              Select the tables you wish to include in your backup. Unencrypted backups are signed via Voyarr keys; encrypted backups are securely ciphered via AES-256.
            </Typography>
            
            <Box sx={{ mb: 2, maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', p: 1 }}>
              <Button size="small" variant="outlined" onClick={handleToggleAll} sx={{ mb: 1, textTransform: 'none' }}>
                Toggle All
              </Button>
              <Grid container spacing={1}>
                {tables.map(table => (
                  <Grid item xs={12} sm={6} key={table}>
                    <FormControlLabel
                      control={<Checkbox checked={selectedTables.includes(table)} onChange={() => handleToggleTable(table)} size="small" />}
                      label={<Typography variant="body2">{table}</Typography>}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Optional Encryption Passphrase */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                size="small"
                label="Passphrase for Encryption (Optional)"
                type={showExportPassword ? 'text' : 'password'}
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder="Leave blank for unencrypted signed backup"
                helperText="Secures your database tables utilizing AES-256 standard encryption (Fernet & PBKDF2)."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon fontSize="small" sx={{ color: exportPassword ? 'var(--accent)' : 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowExportPassword(!showExportPassword)} edge="end" size="small">
                        {showExportPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" color="primary" onClick={() => handleExport('full')} disabled={loading} sx={{ textTransform: 'none' }}>
                Full Backup
              </Button>
              <Button variant="contained" color="secondary" onClick={() => handleExport('custom')} disabled={loading || selectedTables.length === 0} sx={{ textTransform: 'none' }}>
                Custom Backup
              </Button>
              <Button variant="outlined" onClick={() => handleExport('settings')} disabled={loading} sx={{ textTransform: 'none' }}>
                Settings Only
              </Button>
            </Box>
            
            {loading && <CircularProgress size={24} sx={{ mt: 2 }} />}
            {message && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
          </Paper>
        </Grid>

        {/* Right Side: Local Backups Browser */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon sx={{ color: 'var(--accent)' }} /> Server-Side Backups
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              These backups are stored locally in the container's volume mount (`/app/backups`). You can verify and restore them instantly.
            </Typography>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '300px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
              {localLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
              ) : localBackups.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>No backups found on server.</Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Backup File</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {localBackups.map((backup) => (
                        <TableRow key={backup.name} hover>
                          <TableCell sx={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Tooltip title={backup.name}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FolderZipIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ fontWeight: selectedLocalBackup?.name === backup.name ? 'bold' : 'normal' }}>
                                  {backup.name}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{(backup.size / 1024).toFixed(1)} KB</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant={selectedLocalBackup?.name === backup.name ? 'contained' : 'outlined'}
                              onClick={() => handleVerifyLocal(backup)}
                              sx={{ textTransform: 'none', py: 0.2 }}
                            >
                              Select
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Restore Section (Unified for Uploaded & Local) */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Restore & Verify Backup</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
                  Select a backup file by uploading it from your computer or choosing from the server list above.
                </Typography>
                
                <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
                  <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={restoreLoading} sx={{ textTransform: 'none' }}>
                    Upload Backup File
                  </Button>
                  
                  {uploadFile && (
                    <Alert severity="info" icon={<FolderZipIcon />} sx={{ py: 0 }}>
                      <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                        Uploaded: {uploadFile.name}
                      </Typography>
                    </Alert>
                  )}

                  {selectedLocalBackup && (
                    <Alert severity="info" icon={<StorageIcon />} sx={{ py: 0 }}>
                      <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                        Server: {selectedLocalBackup.name}
                      </Typography>
                    </Alert>
                  )}
                </Box>

                {verifyData && verifyData.encrypted && !verifyData.decrypted_data && (
                  <Box sx={{ mt: 2, p: 2, border: '1px solid var(--accent-border)', borderRadius: '8px', backgroundColor: 'var(--accent-bg)' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LockIcon fontSize="small" sx={{ color: 'var(--accent)' }} /> Backup is Encrypted
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      label="Enter Decryption Passphrase"
                      type={showRestorePassword ? 'text' : 'password'}
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      sx={{ mb: 2, '& .MuiInputBase-root': { backgroundColor: 'rgba(0,0,0,0.2)' } }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowRestorePassword(!showRestorePassword)} edge="end" size="small">
                              {showRestorePassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleDecryptVerify}
                      disabled={!restorePassword || decryptLoading}
                      sx={{ textTransform: 'none', backgroundColor: 'var(--accent)' }}
                    >
                      {decryptLoading ? <CircularProgress size={20} /> : 'Decrypt & Verify'}
                    </Button>
                  </Box>
                )}
              </Grid>

              <Grid item xs={12} md={8}>
                {verifyData ? (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Verification Report
                    </Typography>
                    
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                          <Typography variant="caption" color="textSecondary">Backup Type</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                            {verifyData.type}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                          <Typography variant="caption" color="textSecondary">Encryption Mode</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {verifyData.encrypted ? (
                              <React.Fragment>
                                <LockIcon fontSize="small" sx={{ color: 'var(--accent)' }} /> AES-256 Encrypted
                              </React.Fragment>
                            ) : 'None (Plaintext)'}
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                          <Typography variant="caption" color="textSecondary">SHA-256 Checksum</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'var(--mono)', backgroundColor: 'var(--code-bg)', p: 0.5, borderRadius: '4px', wordBreak: 'break-all', flexGrow: 1 }}>
                              {verifyData.checksum || 'N/A'}
                            </Typography>
                            {verifyData.checksum && (
                              <IconButton size="small" onClick={() => copyToClipboard(verifyData.checksum)}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Paper>
                      </Grid>

                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                          <Typography variant="caption" color="textSecondary">Signature Integrity Status</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            {verifyData.verified_signature || (verifyData.encrypted && verifyData.decrypted_data) ? (
                              <React.Fragment>
                                <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />
                                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                  Verified Authenticity (Signature matches payload integrity)
                                </Typography>
                              </React.Fragment>
                            ) : (
                              <React.Fragment>
                                <WarningIcon sx={{ color: 'warning.main' }} fontSize="small" />
                                <Typography variant="body2" sx={{ color: 'warning.main' }}>
                                  Unsigned backup or custom-derived signature (Decrypted locally)
                                </Typography>
                              </React.Fragment>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>

                    {verifyData.decrypted_data && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        Ready to restore database. Payload verified successfully! Includes <strong>{verifyData.table_count}</strong> tables and <strong>{verifyData.record_count}</strong> records.
                      </Alert>
                    )}

                    {/* Collapsible Manual Verification Expander */}
                    <Accordion sx={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden', mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Manual Verification Protocol (Command-Line Python)
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                          Validate file integrity, authenticate signatures, and decrypt this backup file completely offline using Python.
                        </Typography>
                        <Box sx={{ position: 'relative' }}>
                          <Box sx={{ position: 'absolute', top: 5, right: 5 }}>
                            <Button size="small" variant="text" startIcon={<ContentCopyIcon />} onClick={() => copyToClipboard(pythonVerifierSnippet)} sx={{ textTransform: 'none', color: '#9ca3af' }}>
                              Copy Snippet
                            </Button>
                          </Box>
                          <pre style={{
                            margin: 0,
                            padding: '12px',
                            backgroundColor: '#1f2028',
                            borderRadius: '6px',
                            color: '#9ca3af',
                            fontSize: '0.75rem',
                            fontFamily: 'var(--mono)',
                            overflowX: 'auto'
                          }}>
                            {pythonVerifierSnippet}
                          </pre>
                        </Box>
                      </AccordionDetails>
                    </Accordion>

                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handleRestore}
                      disabled={!verifyData.decrypted_data || restoreLoading}
                      fullWidth
                      sx={{ textTransform: 'none', py: 1, fontWeight: 'bold' }}
                    >
                      {restoreLoading ? <CircularProgress size={24} /> : 'Execute Database Restore'}
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ p: 4, border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', textAlign: 'center', color: 'text.secondary' }}>
                    No verified backup loaded. Upload a backup JSON or select one from the server-side backups list to proceed.
                  </Box>
                )}
              </Grid>
            </Grid>

            {restoreMessage && <Alert severity={restoreMessage.type} sx={{ mt: 2 }}>{restoreMessage.text}</Alert>}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}