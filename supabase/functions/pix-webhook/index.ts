import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to send order to Utmify
async function sendToUtmify(orderData: {
  orderId: string;
  status: 'waiting_payment' | 'paid' | 'refused' | 'refunded';
  createdAt: string;
  approvedDate: string | null;
  refundedAt: string | null;
  customer: { name: string; email: string; phone: string; document: string; };
  products: Array<{ id: string; name: string; quantity: number; priceInCents: number; }>;
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

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Missing database credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();

    console.log('Received GhostsPay webhook:', JSON.stringify(payload));

    // GhostsPay webhook structure:
    // { id, type, objectId, data: { id, amount (cents), status, customer, pix, metadata, ... } }
    const data = payload.data || payload;
    const transactionId = data.id || payload.objectId || payload.id;
    const status = data.status;
    const amountInCents = data.amount;
    const customer = data.customer || {};
    const metadata = data.metadata || {};

    console.log('Parsed webhook data:', { transactionId, status, amountInCents });

    // Parse items from metadata
    let products = [{ id: 'ticket', name: 'Ingresso', quantity: 1, priceInCents: amountInCents }];
    if (metadata.items) {
      try {
        const parsedItems = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
        products = parsedItems.map((item: any, index: number) => ({
          id: `ticket_${index}`,
          name: item.name,
          quantity: item.quantity,
          priceInCents: Math.round(item.price * 100)
        }));
      } catch (e) {
        console.log('Could not parse items from metadata');
      }
    }

    const nowUTC = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Handle PAID status
    if (status === 'paid') {
      console.log('Payment confirmed! Transaction:', transactionId);

      const { data: orderData, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('transaction_id', transactionId)
        .select()
        .maybeSingle();

      if (updateError) console.error('Error updating order:', updateError);
      else if (orderData) console.log('Order updated to paid:', orderData.id);
      else console.log('Order not found for transaction:', transactionId);

      const utmifyResult = await sendToUtmify({
        orderId: transactionId,
        status: 'paid',
        createdAt: metadata.createdAt || nowUTC,
        approvedDate: nowUTC,
        refundedAt: null,
        customer: {
          name: customer.name || metadata.customerName || 'Cliente',
          email: customer.email || metadata.customerEmail || '',
          phone: customer.phone || metadata.customerPhone || '',
          document: customer.document || metadata.customerCpf || ''
        },
        products,
        totalPriceInCents: amountInCents,
        gatewayFeeInCents: Math.round(amountInCents * 0.0299)
      });

      console.log('Utmify paid result:', utmifyResult);

      return new Response(
        JSON.stringify({ received: true, status: 'paid', transactionId, utmifyNotified: utmifyResult.success, orderUpdated: !updateError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle REFUNDED status
    if (status === 'refunded') {
      console.log('Payment refunded! Transaction:', transactionId);

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('transaction_id', transactionId);

      if (updateError) console.error('Error updating order:', updateError);

      const utmifyResult = await sendToUtmify({
        orderId: transactionId,
        status: 'refunded',
        createdAt: metadata.createdAt || nowUTC,
        approvedDate: null,
        refundedAt: nowUTC,
        customer: {
          name: customer.name || metadata.customerName || 'Cliente',
          email: customer.email || metadata.customerEmail || '',
          phone: customer.phone || metadata.customerPhone || '',
          document: customer.document || metadata.customerCpf || ''
        },
        products,
        totalPriceInCents: amountInCents,
        gatewayFeeInCents: Math.round(amountInCents * 0.0299)
      });

      console.log('Utmify refunded result:', utmifyResult);

      return new Response(
        JSON.stringify({ received: true, status: 'refunded', transactionId, utmifyNotified: utmifyResult.success }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle REFUSED / FAILED / EXPIRED / CANCELED
    if (['refused', 'failed', 'expired', 'canceled'].includes(status)) {
      console.log(`Payment ${status}! Transaction:`, transactionId);

      await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('transaction_id', transactionId);

      return new Response(
        JSON.stringify({ received: true, status, transactionId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Other statuses - acknowledge
    return new Response(
      JSON.stringify({ received: true, status: status || 'unknown', transactionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
