import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAwsSecrets } from '@/lib/aws-secrets';

export const dynamic = 'force-dynamic';

// Create Supabase admin client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

/**
 * Kalshi API helper for selling positions
 */
async function sellKalshiPosition(
  ticker: string,
  side: 'yes' | 'no',
  contracts: number,
  priceCents: number,
  apiKey: string,
  privateKey: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Create authentication signature
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = '/trade-api/v2/portfolio/orders';
    const method = 'POST';
    
    // Import crypto for signing
    const crypto = await import('crypto');
    const signaturePayload = timestamp + method + path;
    
    // Parse the private key and create signature
    const key = crypto.createPrivateKey({
      key: privateKey,
      format: 'pem',
    });
    
    const signatureBuffer = crypto.sign('sha256', new Uint8Array(Buffer.from(signaturePayload)), {
      key,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });
    
    const signatureBase64 = signatureBuffer.toString('base64');
    
    // Build order payload - SELL action
    const orderPayload = {
      ticker,
      side: side.toLowerCase(),
      action: 'sell',  // SELL to close position
      count: contracts,
      type: 'limit',
      time_in_force: 'good_till_canceled',
      [side.toLowerCase() === 'yes' ? 'yes_price' : 'no_price']: priceCents,
    };
    
    const response = await fetch('https://api.elections.kalshi.com/trade-api/v2/portfolio/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'KALSHI-ACCESS-KEY': apiKey,
        'KALSHI-ACCESS-SIGNATURE': signatureBase64,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
      },
      body: JSON.stringify(orderPayload),
    });
    
    if (response.status === 201) {
      const data = await response.json();
      return { success: true, data: data.order };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: `Kalshi API error ${response.status}: ${JSON.stringify(errorData)}` 
      };
    }
  } catch (error) {
    console.error('Kalshi sell error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get current market price from Kalshi
 */
async function getKalshiMarketPrice(ticker: string): Promise<{ 
  yesBid: number; 
  yesAsk: number; 
  noBid: number; 
  noAsk: number;
} | null> {
  try {
    const response = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets/${ticker}`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (response.ok) {
      const data = await response.json();
      const market = data.market;
      return {
        yesBid: market.yes_bid || 0,
        yesAsk: market.yes_ask || 0,
        noBid: 100 - (market.yes_ask || 0),  // NO bid = 100 - YES ask
        noAsk: 100 - (market.yes_bid || 0),  // NO ask = 100 - YES bid
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching Kalshi market:', error);
    return null;
  }
}

/**
 * POST /api/positions/sell
 * Sell/close a position
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { positionId, ticker, side, contracts, priceCents, platform } = body;
    
    if (!positionId || !ticker || !side || !contracts) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: positionId, ticker, side, contracts',
      }, { status: 400 });
    }
    
    // Get API credentials from AWS Secrets Manager
    const secrets = await getAwsSecrets();
    
    if (platform?.toLowerCase() === 'kalshi') {
      const apiKey = secrets['kalshi_api_key'] || secrets['KALSHI_API_KEY'];
      const privateKey = secrets['kalshi_private_key'] || secrets['KALSHI_PRIVATE_KEY'];
      
      if (!apiKey || !privateKey) {
        return NextResponse.json({
          success: false,
          error: 'Kalshi API credentials not configured',
        }, { status: 500 });
      }
      
      // Execute the sell order
      const result = await sellKalshiPosition(
        ticker,
        side as 'yes' | 'no',
        contracts,
        priceCents || 50,  // Default to 50 cents if not specified
        apiKey,
        privateKey
      );
      
      if (result.success) {
        // Update position in database
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from('polybot_simulated_trades')
            .update({
              outcome: 'sold',
              resolved_at: new Date().toISOString(),
              resolution_notes: `Manually sold via UI. Order ID: ${result.data?.order_id}`,
            })
            .eq('id', positionId);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Position sell order placed',
          order: result.data,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error,
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: `Platform ${platform} not supported for manual selling yet`,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Sell position error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/positions/sell?ticker=XXX
 * Get current market price for a position (to help user decide sell price)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const platform = searchParams.get('platform') || 'kalshi';
    
    if (!ticker) {
      return NextResponse.json({
        success: false,
        error: 'Missing ticker parameter',
      }, { status: 400 });
    }
    
    if (platform.toLowerCase() === 'kalshi') {
      const prices = await getKalshiMarketPrice(ticker);
      
      if (prices) {
        return NextResponse.json({
          success: true,
          ticker,
          platform: 'kalshi',
          prices: {
            yes: {
              bid: prices.yesBid,
              ask: prices.yesAsk,
              bidDollars: prices.yesBid / 100,
              askDollars: prices.yesAsk / 100,
            },
            no: {
              bid: prices.noBid,
              ask: prices.noAsk,
              bidDollars: prices.noBid / 100,
              askDollars: prices.noAsk / 100,
            },
          },
          // Best exit prices (what you'd get if selling)
          sellPrices: {
            yes: prices.yesBid,  // Sell YES at the bid
            no: prices.noBid,    // Sell NO at the bid
          },
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Could not fetch market prices',
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: `Platform ${platform} not supported`,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Get market price error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
