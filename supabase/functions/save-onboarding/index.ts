import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://redrightlabs.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pick<T = unknown>(obj: Record<string, unknown>, key: string): T | undefined {
  return obj && key in obj ? (obj[key] as T) : undefined;
}

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function asBoolean(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const state = (body && typeof body === "object") ? body as Record<string, unknown> : {};

    const shopName =
      body?.shop?.name ||
      optionalString(pick(state, "shop.name")) ||
      optionalString(pick(state, "shop.business_name")) ||
      "Unnamed Business";

    const shopId =
      body?.shop?.id ||
      optionalString(pick(state, "shop.id")) ||
      crypto.randomUUID();

    const timezone =
      optionalString(pick(state, "shop.timezone")) ||
      optionalString(pick(state, "shop.business_timezone"));

    const vertical =
      optionalString(pick(state, "shop.vertical")) ||
      optionalString(pick(state, "vertical.key")) ||
      optionalString(pick(state, "vertical"));

    const hoursMode = optionalString(pick(state, "shop.hours.mode"));
    const hoursTemplate = pick(state, "shop.hours.template") ?? null;
    const ownerIsProvider = asBoolean(pick(state, "owner.is_provider"));
    const roster = Array.isArray(pick(state, "shop.roster")) ? (pick(state, "shop.roster") as unknown[]) : [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let logoUrl: string | null = null;
    const logoFile = body?.shop?.logo?.file;

    if (logoFile) {
      const base64 = logoFile.split(",")[1];
      const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = `brand-assets/${shopId}/logo.png`;

      const { error: uploadError } = await supabase.storage
        .from("brand-assets")
        .upload(path, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Logo upload error:", uploadError);
      } else {
        const { data } = supabase.storage
          .from("brand-assets")
          .getPublicUrl(path);

        logoUrl = data.publicUrl;
      }
    }

    const nowIso = new Date().toISOString();

    const { data: shopsData, error: shopsError } = await supabase
  .from("shops")
  .upsert({
    id: shopId,
    name: shopName,
    logo_url: logoUrl,
    timezone,
    vertical,
    created_at: nowIso,
  })
  .select();

    console.log("SHOPS RESULT:", { shopsData, shopsError });

    if (shopsError) {
      console.error("Shops upsert error:", shopsError);
      throw new Error(`Shops upsert failed: ${shopsError.message}`);
    }

    if (!Array.isArray(shopsData) || shopsData.length === 0) {
      throw new Error("Shops upsert returned no rows.");
    }

const { data: settingsData, error: settingsError } = await supabase
  .from("shop_settings")
  .upsert({
    shop_id: shopId,
    hours_mode: hoursMode,
    hours_template: hoursTemplate,
    owner_is_provider: ownerIsProvider,
    onboarding_state: state,
    updated_at: nowIso,
  })
  .select();

    console.log("SETTINGS RESULT:", { settingsData, settingsError });

    if (settingsError) {
      console.error("Shop settings upsert error:", settingsError);
      throw new Error(`Shop settings upsert failed: ${settingsError.message}`);
    }

    if (!Array.isArray(settingsData) || settingsData.length === 0) {
      throw new Error("Shop settings upsert returned no rows.");
    }

    if (roster.length) {
      const rosterRows = roster
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const person = item as Record<string, unknown>;
          return {
            id: crypto.randomUUID(),
            shop_id: shopId,
            name: optionalString(person.name),
            phone: optionalString(person.phone),
            role: optionalString(person.role),
            updated_at: nowIso,
          };
        })
        .filter((row) => row.name || row.phone || row.role);

      if (rosterRows.length) {
        const { error: rosterDeleteError } = await supabase
          .from("shop_roster")
          .delete()
          .eq("shop_id", shopId);

        if (rosterDeleteError) {
  console.error("Shop roster delete error:", rosterDeleteError);
  throw new Error(`Shop roster delete failed: ${rosterDeleteError.message}`);
}

const { data: rosterData, error: rosterInsertError } = await supabase
  .from("shop_roster")
  .insert(rosterRows)
  .select();

        console.log("ROSTER RESULT:", { rosterData, rosterInsertError });

        if (rosterInsertError) {
          console.error("Shop roster insert error:", rosterInsertError);
          throw new Error(`Shop roster insert failed: ${rosterInsertError.message}`);
        }

        if (!Array.isArray(rosterData) || rosterData.length === 0) {
          throw new Error("Shop roster insert returned no rows.");
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        shopId,
        logoUrl,
        shopName,
        debug: {
          shopsRows: Array.isArray(shopsData) ? shopsData.length : 0,
          settingsRows: Array.isArray(settingsData) ? settingsData.length : 0,
          rosterRows: Array.isArray(roster) ? roster.length : 0,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Fatal error:", err);

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