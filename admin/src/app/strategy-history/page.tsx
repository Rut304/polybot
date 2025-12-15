'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ConfigChange {
  id: number;
  created_at: string;
  changed_by: string;
  change_type: string;
  parameter_name: string;
  old_value: string | null;
  new_value: string;
  reason: string | null;
  session_label: string;
}

interface NewChange {
  parameter_name: string;
  old_value: string;
  new_value: string;
  reason: string;
  change_type: string;
}

export default function StrategyHistoryPage() {
  const [changes, setChanges] = useState<ConfigChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChange, setNewChange] = useState<NewChange>({
    parameter_name: '',
    old_value: '',
    new_value: '',
    reason: '',
    change_type: 'manual'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchChanges();
  }, [filter]);

  async function fetchChanges() {
    setLoading(true);
    try {
      let query = supabase
        .from('polybot_config_history')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter !== 'all') {
        query = query.eq('change_type', filter);
      }

      const { data, error } = await query.limit(200);

      if (error) {
        console.error('Error fetching config history:', error);
        // If table doesn't exist yet, show empty
        setChanges([]);
      } else {
        setChanges(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setChanges([]);
    }
    setLoading(false);
  }

  async function addChange() {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('polybot_config_history')
        .insert([{
          ...newChange,
          changed_by: 'admin_ui',
          session_label: 'v1'
        }]);

      if (error) throw error;

      setShowAddForm(false);
      setNewChange({
        parameter_name: '',
        old_value: '',
        new_value: '',
        reason: '',
        change_type: 'manual'
      });
      fetchChanges();
    } catch (err) {
      console.error('Error adding change:', err);
      alert('Failed to add change');
    }
    setSubmitting(false);
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function getChangeTypeColor(type: string) {
    switch (type) {
      case 'manual': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'auto_tune': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'ai_recommendation': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'reset': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }

  function getChangeTypeIcon(type: string) {
    switch (type) {
      case 'manual': return '✏️';
      case 'auto_tune': return '⚙️';
      case 'ai_recommendation': return '🤖';
      case 'reset': return '🔄';
      default: return '📝';
    }
  }

  // Group changes by date
  const groupedChanges: Record<string, ConfigChange[]> = {};
  changes.forEach(change => {
    const date = new Date(change.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    if (!groupedChanges[date]) {
      groupedChanges[date] = [];
    }
    groupedChanges[date].push(change);
  });

  // Common parameter options for the dropdown
  const commonParameters = [
    'poly_single_max_position_usd',
    'kalshi_single_max_position_usd',
    'cross_plat_max_position_usd',
    'polymarket_starting_balance',
    'kalshi_starting_balance',
    'poly_single_min_profit_pct',
    'kalshi_single_min_profit_pct',
    'poly_single_max_spread_pct',
    'kalshi_single_max_spread_pct',
    'execution_failure_rate',
    'resolution_loss_rate',
    'max_concurrent_positions',
    'enable_polymarket_single_arb',
    'enable_kalshi_single_arb',
    'enable_cross_platform_arb',
    'enable_news_arbitrage'
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">📊</span>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Strategy Change History
          </h1>
        </div>
        <p className="text-gray-400">Track all configuration changes with timestamps and reasons</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
        >
          <option value="all">All Changes</option>
          <option value="manual">Manual Changes</option>
          <option value="auto_tune">Auto-Tune</option>
          <option value="ai_recommendation">AI Recommendations</option>
          <option value="reset">Resets</option>
        </select>

        {/* Add New Change */}
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <span>➕</span> Log New Change
        </button>

        {/* Refresh */}
        <button
          onClick={fetchChanges}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-white">{changes.length}</div>
          <div className="text-gray-400 text-sm">Total Changes</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-blue-500/30">
          <div className="text-3xl font-bold text-blue-400">
            {changes.filter(c => c.change_type === 'manual').length}
          </div>
          <div className="text-gray-400 text-sm">Manual Changes</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-green-500/30">
          <div className="text-3xl font-bold text-green-400">
            {changes.filter(c => c.change_type === 'ai_recommendation').length}
          </div>
          <div className="text-gray-400 text-sm">AI Recommendations</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-purple-500/30">
          <div className="text-3xl font-bold text-purple-400">
            {changes.filter(c => c.change_type === 'auto_tune').length}
          </div>
          <div className="text-gray-400 text-sm">Auto-Tuned</div>
        </div>
      </div>

      {/* Add Change Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Log Strategy Change</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Parameter</label>
                <select
                  value={newChange.parameter_name}
                  onChange={(e) => setNewChange({...newChange, parameter_name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                >
                  <option value="">Select parameter...</option>
                  {commonParameters.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
                {newChange.parameter_name === 'custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom parameter name"
                    onChange={(e) => setNewChange({...newChange, parameter_name: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 mt-2"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Old Value</label>
                  <input
                    type="text"
                    value={newChange.old_value}
                    onChange={(e) => setNewChange({...newChange, old_value: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                    placeholder="e.g., 30"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Value</label>
                  <input
                    type="text"
                    value={newChange.new_value}
                    onChange={(e) => setNewChange({...newChange, new_value: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                    placeholder="e.g., 50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Change Type</label>
                <select
                  value={newChange.change_type}
                  onChange={(e) => setNewChange({...newChange, change_type: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                >
                  <option value="manual">Manual Change</option>
                  <option value="ai_recommendation">AI Recommendation</option>
                  <option value="auto_tune">Auto-Tune</option>
                  <option value="reset">Reset</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Reason</label>
                <textarea
                  value={newChange.reason}
                  onChange={(e) => setNewChange({...newChange, reason: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 h-20"
                  placeholder="Why was this change made?"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={addChange}
                disabled={submitting || !newChange.parameter_name || !newChange.new_value}
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading history...</div>
        </div>
      ) : changes.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-8 text-center border border-gray-800">
          <span className="text-5xl mb-4 block">📋</span>
          <h3 className="text-xl font-semibold mb-2">No Changes Recorded Yet</h3>
          <p className="text-gray-400 mb-4">
            Run the SQL migration script to set up tracking, or manually log changes.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            Log First Change
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedChanges).map(([date, dayChanges]) => (
            <div key={date}>
              <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <span className="text-blue-400">📅</span>
                {date}
                <span className="text-sm text-gray-500 font-normal">
                  ({dayChanges.length} {dayChanges.length === 1 ? 'change' : 'changes'})
                </span>
              </h3>
              
              <div className="space-y-3">
                {dayChanges.map((change) => (
                  <div
                    key={change.id}
                    className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs border ${getChangeTypeColor(change.change_type)}`}>
                            {getChangeTypeIcon(change.change_type)} {change.change_type.replace('_', ' ')}
                          </span>
                          <code className="text-sm bg-gray-800 px-2 py-1 rounded text-yellow-400">
                            {change.parameter_name}
                          </code>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span className="text-red-400 bg-red-500/10 px-2 py-1 rounded">
                            {change.old_value || 'null'}
                          </span>
                          <span className="text-gray-500">→</span>
                          <span className="text-green-400 bg-green-500/10 px-2 py-1 rounded">
                            {change.new_value}
                          </span>
                        </div>

                        {change.reason && (
                          <p className="text-gray-400 text-sm mt-2">
                            💬 {change.reason}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right text-sm text-gray-500">
                        <div>{formatDate(change.created_at)}</div>
                        <div className="text-xs">{change.changed_by}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Reference */}
      <div className="mt-12 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>💡</span> Current Config Quick Reference
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400">Position Size</div>
            <div className="text-white font-medium">$50</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400">Per Platform</div>
            <div className="text-white font-medium">$3,000</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400">Total Bankroll</div>
            <div className="text-white font-medium">$15,000</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400">Strategies</div>
            <div className="text-white font-medium">All Enabled</div>
          </div>
        </div>
      </div>
    </div>
  );
}
