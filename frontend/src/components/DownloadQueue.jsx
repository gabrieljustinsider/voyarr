import { Typography, LinearProgress, List, ListItem, ListItemText, Box, Button, Chip } from '@mui/material'

export default function DownloadQueue({ queue }) {
  const API_BASE = 'http://localhost:8000'

  const handlePause = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/progress/${taskId}/pause`, { method: 'POST' })
      if (response.ok) {
        console.log('Download paused')
        // Refresh queue or update state
      }
    } catch (error) {
      console.error('Error pausing download:', error)
    }
  }

  const handleResume = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/progress/${taskId}/resume`, { method: 'POST' })
      if (response.ok) {
        console.log('Download resumed')
      }
    } catch (error) {
      console.error('Error resuming download:', error)
    }
  }

  const handleCancel = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/progress/${taskId}/cancel`, { method: 'POST' })
      if (response.ok) {
        console.log('Download cancelled')
      }
    } catch (error) {
      console.error('Error cancelling download:', error)
    }
  }

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Download Queue
      </Typography>
      {queue.length > 0 ? (
        <List>
          {queue.map((task) => (
            <ListItem key={task.task_id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                <Typography variant="h6">
                  Task {task.task_id}
                </Typography>
                <Chip 
                  label={task.status} 
                  color={task.status === 'completed' ? 'success' : task.status === 'failed' ? 'error' : 'primary'} 
                  size="small"
                />
              </Box>
              <Box sx={{ width: '100%', mb: 1 }}>
                <LinearProgress variant="determinate" value={task.progress} sx={{ height: 10, borderRadius: 5 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {task.progress}% complete
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {task.status === 'running' && (
                  <Button size="small" variant="outlined" onClick={() => handlePause(task.task_id)}>
                    Pause
                  </Button>
                )}
                {task.status === 'paused' && (
                  <Button size="small" variant="outlined" onClick={() => handleResume(task.task_id)}>
                    Resume
                  </Button>
                )}
                <Button size="small" variant="outlined" color="error" onClick={() => handleCancel(task.task_id)}>
                  Cancel
                </Button>
              </Box>
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography>No active downloads.</Typography>
      )}
    </div>
  )
}
