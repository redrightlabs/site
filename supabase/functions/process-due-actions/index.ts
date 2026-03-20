const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = "https://uwydiqltvchlmjvzwkal.supabase.co";

function getServiceRoleKey() {
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!serviceRoleKey) throw new Error("Missing SERVICE_ROLE_KEY");
  return serviceRoleKey;
}

async function getDueLifecycleProjects() {
  const serviceRoleKey = getServiceRoleKey();

  const query = `${supabaseUrl}/rest/v1/project_folders?or=(
    and(aftercare_planned_at.not.is.null,aftercare_planned_at.lte.now(),aftercare_sent_at.is.null),
    and(contact_card_planned_at.not.is.null,contact_card_planned_at.lte.now(),contact_card_sent_at.is.null),
    and(cw1_planned_at.not.is.null,cw1_planned_at.lte.now(),cw1_sent_at.is.null),
    and(cw2_planned_at.not.is.null,cw2_planned_at.lte.now(),cw2_sent_at.is.null),
    and(cw3_planned_at.not.is.null,cw3_planned_at.lte.now(),cw3_sent_at.is.null),
    and(review_planned_at.not.is.null,review_planned_at.lte.now(),review_requested_at.is.null),
    and(portfolio_request_planned_at.not.is.null,portfolio_request_planned_at.lte.now(),photo_requested_at.is.null)
  )&select=*`;

  const res = await fetch(query.replace(/\s+/g, ""), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to fetch lifecycle projects: ${res.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function markAftercareSent(projectId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders?id=eq.${projectId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      aftercare_sent_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark aftercare sent: ${text}`);
  }
}

async function markContactCardSent(projectId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders?id=eq.${projectId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      contact_card_sent_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark contact card sent: ${text}`);
  }
}

async function markCW1Sent(projectId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders?id=eq.${projectId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      cw1_sent_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark CW1 sent: ${text}`);
  }
}

async function markCW2Sent(projectId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders?id=eq.${projectId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      cw2_sent_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark CW2 sent: ${text}`);
  }
}

async function markCW3Sent(projectId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders?id=eq.${projectId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      cw3_sent_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark CW3 sent: ${text}`);
  }
}

async function markReviewSent(projectId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders?id=eq.${projectId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      review_requested_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark review sent: ${text}`);
  }
}

async function markPortfolioSent(projectId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders?id=eq.${projectId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      photo_requested_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark portfolio sent: ${text}`);
  }
}

function getClientName(project: any) {
  return project?.client_name || "there";
}

const LIFECYCLE_MESSAGES = {
  aftercare: (project: any) =>
    `Hi ${getClientName(project)}, your aftercare instructions are ready. Reply here if you have any healing concerns.`,
  contact_card: (project: any) =>
    `Hi ${getClientName(project)}, here’s your contact card for easy access. Save this number and reach out anytime.`,
  cw1: (project: any) =>
    `Hey ${getClientName(project)}, just checking in — how is your tattoo healing so far? Any concerns at all, just reply here.`,
  cw2: (project: any) =>
    `Hey ${getClientName(project)}, just a quick follow-up — everything still healing well? If anything feels off, let me know.`,
  cw3: (project: any) =>
    `Hey ${getClientName(project)}, one more healing check-in — how’s everything looking now? If you need anything, just reply here.`,
  review: (project: any) =>
    `Hey ${getClientName(project)}, if you had a great experience, I’d really appreciate a quick review. It helps more than you know.`,
  portfolio: (project: any) =>
    `Hey ${getClientName(project)}, if you’re open to it, I’d love to see a healed photo for the portfolio. No pressure — only if you’re comfortable.`,
} as const;

type LifecycleActionKey = keyof typeof LIFECYCLE_MESSAGES;

function buildLifecycleMessage(action: LifecycleActionKey, project: any) {
  return LIFECYCLE_MESSAGES[action](project);
}

async function logStubLifecycleAction(payload: {
  action: string;
  project: any;
  message: string;
}) {
  const serviceRoleKey = getServiceRoleKey();

  const eventType = `lifecycle.${payload.action}.stub_logged`;

  const body = {
    shop_id: null,
    booking_request_id: null,
    project_id: null,
    event_type: eventType,
    event_payload: {
      action: payload.action,
      channel: "stub",
      project_folder_id: payload.project?.project_folder_id || null,
      client_name: payload.project?.client_name || null,
      message: payload.message,
    },
    source: "process-due-actions",
    channel: "stub",
    external_id: null,
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/system_events`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!res.ok) {
    throw new Error(`Failed to log stub lifecycle action: ${res.status} ${rawText}`);
  }

  return Array.isArray(data) ? data[0] : data;
}

async function sendLifecycleAction(payload: {
  action: string;
  project: any;
  message: string;
}) {
  const loggedEvent = await logStubLifecycleAction(payload);

  return {
    ok: true,
    action: payload.action,
    project_folder_id: payload.project?.project_folder_id || null,
    channel: "stub",
    message: payload.message,
    logged_event_id: loggedEvent?.id || null,
    event_type: loggedEvent?.event_type || null,
  };
}

async function logWorkerRun(payload: {
  worker_name: string;
  ran_at: string;
  processed_count: number;
  status: "success" | "error";
  details: Record<string, unknown>;
}) {
  const serviceRoleKey = getServiceRoleKey();

  const body = {
    worker_name: payload.worker_name,
    ran_at: payload.ran_at,
    processed_count: payload.processed_count,
    status: payload.status,
    details_json: payload.details,
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/worker_runs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to log worker run: ${text}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const dueProjects = await getDueLifecycleProjects();
    const ranAt = new Date().toISOString();

    const processed: any[] = [];

    for (const project of dueProjects) {
      const now = new Date();

      let aftercareTriggered = false;
      let contactCardTriggered = false;

      if (
        project.aftercare_planned_at &&
        !project.aftercare_sent_at &&
        new Date(project.aftercare_planned_at) <= now
      ) {
        const sendResult = await sendLifecycleAction({
          action: "aftercare",
          project,
          message: buildLifecycleMessage("aftercare", project),
        });

        if (!sendResult.ok) {
          throw new Error(`Aftercare send failed for ${project.project_folder_id}`);
        }

        await markAftercareSent(project.id);
        aftercareTriggered = true;
      }

      if (
        project.contact_card_planned_at &&
        !project.contact_card_sent_at &&
        new Date(project.contact_card_planned_at) <= now
      ) {
        const sendResult = await sendLifecycleAction({
          action: "contact_card",
          project,
          message: buildLifecycleMessage("contact_card", project),
        });

        if (!sendResult.ok) {
          throw new Error(`Contact card send failed for ${project.project_folder_id}`);
        }

        await markContactCardSent(project.id);
        contactCardTriggered = true;
      }

      if (aftercareTriggered || contactCardTriggered) {
        processed.push({
          id: project.id,
          project_folder_id: project.project_folder_id,
          aftercare_sent: aftercareTriggered,
          contact_card_sent: contactCardTriggered,
        });
      }

      if (
        project.cw1_planned_at &&
        !project.cw1_sent_at &&
        new Date(project.cw1_planned_at) <= now
      ) {
        const sendResult = await sendLifecycleAction({
          action: "cw1",
          project,
          message: buildLifecycleMessage("cw1", project),
        });

        if (!sendResult.ok) {
          throw new Error(`CW1 send failed for ${project.project_folder_id}`);
        }

        await markCW1Sent(project.id);

        processed.push({
          id: project.id,
          action: "cw1",
          sent: true,
        });
      }

      if (
        project.cw2_planned_at &&
        !project.cw2_sent_at &&
        new Date(project.cw2_planned_at) <= now
      ) {
        const sendResult = await sendLifecycleAction({
          action: "cw2",
          project,
          message: buildLifecycleMessage("cw2", project),
        });

        if (!sendResult.ok) {
          throw new Error(`CW2 send failed for ${project.project_folder_id}`);
        }

        await markCW2Sent(project.id);

        processed.push({
          id: project.id,
          action: "cw2",
          sent: true,
        });
      }

      if (
        project.cw3_planned_at &&
        !project.cw3_sent_at &&
        new Date(project.cw3_planned_at) <= now
      ) {
        const sendResult = await sendLifecycleAction({
          action: "cw3",
          project,
          message: buildLifecycleMessage("cw3", project),
        });

        if (!sendResult.ok) {
          throw new Error(`CW3 send failed for ${project.project_folder_id}`);
        }

        await markCW3Sent(project.id);

        processed.push({
          id: project.id,
          action: "cw3",
          sent: true,
        });
      }

      if (
        project.review_planned_at &&
        !project.review_requested_at &&
        new Date(project.review_planned_at) <= now
      ) {
        const sendResult = await sendLifecycleAction({
          action: "review",
          project,
          message: buildLifecycleMessage("review", project),
        });

        if (!sendResult.ok) {
          throw new Error(`Review send failed for ${project.project_folder_id}`);
        }

        await markReviewSent(project.id);

        processed.push({
          id: project.id,
          action: "review",
          sent: true,
        });
      }

      if (
        project.portfolio_request_planned_at &&
        !project.photo_requested_at &&
        new Date(project.portfolio_request_planned_at) <= now
      ) {
        const sendResult = await sendLifecycleAction({
          action: "portfolio",
          project,
          message: buildLifecycleMessage("portfolio", project),
        });

        if (!sendResult.ok) {
          throw new Error(`Portfolio send failed for ${project.project_folder_id}`);
        }

        await markPortfolioSent(project.id);

        processed.push({
          id: project.id,
          action: "portfolio",
          sent: true,
        });
      }
    }

    await logWorkerRun({
      worker_name: "process-due-actions",
      ran_at: ranAt,
      processed_count: processed.length,
      status: "success",
      details: {
        due_project_count: dueProjects.length,
        processed,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        ran_at: ranAt,
        processed_count: processed.length,
        processed,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    try {
      await logWorkerRun({
        worker_name: "process-due-actions",
        ran_at: new Date().toISOString(),
        processed_count: 0,
        status: "error",
        details: {
          error: message,
        },
      });
    } catch (_loggingError) {
      // swallow logging failures so the original error still returns cleanly
    }

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
