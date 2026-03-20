function generateProjectId() {
  return "pf_" + crypto.randomUUID();
}

async function createProjectFolder({
  projectFolderId,
  organizationId,
  organizationClientId,
  clientName,
  serviceSummary
}) {
  const SUPABASE_FUNCTION_URL =
    "https://uwydiqltvchlmjvzwkal.functions.supabase.co/create-project-folder";

  const ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3eWRpcWx0dmNobG1qdnp3a2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODg3NDcsImV4cCI6MjA4Nzg2NDc0N30.lRDxjO8cBV8gf04MeP6ZPCAjPy4ckQA8Ums2rR-ocps";

  const res = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      projectFolderId,
      organizationId,
      organizationClientId,
      projectType: "consult",
      source: "demo_console",
      clientName,
      serviceSummary
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Project creation failed");
  }

  return data;
}