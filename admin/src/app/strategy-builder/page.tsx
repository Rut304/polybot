'use client';

import { useState } from 'react';
import { 
  Target, 
  Plus, 
  Play, 
  Save, 
  Trash2, 
  Settings2,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Percent,
  AlertTriangle,
  CheckCircle,
  Code,
  Wand2,
} from 'lucide-react';
import { useTier } from '@/lib/useTier';
import { FeatureGate } from '@/components/FeatureGate';

interface StrategyCondition {
  id: string;
  type: 'price' | 'rsi' | 'volume' | 'time' | 'news';
  operator: 'above' | 'below' | 'equals' | 'between';
  value: number;
  value2?: number; // For 'between' operator
}

interface StrategyAction {
  id: string;
  type: 'buy' | 'sell' | 'alert';
  amount: number;
  amountType: 'percent' | 'fixed';
  platform: 'polymarket' | 'kalshi' | 'both';
}

interface CustomStrategy {
  id: string;
  name: string;
  description: string;
  conditions: StrategyCondition[];
  actions: StrategyAction[];
  isActive: boolean;
  createdAt: string;
}

const CONDITION_TYPES = [
  { value: 'price', label: 'Price Movement', icon: DollarSign },
  { value: 'rsi', label: 'RSI Level', icon: TrendingUp },
  { value: 'volume', label: 'Volume Spike', icon: TrendingDown },
  { value: 'time', label: 'Time Window', icon: Clock },
  { value: 'news', label: 'News Sentiment', icon: AlertTriangle },
];

const OPERATORS = [
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
  { value: 'equals', label: 'Equals' },
  { value: 'between', label: 'Between' },
];

export default function StrategyBuilderPage() {
  const { isElite } = useTier();
  const [strategies, setStrategies] = useState<CustomStrategy[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newStrategy, setNewStrategy] = useState<Partial<CustomStrategy>>({
    name: '',
    description: '',
    conditions: [],
    actions: [],
  });

  const addCondition = () => {
    const condition: StrategyCondition = {
      id: crypto.randomUUID(),
      type: 'price',
      operator: 'above',
      value: 0,
    };
    setNewStrategy(prev => ({
      ...prev,
      conditions: [...(prev.conditions || []), condition],
    }));
  };

  const addAction = () => {
    const action: StrategyAction = {
      id: crypto.randomUUID(),
      type: 'buy',
      amount: 10,
      amountType: 'percent',
      platform: 'polymarket',
    };
    setNewStrategy(prev => ({
      ...prev,
      actions: [...(prev.actions || []), action],
    }));
  };

  const saveStrategy = () => {
    if (!newStrategy.name) return;
    
    const strategy: CustomStrategy = {
      id: crypto.randomUUID(),
      name: newStrategy.name,
      description: newStrategy.description || '',
      conditions: newStrategy.conditions || [],
      actions: newStrategy.actions || [],
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    
    setStrategies(prev => [...prev, strategy]);
    setNewStrategy({ name: '', description: '', conditions: [], actions: [] });
    setIsCreating(false);
  };

  return (
    <FeatureGate requiredTier="elite" feature="Custom Strategy Builder">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Wand2 className="w-6 h-6 text-yellow-400" />
              </div>
              Strategy Builder
            </h1>
            <p className="text-gray-400 mt-1">
              Create custom automated trading strategies with visual rules
            </p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-brand-green text-dark-bg px-4 py-2 rounded-lg font-medium hover:bg-brand-green/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Strategy
          </button>
        </div>

        {/* Strategy Builder Modal/Form */}
        {isCreating && (
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Create New Strategy</h2>
              <button
                onClick={() => setIsCreating(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Strategy Name</label>
                <input
                  type="text"
                  value={newStrategy.name}
                  onChange={(e) => setNewStrategy(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Election Night Scalper"
                  className="w-full bg-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newStrategy.description}
                  onChange={(e) => setNewStrategy(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this strategy does"
                  className="w-full bg-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-500"
                />
              </div>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Conditions (IF)</h3>
                <button
                  onClick={addCondition}
                  className="text-sm text-brand-green hover:text-brand-green/80 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Condition
                </button>
              </div>
              
              {newStrategy.conditions?.length === 0 && (
                <div className="text-center py-8 text-gray-500 border border-dashed border-dark-border rounded-lg">
                  No conditions yet. Add conditions to trigger your strategy.
                </div>
              )}
              
              <div className="space-y-2">
                {newStrategy.conditions?.map((condition, index) => (
                  <div key={condition.id} className="flex items-center gap-3 bg-dark-border/50 rounded-lg p-3">
                    <span className="text-gray-500 text-sm w-8">{index === 0 ? 'IF' : 'AND'}</span>
                    <select
                      value={condition.type}
                      onChange={(e) => {
                        const updated = [...(newStrategy.conditions || [])];
                        updated[index] = { ...condition, type: e.target.value as any };
                        setNewStrategy(prev => ({ ...prev, conditions: updated }));
                      }}
                      className="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white"
                    >
                      {CONDITION_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <select
                      value={condition.operator}
                      onChange={(e) => {
                        const updated = [...(newStrategy.conditions || [])];
                        updated[index] = { ...condition, operator: e.target.value as any };
                        setNewStrategy(prev => ({ ...prev, conditions: updated }));
                      }}
                      className="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white"
                    >
                      {OPERATORS.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={condition.value}
                      onChange={(e) => {
                        const updated = [...(newStrategy.conditions || [])];
                        updated[index] = { ...condition, value: Number(e.target.value) };
                        setNewStrategy(prev => ({ ...prev, conditions: updated }));
                      }}
                      className="w-24 bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white"
                    />
                    <button
                      onClick={() => {
                        setNewStrategy(prev => ({
                          ...prev,
                          conditions: prev.conditions?.filter(c => c.id !== condition.id),
                        }));
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Actions (THEN)</h3>
                <button
                  onClick={addAction}
                  className="text-sm text-brand-green hover:text-brand-green/80 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Action
                </button>
              </div>
              
              {newStrategy.actions?.length === 0 && (
                <div className="text-center py-8 text-gray-500 border border-dashed border-dark-border rounded-lg">
                  No actions yet. Add what should happen when conditions are met.
                </div>
              )}
              
              <div className="space-y-2">
                {newStrategy.actions?.map((action, index) => (
                  <div key={action.id} className="flex items-center gap-3 bg-dark-border/50 rounded-lg p-3">
                    <span className="text-gray-500 text-sm w-12">THEN</span>
                    <select
                      value={action.type}
                      onChange={(e) => {
                        const updated = [...(newStrategy.actions || [])];
                        updated[index] = { ...action, type: e.target.value as any };
                        setNewStrategy(prev => ({ ...prev, actions: updated }));
                      }}
                      className="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white"
                    >
                      <option value="buy">Buy YES</option>
                      <option value="sell">Sell / Buy NO</option>
                      <option value="alert">Send Alert</option>
                    </select>
                    <input
                      type="number"
                      value={action.amount}
                      onChange={(e) => {
                        const updated = [...(newStrategy.actions || [])];
                        updated[index] = { ...action, amount: Number(e.target.value) };
                        setNewStrategy(prev => ({ ...prev, actions: updated }));
                      }}
                      className="w-20 bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white"
                    />
                    <select
                      value={action.amountType}
                      onChange={(e) => {
                        const updated = [...(newStrategy.actions || [])];
                        updated[index] = { ...action, amountType: e.target.value as any };
                        setNewStrategy(prev => ({ ...prev, actions: updated }));
                      }}
                      className="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white"
                    >
                      <option value="percent">% of Balance</option>
                      <option value="fixed">$ Fixed</option>
                    </select>
                    <span className="text-gray-500">on</span>
                    <select
                      value={action.platform}
                      onChange={(e) => {
                        const updated = [...(newStrategy.actions || [])];
                        updated[index] = { ...action, platform: e.target.value as any };
                        setNewStrategy(prev => ({ ...prev, actions: updated }));
                      }}
                      className="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white"
                    >
                      <option value="polymarket">Polymarket</option>
                      <option value="kalshi">Kalshi</option>
                      <option value="both">Both</option>
                    </select>
                    <button
                      onClick={() => {
                        setNewStrategy(prev => ({
                          ...prev,
                          actions: prev.actions?.filter(a => a.id !== action.id),
                        }));
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveStrategy}
                disabled={!newStrategy.name || !newStrategy.conditions?.length || !newStrategy.actions?.length}
                className="flex items-center gap-2 bg-brand-green text-dark-bg px-4 py-2 rounded-lg font-medium hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Strategy
              </button>
            </div>
          </div>
        )}

        {/* Saved Strategies */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Strategies</h2>
          
          {strategies.length === 0 && !isCreating && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-dark-border rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-white font-medium mb-2">No Custom Strategies Yet</h3>
              <p className="text-gray-400 mb-4">
                Create your first custom strategy to automate your trading based on your own rules.
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 bg-brand-green text-dark-bg px-4 py-2 rounded-lg font-medium hover:bg-brand-green/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Strategy
              </button>
            </div>
          )}

          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className="bg-dark-card border border-dark-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{strategy.name}</h3>
                  <p className="text-gray-400 text-sm">{strategy.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${strategy.isActive ? 'bg-brand-green/20 text-brand-green' : 'bg-gray-700 text-gray-400'}`}>
                    {strategy.isActive ? 'Active' : 'Paused'}
                  </span>
                  <button className="p-2 hover:bg-dark-border rounded-lg transition-colors">
                    <Play className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-2 hover:bg-dark-border rounded-lg transition-colors">
                    <Settings2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <span>{strategy.conditions.length} conditions</span>
                <span>•</span>
                <span>{strategy.actions.length} actions</span>
                <span>•</span>
                <span>Created {new Date(strategy.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon Features */}
        <div className="bg-dark-card/50 border border-dark-border rounded-xl p-6">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Code className="w-4 h-4 text-neon-blue" />
            Coming Soon
          </h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-gray-600" />
              Import/Export strategies as JSON
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-gray-600" />
              Backtest strategies on historical data
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-gray-600" />
              Share strategies with other Elite users
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-gray-600" />
              Python code editor for advanced users
            </li>
          </ul>
        </div>
      </div>
    </FeatureGate>
  );
}
