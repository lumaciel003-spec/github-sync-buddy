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
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

// Function to send order to Utmify
async function sendToUtmify(orderData: {
  orderId: string;
  status: 'waiting_payment' | 'paid' | 'refused' | 'refunded';
  createdAt: string;
  approvedDate: string | null;
  refundedAt: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    priceInCents: number;
  }>;
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
    customer: {
      name: orderData.customer.name,
      email: orderData.customer.email,
      phone: orderData.customer.phone,
      document: orderData.customer.document,
      country: 'BR'
    },
    products: orderData.products.map(p => ({
      id: p.id,
      name: p.name,
      planId: null,
      planName: null,
      quantity: p.quantity,
      priceInCents: p.priceInCents
    })),
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
    const alphaPublicKey = Deno.env.get('ALPHACASH_PUBLIC_KEY');
    const alphaSecretKey = Deno.env.get('ALPHACASH_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!alphaPublicKey || !alphaSecretKey) {
      console.error('Missing AlphaCash API credentials');
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

    console.log('Creating PIX payment via AlphaCash:', { amount, customerName, customerEmail, eventId, itemsCount: items.length });

    // AlphaCash uses Basic Auth: publicKey:secretKey
    const credentials = btoa(`${alphaPublicKey}:${alphaSecretKey}`);

    const amountInCents = Math.round(amount * 100);

    // Build items array for AlphaCash
    const alphaItems = [{
      title: 'LOTE PROMOCIONAL',
      unitPrice: amountInCents,
      quantity: 1,
      tangible: false,
      externalRef: `gw_${Date.now()}`
    }];

    // Build request body per AlphaCash API docs
    const requestBody = {
      amount: amountInCents,
      paymentMethod: 'pix',
      items: alphaItems,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone.replace(/\D/g, ''),
        document: {
          number: customerCpf.replace(/\D/g, ''),
          type: 'cpf'
        }
      },
      postbackUrl: `${supabaseUrl}/functions/v1/pix-webhook`,
      metadata: JSON.stringify({
        source: 'guicheweb',
        eventId: eventId || null,
        customerName,
        customerEmail,
        customerCpf: customerCpf.replace(/\D/g, ''),
        customerPhone: customerPhone.replace(/\D/g, ''),
        items
      }),
      externalRef: `gw_${Date.now()}`,
      ip: '127.0.0.1'
    };

    console.log('AlphaCash request body:', JSON.stringify(requestBody));

    // Call AlphaCash API
    const alphaResponse = await fetch('https://api.alphacashpay.com.br/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('AlphaCash response status:', alphaResponse.status);

    const responseText = await alphaResponse.text();
    console.log('AlphaCash response text:', responseText);

    let alphaData;
    try {
      alphaData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider', raw: responseText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!alphaResponse.ok) {
      console.error('AlphaCash API error:', alphaData);

      const errorMessage = JSON.stringify(alphaData).toLowerCase();
      const isCpfError = errorMessage.includes('cpf') || errorMessage.includes('document') || errorMessage.includes('invalid');

      return new Response(
        JSON.stringify({
          error: isCpfError ? 'CPF inválido ou incorreto' : 'Failed to create PIX payment',
          details: alphaData,
          isCpfError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AlphaCash response: data.pix.qrcode contains the PIX copia-e-cola
    const transactionData = alphaData.data || alphaData;
    const transactionId = String(transactionData.id);
    const pixData = transactionData.pix;
    const copiaCola = pixData?.qrcode;

    if (!copiaCola) {
      console.error('Missing QR code data in response:', alphaData);
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider', debug: alphaData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate QR code image URL from the PIX code
    const qrCodeUrl = copiaCola.startsWith('http')
      ? copiaCola
      : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(copiaCola)}`;

    const pixCopiaCola = copiaCola;

    // Save order to database
    const { error: insertError } = await supabase
      .from('orders')
      .insert({
        transaction_id: transactionId || `AC_${Date.now()}`,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_cpf: customerCpf.replace(/\D/g, ''),
        customer_phone: customerPhone.replace(/\D/g, ''),
        items: items,
        total_amount: amount,
        status: 'pending',
        event_id: eventId || null
      });

    if (insertError) {
      console.error('Error saving order to database:', insertError);
    } else {
      console.log('Order saved to database with pending status');
    }

    // Send waiting_payment to Utmify
    const createdAtUTC = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const utmifyProducts = items.map((item, index) => ({
      id: `ticket_${index}`,
      name: item.name,
      quantity: item.quantity,
      priceInCents: Math.round(item.price * 100)
    }));

    const utmifyResult = await sendToUtmify({
      orderId: transactionId || `AC_${Date.now()}`,
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
      products: utmifyProducts,
      totalPriceInCents: amountInCents,
      gatewayFeeInCents: Math.round(amountInCents * 0.0299)
    });

    console.log('Utmify waiting_payment result:', utmifyResult);

    return new Response(
      JSON.stringify({
        qrCode: qrCodeUrl,
        copiaCola: pixCopiaCola,
        transactionId: transactionId,
        status: transactionData.status || 'pending',
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
