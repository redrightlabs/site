/* owner.js — PORTAL_CANON_SPEC_v1 (Phase 1)
   Shop Overview:
   - Same 3 unresolved bubbles (shop totals)
   - Buoy ON if ANY unresolved count > 0
   - Daily brief is BROKEN OUT BY ARTIST:
       Artist name (link to their artist brief: artist.html?from=shop&artist=<id>)
       Then today’s appointments under that artist (time centered, client bold)
       Project folder pill per appointment
   - Weekly overview: data-only number
   - Isla report: shop totals summary
   - Calendar: shop read-only (future)
*/

(() => {
  const el = (id) => document.getElementById(id);

  // ----------------------------
  // MOCK DATA (replace later)
  // ----------------------------
  const data = {
    today: new Date(),

    unresolved: {
      bookingsWaiting: 4,
      carewatch: 2,
      newPhotos: 5,
    },

    // Daily brief (by artist)
    artistsToday: [
      {
        id: "a_chris",
        name: "Chris",
        appointments: [
          { time: "10:00", client: "J", type: "Session", descriptor: "Session 2 / 5 · Arm sleeve", folderUrl: "#" },
          { time: "14:30", client: "M", type: "Consult", descriptor: "Rose", folderUrl: "#" },
        ]
      },
      {
        id: "a_becca",
        name: "Becca",
        appointments: [
          { time: "12:00", client: "S", type: "Session", descriptor: "Script", folderUrl: "#" },
        ]
      }
    ],

    weekly: { totalAppointmentsThisWeek: 27 },

    report: { line: "This week: 18 bookings handled · 31 CareWatch check-ins · 12 photos collected · 9 reviews requested" },

    queues: {
      bookings: [{ client: "K", project: "Small script" }, { client: "R", project: "Cover-up" }],
      carewatch: [{ client: "T", project: "Forearm" }],
      photos: [
        { artist: "Chris", client: "A", project: "Sleeve", photos: ["https://picsum.photos/900/600?random=41"] },
        { artist: "Becca", client: "D", project: "Rose", photos: ["https://picsum.photos/900/600?random=42"] },
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

  function renderDailyByArtist() {
    const wrap = el("shopBrief");
    const groups = data.artistsToday || [];

    wrap.innerHTML = groups.map(group => {
      const appts = (group.appointments || []).map(a => `
        <div class="item">
          <div class="time">${escapeHtml(a.time || "")}</div>
          <div class="primary">${escapeHtml(a.client || "")}</div>
          <div class="secondary">${escapeHtml(a.type || "")}${a.descriptor ? ` · ${escapeHtml(a.descriptor)}` : ""}</div>
          <div class="pillRow">
            <a class="pill" href="${escapeAttr(a.folderUrl || "#")}" target="_blank" rel="noreferrer">Project folder</a>
          </div>
        </div>
      `).join("") || `<div class="smallCenter">No appointments.</div>`;
      const artistUrl = new URL("../artist/artist.html", location.href);
      artistUrl.searchParams.set("from", "shop");
      artistUrl.searchParams.set("artist", group.id || "");
      const artistHref = artistUrl.toString();

      return `
  <div class="artistBlock">
    <div class="artistNameRow">
      <a class="artistLink" href="${artistHref}">${escapeHtml(group.name || "Artist")}</a>
    </div>
    <div class="list">
      ${appts}
    </div>
  </div>
`;
    }).join("");
  }

  function renderWeekly() {
    el("weekTotal").textContent = String(data.weekly?.totalAppointmentsThisWeek ?? "—");
  }

  function renderReport() {
    el("shopReportLine").textContent = data.report?.line || "—";
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
    // Shop breakdown by artist + photo previews
    const rows = (data.queues.photos || []).map(x => {
      const pics = (x.photos || []).map(src => `<img class="refimg" src="${escapeAttr(src)}" alt="Photo" />`).join("");
      return `
        <div class="item">
          <div class="secondary">${escapeHtml(x.artist || "")}</div>
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

  // Escape helpers
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
  renderDailyByArtist();
  renderWeekly();
  renderReport();
  bindNav();
})();