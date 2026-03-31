import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://redrightlabs.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function isConsultLike(value: unknown): boolean {
  return /consult/.test(String(value || "").toLowerCase());
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const body = await req.json();

    const shopId = body?.shopId ? String(body.shopId) : null;
    const shopName = body?.shopName ? String(body.shopName) : "";
    const actionType = body?.actionType ? String(body.actionType) : "closeout";
    const requestedOutcome = body?.requestedOutcome ? String(body.requestedOutcome).trim().toLowerCase() : "";
    const appointmentId = body?.appointmentId ? String(body.appointmentId) : null;
    const completionStatus = body?.completionStatus ? String(body.completionStatus) : "";
    const artistName = body?.artistName ? String(body.artistName) : "";
    const title = body?.title ? String(body.title) : "An appointment hasn't been closed out yet.";
    const message = body?.body ? String(body.body) : "Have Isla close it out?";
    const source = body?.source ? String(body.source) : "operator-home";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (actionType === "closeout_outcome") {
      if (!appointmentId) {
        throw new Error("Missing appointmentId for closeout outcome.");
      }

      let rpcName = "";
      let rpcArgs: Record<string, string> = {};

      if (requestedOutcome === "done") {
        rpcName = "mark_appointment_done";
        rpcArgs = { appt_id: appointmentId };
      } else if (requestedOutcome === "no_show") {
        rpcName = "mark_appointment_no_show";
        rpcArgs = { appt_id: appointmentId };
      } else {
        throw new Error(`Unsupported requestedOutcome for closeout_outcome: ${requestedOutcome}`);
      }

           const { error } = await supabase.rpc(rpcName, rpcArgs);

      if (error) {
        throw new Error(`${rpcName} failed: ${error.message}`);
      }

      let queuedArtistFollowup: { id: string; created_at: string } | null = null;

      if (requestedOutcome === "done" && appointmentId) {
        const { data: appointmentRow, error: appointmentError } = await supabase
          .from("appointments")
          .select("id, project_id, service_type, artist_name, client_name")
          .eq("id", appointmentId)
          .maybeSingle();

        if (appointmentError) {
          throw new Error(`appointment lookup failed: ${appointmentError.message}`);
        }

        const consultLike =
          isConsultLike(appointmentRow?.service_type) ||
          isConsultLike(title) ||
          isConsultLike(message);

        if (consultLike) {
          const followupTitle = "Consult complete — confirm project plan";
          const followupMessage = `Consult is done for ${appointmentRow?.client_name || "this client"}. Please reply with: 1) how many sessions you want booked, 2) how long each session should be, and 3) the minimum healing time you want between sessions.`;

          const { data: queuedFollowup, error: followupError } = await supabase
            .from("isla_actions")
            .insert({
              shop_id: shopId,
              shop_name: shopName,
              action_type: "consult_plan_request",
              artist_name: appointmentRow?.artist_name || artistName,
              title: followupTitle,
              message: followupMessage,
              source: `${source}:consult-followup`,
              status: "queued",
              created_at: new Date().toISOString(),
            })
            .select("id, created_at")
            .single();

          if (followupError) {
            throw new Error(`consult followup insert failed: ${followupError.message}`);
          }

          queuedArtistFollowup = queuedFollowup;
        }
      }

            console.log("OPERATOR CLOSEOUT RESOLVED", {
        shopId,
        shopName,
        appointmentId,
        requestedOutcome,
        completionStatus,
        artistName,
        queuedArtistFollowup,
        source,
      });

           return new Response(
        JSON.stringify({
          success: true,
          appointmentId,
          requestedOutcome,
          status: requestedOutcome,
          queuedArtistFollowup,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (actionType === "closeout_needs_contact") {
      if (!appointmentId) {
        throw new Error("Missing appointmentId for needs-contact action.");
      }

      const { error } = await supabase.rpc("mark_completion_blocked_missing_contact", {
        p_appointment_id: appointmentId,
        p_reason: "operator_flagged_needs_contact",
      });

      if (error) {
        throw new Error(`mark_completion_blocked_missing_contact failed: ${error.message}`);
      }

      console.log("OPERATOR CLOSEOUT FLAGGED NEEDS CONTACT", {
        shopId,
        shopName,
        appointmentId,
        completionStatus,
        artistName,
        source,
      });

      return new Response(
        JSON.stringify({
          success: true,
          appointmentId,
          requestedOutcome: "needs_contact",
          status: "blocked_missing_contact",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

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