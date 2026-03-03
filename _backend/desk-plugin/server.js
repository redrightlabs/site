import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json({ limit: "100kb" })); // small by design (no PHI blobs)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const PORT = 8787;
app.listen(PORT, () => {
  console.log(`RR Desk Plugin backend running on http://localhost:${PORT}`);
  console.log(`Desk UI (Dental demo): http://localhost:${PORT}/plugins/dental/desk/?token=demo-desk-token`);
  console.log(`Desk UI (Tattoo shell): http://localhost:${PORT}/plugins/tattoo/desk/?token=demo-desk-token`);
  console.log(`Desk UI (MedSpa shell): http://localhost:${PORT}/plugins/medspa/desk/?token=demo-desk-token`);
  console.log(`Desk UI (PT shell): http://localhost:${PORT}/plugins/pt/desk/?token=demo-desk-token`);
});