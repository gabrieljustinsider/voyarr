import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction,
  Box, Typography, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../api';

const ChapterManager = ({ open, onClose, libraryEntry }) => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', start_time: 0, end_time: '', tags: '' });

  const loadChapters = useCallback(async () => {
    if (!libraryEntry) return;
    try {
      setLoading(true);
      const res = await api.get(`/chapters/library/${libraryEntry.id}`);
      setChapters(res.data);
    } catch (err) {
      console.error('Failed to load chapters', err);
    } finally {
      setLoading(false);
    }
  }, [libraryEntry]);

  useEffect(() => {
    if (open && libraryEntry) {
      loadChapters();
      setForm({ title: '', start_time: 0, end_time: '', tags: '' });
      setEditingId(null);
    }
  }, [open, libraryEntry, loadChapters]);

  const handleSave = async () => {
    try {
      const payload = {
        title: form.title,
        start_time: parseInt(form.start_time, 10),
        end_time: form.end_time ? parseInt(form.end_time, 10) : null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      if (editingId) {
        await api.put(`/chapters/${editingId}`, payload);
      } else {
        await api.post(`/chapters/library/${libraryEntry.id}`, payload);
      }
      
      setForm({ title: '', start_time: 0, end_time: '', tags: '' });
      setEditingId(null);
      loadChapters();
    } catch (err) {
      console.error('Failed to save chapter', err);
      alert('Failed to save chapter');
    }
  };

  const handleEdit = (ch) => {
    setEditingId(ch.id);
    setForm({
      title: ch.title,
      start_time: ch.start_time,
      end_time: ch.end_time || '',
      tags: ch.tags ? ch.tags.join(', ') : ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this chapter?')) return;
    try {
      await api.delete(`/chapters/${id}`);
      loadChapters();
    } catch (err) {
      console.error('Failed to delete chapter', err);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Manage Chapters - {libraryEntry?.title}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <TextField
            label="Title"
            size="small"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            fullWidth
          />
          <TextField
            label="Start Time (sec)"
            type="number"
            size="small"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            sx={{ width: 120 }}
          />
          <TextField
            label="End Time (sec)"
            type="number"
            size="small"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            sx={{ width: 120 }}
          />
          <TextField
            label="Tags (comma separated)"
            size="small"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            fullWidth
          />
          <Button variant="contained" onClick={handleSave} disabled={!form.title || form.start_time === ''}>
            {editingId ? 'Update' : 'Add'}
          </Button>
          {editingId && (
            <Button variant="outlined" onClick={() => { setEditingId(null); setForm({ title: '', start_time: 0, end_time: '', tags: '' }); }}>
              Cancel
            </Button>
          )}
        </Box>

        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          <List>
            {chapters.length === 0 && <Typography color="textSecondary">No chapters added yet.</Typography>}
            {chapters.map(ch => (
              <ListItem key={ch.id} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight="bold">{formatTime(ch.start_time)}</Typography>
                      <Typography>{ch.title}</Typography>
                      {ch.end_time && <Typography variant="caption" color="textSecondary">to {formatTime(ch.end_time)}</Typography>}
                    </Box>
                  }
                  secondary={
                    ch.tags && ch.tags.length > 0 ? (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                        {ch.tags.map(t => <Chip key={t} label={t} size="small" />)}
                      </Box>
                    ) : null
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleEdit(ch)} sx={{ mr: 1 }}>
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" color="error" onClick={() => handleDelete(ch.id)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChapterManager;
