export default function CredentialForm({ 
  credentials, 
  setCredentials, 
  onSubmit 
}) {
  return (
    <section className="section">
      <h2>Credentials</h2>
      <form onSubmit={onSubmit} className="credentials-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="dailyLimit">Custom Daily Limit (Optional)</label>
          <input
            type="number"
            id="dailyLimit"
            value={credentials.dailyLimit}
            onChange={(e) => setCredentials({...credentials, dailyLimit: e.target.value})}
            placeholder="Override default limit"
          />
        </div>
        <button type="submit">Save Credentials</button>
      </form>
    </section>
  )
}
