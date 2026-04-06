import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// HTML sanitization - allow only safe tags
const ALLOWED_TAGS = ['p', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br', 'span'];
const ALLOWED_ATTRS = ['class', 'style'];

function sanitizeHtml(html: string): string {
  if (!html) return '';
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/(iframe|object|embed|form|input|button|textarea|select|meta|link|base)>/gi, '');
  sanitized = sanitized.replace(/<img[^>]*onerror[^>]*>/gi, '');
  return sanitized;
}

// Validate admin access - check password directly or validate HMAC token
async function validateAdminAccess(body: Record<string, unknown>): Promise<boolean> {
  // Method 1: Direct password validation (most reliable)
  const adminPasswordFromRequest = body.admin_password as string;
  const adminPassword = Deno.env.get("ADMIN_PASSWORD");
  
  if (adminPasswordFromRequest && adminPassword && adminPasswordFromRequest === adminPassword) {
    console.log("Admin access validated via direct password");
    return true;
  }

  // Method 2: HMAC token validation (fallback)
  const token = body.token as string;
  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length === 2) {
        const [payloadB64, sigB64] = parts;
        const pwd = adminPassword || "";
        const encoder = new TextEncoder();
        const keyData = encoder.encode(pwd + "_signing_secret_v1");
        const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
        const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
        const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payloadB64));
        if (valid) {
          const payload = JSON.parse(atob(payloadB64));
          const now = Math.floor(Date.now() / 1000);
          if (now <= payload.exp) {
            console.log("Admin access validated via HMAC token");
            return true;
          }
        }
      }
    } catch (e) {
      console.error("Token validation error:", e);
    }
  }

  console.log("Admin access validation failed - ADMIN_PASSWORD env exists:", !!adminPassword);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, data, token } = body;
    
    console.log(`Admin events v4 - action: ${action}`);

    // Validate admin access (password or token)
    const isValid = await validateAdminAccess(body);
    if (!isValid) {
      console.log("Unauthorized: validation failed");
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "list_events": {
        const { data: events, error } = await supabase
          .from("events")
          .select("*, ticket_types(*)")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, events }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_event": {
        const { data: event, error } = await supabase
          .from("events")
          .select("*, ticket_types(*)")
          .eq("id", data.id)
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, event }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_event": {
        // Sanitize HTML description
        const sanitizedDescription = sanitizeHtml(data.description || '');
        
        // Generate unique slug - append suffix if slug already exists
        let slug = data.slug;
        const { data: existingSlugs } = await supabase
          .from("events")
          .select("slug")
          .like("slug", `${slug}%`);
        
        if (existingSlugs && existingSlugs.length > 0) {
          const existing = existingSlugs.map(e => e.slug);
          if (existing.includes(slug)) {
            let counter = 2;
            while (existing.includes(`${slug}-${counter}`)) {
              counter++;
            }
            slug = `${slug}-${counter}`;
          }
        }
        
        const { data: event, error } = await supabase
          .from("events")
          .insert({
            name: data.name,
            slug,
            description: sanitizedDescription,
            location: data.location,
            event_date: data.event_date,
            event_time: data.event_time,
            opening_time: data.opening_time,
            banner_url: data.banner_url,
            cover_url: data.cover_url,
            map_url: data.map_url,
            event_map_url: data.event_map_url,
            instagram_url: data.instagram_url,
            facebook_url: data.facebook_url,
            youtube_url: data.youtube_url,
            google_maps_embed: data.google_maps_embed,
            is_active: data.is_active ?? true,
            show_on_home: data.show_on_home ?? true,
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, event }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_event": {
        // Sanitize HTML description
        const sanitizedDescription = sanitizeHtml(data.description || '');
        
        const { data: event, error } = await supabase
          .from("events")
          .update({
            name: data.name,
            slug: data.slug,
            description: sanitizedDescription,
            location: data.location,
            event_date: data.event_date,
            event_time: data.event_time,
            opening_time: data.opening_time,
            banner_url: data.banner_url,
            cover_url: data.cover_url,
            map_url: data.map_url,
            event_map_url: data.event_map_url,
            instagram_url: data.instagram_url,
            facebook_url: data.facebook_url,
            youtube_url: data.youtube_url,
            google_maps_embed: data.google_maps_embed,
            is_active: data.is_active,
            show_on_home: data.show_on_home,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, event }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_event": {
        const { error } = await supabase
          .from("events")
          .delete()
          .eq("id", data.id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_ticket_type": {
        const { data: ticketType, error } = await supabase
          .from("ticket_types")
          .insert({
            event_id: data.event_id,
            sector: data.sector,
            name: data.name,
            description: data.description,
            price: data.price,
            fee: data.fee,
            available: data.available,
            color: data.color,
            batch: data.batch,
            sort_order: data.sort_order,
            is_active: data.is_active ?? true,
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, ticketType }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_ticket_type": {
        const { data: ticketType, error } = await supabase
          .from("ticket_types")
          .update({
            sector: data.sector,
            name: data.name,
            description: data.description,
            price: data.price,
            fee: data.fee,
            available: data.available,
            color: data.color,
            batch: data.batch,
            sort_order: data.sort_order,
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, ticketType }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_ticket_type": {
        const { error } = await supabase
          .from("ticket_types")
          .delete()
          .eq("id", data.id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
