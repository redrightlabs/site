/* artist.js — PORTAL_CANON_SPEC_v1 (Phase 1)
   Artist Portal:
   - 3 unresolved bubbles (Bookings / CareWatch / New photos)
   - Buoy ON (slow pulse) if ANY unresolved count > 0
   - Daily brief: appointments only (time centered, client bold)
   - Project Folder pill per appointment
   - Weekly outlook: upcomingCount only
   - Isla report: artist-only handled summary
   - Back to Shop Overview link appears ONLY when ?from=shop
*/
document.addEventListener("DOMContentLoaded", () => {
  const el = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  const from = (params.get("from") || "").toLowerCase(); // "shop" enables back link

  // ----------------------------
  // MOCK DATA (replace later)
  // ----------------------------
  const data = {
    today: new Date(),

    unresolved: {
      bookingsWaiting: 2,
      carewatch: 1,
      newPhotos: 3,
    },

    todayAppointments: [
      {
        time: "10:00",
        client: "J",
        type: "Session",
        descriptor: "Session 2 / 5 · Arm sleeve",
        project: { name: "Arm sleeve", folderUrl: "#", referencePhotos: [] }
      },
      {
        time: "14:30",
        client: "M",
        type: "Consult",
        descriptor: "Rose",
        project: { name: "Rose", folderUrl: "#", referencePhotos: [] }
      }
    ],

    weekly: { upcomingCount: 14 },

    report: {
      line: "Handled: 5 bookings · 8 CareWatch check-ins · 3 photos collected"
    },

    queues: {
      bookings: [{ client: "K", project: "Small script" }, { client: "R", project: "Cover-up" }],
      carewatch: [{ client: "T", project: "Forearm" }],
      photos: [
        { client: "A", project: "Sleeve", photos: ["https://picsum.photos/900/600?random=21"] },
        { client: "D", project: "Rose", photos: ["https://picsum.photos/900/600?random=22"] },
      ]
    },

    calendar: [
      { date: "Wed", time: "11:00", type: "Session", client: "J", project: "Arm sleeve", folderUrl: "#" },
      { date: "Fri", time: "15:00", type: "Consult", client: "M", project: "Rose", folderUrl: "#" },
    ],
  };

  // ----------------------------
  // Sheet
  // ----------------------------
  const sheet = el("sheet");
  function closeSheet() {
    sheet.classList.remove("open");
    sheet.innerHTML = "";
  }
  function openSheet(title, bodyHtml) {
    sheet.classList.add("open");
    sheet.innerHTML = `
      <div class="panel">
        <div class="panelHead">
          <div class="panelTitle">${escapeHtml(title)}</div>
          <button class="ghost" id="closeSheetBtn" type="button">Close</button>
        </div>
        ${bodyHtml}
      </div>
    `;
    el("closeSheetBtn").onclick = closeSheet;
    sheet.onclick = (e) => { if (e.target === sheet) closeSheet(); };
  }

  function openProjectFolder(project) {
    if (!project) return;

    const photos = (project.referencePhotos || [])
      .map((src) => `<img class="refimg" src="${escapeAttr(src)}" alt="Reference photo" />`)
      .join("");

    const link = project.folderUrl && project.folderUrl !== "#"
      ? `<div class="pillRow">
           <a class="pill" href="${escapeAttr(project.folderUrl)}" target="_blank" rel="noreferrer">Open Project Folder</a>
         </div>`
      : `<div class="smallCenter">Project folder link not set.</div>`;

    openSheet(
      "Project folder",
      `
        <div class="bigCenter">${escapeHtml(project.name || "Project")}</div>
        ${link}
        ${photos || `<div class="smallCenter" style="margin-top:10px">No reference photos.</div>`}
      `
    );
  }

  // ----------------------------
  // Render
  // ----------------------------
  function renderTop() {
    el("todayLabel").textContent = data.today.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const anyUnresolved =
      (data.unresolved.bookingsWaiting || 0) +
      (data.unresolved.carewatch || 0) +
      (data.unresolved.newPhotos || 0) > 0;

    el("buoyDot").classList.toggle("on", anyUnresolved);

    // Back link ONLY when arriving from shop
    const back = el("backLink");
    if (back) back.style.display = (from === "shop") ? "block" : "none";
  }

  function renderBubbles() {
    const set = (countId, bubbleId, n) => {
      el(countId).textContent = String(n || 0);
      el(bubbleId).classList.toggle("hot", (n || 0) > 0);
    };

    set("cBookings", "bBookings", data.unresolved.bookingsWaiting);
    set("cCarewatch", "bCarewatch", data.unresolved.carewatch);
    set("cPhotos", "bPhotos", data.unresolved.newPhotos);

    el("bBookings").onclick = openBookingsQueue;
    el("bCarewatch").onclick = openCarewatchQueue;
    el("bPhotos").onclick = openPhotosQueue;
  }

  function renderDaily() {
    const list = el("dailyList");
    const items = data.todayAppointments || [];

    list.innerHTML = items.map((x, idx) => `
      <div class="item">
        <div class="time">${escapeHtml(x.time || "")}</div>
        <div class="primary">${escapeHtml(x.client || "")}</div>
        <div class="secondary">${escapeHtml(x.type || "")}${x.descriptor ? ` · ${escapeHtml(x.descriptor)}` : ""}</div>
        <div class="pillRow">
          <button class="pill" type="button" data-open-project="${idx}">Project folder</button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll("[data-open-project]").forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-open-project"));
        openProjectFolder(items[idx]?.project);
      };
    });
  }

  function renderWeekly() {
    el("weekCount").textContent = String(data.weekly?.upcomingCount ?? "—");
  }

  function renderReport() {
    el("artistReportLine").textContent = data.report?.line || "—";
  }

  // ----------------------------
  // Queues
  // ----------------------------
  function openBookingsQueue() {
    const rows = (data.queues.bookings || []).map(x => `
      <div class="item">
        <div class="primary">${escapeHtml(x.client || "")}</div>
        <div class="secondary">${escapeHtml(x.project || "")}</div>
      </div>
    `).join("") || `<div class="smallCenter">No items.</div>`;

    openSheet("Bookings waiting", `<div class="list">${rows}</div>`);
  }

  function openCarewatchQueue() {
    const rows = (data.queues.carewatch || []).map(x => `
      <div class="item">
        <div class="primary">${escapeHtml(x.client || "")}</div>
        <div class="secondary">${escapeHtml(x.project || "")}</div>
      </div>
    `).join("") || `<div class="smallCenter">No items.</div>`;

    openSheet("CareWatch", `<div class="list">${rows}</div>`);
  }

  function openPhotosQueue() {
    const rows = (data.queues.photos || []).map(x => {
      const pics = (x.photos || []).map(src =>
        `<img class="refimg" src="${escapeAttr(src)}" alt="Photo" />`
      ).join("");
      return `
        <div class="item">
          <div class="primary">${escapeHtml(x.client || "")}</div>
          <div class="secondary">${escapeHtml(x.project || "")}</div>
          ${pics}
        </div>
      `;
    }).join("") || `<div class="smallCenter">No items.</div>`;

    openSheet("New photos", `<div class="list">${rows}</div>`);
  }

  // ----------------------------
  // Calendar
  // ----------------------------
  function openCalendar() {
    const rows = (data.calendar || []).map(x => `
      <div class="item">
        <div class="time">${escapeHtml(`${x.date || ""} · ${x.time || ""}`)}</div>
        <div class="primary">${escapeHtml(x.client || "")}</div>
        <div class="secondary">${escapeHtml(x.type || "")} · ${escapeHtml(x.project || "")}</div>
        <div class="pillRow">
          <a class="pill" href="${escapeAttr(x.folderUrl || "#")}" target="_blank" rel="noreferrer">Project folder</a>
        </div>
      </div>
    `).join("") || `<div class="smallCenter">No events.</div>`;

    openSheet("Calendar", `<div class="list">${rows}</div>`);
  }

  // ----------------------------
  // Bottom nav
  // ----------------------------
  function bindNav() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((t) => {
      t.onclick = () => {
        tabs.forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        const name = (t.dataset.tab || "").toLowerCase();
        if (name === "calendar") openCalendar();
      };
    });
  }

  // ----------------------------
  // Escape helpers
  // ----------------------------
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(str) { return escapeHtml(str); }

  // Init
  renderTop();
  renderBubbles();
  renderDaily();
  renderWeekly();
  renderReport();
  bindNav();
});