import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --------------------------------------------------
    // 1. CREATE / IDENTIFY SHOP
    // --------------------------------------------------

    const shopName = body?.shop?.name || "Unnamed Business";

    const shopId =
      body?.shop?.id ||
      crypto.randomUUID();

    // --------------------------------------------------
    // 2. HANDLE LOGO UPLOAD
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 3. UPSERT SHOP RECORD
    // --------------------------------------------------

    const { error: dbError } = await supabase
      .from("shops")
      .upsert({
        id: shopId,
        name: shopName,
        logo_url: logoUrl,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("DB error:", dbError);
    }

    // --------------------------------------------------
    // 4. RETURN CLEAN RESPONSE
    // --------------------------------------------------

    return new Response(
      JSON.stringify({
        success: true,
        shopId,
        logoUrl,
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Fatal error:", err);

    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { status: 500 }
    );
  }
});