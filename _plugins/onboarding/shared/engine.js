/* RedRight Onboarding Engine (shared) — v2 hardened
   - No back button
   - No progress UI
   - Close = pause
   - Resume restores last unanswered
   - Multi-select never auto-advances
   - End screens have no buttons

   Expects screens to be provided by a vertical-specific file via:
   - window.RR_ONBOARDING_FLOWS = { shop: [...], artist: [...] }

   Optional:
   - window.RR_ONBOARDING_VERTICAL_KEY = "tattoo_v2" (used in storage key)
   - window.RR_DEFAULT_FLOW = "shop" | "artist" (used only when URL has no ?flow=)
*/

(() => {
  // -------------------------
  // Global crash guards
  // -------------------------
  window.addEventListener("error", (e) => {
    console.error("[RR Onboarding] Unhandled error", e?.error || e);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[RR Onboarding] Unhandled promise rejection", e?.reason || e);
  });

  // -------------------------
  // Params + flow selection
  // -------------------------
  const params = (() => {
    try { return new URLSearchParams(location.search); }
    catch { return new URLSearchParams(); }
  })();

  const urlFlow = (params.get("flow") || "").trim().toLowerCase();
  const defaultFlow = (String(window.RR_DEFAULT_FLOW || "") || "").trim().toLowerCase();
  const forcedFlow = urlFlow || defaultFlow; // URL wins; then page default

  const FLOW_KEY =
    forcedFlow === "artist" ? "artist" :
    forcedFlow === "shop" ? "shop" :
    "full";

  const VERTICAL_KEY = (String(window.RR_ONBOARDING_VERTICAL_KEY || "") || "").trim() || "onboarding";
  const STORAGE_KEY = `rr_onboarding_${VERTICAL_KEY}_${FLOW_KEY}`;

  // DEV: allow hard reset via ?reset=1 (clears only this flow's key)
  try { if (params.get("reset") === "1") localStorage.removeItem(STORAGE_KEY); } catch {}

  // -------------------------
  // Pull flows from vertical screens file
  // -------------------------
  const FLOWS = window.RR_ONBOARDING_FLOWS;
  if (!FLOWS || !Array.isArray(FLOWS.shop) || !Array.isArray(FLOWS.artist)) {
    console.error("[RR Onboarding] Missing window.RR_ONBOARDING_FLOWS (shop/artist arrays). Ensure the vertical screens file is loaded before shared/engine.js");
    return;
  }

  // Lookup
  const SCREEN_BY_ID = new Map();
  [...(FLOWS.shop || []), ...(FLOWS.artist || [])].forEach((s) => {
    if (s && s.id) SCREEN_BY_ID.set(s.id, s);
  });

    // Canonical flow anchors (NO vertical-specific IDs in shared engine)
  const SHOP_START_ID = FLOWS.shop?.[0]?.id || null;
  const ARTIST_START_ID = FLOWS.artist?.[0]?.id || null;

  const SHOP_END_ID =
    FLOWS.shop && FLOWS.shop.length ? FLOWS.shop[FLOWS.shop.length - 1].id : SHOP_START_ID;

  const ARTIST_END_ID =
    FLOWS.artist && FLOWS.artist.length ? FLOWS.artist[FLOWS.artist.length - 1].id : ARTIST_START_ID;
// Active flow for this page instance (shop or artist)
let ACTIVE_FLOW = (String(window.RR_DEFAULT_FLOW || "") || "shop").trim().toLowerCase();
if (ACTIVE_FLOW !== "artist" && ACTIVE_FLOW !== "shop") ACTIVE_FLOW = "shop";

  // -------------------------
  // DOM helpers (hard fail-safe)
  // -------------------------
  const el = (id) => document.getElementById(id);
  const $title = el("title");
  const $quote = el("quote");
  const $question = el("question");
  const $input = el("input");
  const $closeBtn = el("closeBtn");

  const hasUI = !!($title && $quote && $question && $input);

  function assertUI() {
    if (hasUI) return true;
    console.error("[RR Onboarding] Missing required DOM nodes. Check IDs: title, quote, question, input, closeBtn");
    return false;
  }

  function setText(node, text) {
    if (!node) return;
    node.textContent = text || "";
    node.style.display = text ? "" : "none";
  }

  function setMultiline(node, text) {
    if (!node) return;
    node.textContent = "";
    if (!text) {
      node.style.display = "none";
      return;
    }
    node.style.display = "";
    String(text).split("\n").forEach((line, idx) => {
      if (idx) node.appendChild(document.createElement("br"));
      node.appendChild(document.createTextNode(line));
    });
  }

  function clearInput() {
    if (!$input) return;
    $input.innerHTML = "";
  }

  // -------------------------
  // State
  // -------------------------
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("[RR Onboarding] Failed to save state", e); }
  }

  function get(state, key) { return state ? state[key] : undefined; }

  function set(state, key, value) {
    if (!state) return;
    state[key] = value;
    saveState(state);
  }

  // -------------------------
  // UI builders
  // -------------------------
  function mkBtn(label, { primary = false, selected = false } = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rr-option" + (primary ? " rr-primary" : "");
    btn.textContent = label;
    btn.dataset.selected = String(!!selected);
    return btn;
  }

  function mkNote(text) {
    const div = document.createElement("div");
    div.className = "rr-note";
    div.style.color = "rgba(233,230,223,.65)";
    div.style.fontSize = "14px";
    div.style.lineHeight = "1.4";
    div.style.margin = "10px 0 0 0";
    div.textContent = text;
    return div;
  }

  function mkLabel(label) {
    const d = document.createElement("div");
    d.style.textAlign = "left";
    d.style.width = "100%";
    d.style.color = "rgba(233,230,223,.62)";
    d.style.fontSize = "12px";
    d.style.letterSpacing = ".12em";
    d.style.textTransform = "uppercase";
    d.style.margin = "10px 0 6px";
    d.textContent = label;
    return d;
  }

  function mkTextInput({ value = "", placeholder = "", maxLength = 120, inputMode = "text" } = {}) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = inputMode;
    inp.value = value || "";
    inp.placeholder = placeholder;
    inp.maxLength = maxLength;
    inp.style.width = "100%";
    inp.style.border = "1px solid rgba(233,230,223,.10)";
    inp.style.borderRadius = "14px";
    inp.style.padding = "14px";
    inp.style.background = "rgba(255,255,255,.02)";
    inp.style.color = "rgba(233,230,223,.95)";
    inp.style.fontFamily = "inherit";
    inp.style.fontSize = "17px";
    return inp;
  }

  function mkSelect(options, value) {
    const sel = document.createElement("select");
    sel.style.width = "100%";
    sel.style.border = "1px solid rgba(233,230,223,.10)";
    sel.style.borderRadius = "14px";
    sel.style.padding = "14px";
    sel.style.background = "rgba(255,255,255,.02)";
    sel.style.color = "rgba(233,230,223,.95)";
    sel.style.fontFamily = "inherit";
    sel.style.fontSize = "17px";

    (options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (String(opt.value) === String(value)) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function mkDivider() {
    const hr = document.createElement("div");
    hr.style.width = "100%";
    hr.style.height = "1px";
    hr.style.background = "rgba(233,230,223,.10)";
    hr.style.margin = "14px 0";
    return hr;
  }

  // -------------------------
  // Roster helpers (shared)
  // Stored at: shop.roster = [{id,name,phone,role}]
  // -------------------------
  function normalizePhone(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const digits = s.replace(/[^\d]/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return digits;
    if (digits.length === 10) return digits;
    return "";
  }

  function prettyPhone10(digits) {
    const d = String(digits || "").replace(/[^\d]/g, "");
    const x = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
    if (x.length !== 10) return digits || "";
    return `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}`;
  }

  function last4(digits) {
    const d = String(digits || "").replace(/[^\d]/g, "");
    const x = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
    return x.length >= 4 ? x.slice(-4) : "";
  }

  function getRoster(state) {
    const captured = get(state, "shop.roster");
    if (Array.isArray(captured) && captured.length) return captured;

    const mock = params.get("mock") === "1";
    if (!mock) return [];

    return [
      { id: "u1", name: "Lena", phone: "8435550101", role: "artist" },
      { id: "u2", name: "Marco", phone: "8435550102", role: "artist" },
      { id: "u3", name: "Jules", phone: "8435550103", role: "artist" },
      { id: "u4", name: "Rico", phone: "8435550104", role: "artist" },
      { id: "u5", name: "Nia", phone: "8435550105", role: "artist" },
      { id: "u6", name: "Sage", phone: "8435550106", role: "artist" },
      { id: "u7", name: "Drew", phone: "8435550107", role: "owner_artist" },
    ];
  }

  // -------------------------
  // Hours editor (shared)
  // -------------------------
  const DAYS = [
    ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"],
    ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
  ];

  function defaultWeeklyHours() {
    const out = {};
    for (const [k] of DAYS) out[k] = { closed: false, open: "11:00", close: "19:00" };
    out.sun = { closed: true, open: "11:00", close: "19:00" };
    return out;
  }

  function renderWeeklyHoursEditor(state) {
    const existing = get(state, "shop.hours.template");
    const base = defaultWeeklyHours();
    const hours = existing && typeof existing === "object" && !existing.varies ? { ...base, ...existing } : base;

    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.textAlign = "left";

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "160px 1fr 1fr";
    grid.style.alignItems = "center";
    grid.style.gap = "10px";
    grid.style.width = "100%";

    const hdr = (t) => {
      const d = document.createElement("div");
      d.style.color = "rgba(233,230,223,.55)";
      d.style.fontSize = "12px";
      d.style.letterSpacing = ".12em";
      d.style.textTransform = "uppercase";
      d.textContent = t;
      return d;
    };

    grid.appendChild(hdr("Day"));
    grid.appendChild(hdr("Open"));
    grid.appendChild(hdr("Close"));

    const inputs = {};

    const mkTime = (value) => {
      const t = document.createElement("input");
      t.type = "time";
      t.value = value || "11:00";
      t.style.width = "100%";
      t.style.border = "1px solid rgba(233,230,223,.10)";
      t.style.borderRadius = "14px";
      t.style.padding = "12px";
      t.style.background = "rgba(255,255,255,.02)";
      t.style.color = "rgba(233,230,223,.95)";
      t.style.fontFamily = "inherit";
      t.style.fontSize = "16px";
      return t;
    };

    for (const [key, label] of DAYS) {
      const dayCell = document.createElement("div");
      dayCell.style.display = "flex";
      dayCell.style.flexDirection = "column";
      dayCell.style.gap = "6px";

      const dayName = document.createElement("div");
      dayName.style.color = "rgba(233,230,223,.90)";
      dayName.style.fontSize = "15px";
      dayName.textContent = label;

      const openWrap = document.createElement("label");
      openWrap.style.display = "flex";
      openWrap.style.alignItems = "center";
      openWrap.style.gap = "8px";
      openWrap.style.color = "rgba(233,230,223,.60)";
      openWrap.style.fontSize = "13px";

      const openChk = document.createElement("input");
      openChk.type = "checkbox";
      openChk.checked = !hours[key]?.closed;

      const closedTag = document.createElement("span");
      closedTag.textContent = "Closed";
      closedTag.style.display = openChk.checked ? "none" : "flex";
      closedTag.style.alignItems = "center";
      closedTag.style.justifyContent = "center";
      closedTag.style.padding = "6px 16px";
      closedTag.style.marginTop = "6px";
      closedTag.style.border = "1px solid rgba(255,43,43,.35)";
      closedTag.style.borderRadius = "999px";
      closedTag.style.background = "rgba(255,43,43,.08)";
      closedTag.style.color = "rgba(233,230,223,.85)";
      closedTag.style.fontSize = "13px";
      closedTag.style.letterSpacing = ".10em";
      closedTag.style.textTransform = "uppercase";

      openWrap.appendChild(openChk);
      openWrap.appendChild(closedTag);

      dayCell.appendChild(dayName);
      dayCell.appendChild(openWrap);

      const open = mkTime(hours[key]?.open);
      const close = mkTime(hours[key]?.close);

      function syncDayUI() {
        const isOpen = openChk.checked;
        open.disabled = !isOpen;
        close.disabled = !isOpen;

        open.style.visibility = isOpen ? "visible" : "hidden";
        close.style.visibility = isOpen ? "visible" : "hidden";

        open.style.opacity = isOpen ? "1" : "0";
        close.style.opacity = isOpen ? "1" : "0";

        open.style.pointerEvents = isOpen ? "auto" : "none";
        close.style.pointerEvents = isOpen ? "auto" : "none";

        closedTag.style.display = isOpen ? "none" : "flex";

        if (isOpen) {
          if (!open.value) open.value = hours[key]?.open || "11:00";
          if (!close.value) close.value = hours[key]?.close || "19:00";
        }
      }

      openChk.addEventListener("change", syncDayUI);
      syncDayUI();

      inputs[key] = { openChk, open, close };

      grid.appendChild(dayCell);
      grid.appendChild(open);
      grid.appendChild(close);
    }

    wrap.appendChild(grid);

    return {
      node: wrap,
      readValue: () => {
        const out = {};
        for (const [k] of DAYS) {
          const row = inputs[k];
          const isOpen = !!row.openChk.checked;
          out[k] = { closed: !isOpen, open: isOpen ? (row.open.value || "") : "", close: isOpen ? (row.close.value || "") : "" };
        }
        return out;
      },
    };
  }

  // -------------------------
  // Answered logic
  // -------------------------
  function isAnswered(state, screen) {
    if (!screen) return true;
    if (screen.type === "end") return true;

    if (screen.type === "form") {
      return (screen.fields || []).every((f) => {
        const v = get(state, f.id);
        return f.required ? v !== undefined && String(v).trim() !== "" : true;
      });
    }

    if (screen.type === "upload") {
      const id = screen.upload?.field_id;
      const v = id ? get(state, id) : "";
      return screen.upload?.required ? !!v : true;
    }

    if (screen.type === "phone") return !!get(state, screen.key);

    if (screen.type === "hours") {
      const mode = get(state, "shop.hours.mode");
      const tmpl = get(state, "shop.hours.template");
      if (!mode || !tmpl) return false;
      if (mode === "weekly") return typeof tmpl === "object" && !tmpl.varies;
      if (mode === "varies") return typeof tmpl === "object" && tmpl.varies === true;
      return false;
    }

    if (screen.type === "roster_build") {
      const roster = get(state, "shop.roster");
      return Array.isArray(roster) && roster.length > 0;
    }

    if (screen.type === "roster") return !!get(state, screen.key);

    if (screen.type === "multi") return Array.isArray(get(state, screen.key));

    return screen.key ? get(state, screen.key) !== undefined : true;
  }
  // -------------------------
  // Vertical config validation (bulletproof)
  // - Detects duplicate IDs
  // - Detects missing next targets
  // - Detects missing required fields for known types
  // - Never silently resets; shows a fatal config screen
  // -------------------------
  function renderFatalConfig(errors) {
    if (!assertUI()) return;

    if ($closeBtn) $closeBtn.style.display = "none";
    clearInput();

    setText($title, "Onboarding Config Error");
    setText($quote, "Fix required before pilots");

    const lines = [];
    lines.push("The onboarding config for this vertical is invalid.");
    lines.push("");
    (errors || []).forEach((e, i) => {
      lines.push(`${i + 1}) ${e}`);
    });

    setMultiline($question, lines.join("\n"));

    console.error("[RR Onboarding] Config validation failed:\n" + (errors || []).join("\n"));

    const note = mkNote("Hard fail-safe. Fix screens.js / flow wiring and reload.");
    $input.appendChild(note);
  }

  function validateVerticalConfig() {
    const errs = [];

    // FLOWS sanity
    if (!FLOWS || !Array.isArray(FLOWS.shop) || !Array.isArray(FLOWS.artist)) {
      errs.push("window.RR_ONBOARDING_FLOWS must provide { shop: [], artist: [] } arrays.");
      return errs;
    }

    // Anchors must exist
    if (!SHOP_START_ID) errs.push("SHOP flow has no start screen (FLOWS.shop[0].id missing).");
    if (!ARTIST_START_ID) errs.push("ARTIST flow has no start screen (FLOWS.artist[0].id missing).");

    // Collect IDs & detect duplicates across both flows
    const idToFlow = new Map();
    const allScreens = [...(FLOWS.shop || []), ...(FLOWS.artist || [])];

    allScreens.forEach((s, idx) => {
      if (!s || typeof s !== "object") {
        errs.push(`Screen at combined index ${idx} is not an object.`);
        return;
      }

      const id = (s.id || "").trim();
      if (!id) {
        errs.push(`Screen missing id (type=${String(s.type || "?")}).`);
        return;
      }

      const flowName = (FLOWS.shop || []).includes(s) ? "shop" : "artist";

      if (idToFlow.has(id)) {
        errs.push(
          `Duplicate screen id '${id}' appears in both '${idToFlow.get(id)}' and '${flowName}'. IDs must be globally unique.`
        );
      } else {
        idToFlow.set(id, flowName);
      }

      // Type sanity
      if (!s.type) errs.push(`Screen '${id}' missing type.`);

      // Required fields by type
      if (s.type === "single" || s.type === "multi" || s.type === "phone" || s.type === "roster") {
        if (!s.key) errs.push(`Screen '${id}' (type=${s.type}) missing key.`);
      }

      if (s.type === "form") {
        if (!Array.isArray(s.fields) || !s.fields.length) errs.push(`Screen '${id}' (form) must have fields[].`);
        (s.fields || []).forEach((f, fi) => {
          if (!f || typeof f !== "object") return errs.push(`Screen '${id}' (form) field[${fi}] is invalid.`);
          if (!f.id) errs.push(`Screen '${id}' (form) field[${fi}] missing id.`);
          if (!f.label) errs.push(`Screen '${id}' (form) field[${fi}] missing label.`);
        });
      }

      if (s.type === "upload") {
        const fieldId = s.upload && s.upload.field_id;
        if (!fieldId) errs.push(`Screen '${id}' (upload) missing upload.field_id.`);
      }

      // Next target validation (string only)
      if (typeof s.next === "string") {
        const nextId = s.next.trim();
        if (nextId && !SCREEN_BY_ID.has(nextId)) {
          errs.push(`Screen '${id}' next -> '${nextId}' does not exist.`);
        }
      }

      // Options sanity
      if (s.type === "single" || s.type === "multi") {
        if (!Array.isArray(s.options) || !s.options.length) {
          errs.push(`Screen '${id}' (type=${s.type}) must have options[].`);
        } else {
          (s.options || []).forEach((o, oi) => {
            if (!o || typeof o !== "object") return errs.push(`Screen '${id}' option[${oi}] is invalid.`);
            if (!("label" in o)) errs.push(`Screen '${id}' option[${oi}] missing label.`);
            if (!("value" in o)) errs.push(`Screen '${id}' option[${oi}] missing value.`);
          });
        }
      }

      // Exclusive sanity for multi
      if (s.type === "multi" && s.exclusive != null && !Array.isArray(s.exclusive)) {
        errs.push(`Screen '${id}' (multi) exclusive must be an array if provided.`);
      }
    });

    // Validate computed end IDs exist
    if (SHOP_END_ID && !SCREEN_BY_ID.has(SHOP_END_ID)) errs.push(`Computed SHOP_END_ID '${SHOP_END_ID}' does not exist.`);
    if (ARTIST_END_ID && !SCREEN_BY_ID.has(ARTIST_END_ID)) errs.push(`Computed ARTIST_END_ID '${ARTIST_END_ID}' does not exist.`);

    return errs;
  }
function screenBelongsToActiveFlow(screenId) {
  if (!screenId) return false;
  if (ACTIVE_FLOW === "artist") return FLOWS.artist.some((s) => s.id === screenId);
  return FLOWS.shop.some((s) => s.id === screenId);
}

    function firstUnansweredStartId(state) {
  // If this page is explicitly the artist/provider onboarding surface,
  // start/resume the artist flow regardless of any shop-side gating.
  if (ACTIVE_FLOW === "artist") {
    for (const s of FLOWS.artist) {
      if (!isAnswered(state, s)) return s.id;
    }
    return ARTIST_END_ID || ARTIST_START_ID;
  }

  // Default: shop onboarding surface
  for (const s of FLOWS.shop) {
    if (!isAnswered(state, s)) return s.id;
  }

  // Only after finishing shop do we optionally proceed into artist,
  // gated by the shop discovery flag.
  if (get(state, "owner.is_provider") === true) {
    for (const s of FLOWS.artist) {
      if (!isAnswered(state, s)) return s.id;
    }
    return ARTIST_END_ID || ARTIST_START_ID;
  }

  return SHOP_END_ID || SHOP_START_ID;
}

  // -------------------------
  // Render / navigation
  // -------------------------
  function render(screen, state) {
    if (!assertUI()) return;

    if (!screen || !screen.id) {
      console.warn("[RR Onboarding] Missing screen. Falling back to first unanswered.");
      const startId = firstUnansweredStartId(state);
      const start = SCREEN_BY_ID.get(startId) || FLOWS.shop?.[0];
      if (start) return render(start, state);
      return;
    }

    setText($title, screen.title);
    setText($quote, screen.quote);
    setMultiline($question, screen.question);

    if (screen.type === "end") {
  // End screens must remain operable: keep Close visible.
  if ($closeBtn) {
    $closeBtn.style.display = "";
    $closeBtn.textContent = "Close";
    $closeBtn.dataset.mode = "done";
  }
  clearInput();
  delete state._last_screen;
  saveState(state);
  return;
}

if ($closeBtn) {
  $closeBtn.style.display = "";
  $closeBtn.textContent = "Close";
  $closeBtn.dataset.mode = "pause";
}  
  state._last_screen = screen.id;
    saveState(state);

    try {
      switch (screen.type) {
        case "single": return renderSingle(screen, state);
        case "multi": return renderMulti(screen, state);
        case "form": return renderForm(screen, state);
        case "upload": return renderUpload(screen, state);
        case "phone": return renderPhone(screen, state);
        case "hours": return renderHours(screen, state);
        case "roster_build": return renderRosterBuild(screen, state);
        case "roster": return renderRosterPick(screen, state);
        default:
          console.warn("[RR Onboarding] Unknown screen type:", screen.type, "for", screen.id);
          return renderSingle(
            {
              ...screen,
              type: "single",
              key: screen.key || `_ack.${screen.id}`,
              options: [{ label: "Continue", value: "ok", primary: true }],
              next: typeof screen.next === "string" ? screen.next : SHOP_END_ID || SHOP_START_ID,
            },
            state
          );
      }
    } catch (e) {
  console.error("[RR Onboarding] Render failed for", screen?.id, e);

  const fallback =
    (SHOP_END_ID ? SCREEN_BY_ID.get(SHOP_END_ID) : null) ||
    FLOWS.shop?.[0] ||
    null;

  if (fallback && fallback.id !== screen?.id) {
    render(fallback, state);
    return;
  }

  return;
}
  }

    function goNext(current, state) {
    let nextId = null;

    if (typeof current.next === "function") nextId = current.next(state);
    else if (typeof current.next === "string") nextId = current.next;

    if (!nextId) {
      const flow = FLOWS.shop.some((s) => s.id === current.id) ? FLOWS.shop : FLOWS.artist;
      const idx = flow.findIndex((s) => s.id === current.id);
      nextId = flow[idx + 1]?.id || flow[flow.length - 1]?.id;
    }

    const next =
      SCREEN_BY_ID.get(nextId) ||
      (SHOP_END_ID ? SCREEN_BY_ID.get(SHOP_END_ID) : null) ||
      FLOWS.shop?.[0] ||
      null;

    render(next, state);
  }

  // -------------------------
  // Renderers
  // -------------------------
  function renderSingle(screen, state) {
    clearInput();
    const selected = get(state, screen.key);

    (screen.options || []).forEach((opt) => {
      const btn = mkBtn(opt.label, { primary: !!opt.primary, selected: selected === opt.value });
      btn.addEventListener("click", () => {
        set(state, screen.key, opt.value);
        goNext(screen, state);
      });
      $input.appendChild(btn);
    });
  }

  function renderMulti(screen, state) {
    clearInput();
    $input.appendChild(mkNote("Select all that apply."));

    const selected = get(state, screen.key);
    const selSet = new Set(Array.isArray(selected) ? selected : []);
    const exclusives = new Set(Array.isArray(screen.exclusive) ? screen.exclusive : []);

    const buttons = [];

    (screen.options || []).forEach((opt) => {
      const btn = mkBtn(opt.label, { selected: selSet.has(opt.value) });
      buttons.push({ btn, value: opt.value });

      btn.addEventListener("click", () => {
        const clickedVal = opt.value;
        const isExclusive = exclusives.has(clickedVal);

        if (selSet.has(clickedVal)) {
          selSet.delete(clickedVal);
        } else {
          if (isExclusive) {
            selSet.clear();
            selSet.add(clickedVal);
          } else {
            for (const v of Array.from(selSet)) if (exclusives.has(v)) selSet.delete(v);
            selSet.add(clickedVal);
          }
        }

        set(state, screen.key, Array.from(selSet));
        buttons.forEach(({ btn, value }) => (btn.dataset.selected = String(selSet.has(value))));
      });

      $input.appendChild(btn);
    });

    const cont = mkBtn("Continue", { primary: true });
    cont.addEventListener("click", () => {
      const now = get(state, screen.key);
      if (!Array.isArray(now) || now.length === 0) return alert("Select at least one option.");
      goNext(screen, state);
    });
    $input.appendChild(cont);
  }

  function renderForm(screen, state) {
    clearInput();
    const values = {};

    (screen.fields || []).forEach((f) => {
      $input.appendChild(mkLabel(f.label));

      let widget;
      if (f.kind === "timezone") {
        const tz = get(state, f.id) || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        widget = mkTextInput({ value: tz, maxLength: 80 });
      } else {
        const v = get(state, f.id) || "";
        widget = mkTextInput({ value: v, maxLength: f.max_length || 120 });
      }

      widget.addEventListener("input", () => (values[f.id] = widget.value.trim()));
      values[f.id] = widget.value.trim();
      $input.appendChild(widget);
    });

    const cont = mkBtn("Continue", { primary: true });
    cont.addEventListener("click", () => {
      for (const f of screen.fields || []) {
        const v = (values[f.id] ?? "").toString().trim();
        if (f.required && !v) return alert(`Missing: ${f.label}`);
      }
      for (const f of screen.fields || []) set(state, f.id, (values[f.id] ?? "").toString().trim());
      goNext(screen, state);
    });

    $input.appendChild(cont);
  }

  function renderUpload(screen, state) {
    clearInput();
    const fieldId = screen.upload?.field_id;
    const required = !!screen.upload?.required;
    const existing = fieldId ? get(state, fieldId) : "";

    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg,image/webp";
    inp.style.width = "100%";
    inp.style.color = "rgba(233,230,223,.72)";
    inp.style.fontFamily = "inherit";
    inp.style.fontSize = "15px";
    inp.style.padding = "10px 2px";

    if (existing) $input.appendChild(mkNote(`Current: ${existing}`));
    $input.appendChild(inp);

    const cont = mkBtn("Continue", { primary: true });
    cont.addEventListener("click", () => {
      const file = inp.files && inp.files[0];
      if (required && !file && !existing) return alert("Please upload a logo.");
      if (file && fieldId) set(state, fieldId, `local://${file.name}`); // placeholder token
      goNext(screen, state);
    });

    $input.appendChild(cont);
  }

  function renderPhone(screen, state) {
    clearInput();
    $input.appendChild(mkLabel("Phone number"));

    const existing = get(state, screen.key) || "";
    const inp = mkTextInput({
      value: existing ? prettyPhone10(existing) : "",
      placeholder: "e.g., (843) 555-0123",
      maxLength: 20,
      inputMode: "tel",
    });

    $input.appendChild(inp);

    const cont = mkBtn("Continue", { primary: true });
    cont.addEventListener("click", () => {
      const normalized = normalizePhone(inp.value);
      if (!normalized) return alert("Enter a valid 10-digit US phone number.");
      set(state, screen.key, normalized);
      goNext(screen, state);
    });

    $input.appendChild(cont);
  }

  function renderHours(screen, state) {
    clearInput();

    const mode = get(state, "shop.hours.mode");
    const weeklyBtn = mkBtn("Set weekly hours", { selected: mode === "weekly" });
    const variesBtn = mkBtn("Hours vary week to week", { selected: mode === "varies" });

    weeklyBtn.addEventListener("click", () => {
      set(state, "shop.hours.mode", "weekly");
      set(state, "shop.hours.template", defaultWeeklyHours());
      render(screen, state);
    });

    variesBtn.addEventListener("click", () => {
      set(state, "shop.hours.mode", "varies");
      set(state, "shop.hours.template", { varies: true });
      render(screen, state);
    });

    $input.appendChild(weeklyBtn);
    $input.appendChild(variesBtn);

    const currentMode = get(state, "shop.hours.mode");
    let readValue = null;

    if (currentMode === "weekly") {
      try {
        const editor = renderWeeklyHoursEditor(state);
        $input.appendChild(editor.node);
        readValue = editor.readValue;
      } catch (err) {
        console.error("[RR Onboarding] Weekly hours editor failed", err);
        $input.appendChild(mkNote("Weekly hours editor failed. Refresh and try again. If it persists, choose 'Hours vary week to week' for now."));
        readValue = () => defaultWeeklyHours();
      }
    }

    const cont = mkBtn("Continue", { primary: true });
    cont.addEventListener("click", () => {
      const m = get(state, "shop.hours.mode");
      if (!m) return alert("Choose one option.");
      if (typeof readValue === "function") set(state, "shop.hours.template", readValue());
      goNext(screen, state);
    });

    $input.appendChild(cont);
  }

  function renderRosterBuild(screen, state) {
  clearInput();

  // Roles are sourced ONLY from the vertical config.
  // IMPORTANT: define once (no redeclare) to avoid "Identifier 'roles' has already been declared".
  const roles =
    (window.RR_ONBOARDING_VERTICAL && Array.isArray(window.RR_ONBOARDING_VERTICAL.roster_roles))
      ? window.RR_ONBOARDING_VERTICAL.roster_roles
      : [
          // safe fallback (generic)
          { label: "Team member", value: "team" },
          { label: "Owner", value: "owner" },
          { label: "Manager", value: "manager" },
          { label: "Admin", value: "admin" },
        ];

  const roster = Array.isArray(get(state, "shop.roster")) ? get(state, "shop.roster") : [];

  // Existing roster list
  if (roster.length) {
    roster.forEach((p, idx) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.width = "100%";
      row.style.padding = "10px 12px";
      row.style.border = "1px solid rgba(233,230,223,.10)";
      row.style.borderRadius = "14px";
      row.style.margin = "8px 0";
      row.style.background = "rgba(255,255,255,.015)";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";
      left.style.gap = "2px";

      const name = document.createElement("div");
      name.style.color = "rgba(233,230,223,.92)";
      name.style.fontSize = "16px";
      name.textContent = p.name || "Unnamed";

      const meta = document.createElement("div");
      meta.style.color = "rgba(233,230,223,.60)";
      meta.style.fontSize = "13px";

      const roleLabel = (() => {
        const map = new Map((roles || []).map((r) => [r.value, r.label]));
        return map.get(p.role) || p.role || "Team member";
      })();

      meta.textContent = `${String(roleLabel).toUpperCase()} • ${prettyPhone10(p.phone)} • ****${last4(p.phone)}`;

      left.appendChild(name);
      left.appendChild(meta);

      const remove = mkBtn("Remove");
      remove.style.maxWidth = "140px";
      remove.addEventListener("click", () => {
        const next = roster.slice();
        next.splice(idx, 1);
        set(state, "shop.roster", next);
        render(screen, state);
      });

      row.appendChild(left);
      row.appendChild(remove);
      $input.appendChild(row);
    });

    $input.appendChild(mkDivider());
  }

  // Add new person
  $input.appendChild(mkLabel("Name"));
  const nameInp = mkTextInput({ placeholder: "e.g., Lena", maxLength: 40 });
  $input.appendChild(nameInp);

  $input.appendChild(mkLabel("Mobile"));
  const phoneInp = mkTextInput({ placeholder: "e.g., (843) 555-0123", maxLength: 20, inputMode: "tel" });
  $input.appendChild(phoneInp);

  $input.appendChild(mkLabel("Role"));
  const defaultRole = roles[0]?.value || "team";
  const roleSel = mkSelect(roles, defaultRole);
  $input.appendChild(roleSel);

  const add = mkBtn("Add person", { primary: true });
  add.addEventListener("click", () => {
    const name = nameInp.value.trim();
    const phone = normalizePhone(phoneInp.value);
    const role = roleSel.value;

    if (!name) return alert("Enter a name.");
    if (!phone) return alert("Enter a valid 10-digit US phone number.");

    const id = `p_${Math.random().toString(16).slice(2, 10)}`;
    set(state, "shop.roster", roster.concat([{ id, name, phone, role }]));

    nameInp.value = "";
    phoneInp.value = "";
    roleSel.value = defaultRole;

    render(screen, state);
  });
  $input.appendChild(add);

  const cont = mkBtn("Continue", { primary: true });
  cont.addEventListener("click", () => {
    const current = Array.isArray(get(state, "shop.roster")) ? get(state, "shop.roster") : [];
    if (!current.length) return alert("Add at least one person.");
    goNext(screen, state);
  });
  $input.appendChild(cont);
}

  function renderRosterPick(screen, state) {
    clearInput();
    const roster = getRoster(state);
    const selected = get(state, screen.key);

    if (!roster.length) {
      $input.appendChild(mkNote("Roster not loaded yet (add ?mock=1 for demo)."));
      const cont = mkBtn("Continue", { primary: true });
      cont.addEventListener("click", () => goNext(screen, state));
      $input.appendChild(cont);
      return;
    }

    roster.forEach((p) => {
      const roleTag = p.role === "owner_artist" ? "OWNER/ARTIST" : p.role ? p.role.toUpperCase() : "PERSON";
      const label = `${p.name}  •  ${roleTag}  •  ****${last4(p.phone)}`;
      const btn = mkBtn(label, { selected: selected === p.id });
      btn.addEventListener("click", () => {
        set(state, screen.key, p.id);
        goNext(screen, state);
      });
      $input.appendChild(btn);
    });
  }

  // Close = pause (default) or done (end screens)
if ($closeBtn) {
  $closeBtn.addEventListener("click", () => {
    const mode = ($closeBtn.dataset.mode || "pause").toLowerCase();
    if (mode === "done") {
      alert("Complete. You can close this tab.");
      return;
    }
    alert("Paused. You can resume anytime.");
  });
}

  function init() {
    if (!assertUI()) return;

     const configErrors = validateVerticalConfig();
if (configErrors.length) {
  renderFatalConfig(configErrors);
  return;
}

    const shouldReset = params.get("reset") === "1";
    let state = loadState();

    // Establish ACTIVE_FLOW for this page instance.
// URL ?flow= overrides RR_DEFAULT_FLOW.
if (urlFlow === "artist" || urlFlow === "shop") {
  ACTIVE_FLOW = urlFlow;
} else {
  ACTIVE_FLOW = (String(window.RR_DEFAULT_FLOW || "") || "shop").trim().toLowerCase();
  if (ACTIVE_FLOW !== "artist" && ACTIVE_FLOW !== "shop") ACTIVE_FLOW = "shop";
}

    if (shouldReset) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      state = {};
    }
// Force-start support using canonical anchors only
if (urlFlow === "artist") {
  const s = ARTIST_START_ID ? SCREEN_BY_ID.get(ARTIST_START_ID) : null;
  if (s) {
    render(s, state);
    return;
  }
}

if (urlFlow === "shop") {
  const s = SHOP_START_ID ? SCREEN_BY_ID.get(SHOP_START_ID) : null;
  if (s) {
    render(s, state);
    return;
  }
}
   

   const last = state._last_screen;
let lastScreen = last ? SCREEN_BY_ID.get(last) : null;

// Bulletproof: never resume a screen from the wrong flow surface.
if (lastScreen && !screenBelongsToActiveFlow(lastScreen.id)) {
  lastScreen = null;
  delete state._last_screen;
  saveState(state);
}

if (!lastScreen || isAnswered(state, lastScreen)) {
  const startId = firstUnansweredStartId(state);
  const start =
    SCREEN_BY_ID.get(startId) ||
    (ACTIVE_FLOW === "artist" ? FLOWS.artist?.[0] : FLOWS.shop?.[0]);

  render(start, state);
  return;
}

render(lastScreen, state);

  }

  init();
})();