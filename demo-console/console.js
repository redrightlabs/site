/* ===============================
   REDRIGHT ISLA DEMO CONSOLE
   console.js
   v3 — 6 Month ProjectFlow Planner
   =============================== */

/* ===============================
   LIVE MODE CONFIG
   Fill these in when you're ready to point the demo
   at your real Supabase event stream.
   =============================== */

window.ISLA_SUPABASE_CONFIG = window.ISLA_SUPABASE_CONFIG || {
  url: "https://uwydiqltvchlmjvzwkal.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3eWRpcWx0dmNobG1qdnp3a2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODg3NDcsImV4cCI6MjA4Nzg2NDc0N30.lRDxjO8cBV8gf04MeP6ZPCAjPy4ckQA8Ums2rR-ocps",
  shopId: "5f9679d4-b202-49ba-9424-879a69a8fe8c",
  pollMs: 2500,
  liveMode: false
};

const LIVE_CONFIG = window.ISLA_SUPABASE_CONFIG;
const LIVE_MODE = Boolean(LIVE_CONFIG.liveMode && LIVE_CONFIG.url && LIVE_CONFIG.anonKey && LIVE_CONFIG.shopId);
let livePollHandle = null;
let lastSeenEventId = 0;
const processedEventIds = new Set();
let liveStartedAt = null;

const operationsLog = document.getElementById("operations-log");
const revenueValue = document.querySelector(".revenue-value");
const timelineSteps = Array.from(document.querySelectorAll(".journey-step"));
const controlButtons = Array.from(document.querySelectorAll(".control-btn"));
const calendarGrid = document.getElementById("calendar-grid");

let estimatedRevenue = 0;
let logQueue = [];
let isLogTyping = false;
let isCreatingLiveProject = false;
let pendingLifecycleDemo = null;

const EVENT_LABELS = {
  "call.inbound": "📞 Incoming Call",
  "call.completed": "📴 Call Completed",
  "scene1.intent.started": "🧭 Qualification Started",
  "scene2.discovery.started": "🎬 Discovery Started",
  "scene2.discovery.updated": "📝 Discovery Updated",
  "scene2.artist_review.submitted": "🎨 Artist Review Submitted",
  "scene2.artist_classification.received": "🧑‍🎨 Artist Classification Received",
  "scene2.slot_options.generated": "📅 Appointment Slots Generated",
  "scene2.slot_options.sent_to_client": "📨 Slot Options Sent",
  "scene2.slot_selected": "✅ Slot Selected",
  "calendar.event.created": "🗓️ Calendar Event Created",
  "booking.confirmed": "✅ Booking Confirmed",
  "scene3.prep.sent": "📋 Prep Sent",
  "scene4.here.received": "📍 HERE Received",
  "scene4.completion_check.sent": "🧾 Completion Check Sent",
  "scene4.completion_confirmed.done": "✅ Appointment Marked Done",
  "scene5.aftercare.sent": "📘 Aftercare Sent",
  "scene5.contact_card.sent": "🪪 Contact Card Sent",
  "scene5.carewatch.armed": "🛟 CareWatch Armed",
};


/* -------------------------------
   Helpers
-------------------------------- */

function nowStamp() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addLog(message) {
  logQueue.push(message);
  if (isLogTyping) return;

  isLogTyping = true;

  function processNext() {
    const nextMessage = logQueue.shift();

    if (!nextMessage) {
      isLogTyping = false;
      return;
    }

    const entry = document.createElement("div");
    entry.className = "log-entry";

    const prefix = `[${nowStamp()}] `;
    const full = prefix + nextMessage;

    entry.textContent = "";
    operationsLog.prepend(entry);

    let i = 0;

    function type() {
      if (i < full.length) {
        entry.textContent += full.charAt(i);
        i++;
        setTimeout(type, 22);
      } else {
        setTimeout(processNext, 80);
      }
    }

    type();
  }

  processNext();
}

function setRevenue(amount) {
  const start = estimatedRevenue;
  const end = amount;
  const duration = 700;
  const startTime = performance.now();

  if (!revenueValue) {
    estimatedRevenue = end;
    return;
  }

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.floor(start + (end - start) * progress);

    revenueValue.textContent = `$${value.toLocaleString()}`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      estimatedRevenue = end;
      revenueValue.textContent = `$${end.toLocaleString()}`;
          revenueValue?.classList.add("bump");
      window.setTimeout(() => revenueValue?.classList.remove("bump"), 350);
    
    }
  }

  requestAnimationFrame(tick);
}

function incrementRevenue(amount) {
  setRevenue(estimatedRevenue + amount);
}

function activateTimelineStep(stepLabel) {
  timelineSteps.forEach((step) => {
    const matches = step.textContent.trim().toLowerCase() === stepLabel.trim().toLowerCase();
    step.classList.toggle("active", matches);
  });

  pulseJourneyStep(stepLabel);
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthTitle(date) {
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function normalizeEventType(type) {
  const map = {
    "call.incoming": "call.inbound",
    "scene2.slot_options.sent": "scene2.slot_options.sent_to_client",
    "scene2.client_options.sent": "scene2.slot_options.sent_to_client"
  };
  return map[type] || type;
}

function getEventPayload(eventRow) {
  return eventRow?.event_payload || eventRow?.payload || {};
}

function getEventLabel(type) {
  return EVENT_LABELS[type] || type;
}
function getClientName(payload) {
  return payload?.client_name || payload?.name || "Client";
}

function getClientPhone(payload) {
  return payload?.client_phone || payload?.phone || "unknown";
}

const TEST_PROJECT_ID = "project_demo_1";
const AUTO_LOAD_TEST_PROJECT = false;

async function fetchProjectRuntimePayload(projectFolderId) {
  const base = LIVE_CONFIG.url.replace(/\/$/, "");
  const key = LIVE_CONFIG.anonKey;

  const res = await fetch(`${base}/rest/v1/rpc/get_project_runtime_payload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      p_project_folder_id: projectFolderId
    })
  });

  if (!res.ok) {
    throw new Error(`Runtime payload fetch failed: ${res.status}`);
  }

  return res.json();
}

async function loadRuntimePayload() {
  try {
    const payload = await fetchProjectRuntimePayload(TEST_PROJECT_ID);

    console.log("Runtime payload:", payload);

    if (!payload) return;

    const project = payload.project || {};
    const events = Array.isArray(payload.events) ? payload.events : [];
    const media = Array.isArray(payload.media) ? payload.media : [];

    const clientName = project.client_name || project.global_client_name || "Unknown client";
    const projectSummary =
      project.service_summary ||
      project.project_type ||
      project.project_folder_id ||
      "Project loaded";

    addLog(`Runtime project loaded — ${clientName}`);
    addLog(`Project summary — ${projectSummary}`);

        if (project.completion_check_planned_at) {
      addLog("Completion check scheduled — artist reply DONE to release aftercare + CareWatch");
    }

    if (project.aftercare_planned_at) {
      addLog("Aftercare + contact card scheduled — released after artist confirmation");
    }

    addLog(`Project events detected — ${events.length}`);
    addLog(`Media objects detected — ${media.length}`);
    renderRuntimeProjectToPlanner(project);
  } catch (err) {
    console.error("Runtime payload load failed:", err);
  }
}

function addMilestoneLog(label, detail = "") {
  addLog(detail ? `${label} — ${detail}` : label);
}
/* -------------------------------
   Planner generation
-------------------------------- */

const dayCellMap = new Map();

function buildTwelveMonthPlanner(startDate = new Date()) {
  if (!calendarGrid) return;

  calendarGrid.innerHTML = "";
  dayCellMap.clear();

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstMonth = startOfMonth(startDate);

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthDate = new Date(
      firstMonth.getFullYear(),
      firstMonth.getMonth() + monthOffset,
      1
    );

    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

    const monthBlock = document.createElement("div");
    monthBlock.className = "month-block";
    monthBlock.style.opacity = "0";
    monthBlock.style.transform = "translateY(6px)";
    monthBlock.style.transition = "opacity .35s ease, transform .35s ease";

    const title = document.createElement("div");
    title.className = "month-title";
    title.textContent = formatMonthTitle(monthDate);
    monthBlock.appendChild(title);

    const weekdayRow = document.createElement("div");
    weekdayRow.className = "month-weekday-row";

    weekdayLabels.forEach((label) => {
      const cell = document.createElement("div");
      cell.className = "weekday";
      cell.textContent = label;
      weekdayRow.appendChild(cell);
    });

    monthBlock.appendChild(weekdayRow);

    const daysGrid = document.createElement("div");
    daysGrid.className = "month-days";

    const cursor = new Date(gridStart);

    while (cursor <= gridEnd) {
      const iso = formatISODate(cursor);
      const inCurrentMonth = cursor.getMonth() === monthDate.getMonth();

      const day = document.createElement("div");
      day.className = "day";
      day.dataset.date = iso;

      if (!inCurrentMonth) {
        day.classList.add("day--outside");
      }

      const dayNum = document.createElement("span");
      dayNum.className = "day-num";
      dayNum.textContent = cursor.getDate();
      day.appendChild(dayNum);

      daysGrid.appendChild(day);

      // Prefer the real in-month cell; only fall back to ghost cells
      // if that date has not been seen yet.
      if (inCurrentMonth) {
        dayCellMap.set(iso, day);
      } else if (!dayCellMap.has(iso)) {
        dayCellMap.set(iso, day);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    monthBlock.appendChild(daysGrid);
    calendarGrid.appendChild(monthBlock);

    requestAnimationFrame(() => {
      monthBlock.style.opacity = "1";
      monthBlock.style.transform = "translateY(0)";
    });
  }
}

function findDayCellByDate(dateLike) {
  const iso = typeof dateLike === "string" ? dateLike : formatISODate(dateLike);
  return dayCellMap.get(iso);
}

function scrollPlannerToDate(dateLike, force = false) {
  const day = findDayCellByDate(dateLike);
  if (!day) return;

  const scroller = calendarGrid;
  if (!scroller) return;

  const scrollerRect = scroller.getBoundingClientRect();
  const dayRect = day.getBoundingClientRect();

  const topThreshold = scrollerRect.top + 120;
  const bottomThreshold = scrollerRect.bottom - 120;

  const isFarAbove = dayRect.top < topThreshold;
  const isFarBelow = dayRect.bottom > bottomThreshold;

  if (force || isFarAbove || isFarBelow) {
    day.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

function pulseJourneyStep(stepLabel) {
  timelineSteps.forEach((step) => {
    const matches = step.textContent.trim().toLowerCase() === stepLabel.trim().toLowerCase();
    if (matches) {
      step.classList.add("just-fired");
      window.setTimeout(() => step.classList.remove("just-fired"), 500);
    }
  });
}

function flashDay(dateLike) {
  const day = findDayCellByDate(dateLike);
  if (!day) return;

  day.classList.add("just-updated");
  window.setTimeout(() => day.classList.remove("just-updated"), 500);
}

function showIslaToast(text) {
  let toast = document.getElementById("isla-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "isla-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.classList.add("show");

  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.classList.remove("show");
  }, 1600);
}

window.showIslaToast = showIslaToast;

function clearPlannerEvents() {
  dayCellMap.forEach((day) => {
    day.classList.remove("has-session", "just-updated");
    Array.from(day.querySelectorAll(".session-card, .action-chip")).forEach((el) => el.remove());
  });
}

function clearOperationsLog() {
  operationsLog.innerHTML = "";
  logQueue = [];
  isLogTyping = false;
}

function resetJourney() {
  timelineSteps.forEach((step) => {
    step.classList.remove("active", "just-fired");
  });
  activateTimelineStep("Call Intake");
}

function resetDemoSurface() {
  clearPlannerEvents();
  clearOperationsLog();
  resetJourney();
  setRevenue(0);

  addLog("Isla Engine online");
  addLog("Messaging connected");
  addLog("Calendar synced");
}

/* -------------------------------
   Rendering
-------------------------------- */

function addSession(dateLike, sessionTitle, meta, projectHref, value = 0) {
  const day = findDayCellByDate(dateLike);
  if (!day) {
    addLog(`Unable to place session on ${typeof dateLike === "string" ? dateLike : formatISODate(dateLike)}`);
    return;
  }

const safeHref =
  typeof projectHref === "string" && projectHref.trim() && projectHref.trim() !== "#"
    ? projectHref.trim()
    : "";
    const card = document.createElement("div");
    card.className = "session-card";
       card.innerHTML = `
    <div class="session-title">${sessionTitle}</div>
    <div class="session-meta">${meta}</div>
    <a class="project-link${safeHref ? "" : " is-disabled"}" href="${safeHref || "javascript:void(0)"}" ${safeHref ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'} aria-label="Open Project Folder">
      <span class="pf-chip">PF</span>
      <span class="project-link-text">Project Folder</span>
    </a>
  `;

  day.appendChild(card);
  const projectLink = card.querySelector(".project-link");

if (projectLink && safeHref) {
  projectLink.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(safeHref, "_blank", "noopener");
  });
}

  card.classList.add("is-flash");
  window.setTimeout(() => card.classList.remove("is-flash"), 1000);

  day.classList.add("has-session");
  flashDay(dateLike);

  incrementRevenue(value);
  addLog(`Session scheduled — ${sessionTitle} on ${typeof dateLike === "string" ? dateLike : formatISODate(dateLike)}`);
}

function addAction(dateLike, label, muted = false) {
  const day = findDayCellByDate(dateLike);
  if (!day) {
    addLog(`Unable to place Isla action on ${typeof dateLike === "string" ? dateLike : formatISODate(dateLike)}`);
    return;
  }

  const chip = document.createElement("div");
  chip.className = `action-chip${muted ? " is-muted" : ""} is-flash`;
  chip.textContent = label;
  day.appendChild(chip);
    flashDay(dateLike);

  window.setTimeout(() => chip.classList.remove("is-flash"), 1000);
}

function removeActionChip(dateLike, label) {
  const day = findDayCellByDate(dateLike);
  if (!day) return;

  Array.from(day.querySelectorAll(".action-chip")).forEach((chip) => {
    if (chip.textContent.trim().toLowerCase() === label.trim().toLowerCase()) {
      chip.remove();
    }
  });
}

function addLifecyclePlaceholderSession(sessionDate, projectHref) {
  addSession(
    sessionDate,
    "Miss Mary",
    "Tattoo Session",
    projectHref || "#",
    0,
  );
}

function renderPendingLifecycleDemo(project) {
  const projectHref = project?.project_folder_link || "#";
  const sessionDate = new Date();
  sessionDate.setHours(13, 0, 0, 0);

  const completionCheck = new Date(sessionDate);
  completionCheck.setHours(completionCheck.getHours() + 4);

  const cw1 = new Date(completionCheck);
  cw1.setHours(cw1.getHours() + 24);

  const cw2 = new Date(completionCheck);
  cw2.setHours(cw2.getHours() + 72);

  const cw3 = new Date(completionCheck);
  cw3.setDate(cw3.getDate() + 10);

  addLifecyclePlaceholderSession(formatISODate(sessionDate), projectHref);
  addAction(formatISODate(completionCheck), "Done?");
  addAction(formatISODate(completionCheck), "Aftercare", true);
  addAction(formatISODate(completionCheck), "Contact Card", true);
  addAction(formatISODate(cw1), "CW1", true);
  addAction(formatISODate(cw2), "CW2", true);
  addAction(formatISODate(cw3), "CW3", true);

  pendingLifecycleDemo = {
    projectFolderId: project?.project_folder_id || null,
    projectHref,
    sessionDate: formatISODate(sessionDate),
    completionCheckDate: formatISODate(completionCheck),
    cw1Date: formatISODate(cw1),
    cw2Date: formatISODate(cw2),
    cw3Date: formatISODate(cw3),
    released: false,
  };

  scrollPlannerToDate(sessionDate, true);
  addLog("Lifecycle shell rendered — gated follow-up pills are planned");
}

function releasePendingLifecycleDemo() {
  if (!pendingLifecycleDemo) {
    addLog("No pending lifecycle shell to release");
    return;
  }

  if (pendingLifecycleDemo.released) {
    addLog("Follow-up lifecycle already released");
    return;
  }

  removeActionChip(pendingLifecycleDemo.completionCheckDate, "Aftercare");
  removeActionChip(pendingLifecycleDemo.completionCheckDate, "Contact Card");
  removeActionChip(pendingLifecycleDemo.cw1Date, "CW1");
  removeActionChip(pendingLifecycleDemo.cw2Date, "CW2");
  removeActionChip(pendingLifecycleDemo.cw3Date, "CW3");

  addAction(pendingLifecycleDemo.completionCheckDate, "Aftercare");
  addAction(pendingLifecycleDemo.completionCheckDate, "Contact Card");
  addAction(pendingLifecycleDemo.cw1Date, "CW1");
  addAction(pendingLifecycleDemo.cw2Date, "CW2");
  addAction(pendingLifecycleDemo.cw3Date, "CW3");

  pendingLifecycleDemo.released = true;
  activateTimelineStep("CareWatch");
  addLog("Artist replied DONE — gated follow-up pills released");
  showIslaToast("DONE received — follow-up released");
}

function renderRuntimeProjectToPlanner(project) {
  if (!project) return;

    const plannedDates = [
    project.prep_planned_at,
    project.completion_check_planned_at,
    project.aftercare_planned_at,
    project.cw1_planned_at,
    project.cw2_planned_at,
    project.cw3_planned_at
  ].filter(Boolean);

  if (!plannedDates.length) {
    addLog("Project timing not scheduled yet — planner remains in standby");
    return;
  }

  const summary =
    project.service_summary ||
    project.project_type ||
    project.project_folder_id ||
    "Scheduled project";

// Render the main appointment session
if (project.completion_check_planned_at) {

  const sessionDate = new Date(project.completion_check_planned_at);

  const clientName =
    project.client_name ||
    project.global_client_name ||
    "Client Session";

    addSession(
    formatISODate(sessionDate),
    clientName,
    "Tattoo Session",
    project.project_folder_link || "#",
    0
  );

}

  if (project.prep_planned_at) {
  const d = new Date(project.prep_planned_at);
  addAction(formatISODate(d), "Prep");
}

    if (project.completion_check_planned_at) {
    const d = new Date(project.completion_check_planned_at);
    addAction(formatISODate(d), "Done?");
  }

  if (project.aftercare_planned_at) {
    const d = new Date(project.aftercare_planned_at);
    addAction(formatISODate(d), "Aftercare");
  }

  if (project.cw1_planned_at) {
    const d = new Date(project.cw1_planned_at);
    addAction(formatISODate(d), "CW1");
  }

if (project.cw2_planned_at) {
  const d = new Date(project.cw2_planned_at);
  addAction(formatISODate(d), "CW2");
}

if (project.cw3_planned_at) {
  const d = new Date(project.cw3_planned_at);
  addAction(formatISODate(d), "CW3");
}

  const firstDate = plannedDates
    .map((value) => new Date(value))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b)[0];

  if (firstDate) {
    scrollPlannerToDate(firstDate, true);
  }

  addLog(`Planner hydrated from runtime — ${summary}`);
}

function renderProjectFlowPlan(plan) {
  const events = [];
  const EVENT_SPACING = 900;

  plan.sessions.forEach((session, idx) => {
    const sessionIndex = idx + 1;
    const monthDayYear = session.date.toLocaleDateString([], {
      month: "numeric",
      day: "numeric",
      year: "numeric"
    });

  

    events.push({
      date: session.date,
      shouldScroll: false,
      run: () => addLog(`Client selected option ${session.option} · ${monthDayYear}`)
    });

    events.push({
      date: session.date,
      shouldScroll: true,
      run: () => addLog(`Adding session ${sessionIndex} to calendar`)
    });

    events.push({
      date: session.date,
      shouldScroll: true,
      run: () => addSession(
        session.date,
        `Session ${sessionIndex} / ${plan.sessionCount}`,
        `${session.phase} · ${plan.sessionHours}hr · $${plan.sessionValue}`,
        plan.projectFolder,
        plan.sessionValue
      )
    });

    events.push({
      date: addDays(session.date, -1),
      shouldScroll: false,
      run: () => addAction(addDays(session.date, -1), "Prep")
    });

    events.push({
      date: addDays(session.date, 1),
      shouldScroll: false,
      run: () => addAction(addDays(session.date, 1), "CW1")
    });

    events.push({
      date: addDays(session.date, 3),
      shouldScroll: false,
      run: () => addAction(addDays(session.date, 3), "CW2")
    });
  });

  const lastSession = plan.sessions[plan.sessions.length - 1];

  events.push({
    date: addDays(lastSession.date, 30),
    shouldScroll: true,
    run: () => addAction(addDays(lastSession.date, 30), "Photo")
  });

    events.push({
    date: addDays(lastSession.date, 14),
    shouldScroll: true,
    run: () => {
      addAction(addDays(lastSession.date, 14), "Review");
      addLog("Project completed successfully — review request eligible");
    }
  });

  events.forEach((event, i) => {
    window.setTimeout(() => {
      if (i === 0 || event.shouldScroll) {
        scrollPlannerToDate(event.date, i === 0);
      }

      window.setTimeout(() => {
        event.run();
      }, event.shouldScroll ? 420 : 220);

    }, i * EVENT_SPACING);
  });
}

function parseScheduledDate(payload) {
  const raw = payload?.scheduled_time || payload?.selected_slot || payload?.date || null;
  if (!raw) return null;

  if (typeof raw === "string" && raw.includes("T")) {
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  if (typeof raw === "string" && raw.includes(" ")) {
    const dt = new Date(raw.replace(" ", "T"));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function applyLiveEvent(eventRow) {
  if (!eventRow || processedEventIds.has(eventRow.id)) return;
  processedEventIds.add(eventRow.id);
  lastSeenEventId = Math.max(lastSeenEventId, Number(eventRow.id) || 0);

const type = normalizeEventType(eventRow.event_type);
console.log("LIVE EVENT:", type, eventRow);
const payload = getEventPayload(eventRow);

  switch (type) {
 case "call.inbound":
  activateTimelineStep("Call Intake");
  pulseBeacon();
  triggerCallFocus();
  addMilestoneLog("📞 Incoming call detected", getClientPhone(payload));
  showIslaToast("Incoming call detected");
  break;

  case "scene0.greeting.delivered":
    activateTimelineStep("Call Intake");
    addMilestoneLog("Voice greeting delivered", "Isla is now live on the line");
    break;

  case "scene1.intent.started":
    activateTimelineStep("Discovery");
    addMilestoneLog("Qualification started", "Intent is being confirmed");
    break;

  case "scene1.intent.classified.direct_booking":
    activateTimelineStep("Discovery");
    addMilestoneLog("Intent classified", "Direct booking path selected");
    break;

  case "scene1.intent.classified.consult":
    activateTimelineStep("Discovery");
    addMilestoneLog("Intent classified", "Consultation path selected");
    break;

  case "scene1.intent.disengaged":
    addMilestoneLog("Inquiry closed", "Client disengaged cleanly");
    break;

  case "scene2.discovery.started":
    activateTimelineStep("Discovery");
    addMilestoneLog("Discovery started", "Tattoo details now being captured");
    break;

  case "scene2.discovery.updated": {
    const concept = payload.tattoo_concept || payload.concept || "Tattoo concept captured";
    const placement = payload.placement ? ` · ${payload.placement}` : "";
    const size = payload.size ? ` · ${payload.size}` : "";
    addMilestoneLog("Discovery updated", `${concept}${placement}${size}`);
    break;
  }

  case "scene2.recap_sms.sent":
    addMilestoneLog("Recap SMS sent", "Voice intake anchored to text");
    break;

  case "scene2.recap_confirmed.verbal":
    addMilestoneLog("Recap confirmed", "Caller verbally approved captured details");
    break;

  case "call.completed":
    addMilestoneLog("Call completed", "Text continuity is now active");
    break;

  case "scene2.artist_review.submitted":
    activateTimelineStep("Artist Review");
    addMilestoneLog("Review Packet™ submitted", "Artist review gate is now active");
    break;

  case "scene2.artist_classification.received": {
    activateTimelineStep("Artist Review");
    const classification = payload.classification || payload.project_type || "UNKNOWN";
    addMilestoneLog("Artist classification received", classification);
    break;
  }

  case "scene2.slot_options.generated":
    activateTimelineStep("ProjectFlow");
    addMilestoneLog("Calendar options generated", "Valid booking windows prepared");
    break;

  case "scene2.slot_options.sent_to_client":
  case "scene2.client_options.sent":
    activateTimelineStep("ProjectFlow");
    addMilestoneLog("Slot options sent", "Client selection pending");
    break;

  case "scene2.slot_selected":
    activateTimelineStep("Confirmation");
    addMilestoneLog("Client selected slot", payload.selected_slot || payload.selection || "Booking option received");
    break;

  case "calendar.event.created": {
  activateTimelineStep("Confirmation");
  const dt = parseScheduledDate(payload);
  const artistName = payload.artist_name || "Artist";
  const clientName = getClientName(payload);

  if (dt) {
    scrollPlannerToDate(dt, true);
    addSession(
      dt,
      clientName,
      `${artistName}${payload.scheduled_time ? ` · ${payload.scheduled_time}` : ""}`,
      "#",
      600
    );

    addAction(addDays(dt, -1), "Prep");
    addAction(addDays(dt, 1), "CW1");
    addAction(addDays(dt, 3), "CW2");
  } else {
    addMilestoneLog("Calendar event created", "Booking written successfully");
  }
  break;
}

  case "booking.confirmed":
    activateTimelineStep("Confirmation");
    addMilestoneLog("Booking confirmed", `${getClientName(payload)} is now scheduled`);
    showIslaToast("Booking confirmed");
    break;

  case "scene3.waiver.sent": {
  addMilestoneLog("48-hour waiver delivery sent");
  break;
}

  case "scene3.prep.sent": {
  activateTimelineStep("Confirmation");
  addMilestoneLog("24-hour prep sent", "Client prep window is now active");
  break;
}

  case "scene3.arrival_instruction.sent": {
  addMilestoneLog("Arrival instruction sent", "HERE flow armed");
  break;
}

  case "scene4.here.received": {
  activateTimelineStep("Arrival");
  addMilestoneLog("HERE received", `${getClientName(payload)} has arrived`);
  showIslaToast("Client arrived");
  break;
}

  case "scene4.client_ack.sent":
    activateTimelineStep("Arrival");
    addMilestoneLog("Arrival acknowledged", "Client check-in confirmed");
    break;

  case "scene4.acp.delivered": {
  activateTimelineStep("Arrival");
  addMilestoneLog("Arrival Context Packet™ delivered");
  break;
}

  case "scene4.automation.paused":
    activateTimelineStep("Arrival");
    addMilestoneLog("Automation paused", "In-session protection is active");
    break;

  case "scene4.completion_check.sent":
    activateTimelineStep("Arrival");
    addMilestoneLog("Completion check sent", "Waiting for artist reply DONE");
    break;

  case "scene4.completion_confirmed.done":
    activateTimelineStep("Arrival");
    addMilestoneLog("Appointment marked done", "Aftercare pipeline unlocked");
    showIslaToast("Appointment marked done");
    break;

  case "scene5.aftercare.sent":
    activateTimelineStep("CareWatch");
    addMilestoneLog("Aftercare sent", "Client received post-appointment instructions");
    break;

  case "scene5.contact_card.sent":
    activateTimelineStep("CareWatch");
    addMilestoneLog("Contact card sent", "CareWatch continuity is now anchored to Isla");
    break;

  case "scene5.carewatch.armed":
    activateTimelineStep("CareWatch");
    addMilestoneLog("CareWatch armed", "Follow-up timing is now active");
    showIslaToast("CareWatch armed");
    break;
  case "state.error.needs_founder":
    addMilestoneLog("Needs Attention", "Founder intervention required");
    showIslaToast("Needs Attention");
    break;

  default:
    addLog(`Live event received — ${getEventLabel(type)}`);
    break;
}
}

async function fetchLiveEvents() {
  if (!LIVE_MODE) return [];

  const base = LIVE_CONFIG.url.replace(/\/$/, "");
  const query = new URLSearchParams({
    select: "id,shop_id,booking_request_id,project_id,event_type,event_payload,payload,source,channel,external_id,created_at",
    order: "id.asc",
    limit: "100",
    shop_id: `eq.${LIVE_CONFIG.shopId}`
  });
if (liveStartedAt) {
  query.set("created_at", `gte.${liveStartedAt}`);
}
  if (lastSeenEventId > 0) {
    query.set("id", `gt.${lastSeenEventId}`);
  }

  const res = await fetch(`${base}/rest/v1/system_events?${query.toString()}`, {
    headers: {
      apikey: LIVE_CONFIG.anonKey,
      Authorization: `Bearer ${LIVE_CONFIG.anonKey}`,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Supabase poll failed: ${res.status}`);
  }

  return res.json();
}

async function pollLiveEvents() {
  if (!LIVE_MODE) return;

  try {
    const rows = await fetchLiveEvents();
    rows.forEach(applyLiveEvent);
  } catch (err) {
    console.error(err);
    showIslaToast("Live feed error");
  }
}
function addLogInstant(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `[${nowStamp()}] ${message}`;
  operationsLog.prepend(entry);
}
function pulseBeacon() {
  const beacon = document.querySelector(".isla-beacon");
  if (!beacon) return;

  beacon.classList.remove("is-alert");
  void beacon.offsetWidth;
  beacon.classList.add("is-alert");

  window.setTimeout(() => beacon.classList.remove("is-alert"), 950);
}
function bootStatusIndicators() {
  const live = document.getElementById("status-live");
  const msg = document.getElementById("status-msg");
  const cal = document.getElementById("status-cal");
  const systemTitle = document.querySelector(".system-title");
  const beacon = document.querySelector(".isla-beacon");

  [live, msg, cal].forEach((el) => el?.classList.remove("is-on"));
  systemTitle?.classList.remove("is-live");
  beacon?.classList.remove("is-live");

 window.setTimeout(() => msg?.classList.add("is-on"), 420);
window.setTimeout(() => cal?.classList.add("is-on"), 980);
window.setTimeout(() => live?.classList.add("is-on"), 1540);

// final system ignition
window.setTimeout(() => systemTitle?.classList.add("is-live"), 1820);
window.setTimeout(() => beacon?.classList.add("is-live"), 2100);
}

function startLiveEventMode() {
  liveStartedAt = new Date().toISOString();
  clearOperationsLog();
  bootStatusIndicators();
  addLogInstant("Mission control observing activity");
  addLogInstant("Live monitoring armed");
  showIslaToast("Live mode connected");

 clearInterval(livePollHandle);
pollLiveEvents();
livePollHandle = setInterval(pollLiveEvents, LIVE_CONFIG.pollMs || 2500);
}

/* -------------------------------
   Demo events
-------------------------------- */

function fire24HourPrep() {
  addLog("24-hour prep message sent to client");
}

function fireArrival() {
  activateTimelineStep("Arrival");
  addLog("Client texted HERE");
  addLog("Arrival Context Packet™ sent to provider");
}

function fireCareWatch() {
  activateTimelineStep("CareWatch");
  addLog("CareWatch™ check-in sent to client");
  addLog("Healing follow-up monitoring active");
}

function fireReviewRequest() {
  addLog("Review request sent");
}

function firePortfolioRequest() {
  activateTimelineStep("Portfolio Request");
  addLog("Portfolio consent request sent");
}

/* -------------------------------
   Boot + main flow
-------------------------------- */

function bootSequence() {
  resetDemoSurface();
  bootStatusIndicators();
}
function simulateBookingFlow() {
  const startDate = new Date();
  const firstSessionDate = addDays(startDate, 12);

  const plan = {
    sessionCount: 5,
    sessionHours: 4,
    sessionValue: 600,
    minHealingDays: 21,
    concept: "Arm sleeve",
    projectFolder: "#",
    sessions: [
      { date: firstSessionDate, phase: "Outline", option: 2 },
      { date: addDays(firstSessionDate, 21), phase: "Shading 1", option: 1 },
      { date: addDays(firstSessionDate, 42), phase: "Shading 2", option: 2 },
      { date: addDays(firstSessionDate, 63), phase: "Color", option: 1 },
      { date: addDays(firstSessionDate, 84), phase: "Finish / detail", option: 3 }
    ]
  };


  const plannerEventSpacing = 900;
  const plannerEventCount = (plan.sessions.length * 6) + 2;
  const plannerDoneAt = 7600 + (plannerEventCount * plannerEventSpacing);

  activateTimelineStep("Discovery");
  addLog("Incoming call detected");

  setTimeout(() => addLog("Discovery conversation in progress"), 900);
  setTimeout(() => addLog(`Concept captured — ${plan.concept}`), 1700);
  setTimeout(() => addLog("Reference media permission captured"), 2500);
  setTimeout(() => addLog("Review Packet™ generated and sent to artist"), 3300);
  setTimeout(() => addLog("Artist reviewing Review Packet™"), 4500);

  setTimeout(() => {
  activateTimelineStep("ProjectFlow");
  addLog(`Artist proposed ${plan.sessionCount} sessions · ${plan.sessionHours} hours each`);
}, 5600);

setTimeout(() => {
  addLog(`Minimum healing time between sessions: ${plan.minHealingDays} days`);
}, 6400);

setTimeout(() => {
  renderProjectFlowPlan(plan);
  scrollPlannerToDate(plan.sessions[0].date, true);
}, 7600);

  setTimeout(() => {
  addLog("Downstream Isla actions scheduled after each confirmed session");
}, plannerDoneAt + 800);

setTimeout(() => {
  activateTimelineStep("Confirmation");
  addLog("ProjectFlow™ created and confirmed with client");
}, plannerDoneAt + 1700);

setTimeout(() => {
  addLog("Healing windows respected across full project timeline");
}, plannerDoneAt + 2500);

setTimeout(() => {
  addLog("Confirmation SMS sent to client");
}, plannerDoneAt + 3300);


}

/* -------------------------------
   Buttons
-------------------------------- */
function setMode(mode){

  document.getElementById("mode-demo")?.classList.remove("mode-demo","mode-live");
  document.getElementById("mode-live")?.classList.remove("mode-demo","mode-live");

  if(mode === "demo"){
    document.getElementById("mode-demo")?.classList.add("mode-demo");
  }

  if(mode === "live"){
    document.getElementById("mode-live")?.classList.add("mode-live");
  }

}

controlButtons.forEach((btn) => {
  const label = btn.textContent.trim().toLowerCase();

  btn.addEventListener("click", () => {
    btn.classList.add("is-live");
    window.setTimeout(() => btn.classList.remove("is-live"), 450);

if (label === "demo") {

  setMode("demo");

  clearInterval(livePollHandle);

  processedEventIds.clear();
  lastSeenEventId = 0;
  liveStartedAt = null;

  resetDemoSurface();
  bootStatusIndicators();

void createLiveProjectFlowTest();

  return;
}



    if (label === "live") {

  setMode("live");

  processedEventIds.clear();
  lastSeenEventId = 0;
  liveStartedAt = null;

  clearPlannerEvents();
  clearOperationsLog();
  resetJourney();
  setRevenue(0);

  startLiveEventMode();

  return;
}

    if (LIVE_MODE && label !== "demo" && label !== "live") {
      showIslaToast("Time controls stay manual until timers are wired");
      return;
    }

    if (label.includes("24-hour prep")) return fire24HourPrep();
    if (label.includes("arrival")) return fireArrival();
    if (label === "done?") return releasePendingLifecycleDemo();
    if (label.includes("carewatch")) return fireCareWatch();
    if (label.includes("review request")) return fireReviewRequest();
    if (label.includes("portfolio")) return firePortfolioRequest();
  });
});

/* -------------------------------
   Start
-------------------------------- */

window.addEventListener("load", () => {
  buildTwelveMonthPlanner(new Date());
  if (AUTO_LOAD_TEST_PROJECT) {
    loadRuntimePayload();
  }
  
  if (LIVE_MODE) {
    startLiveEventMode();
    return;
  }

  bootSequence();

  
});
async function createLiveProjectFlowTest() {
  if (isCreatingLiveProject) {
    addLog("Project creation already in progress");
    return;
  }

  const demoBtn = document.getElementById("mode-demo");

  try {
    isCreatingLiveProject = true;
    if (demoBtn) demoBtn.disabled = true;

    if (typeof generateProjectId !== "function" || typeof createProjectFolder !== "function") {
      throw new Error("createProject.js helpers are not loaded");
    }

    const projectFolderId = generateProjectId();

    addLog(`Creating live project — ${projectFolderId}`);

    const result = await createProjectFolder({
      projectFolderId,
      organizationId: "9582a009-4f5d-41b7-84c2-51c816c8f819",
      organizationClientId: "36466867-29db-48d8-8283-cccf839c2cb1",
      clientName: "Miss Mary",
      serviceSummary: "Octopus Sleeve Live Test"
    });

    console.log("Live project created:", result);

    const project = result?.project || {};
    const folderLink = project.project_folder_link || result?.drive?.folderUrl || "";

    addLog(`Project created — ${project.project_folder_id || projectFolderId}`);

    if (folderLink) {
      addLog("PF link ready — live project folder attached");
      showIslaToast("Project + PF folder created");
    }

    renderPendingLifecycleDemo(project);
    addLog("Planner loaded with gated lifecycle pills — press Done? to release them");

    return result;
  } catch (err) {
    console.error("Live project creation failed:", err);
    addLog(`Project creation failed — ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  } finally {
    isCreatingLiveProject = false;
    if (demoBtn) demoBtn.disabled = false;
  }
}
