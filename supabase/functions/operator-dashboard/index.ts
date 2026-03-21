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

async function fetchJson(path: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  const rawText = await res.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!res.ok) {
    throw new Error(`Fetch failed for ${path}: ${res.status} ${rawText}`);
  }

  return data;
}

function timeAgoLabel(dateLike?: string | null) {
  if (!dateLike) return "Unknown";

  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "Unknown";

  const diffMs = Date.now() - dt.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "1 hr ago";
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "1 day ago";
  return `${diffDay} days ago`;
}

function nextRunLabel(lastRunAt?: string | null) {
  if (!lastRunAt) return "Unknown";

  const dt = new Date(lastRunAt);
  if (Number.isNaN(dt.getTime())) return "Unknown";

  const next = new Date(dt.getTime() + 5 * 60 * 1000);
  const diffMs = next.getTime() - Date.now();
  const diffMin = Math.max(0, Math.ceil(diffMs / 60000));

  if (diffMin <= 1) return "within 1 min";
  return `in ${diffMin} min`;
}

function actionLabelFromEventType(eventType?: string | null) {
  if (!eventType) return "Lifecycle action";

  const parts = eventType.split(".");
  if (parts.length >= 2) {
    return parts[1].replace(/_/g, " ");
  }

  return eventType;
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function verticalLabelFromValue(vertical?: string | null) {
  const normalized = String(vertical || "").trim().toLowerCase();

  if (normalized === "tattoo" || normalized === "tattoo_v2") {
    return "Tattoo Operator · Shop Portal";
  }

  if (normalized === "medspa") {
    return "MedSpa Operator · Shop Portal";
  }

  if (normalized === "dental") {
    return "Dental Operator · Shop Portal";
  }

  return "Operator · Shop Portal";
}

function summarizeProject(project: any) {
  const chips: string[] = [];

  if (project.aftercare_sent_at) chips.push("Aftercare ✅");
  else if (project.aftercare_planned_at) chips.push("Aftercare ⏳");

  if (project.cw1_sent_at) chips.push("CW1 ✅");
  else if (project.cw1_planned_at) chips.push("CW1 ⏳");

  if (project.cw2_sent_at) chips.push("CW2 ✅");
  else if (project.cw2_planned_at) chips.push("CW2 ⏳");

  if (project.cw3_sent_at) chips.push("CW3 ✅");
  else if (project.cw3_planned_at) chips.push("CW3 ⏳");

  if (project.review_requested_at) chips.push("Review ✅");
  else if (project.review_planned_at) chips.push("Review ⏳");

  if (project.photo_requested_at) chips.push("Portfolio ✅");
  else if (project.portfolio_request_planned_at) chips.push("Portfolio ⏳");

  return chips;
}

function buildNextActions(projects: any[]) {
  const now = Date.now();
  const rows: Array<{ title: string; subtitle: string; ts: number }> = [];

  for (const project of projects) {
    const clientName = project.client_name || "Client";

    const candidates = [
      ["Aftercare due", project.aftercare_planned_at, project.aftercare_sent_at],
      ["Contact card due", project.contact_card_planned_at, project.contact_card_sent_at],
      ["CW1 due", project.cw1_planned_at, project.cw1_sent_at],
      ["CW2 due", project.cw2_planned_at, project.cw2_sent_at],
      ["CW3 due", project.cw3_planned_at, project.cw3_sent_at],
      ["Review due", project.review_planned_at, project.review_requested_at],
      ["Portfolio due", project.portfolio_request_planned_at, project.photo_requested_at],
    ];

    for (const [label, plannedAt, sentAt] of candidates) {
      if (!plannedAt || sentAt) continue;
      const ts = new Date(plannedAt as string).getTime();
      if (Number.isNaN(ts) || ts < now) continue;

      rows.push({
        title: `${label} → ${clientName}`,
        subtitle: project.service_summary || "Upcoming lifecycle action",
        ts,
      });
    }
  }

  return rows
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 6)
    .map((row) => ({
      title: row.title,
      subtitle: row.subtitle,
      stateLabel: timeAgoLabel(new Date(row.ts).toISOString()).replace("ago", "from now"),
    }));
}

function buildAttention(projects: any[], latestRun: any, queuedActions: any[] = []) {
  const items: any[] = [];

  const queuedCloseout = queuedActions.find((action) => action?.action_type === "closeout");
  if (queuedCloseout) {
    const artistLabel = queuedCloseout.artist_name
      ? `${queuedCloseout.artist_name}’s appointment is already queued for close-out.`
      : "An appointment is already queued for close-out.";

    return [{
      title: "Isla is handling this",
      subtitle: artistLabel,
      chipLabel: "Queued",
      chipClass: "",
    }];
  }

  const overdueCompletion = projects.find((project) => {
    if (!project.completion_check_planned_at) return false;
    if (project.completion_confirmed_at) return false;
    return new Date(project.completion_check_planned_at).getTime() < Date.now();
  });

  if (overdueCompletion) {
    items.push({
      title: "Completion confirmation overdue",
      subtitle: `${overdueCompletion.client_name || "Client"} is missing DONE confirmation. Escalation may be approaching.`,
      chipLabel: "Watch",
      chipClass: "is-warn",
    });
  }

  if (latestRun?.status === "error") {
    items.push({
      title: "Worker reported an error",
      subtitle: latestRun?.details_json?.error || "Latest process-due-actions run returned an error.",
      chipLabel: "Alert",
      chipClass: "is-alert",
    });
  }

  if (!items.length) {
    items.push({
      title: "Worker healthy",
      subtitle: "No active warnings or escalations need attention right now.",
      chipLabel: "Clear",
      chipClass: "",
    });
  }

  return items;
}

async function buildOperatorDashboardPayload() {
  const shops = await fetchJson("/rest/v1/shops?select=id,name,logo_url,vertical,created_at&order=created_at.desc&limit=1");
  const shop = Array.isArray(shops) ? shops[0] : null;

  const shopId = shop?.id;

  let shopSettings = null;
  let roster = [] as any[];

  if (shopId) {
    const settingsRows = await fetchJson(`/rest/v1/shop_settings?shop_id=eq.${shopId}&select=hours_mode,hours_template,owner_is_provider,updated_at&limit=1`);
    shopSettings = Array.isArray(settingsRows) ? settingsRows[0] : null;

    const rosterRows = await fetchJson(`/rest/v1/shop_roster?shop_id=eq.${shopId}&select=id,name,phone,role`);
    roster = Array.isArray(rosterRows) ? rosterRows : [];
  }

  let queuedActions = [] as any[];
  if (shopId) {
    const queuedRows = await fetchJson(`/rest/v1/isla_actions?shop_id=eq.${shopId}&status=eq.queued&select=id,action_type,artist_name,title,message,status,created_at&order=created_at.desc&limit=10`);
    queuedActions = Array.isArray(queuedRows) ? queuedRows : [];
  }

  const workerRuns = await fetchJson("/rest/v1/worker_runs?worker_name=eq.process-due-actions&order=created_at.desc&limit=10");
  const latestRun = Array.isArray(workerRuns) ? workerRuns[0] : null;

  const systemEvents = await fetchJson("/rest/v1/system_events?event_type=like.lifecycle.*stub_logged&order=created_at.desc&limit=20");
  const projectFolders = await fetchJson("/rest/v1/project_folders?order=updated_at.desc&limit=50");
  const projects = Array.isArray(projectFolders) ? projectFolders : [];

  const recentActions = (Array.isArray(systemEvents) ? systemEvents : []).slice(0, 8).map((event: any) => {
    const actionName = titleCase(actionLabelFromEventType(event.event_type));
    const clientName = event?.event_payload?.client_name || "Client";

    return {
  title: `${actionName} sent → ${clientName}`,
  subtitle: event?.event_payload?.message || "Lifecycle action logged by Isla.",
  timeLabel: timeAgoLabel(event.created_at),
  createdAt: event.created_at,
};
  });

  const activeProjects = projects.slice(0, 8).map((project: any) => ({
    title: `${project.client_name || "Client"} — ${project.service_summary || "Project"}`,
    subtitle: project.notes_internal || project.next_required_action || "Lifecycle in motion.",
    stateLabel: project.completion_confirmed_at ? "Healthy" : "In Progress",
    stateClass: project.completion_confirmed_at ? "is-done" : "is-upcoming",
    chips: summarizeProject(project),
    projectFolderUrl: project.project_folder_link || "#",
  }));

  const lifecycleActionCount = recentActions.length;
  const dailyBreakdown = {
    carewatch: recentActions.filter((item: any) => /carewatch|cw1|cw2|cw3/i.test(item.title || "")).length,
    review: recentActions.filter((item: any) => /review/i.test(item.title || "")).length,
    rebooking: recentActions.filter((item: any) => /rebook/i.test(item.title || "")).length,
  };
  const attentionItems = buildAttention(projects, latestRun, queuedActions);

  return {
    shopId: shop?.id || null,
    shopName: shop?.name || "Your Business",
    logoUrl: shop?.logo_url || "",
    verticalLabel: verticalLabelFromValue(shop?.vertical),
    hoursMode: shopSettings?.hours_mode || null,
    hoursTemplate: shopSettings?.hours_template || null,
    ownerIsProvider: shopSettings?.owner_is_provider ?? null,
    rosterCount: roster.length,
    roster: roster.map((person: any) => ({
      id: person.id,
      name: person.name,
      role: person.role,
    })),
    queuedActions: queuedActions.map((action: any) => ({
      id: action.id,
      actionType: action.action_type,
      artistName: action.artist_name,
      title: action.title,
      message: action.message,
      status: action.status,
      createdAt: action.created_at,
    })),
    engine: {
      status: latestRun?.status === "error" ? "Attention" : "Running",
      lastRunLabel: timeAgoLabel(latestRun?.ran_at),
      nextRunLabel: nextRunLabel(latestRun?.ran_at),
      lastResultLabel: latestRun
        ? `${latestRun.processed_count || 0} processed · ${latestRun.status || "unknown"}`
        : "No runs yet",
    },
    impact: {
      influencedRevenue: `$${(lifecycleActionCount * 120).toLocaleString()}`,
      lifecycleActions: String(lifecycleActionCount),
      attentionCount: String(attentionItems.filter((item) => item.chipClass).length),
      teamSize: String(roster.length),
    },
    recentActions,
    dailyBreakdown,
    nextActions: buildNextActions(projects),
    activeProjects,
    attention: attentionItems,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
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
    const payload = await buildOperatorDashboardPayload();

    return new Response(
      JSON.stringify(payload),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

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
