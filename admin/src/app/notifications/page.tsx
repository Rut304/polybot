'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Save,
  TestTube2,
  Settings,
  Webhook,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface NotificationSettings {
  discord_webhook: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  notifications_enabled: boolean;
  notify_on_opportunity: boolean;
  notify_on_trade: boolean;
  notify_on_error: boolean;
  notify_daily_summary: boolean;
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    discord_webhook: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    notifications_enabled: true,
    notify_on_opportunity: true,
    notify_on_trade: true,
    notify_on_error: true,
    notify_daily_summary: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'discord' | 'telegram' | null>(null);
  const [testResult, setTestResult] = useState<{ channel: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Fetch notification settings from config (single-row table with columns)
      const { data, error } = await supabase
        .from('polybot_config')
        .select('discord_webhook, telegram_bot_token, telegram_chat_id, notifications_enabled, notify_on_opportunity, notify_on_trade, notify_on_error, notify_daily_summary')
        .limit(1)
        .single();

      if (!error && data) {
        setSettings({
          discord_webhook: data.discord_webhook || '',
          telegram_bot_token: data.telegram_bot_token || '',
          telegram_chat_id: data.telegram_chat_id || '',
          notifications_enabled: data.notifications_enabled ?? false,
          notify_on_opportunity: data.notify_on_opportunity ?? true,
          notify_on_trade: data.notify_on_trade ?? true,
          notify_on_error: data.notify_on_error ?? true,
          notify_daily_summary: data.notify_daily_summary ?? true,
        });
      } else if (error) {
        // Columns may not exist yet - use defaults
        console.log('Notification columns may not exist yet, using defaults');
      }
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save settings to config table (single-row table with columns)
      const { error } = await supabase
        .from('polybot_config')
        .update({
          discord_webhook: settings.discord_webhook,
          telegram_bot_token: settings.telegram_bot_token,
          telegram_chat_id: settings.telegram_chat_id,
          notifications_enabled: settings.notifications_enabled,
          notify_on_opportunity: settings.notify_on_opportunity,
          notify_on_trade: settings.notify_on_trade,
          notify_on_error: settings.notify_on_error,
          notify_daily_summary: settings.notify_daily_summary,
        })
        .eq('id', 1);

      if (error) throw error;
      setTestResult({ channel: 'save', success: true, message: 'Settings saved successfully!' });
    } catch (err) {
      console.error('Error saving settings:', err);
      setTestResult({ channel: 'save', success: false, message: 'Failed to save settings. Notification columns may need to be added to database.' });
    } finally {
      setSaving(false);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const handleTestDiscord = async () => {
    if (!settings.discord_webhook) {
      setTestResult({ channel: 'discord', success: false, message: 'Discord webhook URL is required' });
      return;
    }

    setTesting('discord');
    try {
      const response = await fetch(settings.discord_webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🤖 PolyBot Test',
            description: 'Discord notifications are working correctly!',
            color: 0x00FF00,
            footer: { text: 'PolyBot Notification System' },
            timestamp: new Date().toISOString(),
          }],
        }),
      });

      if (response.ok) {
        setTestResult({ channel: 'discord', success: true, message: 'Discord test message sent!' });
      } else {
        setTestResult({ channel: 'discord', success: false, message: 'Failed to send Discord message' });
      }
    } catch (err) {
      setTestResult({ channel: 'discord', success: false, message: 'Error sending Discord message' });
    } finally {
      setTesting(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleTestTelegram = async () => {
    if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
      setTestResult({ channel: 'telegram', success: false, message: 'Bot token and chat ID are required' });
      return;
    }

    setTesting('telegram');
    try {
      const url = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegram_chat_id,
          text: '🤖 *PolyBot Test*\n\nTelegram notifications are working correctly!',
          parse_mode: 'Markdown',
        }),
      });

      if (response.ok) {
        setTestResult({ channel: 'telegram', success: true, message: 'Telegram test message sent!' });
      } else {
        setTestResult({ channel: 'telegram', success: false, message: 'Failed to send Telegram message' });
      }
    } catch (err) {
      setTestResult({ channel: 'telegram', success: false, message: 'Error sending Telegram message' });
    } finally {
      setTesting(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="text-yellow-400" />
            Notifications
          </h1>
          <p className="text-gray-400 mt-1">
            Configure Discord and Telegram alerts for trading events
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg flex items-center gap-3 ${testResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
            }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <span className={testResult.success ? 'text-green-400' : 'text-red-400'}>
            {testResult.message}
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discord Settings */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold">Discord</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Webhook URL
              </label>
              <input
                type="text"
                value={settings.discord_webhook}
                onChange={(e) => setSettings({ ...settings, discord_webhook: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Create a webhook in your Discord server settings → Integrations → Webhooks
              </p>
            </div>

            <button
              onClick={handleTestDiscord}
              disabled={testing === 'discord' || !settings.discord_webhook}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {testing === 'discord' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube2 className="w-4 h-4" />
              )}
              Test Discord
            </button>
          </div>
        </motion.div>

        {/* Telegram Settings */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold">Telegram</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Bot Token
              </label>
              <input
                type="password"
                value={settings.telegram_bot_token}
                onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                placeholder="123456:ABC-DEF..."
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get from @BotFather on Telegram
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Chat ID
              </label>
              <input
                type="text"
                value={settings.telegram_chat_id}
                onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                placeholder="-100123456789"
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get from @userinfobot or use your user/group ID
              </p>
            </div>

            <button
              onClick={handleTestTelegram}
              disabled={testing === 'telegram' || !settings.telegram_bot_token || !settings.telegram_chat_id}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {testing === 'telegram' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube2 className="w-4 h-4" />
              )}
              Test Telegram
            </button>
          </div>
        </motion.div>
      </div>

      {/* Notification Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <Settings className="w-5 h-5 text-yellow-400" />
          </div>
          <h2 className="text-xl font-semibold">Notification Preferences</h2>
        </div>

        <div className="space-y-4">
          {/* Master toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div>
              <p className="font-medium">Enable Notifications</p>
              <p className="text-sm text-gray-400">Master switch for all notifications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications_enabled}
                onChange={(e) => setSettings({ ...settings, notifications_enabled: e.target.checked })}
                className="sr-only peer"
                aria-label="Enable notifications"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opportunity alerts */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-medium">Opportunity Alerts</p>
                  <p className="text-sm text-gray-400">When arbitrage detected</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notify_on_opportunity}
                  onChange={(e) => setSettings({ ...settings, notify_on_opportunity: e.target.checked })}
                  className="sr-only peer"
                  disabled={!settings.notifications_enabled}
                  aria-label="Opportunity alerts"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Trade alerts */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="font-medium">Trade Alerts</p>
                  <p className="text-sm text-gray-400">When trades execute</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notify_on_trade}
                  onChange={(e) => setSettings({ ...settings, notify_on_trade: e.target.checked })}
                  className="sr-only peer"
                  disabled={!settings.notifications_enabled}
                  aria-label="Trade alerts"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Error alerts */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="font-medium">Error Alerts</p>
                  <p className="text-sm text-gray-400">When errors occur</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notify_on_error}
                  onChange={(e) => setSettings({ ...settings, notify_on_error: e.target.checked })}
                  className="sr-only peer"
                  disabled={!settings.notifications_enabled}
                  aria-label="Error alerts"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Daily summary */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="font-medium">Daily Summary</p>
                  <p className="text-sm text-gray-400">Daily P&L report</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notify_daily_summary}
                  onChange={(e) => setSettings({ ...settings, notify_daily_summary: e.target.checked })}
                  className="sr-only peer"
                  disabled={!settings.notifications_enabled}
                  aria-label="Daily summary"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
              </label>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Help Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card bg-gradient-to-br from-gray-800 to-gray-900"
      >
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Webhook className="w-4 h-4" />
          Setup Guide
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-400">
          <div>
            <h4 className="text-white font-medium mb-2">Discord Setup</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your Discord server settings</li>
              <li>Go to Integrations → Webhooks</li>
              <li>Click &quot;New Webhook&quot;</li>
              <li>Choose a channel and copy the URL</li>
              <li>Paste the URL above</li>
            </ol>
          </div>

          <div>
            <h4 className="text-white font-medium mb-2">Telegram Setup</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Message @BotFather on Telegram</li>
              <li>Send /newbot and follow prompts</li>
              <li>Copy the bot token</li>
              <li>Message your bot then @userinfobot</li>
              <li>Get your Chat ID from userinfobot</li>
            </ol>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
