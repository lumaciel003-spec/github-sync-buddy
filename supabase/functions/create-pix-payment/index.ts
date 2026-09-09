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
    const clientId = Deno.env.get('STRATTONPAY_CLIENT_ID');
    const clientSecret = Deno.env.get('STRATTONPAY_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret) {
      console.error('Missing StrattonPay API credentials');
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
    const idempotencyKey = `PIX_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const PRODUCT_TITLE = 'Pagamento Online';

    console.log('Creating PIX payment via StrattonPay:', { amountInCents, customerEmail, eventId, idempotencyKey });

    const requestBody = {
      method: 'PIX',
      amount: amountInCents,
      payer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone.replace(/\D/g, ''),
        document: { type: 'CPF', number: customerCpf.replace(/\D/g, '') }
      },
      items: [
        { title: PRODUCT_TITLE, quantity: 1, unitPrice: amountInCents, tangible: false }
      ],
      metadata: {
        provider_name: PRODUCT_TITLE,
        source: PRODUCT_TITLE,
        internal_transaction_id: idempotencyKey
      }
    };

    const response = await fetch('https://app.strattonpay.com.br/api/v1/transactions', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${credentials}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('StrattonPay response:', response.status, responseText);

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

    const tx = data.transaction || data.data || data;
    const qrcode = tx.qrcode || data.qrcode || {};
    const copiaCola = qrcode.code;

    if (!copiaCola) {
      console.error('Missing QR code data in response:', data);
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider', debug: data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qrCodeUrl = qrcode.base64
      ? (String(qrcode.base64).startsWith('data:') ? qrcode.base64 : `data:image/png;base64,${qrcode.base64}`)
      : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(copiaCola)}`;

    const transactionId = String(tx.externalId || tx.id || idempotencyKey);

    const { error: insertError } = await supabase
      .from('orders')
      .insert({
        transaction_id: transactionId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_cpf: customerCpf.replace(/\D/g, ''),
        customer_phone: customerPhone.replace(/\D/g, ''),
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
        phone: customerPhone.replace(/\D/g, ''),
        document: customerCpf.replace(/\D/g, '')
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
