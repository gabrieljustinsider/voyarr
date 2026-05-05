export default function DownloadQueue({ queue }) {
  return (
    <section className="section">
      <h2>Download Queue</h2>
      {queue.length > 0 ? (
        <div className="queue-list">
          {queue.map((task) => (
            <div key={task.task_id} className="queue-item">
              <span>Task {task.task_id}: {task.status}</span>
              <div className="progress-bar" style={{ backgroundColor: '#e0e0e0', borderRadius: '4px', margin: '10px 0' }}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${task.progress}%`, backgroundColor: '#4caf50', height: '10px', borderRadius: '4px' }}
                ></div>
              </div>
              <span>{task.progress}%</span>
            </div>
          ))}
        </div>
      ) : (
        <p>No active downloads.</p>
      )}
    </section>
  )
}
