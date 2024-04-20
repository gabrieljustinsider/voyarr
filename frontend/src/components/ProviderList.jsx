export default function ProviderList({ providers, onSelectProvider }) {
  return (
    <section className="section">
      <h2>Providers</h2>
      <div className="providers-list">
        {providers.map(provider => (
          <div key={provider.id} className="provider-card">
            <h3>{provider.name}</h3>
            <p>{provider.base_url}</p>
            {provider.automatic_limits && (
              <p className="limits-info">Default Daily Limit: {provider.automatic_limits.daily_downloads || 'None'}</p>
            )}
            <button onClick={() => onSelectProvider(provider.id)}>
              Configure Credentials
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
