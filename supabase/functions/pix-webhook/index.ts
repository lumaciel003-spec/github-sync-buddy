import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

function mapStatus(raw: string): string {
  switch ((raw || '').toLowerCase()) {
    case 'paid':
    case 'authorized':
    case 'partially_paid': return 'paid';
    case 'refunded': return 'refunded';
    case 'refused':
    case 'canceled':
    case 'cancelled':
    case 'chargedback': return 'cancelled';
    case 'in_protest': return 'disputed';
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
    const secretKey = Deno.env.get('VELANA_SECRET_KEY') || Deno.env.get('STRIPE_LIVE_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Missing database credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.text();
    console.log('Received Velana postback:', rawBody);
    const payload = JSON.parse(rawBody || '{}');

    // Velana postback: { id, type: "transaction", objectId, url, data: { ...transaction } }
    const tx = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const txId = String(tx.id ?? payload.objectId ?? '');
    let rawStatus = tx.status || '';

    if (!txId) {
      console.log('Postback without transaction id, ignoring');
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Source of truth: confirm the status against the Velana API
    let apiVerified = false;
    if (secretKey) {
      try {
        const credentials = btoa(`${secretKey}:x`);
        const check = await fetch(`https://api.velana.com.br/v1/transactions/${txId}`, {
          headers: { accept: 'application/json', authorization: `Basic ${credentials}` }
        });
        const checkText = await check.text();
        console.log('Velana verify response:', check.status, checkText);
        if (check.ok) {
          const checkData = JSON.parse(checkText || '{}');
          const checkTx = checkData.data || checkData;
          if (checkTx.status) {
            rawStatus = checkTx.status;
            apiVerified = true;
          }
        }
      } catch (e) {
        console.error('Error verifying transaction:', e);
      }
    }

    if (!apiVerified) {
      console.error('Could not confirm transaction with Velana API, ignoring');
      return new Response(
        JSON.stringify({ error: 'Unverified webhook' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = mapStatus(rawStatus);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error: lookupError } = await supabase
      .from('orders')
      .select('*')
      .eq('transaction_id', txId)
      .maybeSingle();

    if (lookupError) console.error('Error looking up order:', lookupError);

    if (!order) {
      console.log('Order not found for transaction:', txId);
      return new Response(
        JSON.stringify({ received: true, status, transactionId: txId }),
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
