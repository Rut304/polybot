import { Resend } from 'resend';

// Lazy-initialize Resend client
let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'PolyBot <noreply@polyparlay.io>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@polyparlay.io';

// ============================================================================
// Email Types
// ============================================================================

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ============================================================================
// Core Email Sending Function
// ============================================================================

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const resendClient = getResend();
  if (!resendClient) {
    console.error('RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || SUPPORT_EMAIL,
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Email sent: ${data?.id} to ${options.to}`);
    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('Email send exception:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ============================================================================
// Email Templates
// ============================================================================

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PolyBot</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0a0a0a;
      color: #e5e5e5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #00ff88;
    }
    .logo-sub {
      color: #666;
      font-size: 14px;
      margin-top: 4px;
    }
    .card {
      background: linear-gradient(145deg, #1a1a1a, #0d0d0d);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 24px;
    }
    h1 {
      color: #ffffff;
      font-size: 24px;
      margin: 0 0 16px 0;
    }
    p {
      color: #a3a3a3;
      line-height: 1.6;
      margin: 0 0 16px 0;
    }
    .highlight {
      color: #00ff88;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #00ff88, #00cc6a);
      color: #000000 !important;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin: 16px 0;
    }
    .button:hover {
      background: linear-gradient(135deg, #00cc6a, #00ff88);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 24px 0;
    }
    .stat-box {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #00ff88;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #333;
    }
    .footer a {
      color: #00ff88;
      text-decoration: none;
    }
    .code {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 32px;
      text-align: center;
      letter-spacing: 8px;
      color: #00ff88;
      margin: 24px 0;
    }
    .alert {
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .alert-title {
      color: #ff4444;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .success {
      background: rgba(0, 255, 136, 0.1);
      border: 1px solid rgba(0, 255, 136, 0.3);
    }
    .success .alert-title {
      color: #00ff88;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🤖 PolyBot</div>
      <div class="logo-sub">Automated Trading Intelligence</div>
    </div>
    ${content}
    <div class="footer">
      <p>© ${new Date().getFullYear()} PolyBot by <a href="https://polyparlay.io">PolyParlay</a></p>
      <p>
        <a href="https://polyparlay.io">Website</a> · 
        <a href="https://app.polyparlay.io">Dashboard</a> · 
        <a href="mailto:support@polyparlay.io">Support</a>
      </p>
      <p style="margin-top: 16px;">
        You're receiving this email because you have an account with PolyBot.<br>
        <a href="https://app.polyparlay.io/settings">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================================
// Welcome Email
// ============================================================================

export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<EmailResult> {
  const html = baseTemplate(`
    <div class="card">
      <h1>Welcome to PolyBot, ${name}! 🎉</h1>
      <p>
        Your account has been created and you're ready to start automated trading.
      </p>
      <p>
        PolyBot connects to multiple prediction markets and exchanges to help you
        find and execute profitable trading opportunities.
      </p>
      <a href="https://app.polyparlay.io/dashboard" class="button">
        Go to Dashboard →
      </a>
    </div>

    <div class="card">
      <h1>Get Started</h1>
      <p><strong>Step 1:</strong> Connect your trading accounts</p>
      <p>Link your Polymarket, Kalshi, Alpaca, or crypto exchange accounts.</p>
      
      <p><strong>Step 2:</strong> Configure your strategies</p>
      <p>Set up arbitrage, sentiment trading, or other automated strategies.</p>
      
      <p><strong>Step 3:</strong> Start trading</p>
      <p>Enable simulation mode first, then go live when you're ready!</p>
    </div>
  `);

  return sendEmail({
    to,
    subject: 'Welcome to PolyBot - Your Trading Bot Awaits! 🤖',
    html,
    text: `Welcome to PolyBot, ${name}!\n\nYour account has been created. Visit https://app.polyparlay.io to get started.`,
  });
}

// ============================================================================
// Magic Link / Login Email
// ============================================================================

export async function sendMagicLinkEmail(
  to: string,
  magicLink: string,
  expiresIn: string = '15 minutes'
): Promise<EmailResult> {
  const html = baseTemplate(`
    <div class="card">
      <h1>Sign in to PolyBot</h1>
      <p>
        Click the button below to sign in to your account. This link will expire in ${expiresIn}.
      </p>
      <a href="${magicLink}" class="button">
        Sign In →
      </a>
      <p style="font-size: 12px; color: #666; margin-top: 24px;">
        If you didn't request this email, you can safely ignore it.
      </p>
    </div>
  `);

  return sendEmail({
    to,
    subject: 'Sign in to PolyBot',
    html,
    text: `Sign in to PolyBot:\n\n${magicLink}\n\nThis link expires in ${expiresIn}.`,
  });
}

// ============================================================================
// Verification Code Email
// ============================================================================

export async function sendVerificationCodeEmail(
  to: string,
  code: string,
  expiresIn: string = '10 minutes'
): Promise<EmailResult> {
  const html = baseTemplate(`
    <div class="card">
      <h1>Verification Code</h1>
      <p>
        Enter this code to verify your identity. It expires in ${expiresIn}.
      </p>
      <div class="code">${code}</div>
      <p style="font-size: 12px; color: #666;">
        If you didn't request this code, please change your password immediately.
      </p>
    </div>
  `);

  return sendEmail({
    to,
    subject: `Your PolyBot verification code: ${code}`,
    html,
    text: `Your PolyBot verification code is: ${code}\n\nThis code expires in ${expiresIn}.`,
  });
}

// ============================================================================
// Password Reset Email
// ============================================================================

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  expiresIn: string = '1 hour'
): Promise<EmailResult> {
  const html = baseTemplate(`
    <div class="card">
      <h1>Reset Your Password</h1>
      <p>
        We received a request to reset your password. Click the button below to create a new password.
      </p>
      <a href="${resetLink}" class="button">
        Reset Password →
      </a>
      <p style="font-size: 12px; color: #666; margin-top: 24px;">
        This link expires in ${expiresIn}. If you didn't request a password reset, you can ignore this email.
      </p>
    </div>
  `);

  return sendEmail({
    to,
    subject: 'Reset your PolyBot password',
    html,
    text: `Reset your PolyBot password:\n\n${resetLink}\n\nThis link expires in ${expiresIn}.`,
  });
}

// ============================================================================
// Trade Alert Email
// ============================================================================

export interface TradeAlertData {
  action: 'BUY' | 'SELL';
  market: string;
  position: string;
  amount: string;
  price: string;
  profit?: string;
  strategy: string;
  timestamp: string;
}

export async function sendTradeAlertEmail(
  to: string,
  trade: TradeAlertData
): Promise<EmailResult> {
  const isProfitable = trade.profit && parseFloat(trade.profit) > 0;
  
  const html = baseTemplate(`
    <div class="card">
      <h1>${trade.action === 'BUY' ? '🟢' : '🔴'} Trade Executed</h1>
      <div class="alert ${isProfitable ? 'success' : ''}">
        <div class="alert-title">${trade.action} ${trade.position}</div>
        <p style="margin: 0;">
          <strong>Market:</strong> ${trade.market}<br>
          <strong>Amount:</strong> ${trade.amount}<br>
          <strong>Price:</strong> ${trade.price}<br>
          ${trade.profit ? `<strong>P/L:</strong> ${trade.profit}<br>` : ''}
          <strong>Strategy:</strong> ${trade.strategy}
        </p>
      </div>
      <p style="font-size: 12px; color: #666;">
        Executed at ${trade.timestamp}
      </p>
      <a href="https://app.polyparlay.io/trades" class="button">
        View Trade History →
      </a>
    </div>
  `);

  return sendEmail({
    to,
    subject: `${trade.action === 'BUY' ? '🟢' : '🔴'} Trade Alert: ${trade.action} ${trade.position}`,
    html,
    text: `Trade Alert\n\n${trade.action} ${trade.position}\nMarket: ${trade.market}\nAmount: ${trade.amount}\nPrice: ${trade.price}\n${trade.profit ? `P/L: ${trade.profit}\n` : ''}Strategy: ${trade.strategy}\n\nTime: ${trade.timestamp}`,
  });
}

// ============================================================================
// Daily Summary Email
// ============================================================================

export interface DailySummaryData {
  date: string;
  totalTrades: number;
  winRate: number;
  totalProfitLoss: string;
  topWinningTrade?: string;
  topLosingTrade?: string;
  activeStrategies: string[];
  accountBalance: string;
}

export async function sendDailySummaryEmail(
  to: string,
  summary: DailySummaryData
): Promise<EmailResult> {
  const isProfit = parseFloat(summary.totalProfitLoss.replace(/[^0-9.-]/g, '')) >= 0;
  
  const html = baseTemplate(`
    <div class="card">
      <h1>📊 Daily Trading Summary</h1>
      <p style="color: #666;">${summary.date}</p>
      
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${summary.totalTrades}</div>
          <div class="stat-label">Total Trades</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${summary.winRate}%</div>
          <div class="stat-label">Win Rate</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: ${isProfit ? '#00ff88' : '#ff4444'}">
            ${summary.totalProfitLoss}
          </div>
          <div class="stat-label">P/L</div>
        </div>
      </div>

      ${summary.topWinningTrade ? `
        <div class="alert success">
          <div class="alert-title">🏆 Top Winner</div>
          <p style="margin: 0;">${summary.topWinningTrade}</p>
        </div>
      ` : ''}

      ${summary.topLosingTrade ? `
        <div class="alert">
          <div class="alert-title">📉 Biggest Loss</div>
          <p style="margin: 0;">${summary.topLosingTrade}</p>
        </div>
      ` : ''}

      <p>
        <strong>Active Strategies:</strong> ${summary.activeStrategies.join(', ') || 'None'}<br>
        <strong>Account Balance:</strong> ${summary.accountBalance}
      </p>

      <a href="https://app.polyparlay.io/dashboard" class="button">
        View Full Report →
      </a>
    </div>
  `);

  return sendEmail({
    to,
    subject: `📊 PolyBot Daily Summary: ${isProfit ? '+' : ''}${summary.totalProfitLoss}`,
    html,
    text: `Daily Trading Summary - ${summary.date}\n\nTrades: ${summary.totalTrades}\nWin Rate: ${summary.winRate}%\nP/L: ${summary.totalProfitLoss}\n\nBalance: ${summary.accountBalance}`,
  });
}

// ============================================================================
// Alert/Warning Emails
// ============================================================================

export interface AlertData {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  actionUrl?: string;
  actionText?: string;
}

export async function sendAlertEmail(
  to: string,
  alert: AlertData
): Promise<EmailResult> {
  const severityColors = {
    info: '#3b82f6',
    warning: '#f59e0b',
    error: '#ef4444',
    critical: '#dc2626',
  };

  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };

  const html = baseTemplate(`
    <div class="card">
      <h1>${severityEmoji[alert.severity]} ${alert.title}</h1>
      <div class="alert" style="border-color: ${severityColors[alert.severity]};">
        <p style="margin: 0;">${alert.message}</p>
      </div>
      ${alert.actionUrl ? `
        <a href="${alert.actionUrl}" class="button">
          ${alert.actionText || 'Take Action'} →
        </a>
      ` : ''}
    </div>
  `);

  return sendEmail({
    to,
    subject: `${severityEmoji[alert.severity]} PolyBot Alert: ${alert.title}`,
    html,
    text: `${alert.title}\n\n${alert.message}${alert.actionUrl ? `\n\n${alert.actionText || 'Take Action'}: ${alert.actionUrl}` : ''}`,
  });
}

// ============================================================================
// Subscription/Billing Emails
// ============================================================================

export async function sendSubscriptionActivatedEmail(
  to: string,
  plan: string,
  amount: string,
  nextBillingDate: string
): Promise<EmailResult> {
  const html = baseTemplate(`
    <div class="card">
      <h1>🎉 Subscription Activated!</h1>
      <p>
        Thank you for subscribing to PolyBot <span class="highlight">${plan}</span>!
      </p>
      <div class="alert success">
        <div class="alert-title">Subscription Details</div>
        <p style="margin: 0;">
          <strong>Plan:</strong> ${plan}<br>
          <strong>Amount:</strong> ${amount}/month<br>
          <strong>Next Billing:</strong> ${nextBillingDate}
        </p>
      </div>
      <p>
        You now have access to all ${plan} features. Time to supercharge your trading!
      </p>
      <a href="https://app.polyparlay.io/dashboard" class="button">
        Start Trading →
      </a>
    </div>
  `);

  return sendEmail({
    to,
    subject: `🎉 Welcome to PolyBot ${plan}!`,
    html,
    text: `Subscription Activated!\n\nPlan: ${plan}\nAmount: ${amount}/month\nNext Billing: ${nextBillingDate}\n\nThank you for subscribing!`,
  });
}

export async function sendPaymentFailedEmail(
  to: string,
  amount: string,
  retryDate: string
): Promise<EmailResult> {
  const html = baseTemplate(`
    <div class="card">
      <h1>⚠️ Payment Failed</h1>
      <div class="alert">
        <div class="alert-title">Action Required</div>
        <p style="margin: 0;">
          We couldn't process your payment of <strong>${amount}</strong>.
        </p>
      </div>
      <p>
        Please update your payment method to avoid service interruption.
        We'll retry the payment on <strong>${retryDate}</strong>.
      </p>
      <a href="https://app.polyparlay.io/settings/billing" class="button">
        Update Payment Method →
      </a>
    </div>
  `);

  return sendEmail({
    to,
    subject: '⚠️ Action Required: Payment Failed',
    html,
    text: `Payment Failed\n\nWe couldn't process your payment of ${amount}.\n\nPlease update your payment method at https://app.polyparlay.io/settings/billing\n\nWe'll retry on ${retryDate}.`,
  });
}

// ============================================================================
// Batch Email Sending
// ============================================================================

export async function sendBatchEmails(
  emails: SendEmailOptions[]
): Promise<EmailResult[]> {
  const results = await Promise.all(emails.map(sendEmail));
  return results;
}
