const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = "https://uwydiqltvchlmjvzwkal.supabase.co";

async function getGoogleAccessToken() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth secrets");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token as string;
}

function getServiceRoleKey() {
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!serviceRoleKey) throw new Error("Missing SERVICE_ROLE_KEY");
  return serviceRoleKey;
}

async function getProjectFolderRow(projectFolderId: string) {
  const serviceRoleKey = getServiceRoleKey();

  const res = await fetch(
    `${supabaseUrl}/rest/v1/project_folders?project_folder_id=eq.${encodeURIComponent(projectFolderId)}&select=project_folder_id,project_folder_external_id,project_folder_link,folder_status`,
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

async function writeFolderBackToSupabase(
  projectFolderId: string,
  folderId: string,
  folderUrl: string,
) {
  const serviceRoleKey = getServiceRoleKey();

  const updateRes = await fetch(
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
        project_folder_external_id: folderId,
        project_folder_link: folderUrl,
        folder_status: "ready",
      }),
    },
  );

  const updateData = await updateRes.text();

  if (!updateRes.ok) {
    throw new Error(`Failed Supabase writeback: ${updateRes.status} ${updateData}`);
  }

  return updateData;
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
    const { projectName, projectFolderId } = await req.json();

    if (!projectName || typeof projectName !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing projectName" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

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

    const existing = await getProjectFolderRow(projectFolderId);

    if (
      existing &&
      existing.folder_status === "ready" &&
      existing.project_folder_external_id &&
      existing.project_folder_link
    ) {
      return new Response(
        JSON.stringify({
          folderId: existing.project_folder_external_id,
          folderUrl: existing.project_folder_link,
          projectFolderId,
          writeback: "already_ready",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER");
    if (!rootFolderId) throw new Error("Missing GOOGLE_DRIVE_ROOT_FOLDER");

    const accessToken = await getGoogleAccessToken();

    const driveRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      }),
    });

    const data = await driveRes.json();

    if (!driveRes.ok) {
      return new Response(
        JSON.stringify({ error: "Google Drive API error", details: data }),
        {
          status: driveRes.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const folderId = data.id as string;
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    await writeFolderBackToSupabase(projectFolderId, folderId, folderUrl);

    return new Response(
      JSON.stringify({
        folderId,
        folderUrl,
        projectFolderId,
        writeback: "ok",
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