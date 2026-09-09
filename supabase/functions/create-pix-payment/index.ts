import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  amount: number;
  customerName: string;
  customerEmail: string;
  customerCpf: string;
  customerPhone: string;
  eventId?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
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
    trackingParameters: {
      src: null, sck: null,
      utm_source: null, utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null
    },
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
    // Velana authenticates with Basic auth: base64("{SECRET_KEY}:x")
    const secretKey = Deno.env.get('VELANA_SECRET_KEY') || Deno.env.get('STRIPE_LIVE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!secretKey) {
      console.error('Missing Velana secret key');
      return new Response(
        JSON.stringify({ error: 'Missing API credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Missing database credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { amount, customerName, customerEmail, customerCpf, customerPhone, eventId, items }: PaymentRequest = await req.json();

    const amountInCents = Math.round(amount * 100);
    const credentials = btoa(`${secretKey}:x`);
    const PRODUCT_TITLE = 'Pagamento Online';
    const cpfDigits = customerCpf.replace(/\D/g, '');
    const phoneDigits = customerPhone.replace(/\D/g, '');

    console.log('Creating PIX payment via Velana:', { amountInCents, customerEmail, eventId });

    const requestBody = {
      amount: amountInCents,
      paymentMethod: 'pix',
      customer: {
        name: customerName,
        email: customerEmail,
        phone: phoneDigits,
        document: { number: cpfDigits, type: 'cpf' }
      },
      items: [
        { title: PRODUCT_TITLE, unitPrice: amountInCents, quantity: 1, tangible: false }
      ],
      pix: { expiresInDays: 1 },
      postbackUrl: `${supabaseUrl}/functions/v1/pix-webhook`,
      metadata: JSON.stringify({ provider_name: PRODUCT_TITLE, event_id: eventId || null }),
      traceable: false
    };

    const response = await fetch('https://api.velana.com.br/v1/transactions', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Velana response:', response.status, responseText);

    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider', raw: responseText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorMessage = JSON.stringify(data).toLowerCase();
      const isCpfError = errorMessage.includes('cpf') || errorMessage.includes('document');
      return new Response(
        JSON.stringify({
          error: isCpfError ? 'CPF inválido ou incorreto' : 'Failed to create PIX payment',
          details: data,
          isCpfError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tx = data.data || data.transaction || data;
    const pix = tx.pix || {};
    const copiaCola = pix.qrcode;

    if (!copiaCola) {
      console.error('Missing QR code data in response:', data);
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider', debug: data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(copiaCola)}`;
    const transactionId = String(tx.id);

    const { error: insertError } = await supabase
      .from('orders')
      .insert({
        transaction_id: transactionId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_cpf: cpfDigits,
        customer_phone: phoneDigits,
        items: items,
        total_amount: amount,
        status: 'pending',
        event_id: eventId || null
      });

    if (insertError) console.error('Error saving order to database:', insertError);
    else console.log('Order saved with pending status:', transactionId);

    const createdAtUTC = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const utmifyResult = await sendToUtmify({
      orderId: transactionId,
      status: 'waiting_payment',
      createdAt: createdAtUTC,
      approvedDate: null,
      refundedAt: null,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: phoneDigits,
        document: cpfDigits
      },
      products: items.map((item, index) => ({
        id: `ticket_${index}`,
        name: item.name,
        quantity: item.quantity,
        priceInCents: Math.round(item.price * 100)
      })),
      totalPriceInCents: amountInCents,
      gatewayFeeInCents: Math.round(amountInCents * 0.0299)
    });

    console.log('Utmify waiting_payment result:', utmifyResult);

    return new Response(
      JSON.stringify({
        qrCode: qrCodeUrl,
        copiaCola,
        transactionId,
        status: 'PENDING',
        externalId: transactionId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-pix-payment function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
