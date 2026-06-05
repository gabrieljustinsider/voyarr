import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [providers, setProviders] = useState([]);
  
  // Forms state
  const [emailText, setEmailText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newTier, setNewTier] = useState({ provider_id: '', name: '', level: 0, price: 0, features: [] });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subsRes, tiersRes, provRes] = await Promise.all([
        apiFetch('/subscriptions/'),
        apiFetch('/subscriptions/tiers'),
        apiFetch('/providers/')
      ]);
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (tiersRes.ok) setTiers(await tiersRes.json());
      if (provRes.ok) setProviders(await provRes.json());
    } catch (e) {
      console.error("Failed to fetch subscription data", e);
    }
  };

  const handleParseEmail = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/subscriptions/parse-email', {
        method: 'POST',
        body: JSON.stringify({ email_text: emailText }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();
      setParseResult(data.parsed_data);
    } catch (e) {
      console.error(e);
      alert("Parse failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveParsedSub = async () => {
    if (!parseResult) return;
    try {
      const payload = {
        provider_id: providers[0]?.id || 1, // Fallback
        ...parseResult
      };
      const res = await apiFetch('/subscriptions/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      alert("Saved successfully!");
      fetchData();
      setParseResult(null);
      setEmailText('');
    } catch (e) {
      console.error(e);
      alert("Failed to save parsed subscription.");
    }
  };

  // Tier CRUD
  const handleCreateTier = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/subscriptions/tiers', {
        method: 'POST',
        body: JSON.stringify({
          ...newTier,
          provider_id: parseInt(newTier.provider_id)
        }),
      });
      if (!res.ok) throw new Error('Create tier failed');
      setNewTier({ provider_id: '', name: '', level: 0, price: 0, features: [] });
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Create tier failed.");
    }
  };

  const handleDeleteTier = async (id) => {
    try {
      await apiFetch(`/subscriptions/tiers/${id}`, { method: 'DELETE' });
      fetchData();
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Subscription &amp; Trial Manager</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Email Parser */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Import from Email</h2>
          <p className="text-sm text-gray-600 mb-2">Paste your subscription confirmation email below.</p>
          <textarea
            className="w-full border p-2 rounded mb-2"
            rows="5"
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder="Paste email content here..."
          ></textarea>
          <button 
            className="bg-blue-600 text-white px-4 py-2 rounded" 
            onClick={handleParseEmail}
            disabled={loading}
          >
            {loading ? "Parsing..." : "Parse Email"}
          </button>
          
          {parseResult && (
            <div className="mt-4 p-4 border rounded bg-gray-50">
              <h3 className="font-semibold mb-2">Detected Data:</h3>
              <pre className="text-xs mb-2">{JSON.stringify(parseResult, null, 2)}</pre>
              <button 
                className="bg-green-600 text-white px-4 py-2 rounded text-sm"
                onClick={handleSaveParsedSub}
              >
                Save as Subscription
              </button>
            </div>
          )}
        </div>

        {/* Trial Manager */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Active Trials &amp; Subscriptions</h2>
          <div className="space-y-2">
            {subscriptions.length === 0 ? <p className="text-gray-500">No subscriptions found.</p> : null}
            {subscriptions.map(sub => (
              <div key={sub.id} className="border p-2 rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">Provider ID: {sub.provider_id}</div>
                  <div className="text-xs text-gray-600">
                    Biller: {sub.biller || 'Unknown'} | Cost: ${sub.cost} | Cycle: {sub.billing_cycle}
                  </div>
                  {sub.is_trial && (
                    <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mt-1">Trial</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tiers CRUD */}
        <div className="bg-white p-4 rounded shadow md:col-span-2">
          <h2 className="text-xl font-semibold mb-2">Subscription Tiers</h2>
          <form onSubmit={handleCreateTier} className="mb-4 flex gap-2">
            <select 
              className="border p-2 rounded"
              required
              value={newTier.provider_id}
              onChange={e => setNewTier({...newTier, provider_id: e.target.value})}
            >
              <option value="">Select Provider</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input 
              type="text" placeholder="Tier Name" className="border p-2 rounded" required
              value={newTier.name} onChange={e => setNewTier({...newTier, name: e.target.value})}
            />
            <input 
              type="number" placeholder="Price" className="border p-2 rounded w-24"
              value={newTier.price} onChange={e => setNewTier({...newTier, price: parseFloat(e.target.value)})}
            />
            <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded">Add Tier</button>
          </form>

          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Provider</th>
                <th className="p-2">Name</th>
                <th className="p-2">Price</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map(tier => (
                <tr key={tier.id} className="border-b">
                  <td className="p-2">{providers.find(p => p.id === tier.provider_id)?.name || tier.provider_id}</td>
                  <td className="p-2">{tier.name}</td>
                  <td className="p-2">${tier.price}</td>
                  <td className="p-2">
                    <button className="text-red-500 hover:underline text-sm" onClick={() => handleDeleteTier(tier.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
      </div>
    </div>
  );
}

export default SubscriptionManager;
