import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function mapStatus(raw: string): string {
  switch ((raw || '').toUpperCase()) {
    case 'APPROVED': return 'paid';
    case 'REFUNDED': return 'refunded';
    case 'REFUSED':
    case 'CANCELLED':
    case 'CANCELED':
    case 'CHARGEBACK': return 'cancelled';
    case 'IN_PROTEST':
    case 'PRE_CHARGEBACK': return 'disputed';
    default: return 'pending';
  }
}

async function sendToUtmify(orderData: {
  orderId: string;
  status: 'waiting_payment' | 'paid' | 'refused' | 'refunded';
  createdAt: string;
  approvedDate: string | null;
  refundedAt: string | null;
  customer: { name: string; email: string; phone: string; document: string };
  products: Array<{ id: string; name: string; quantity: number; priceInCents: number }>;
  totalPriceInCents: number;
  gatewayFeeInCents: number;
}) {
  const utmifyApiKey = Deno.env.get('UTMIFY_API_KEY');
  if (!utmifyApiKey) {
    console.log('UTMIFY_API_KEY not configured, skipping');
    return { success: false, error: 'Missing API key' };
  }

  const utmifyPayload = {
    orderId: orderData.orderId,
    platform: 'GuicheWeb',
    paymentMethod: 'pix',
    status: orderData.status,
    createdAt: orderData.createdAt,
    approvedDate: orderData.approvedDate,
    refundedAt: orderData.refundedAt,
    customer: { ...orderData.customer, country: 'BR' },
    products: orderData.products.map(p => ({ ...p, planId: null, planName: null })),
    trackingParameters: { src: null, sck: null, utm_source: null, utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null },
    commission: {
      totalPriceInCents: orderData.totalPriceInCents,
      gatewayFeeInCents: orderData.gatewayFeeInCents,
      userCommissionInCents: orderData.totalPriceInCents - orderData.gatewayFeeInCents
    }
  };

  try {
    const response = await fetch('https://api.utmify.com.br/api-credentials/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': utmifyApiKey },
      body: JSON.stringify(utmifyPayload)
    });
    const responseText = await response.text();
    console.log('Utmify response:', response.status, responseText);
    return { success: response.ok, status: response.status, response: responseText };
  } catch (error) {
    console.error('Error sending to Utmify:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('STRATTONPAY_CLIENT_ID');
    const clientSecret = Deno.env.get('STRATTONPAY_CLIENT_SECRET');
    const webhookSecret = Deno.env.get('STRATTONPAY_WEBHOOK_SECRET');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Missing database credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.text();

    if (webhookSecret) {
      const provided = req.headers.get('x-webhook-signature') || '';
      const expected = await hmacHex(webhookSecret, rawBody);
      if (provided.toLowerCase() !== expected) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const payload = JSON.parse(rawBody || '{}');
    console.log('Received StrattonPay webhook:', rawBody);

    const tx = payload.transaction || payload.data || payload;
    const txId = String(tx.id || '');
    const externalId = tx.externalId ? String(tx.externalId) : '';
    let rawStatus = tx.status || '';

    // Source of truth: confirm status against the API
    if (txId && clientId && clientSecret) {
      try {
        const credentials = btoa(`${clientId}:${clientSecret}`);
        const check = await fetch(`https://app.strattonpay.com.br/api/v1/transactions/${txId}`, {
          headers: { accept: 'application/json', authorization: `Basic ${credentials}` }
        });
        const checkText = await check.text();
        console.log('StrattonPay verify response:', check.status, checkText);
        if (check.ok) {
          const checkData = JSON.parse(checkText || '{}');
          const checkTx = checkData.transaction || checkData.data || checkData;
          if (checkTx.status) rawStatus = checkTx.status;
        }
      } catch (e) {
        console.error('Error verifying transaction:', e);
      }
    }

    const status = mapStatus(rawStatus);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the order by externalId, fallback to transaction id
    let order: any = null;
    for (const candidate of [externalId, txId].filter(Boolean)) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_id', candidate)
        .maybeSingle();
      if (error) console.error('Error looking up order:', error);
      if (data) { order = data; break; }
    }

    if (!order) {
      console.log('Order not found for transaction:', { txId, externalId });
      return new Response(
        JSON.stringify({ received: true, status, transactionId: externalId || txId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    if (updateError) console.error('Error updating order:', updateError);
    else console.log('Order updated:', order.id, status);

    if (status === 'paid' || status === 'refunded') {
      const nowUTC = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const totalInCents = Math.round(Number(order.total_amount) * 100);

      let products = [{ id: 'ticket', name: 'Pagamento Online', quantity: 1, priceInCents: totalInCents }];
      try {
        const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(parsed) && parsed.length) {
          products = parsed.map((item: any, index: number) => ({
            id: `ticket_${index}`,
            name: item.name,
            quantity: item.quantity,
            priceInCents: Math.round(Number(item.price) * 100)
          }));
        }
      } catch {
        console.log('Could not parse order items');
      }

      const utmifyResult = await sendToUtmify({
        orderId: order.transaction_id,
        status: status === 'paid' ? 'paid' : 'refunded',
        createdAt: (order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString()).replace('T', ' ').substring(0, 19),
        approvedDate: status === 'paid' ? nowUTC : null,
        refundedAt: status === 'refunded' ? nowUTC : null,
        customer: {
          name: order.customer_name || 'Cliente',
          email: order.customer_email || '',
          phone: order.customer_phone || '',
          document: order.customer_cpf || ''
        },
        products,
        totalPriceInCents: totalInCents,
        gatewayFeeInCents: Math.round(totalInCents * 0.0299)
      });

      console.log('Utmify result:', utmifyResult);
    }

    return new Response(
      JSON.stringify({ received: true, status, transactionId: order.transaction_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ received: true, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
