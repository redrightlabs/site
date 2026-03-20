import { generateSchedule } from "../_shared/scheduling.ts";
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

async function insertProjectFolderRow(payload: {
  projectFolderId: string;
  organizationId: string;
  organizationClientId: string;
  projectType: string;
  source: string;
  clientName: string;
  serviceSummary: string;
}) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(`${supabaseUrl}/rest/v1/project_folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      project_folder_id: payload.projectFolderId,
      organization_id: payload.organizationId,
      organization_client_id: payload.organizationClientId,
      project_type: payload.projectType,
      source: payload.source,
      client_name: payload.clientName,
      service_summary: payload.serviceSummary,
      lifecycle_state: "Lead",
      folder_status: "not_created",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to insert project_folders row: ${res.status} ${JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : data;
}

async function applyScheduleToProjectFolder(
  projectFolderId: string,
  schedule: ReturnType<typeof generateSchedule>,
) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(
    `${supabaseUrl}/rest/v1/project_folders?project_folder_id=eq.${encodeURIComponent(projectFolderId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        prep_planned_at: schedule.prep_planned_at,
        completion_check_planned_at: schedule.completion_check_planned_at,
        aftercare_planned_at: schedule.aftercare_planned_at,
        cw1_planned_at: schedule.cw1_planned_at,
        cw2_planned_at: schedule.cw2_planned_at,
        cw3_planned_at: schedule.cw3_planned_at,
        review_planned_at: schedule.review_planned_at,
        portfolio_request_planned_at: schedule.portfolio_request_planned_at,
        artist_done_nudge_planned_at: schedule.escalation_plan?.artist_done_nudge_planned_at,
        escalation_to_manager_planned_at: schedule.escalation_plan?.escalation_to_manager_planned_at,
      }),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to apply schedule to project_folders row: ${res.status} ${JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : data;
}
async function getProjectFolderRow(projectFolderId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(
    `${supabaseUrl}/rest/v1/project_folders?project_folder_id=eq.${encodeURIComponent(projectFolderId)}&select=*`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to read project_folders row: ${res.status} ${JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : data;
}

async function callCreateDriveFolder(projectFolderId: string, projectName: string) {
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!serviceRoleKey) throw new Error("Missing SERVICE_ROLE_KEY");

  const res = await fetch(`${supabaseUrl}/functions/v1/create-drive-folder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      projectFolderId,
      projectName,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to create Drive folder: ${res.status} ${JSON.stringify(data)}`);
  }

  return data;
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
    const {
      projectFolderId,
      organizationId,
      organizationClientId,
      projectType,
      source,
      clientName,
      serviceSummary,
    } = await req.json();

    if (!projectFolderId || typeof projectFolderId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing projectFolderId" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!organizationId || typeof organizationId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing organizationId" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!organizationClientId || typeof organizationClientId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing organizationClientId" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const safeProjectType =
      typeof projectType === "string" && projectType.trim()
        ? projectType.trim()
        : "consult";

    const safeSource =
      typeof source === "string" && source.trim()
        ? source.trim()
        : "manual";

    const safeClientName =
      typeof clientName === "string" && clientName.trim()
        ? clientName.trim()
        : "Unknown Client";

    const safeServiceSummary =
      typeof serviceSummary === "string" && serviceSummary.trim()
        ? serviceSummary.trim()
        : "Project";

    await insertProjectFolderRow({
      projectFolderId,
      organizationId,
      organizationClientId,
      projectType: safeProjectType,
      source: safeSource,
      clientName: safeClientName,
      serviceSummary: safeServiceSummary,
    });

    const drive = await callCreateDriveFolder(
      projectFolderId,
      `${safeClientName} - ${safeServiceSummary}`,
    );

    const schedule = generateSchedule({
      startDate: new Date().toISOString(),
      sessionCount: 1,
      healingDays: 21,
      sessionHours: 4,
    });

       const scheduleWriteback = await applyScheduleToProjectFolder(projectFolderId, schedule);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const updatedProject = await getProjectFolderRow(projectFolderId);

    return new Response(
      JSON.stringify({
        project: updatedProject,
        drive,
        schedule,
        scheduleWriteback,
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