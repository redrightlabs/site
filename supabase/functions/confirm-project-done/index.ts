import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://redrightlabs.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const shopId = body?.shopId ? String(body.shopId) : null;
    const shopName = body?.shopName ? String(body.shopName) : "";
    const actionType = body?.actionType ? String(body.actionType) : "closeout";
    const artistName = body?.artistName ? String(body.artistName) : "";
    const title = body?.title ? String(body.title) : "An appointment hasn't been closed out yet.";
    const message = body?.body ? String(body.body) : "Have Isla close it out?";
    const source = body?.source ? String(body.source) : "operator-home";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const queuedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("isla_actions")
      .insert({
        shop_id: shopId,
        shop_name: shopName,
        action_type: actionType,
        artist_name: artistName,
        title,
        message,
        source,
        status: "queued",
        created_at: queuedAt,
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      throw new Error(`isla_actions insert failed: ${error.message}`);
    }

    console.log("ISLA ACTION QUEUED", {
      actionId: data.id,
      shopId,
      shopName,
      actionType,
      artistName,
      title,
      message,
      source,
      queuedAt: data.created_at,
    });

    return new Response(
      JSON.stringify({
        success: true,
        actionId: data.id,
        queuedAt: data.created_at,
        status: data.status,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("confirm-project-done failed", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});