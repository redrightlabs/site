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

  return Array.isArray(data) ? data[0] : null;
}

async function confirmProjectDone(payload: {
  projectFolderId: string;
  confirmedBy: string;
}) {
  const serviceRoleKey = getServiceRoleKey();
  const now = new Date();

  const aftercarePlannedAt = new Date(now);
  aftercarePlannedAt.setHours(aftercarePlannedAt.getHours() + 1);
  const contactCardPlannedAt = new Date(aftercarePlannedAt);

  const res = await fetch(
    `${supabaseUrl}/rest/v1/project_folders?project_folder_id=eq.${encodeURIComponent(payload.projectFolderId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        completion_confirmed_at: now.toISOString(),
        completion_confirmed_by: payload.confirmedBy,
        aftercare_planned_at: aftercarePlannedAt.toISOString(),
        contact_card_planned_at: contactCardPlannedAt.toISOString(),
        escalation_flag: false,
      }),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to confirm project done: ${res.status} ${JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : data;
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
    const { projectFolderId, confirmedBy } = await req.json();

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

    const safeConfirmedBy =
      typeof confirmedBy === "string" && confirmedBy.trim()
        ? confirmedBy.trim()
        : "artist";

    const existingProject = await getProjectFolderRow(projectFolderId);

    if (!existingProject) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

        const doneWriteback = await confirmProjectDone({
      projectFolderId,
      confirmedBy: safeConfirmedBy,
    });

    const updatedProject = await getProjectFolderRow(projectFolderId);

    return new Response(
      JSON.stringify({
        ok: true,
        project: updatedProject,
        doneWriteback,
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