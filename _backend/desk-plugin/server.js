import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio sends webhook bodies as form-urlencoded
app.use(express.json({ limit: "100kb" })); // small by design (no PHI blobs)


// ===== ENV LOADER (simple local v1) =====
const ENV_PATH = path.resolve(SITE_ROOT_FOR_ENV(), ".env");
loadEnvFile(ENV_PATH);

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// TEMP proof-only appointment target
const TEST_APPOINTMENT_ID = "9abaef82-4031-4a36-8a3a-9bfda382f406";

function SITE_ROOT_FOR_ENV() {
  return path.resolve(__dirname, "..", "..");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
// ===== CONFIG =====
// Points at your existing plugin UI folder:
const SITE_ROOT = path.resolve(__dirname, "..", ".."); // /site

const PLUGIN_ROOTS = {
  dental: path.resolve(SITE_ROOT, "_plugins", "dental", "desk"),
  tattoo: path.resolve(SITE_ROOT, "_plugins", "tattoo", "desk"),
  medspa: path.resolve(SITE_ROOT, "_plugins", "medspa", "desk"),
  pt: path.resolve(SITE_ROOT, "_plugins", "pt", "desk"),
};

// Arrival eligibility window (simple v1)
const ARRIVAL_WINDOW_MINUTES_BEFORE = 60;
const ARRIVAL_WINDOW_MINUTES_AFTER = 240;

// ===== IN-MEMORY STORAGE (v1 local mock backend) =====
// Replace later with DB/filesystem/real calendar integration.
// This is only to prove contract + UI non-mock mode.
const tokens = new Map([
  // token -> { shop_id, role, expires_at, revoked }
  ["demo-desk-token", { shop_id: "shop_demo_001", role: "desk", expires_at: futureDays(90), revoked: false }],
  ["demo-clinical-token", { shop_id: "shop_demo_001", role: "clinical", expires_at: futureDays(90), revoked: false }],
  ["demo-provider-token", { shop_id: "shop_demo_001", role: "provider", expires_at: futureDays(90), revoked: false }]
]);

// "Today appointments" demo dataset
// In reality these come from the calendar + normalization layer.
const appointments = new Map([
  // appointment_id -> { shop_id, start_ts, patient_label, category_label, provider_label, arrived }
  ["apt_001", { shop_id: "shop_demo_001", start_ts: todayAt(9, 0), patient_label: "Morgan R.", category_label: "cleaning", provider_label: "Hygienist", arrived: false }],
  ["apt_002", { shop_id: "shop_demo_001", start_ts: todayAt(10, 30), patient_label: "Jamie K.", category_label: "exam", provider_label: "Dr.", arrived: false }],
  ["apt_003", { shop_id: "shop_demo_001", start_ts: todayAt(13, 15), patient_label: "Taylor S.", category_label: "ortho_consult", provider_label: "Ortho", arrived: true }]
]);

// Arrival events (write-once)
const arrivalEvents = new Set(); // appointment_id

// Scheduling request events
const schedulingRequests = []; // push events (enums only)

// ===== Helpers =====
function futureDays(days) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}
function todayAt(h, m) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
function withinArrivalWindow(start_ts) {
  const now = Date.now();
  const before = start_ts - ARRIVAL_WINDOW_MINUTES_BEFORE * 60 * 1000;
  const after = start_ts + ARRIVAL_WINDOW_MINUTES_AFTER * 60 * 1000;
  return now >= before && now <= after;
}

function resolveToken(token) {
  const rec = tokens.get(token);
  if (!rec) return { ok: false, reason: "link_invalid" };
  if (rec.revoked) return { ok: false, reason: "link_invalid" };
  if (Date.now() > rec.expires_at) return { ok: false, reason: "link_invalid" };
  return { ok: true, ...rec };
}

function jsonOk(res, obj) {
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(JSON.stringify(obj));
}

// ===== Serve plugin UI (so Safari can open a real link) =====
// Examples:
//   http://localhost:8787/plugins/dental/desk/?token=demo-desk-token
//   http://localhost:8787/plugins/tattoo/desk/?token=demo-desk-token
app.use("/plugins/:vertical/desk", (req, res, next) => {
  const vertical = req.params.vertical;
  const root = PLUGIN_ROOTS[vertical];

  if (!root) {
    return res.status(404).send("Plugin not found");
  }

  express.static(root, { extensions: ["html"] })(req, res, next);
});
// ===== GENERIC VERTICAL DESK API BRIDGE (v1) =====
// For now: only "dental" is implemented.
// This lets the URL shape be universal without duplicating logic.
app.use("/api/:vertical/desk", (req, res, next) => {
    console.log("BRIDGE HIT:", req.method, req.originalUrl, "baseUrl=", req.baseUrl, "url=", req.url);
    
  const v = String(req.params.vertical || "").toLowerCase();

  if (v !== "dental") {
    return jsonOk(res, { ok: false, reason: "not_implemented" });
  }

  // IMPORTANT:
  // Because this middleware is mounted at /api/:vertical/desk
  // req.url is now "/session", "/mark_arrived", etc.
  req.url = "/api/dental/desk" + req.url;

  next();
});

// ===== API CONTRACT: 1) GET session =====
app.get("/api/dental/desk/session", (req, res) => {
  const token = String(req.query.token || "");
  const t = resolveToken(token);
  if (!t.ok) return jsonOk(res, { ok: false, reason: "link_invalid" });

  const shop_id = t.shop_id;
  const role = t.role;

  // Normalize appointments for UI (minimal labels only)
  const todays = [];
  for (const [appointment_id, a] of appointments.entries()) {
    if (a.shop_id !== shop_id) continue;
    todays.push({
      appointment_id,
      time_label: new Date(a.start_ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      patient_label: a.patient_label,
      category_label: a.category_label,
      provider_label: a.provider_label,
      arrived: !!a.arrived
    });
  }

  // Stable sort by appointment start time (earliest first)
  todays.sort((a, b) => {
    const at = appointments.get(a.appointment_id)?.start_ts ?? 0;
    const bt = appointments.get(b.appointment_id)?.start_ts ?? 0;
    return at - bt;
  });

  return jsonOk(res, {
    ok: true,
    role,
    shop_name: "Demo Shop",
    timezone: "America/New_York",
    appointments: todays
  });
});

// ===== API CONTRACT: 2) POST mark_arrived =====
app.post("/api/dental/desk/mark_arrived", (req, res) => {
  const { token, appointment_id } = req.body || {};
  const t = resolveToken(String(token || ""));
  if (!t.ok) return jsonOk(res, { ok: false, outcome: "blocked", reason: "link_invalid" });

  if (t.role !== "desk") return jsonOk(res, { ok: true, outcome: "blocked", reason: "role" });

  const a = appointments.get(String(appointment_id || ""));
  if (!a) return jsonOk(res, { ok: true, outcome: "blocked", reason: "not_found" });
  if (a.shop_id !== t.shop_id) return jsonOk(res, { ok: true, outcome: "blocked", reason: "not_found" });

  // eligibility gate
  if (!withinArrivalWindow(a.start_ts)) {
    // canon: no-op silently; UI may show inline reason depending on implementation
    return jsonOk(res, { ok: true, outcome: "no_op", reason: "not_eligible" });
  }

  // mutual cancellation simulation:
  // (In real system, you'd check HERE-accepted state from Scene 4 event store.)
  // We'll treat "already arrived" as "already accepted by some arrival source"
  if (a.arrived || arrivalEvents.has(String(appointment_id))) {
    return jsonOk(res, { ok: true, outcome: "no_op", reason: "duplicate" });
  }

  // write-once arrival
  arrivalEvents.add(String(appointment_id));
  a.arrived = true;

  // packet delivery would happen here (internal only) — we do not message client.
  // In v1 local backend we just accept.

  return jsonOk(res, { ok: true, outcome: "accepted" });
});

// ===== API CONTRACT: 3) POST schedule_followup =====
const ENUMS = {
  appointment_category: new Set(["cleaning", "exam", "consultation", "ortho_consult", "follow_up"]),
  duration: new Set(["15m", "30m", "45m", "60m", "90m"]),
  scheduling_reason: new Set(["routine_next_visit", "post_visit_follow_up", "treatment_progress_check", "missed_visit_rebook", "provider_requested"]),
  patient_status: new Set(["new", "existing", "unknown"]),
  preferred_time: new Set(["", "morning", "afternoon", "any"])
};

function enumOk(key, val) {
  return ENUMS[key]?.has(String(val ?? "")) ?? false;
}

app.post("/api/dental/desk/schedule_followup", (req, res) => {
  const {
    token,
    appointment_id,
    appointment_category,
    duration,
    scheduling_reason,
    patient_status,
    preferred_time
  } = req.body || {};

  const t = resolveToken(String(token || ""));
  if (!t.ok) return jsonOk(res, { ok: false, outcome: "blocked", reason: "link_invalid" });

  if (!["desk", "clinical", "provider"].includes(t.role)) {
    return jsonOk(res, { ok: true, outcome: "blocked", reason: "role" });
  }

  const a = appointments.get(String(appointment_id || ""));
  if (!a) return jsonOk(res, { ok: true, outcome: "blocked", reason: "not_found" });
  if (a.shop_id !== t.shop_id) return jsonOk(res, { ok: true, outcome: "blocked", reason: "not_found" });

  // Strict enum validation (no drift)
  if (!enumOk("appointment_category", appointment_category)) return jsonOk(res, { ok: true, outcome: "blocked", reason: "bad_enum" });
  if (!enumOk("duration", duration)) return jsonOk(res, { ok: true, outcome: "blocked", reason: "bad_enum" });
  if (!enumOk("scheduling_reason", scheduling_reason)) return jsonOk(res, { ok: true, outcome: "blocked", reason: "bad_enum" });
  if (!enumOk("patient_status", patient_status)) return jsonOk(res, { ok: true, outcome: "blocked", reason: "bad_enum" });
  if (!enumOk("preferred_time", preferred_time ?? "")) return jsonOk(res, { ok: true, outcome: "blocked", reason: "bad_enum" });

  // Store event (enums only, no free text)
  schedulingRequests.push({
    ts: Date.now(),
    shop_id: t.shop_id,
    role: t.role,
    appointment_id: String(appointment_id),
    appointment_category: String(appointment_category),
    duration: String(duration),
    scheduling_reason: String(scheduling_reason),
    patient_status: String(patient_status),
    preferred_time: String(preferred_time ?? "")
  });

  // In real system: enqueue Isla workflow entry point (Scene 2 entry) here.
  // v1 local: accept silently.
  return jsonOk(res, { ok: true, outcome: "accepted" });
});

// ===== Hard rule: no HTML error pages for API =====
app.use("/api", (req, res) => {
  jsonOk(res, { ok: false, reason: "not_found" });
});

app.post("/twilio", async (req, res) => {
  console.log("📩 Twilio hit:", req.body);

  const message = String(req.body?.Body || "").toLowerCase().trim();
  const from = String(req.body?.From || "").trim();

  if (!message) {
    console.log("⚠️ Twilio webhook received without Body");
    res.type("text/xml");
    return res.send("<Response></Response>");
  }

  const isDone = message === "done";
const isNoShow = message === "no show" || message === "noshow";

if (!isDone && !isNoShow) {
    console.log("⏭️ Ignored inbound SMS:", { from, message });
    res.type("text/xml");
    return res.send("<Response></Response>");
  }

console.log("✅ Received completion signal:", {
  from,
  message,
  signal: isDone ? "done" : "no_show"
});

  if (!supabase) {
    console.log("❌ Supabase client not configured");
    res.type("text/xml");
    return res.send("<Response></Response>");
  }

  // 1. Find artist by phone
  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("artist_name")
    .eq("artist_phone", from)
    .single();

  if (artistError || !artist) {
    console.log("❌ No artist found for phone:", from, artistError);
    res.type("text/xml");
    return res.send("<Response></Response>");
  }

  console.log("👤 Matched artist:", artist);

  // 2. Find most recent started appointment for that artist
  const now = new Date().toISOString();

  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status")
    .eq("artist_name", artist.artist_name)
    .lte("start_time", now)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (apptError) {
    console.log("❌ Appointment query failed:", apptError);
    res.type("text/xml");
    return res.send("<Response></Response>");
  }

  if (!appt) {
    console.log("⚠️ No appointment found for artist (likely no test data yet):", artist.artist_name);
    res.type("text/xml");
    return res.send("<Response></Response>");
  }

  console.log("🎯 Matched appointment:", appt);

  // 3. Mark it done
  const rpcName = isNoShow ? "mark_appointment_no_show" : "mark_appointment_done";

const { data, error } = await supabase.rpc(rpcName, {
  appt_id: appt.id
});

if (error) {
  console.log(`❌ Supabase ${rpcName} failed:`, error);
  res.type("text/xml");
  return res.send("<Response></Response>");
}

console.log("🎉 Appointment outcome recorded in Supabase:", {
  appointment_id: appt.id,
  outcome: isNoShow ? "no_show" : "done",
  rpc: rpcName,
  result: data
});

  res.type("text/xml");
  return res.send("<Response></Response>");
});


async function sendDueCompletionPrompts() {
  if (!supabase) {
    console.log("❌ Supabase client not configured");
    return;
  }

  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
  const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "";

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.log("❌ Twilio env not configured");
    return;
  }

  const twilio = (await import("twilio")).default;
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  const { data: actions, error } = await supabase.rpc("get_due_completion_actions");

  if (error) {
    console.log("❌ get_due_completion_actions failed:", error);
    return;
  }

  if (!actions || actions.length === 0) {
    console.log("ℹ️ No due completion actions");
    return;
  }

  for (const action of actions) {

    let targetPhone = action.artist_phone;

    if (action.action === "send_escalation") {
      targetPhone = action.escalation_contact_phone || action.artist_phone;
    }

    if (!targetPhone) {
      console.log("⚠️ Missing contact for escalation ladder:", action.appointment_id);

      await supabase.rpc("mark_completion_blocked_missing_contact", {
        p_appointment_id: action.appointment_id,
        p_reason: "missing_all_contacts"
      });

      continue;
    }

    let body = null;

    if (action.action === "send_initial_prompt") {
      body = "All set?";
    } else if (action.action === "send_nudge") {
      body = action.here_signal_present
        ? "Quick check — was that session completed?"
        : "Quick check — did the client come in today?";
    } else if (action.action === "send_escalation") {
      body = action.here_signal_present
        ? "Heads up — we still need completion confirmation for a finished session. Can you mark it done?"
        : "Heads up — we don’t have confirmation whether the client showed. Can you mark done or no show?";
    } else {
      continue;
    }

    try {
      const msg = await client.messages.create({
        from: TWILIO_FROM_NUMBER,
        to: targetPhone,
        body
      });

      console.log("📤 Sent completion ladder message:", {
        appointment_id: action.appointment_id,
        sid: msg.sid
      });

      if (action.action === "send_initial_prompt") {
        await supabase.rpc("register_completion_prompt", {
          p_shop_id: action.shop_id,
          p_appointment_id: action.appointment_id,
          p_escalation_contact_name: action.escalation_contact_name,
          p_escalation_contact_phone: action.escalation_contact_phone,
          p_escalation_contact_role: action.escalation_contact_role
        });

        console.log("✅ Completion control registered:", action.appointment_id);
      } else if (action.action === "send_nudge") {
        await supabase.rpc("mark_completion_nudged", {
          p_appointment_id: action.appointment_id
        });

        console.log("✅ Completion control marked nudged:", action.appointment_id);
      } else if (action.action === "send_escalation") {
        await supabase.rpc("mark_completion_escalated", {
          p_appointment_id: action.appointment_id
        });

        console.log("🚨 Completion escalated:", action.appointment_id);
      }
    } catch (err) {
      console.log("❌ Twilio send failed:", err.message);
    }
  }
}
// ===== TEST ROUTE: SEND COMPLETION PROMPTS =====
app.post("/test/send-completion-prompts", async (req, res) => {
  try {
    await sendDueCompletionPrompts();
    return res.json({ ok: true });
  } catch (err) {
    console.error("🔥 /test/send-completion-prompts failed:", err);
    return res.status(500).json({ ok: false, error: err?.message || "unknown error" });
  }
});

const PORT = 8787;
app.listen(PORT, () => {
  console.log(`RR Desk Plugin backend running on http://localhost:${PORT}`);
  console.log(`Desk UI (Dental demo): http://localhost:${PORT}/plugins/dental/desk/?token=demo-desk-token`);
  console.log(`Desk UI (Tattoo shell): http://localhost:${PORT}/plugins/tattoo/desk/?token=demo-desk-token`);
  console.log(`Desk UI (MedSpa shell): http://localhost:${PORT}/plugins/medspa/desk/?token=demo-desk-token`);
  console.log(`Desk UI (PT shell): http://localhost:${PORT}/plugins/pt/desk/?token=demo-desk-token`);
  console.log(`Twilio webhook: http://localhost:${PORT}/twilio`);
});