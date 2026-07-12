import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const action = body.action as string;

    if (action === "by_transaction") {
      const transactionId = String(body.transaction_id || "").trim();
      if (!transactionId || transactionId.length > 200) {
        return new Response(JSON.stringify({ error: "invalid transaction_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("transaction_id", transactionId)
        .maybeSingle();

      if (error) {
        console.error("by_transaction error:", error);
        return new Response(JSON.stringify({ error: "lookup failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search") {
      const rawValue = String(body.value || "").trim();
      if (!rawValue || rawValue.length > 200) {
        return new Response(JSON.stringify({ error: "invalid value" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isEmail = rawValue.includes("@");
      const field = isEmail ? "customer_email" : "customer_cpf";
      const value = isEmail ? rawValue : rawValue.replace(/\D/g, "");

      if (!isEmail && (value.length < 11 || value.length > 14)) {
        return new Response(JSON.stringify({ error: "invalid cpf" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq(field, value)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("search error:", error);
        return new Response(JSON.stringify({ error: "search failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("orders-lookup fatal:", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});