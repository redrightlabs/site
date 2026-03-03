/* Founder HQ — v2.1 implementation (mock data, no dependencies)
   - Steady red buoy = all good
   - Pulsing red buoy = needs attention (HITL/payments)
   - Calendar + Books are separate views behind buttons
*/
(function () {
  const $ = (sel) => document.querySelector(sel);

  // ----- Elements (guarded) -----
  const buoyDot = $('#buoyDot');
  const todayLabel = $('#todayLabel');

  const attentionRow = $('#attentionRow');
  const chipPayments = $('#chipPayments');
  const chipBroken = $('#chipBroken');
  const payCountEl = $('#payCount');
  const hitlCountEl = $('#hitlCount');

  const tabHome = $('#tabHome');
  const tabCalendar = $('#tabCalendar');
  const tabBooks = $('#tabBooks');

  const viewHome = $('#viewHome');
  const viewCalendar = $('#viewCalendar');
  const viewBooks = $('#viewBooks');

  const demoList = $('#demoList');
  const weeklyLine = $('#weeklyLine');
  const shopList = $('#shopList');
  const globalLine = $('#globalLine');

  const calList = $('#calList');
  const booksGrid = $('#booksGrid');

  const sheet = $('#sheet');

  // If a user renamed assets, fail gracefully.
  function safeSetText(el, txt) { if (el) el.textContent = txt; }

  // ----- Mock Data (replace later) -----
  const state = {
    attention: {
      failedPayments: 0,
      brokenIslas: 0,
      items: [
        // { type:'payments', shop:'Black Harbor', note:'Card declined', link:'#' },
        // { type:'broken', shop:'Sable Ink', note:'Twilio delivery failure', link:'#' },
      ],
    },
    demos: [
      { time: '10:30 AM', person: 'Mason', shop: 'Black Harbor Tattoo', ctx: '#' },
      { time: '2:00 PM', person: 'Lena', shop: 'Sable Ink', ctx: '#' },
    ],
    weekly: { demos: 6, activeShops: 12, onboardedMonth: 3 },
    shops: [
      { name: 'Black Harbor Tattoo', buoy: 'steady', projectflows: 18, reschedules: 6, carewatch: 44, daily:'#', weekly:'#' },
      { name: 'Sable Ink', buoy: 'pulse', projectflows: 9, reschedules: 4, carewatch: 21, daily:'#', weekly:'#' },
      { name: 'Nightline Studio', buoy: 'steady', projectflows: 12, reschedules: 2, carewatch: 33, daily:'#', weekly:'#' },
    ],
    global: { projectflows: 512, reschedules: 184, carewatch: 2901 },
    calendar: [
      { date: 'Feb 2', time: '10:30 AM', title:'Demo · Black Harbor', ctx:'#' },
      { date: 'Feb 2', time: '2:00 PM', title:'Demo · Sable Ink', ctx:'#' },
      { date: 'Feb 6', time: '11:00 AM', title:'Demo · Nightline', ctx:'#' },
    ],
    books: [
      { num: '$28,400', label:'MRR (est.)' },
      { num: '$3,000', label:'Onboarding (month)' },
      { num: '0', label:'Overdue invoices' },
    ],
  };

  // ----- Render Helpers -----
  function setBuoyPulse(on) {
    if (!buoyDot) return;
    buoyDot.classList.toggle('pulse', !!on);
  }

  function fmtToday() {
    try {
      const d = new Date();
      return d.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' });
    } catch {
      return '—';
    }
  }

  function clear(el) { if (el) el.innerHTML = ''; }

  function renderDemos() {
    if (!demoList) return;
    clear(demoList);

    if (!state.demos.length) {
      const empty = document.createElement('div');
      empty.className = 'item';
      empty.textContent = '—';
      demoList.appendChild(empty);
      return;
    }

    for (const d of state.demos) {
      const row = document.createElement('div');
      row.className = 'item';

      row.innerHTML = `
        <div class="itemTop">
          <div class="time">${escapeHtml(d.time)}</div>
          <div class="name">${escapeHtml(d.person)}</div>
          <div class="meta">${escapeHtml(d.shop)}</div>
          <a class="pill" href="${escapeAttr(d.ctx)}" aria-label="Open demo context">Demo context</a>
        </div>
      `;
      demoList.appendChild(row);
    }
  }

  function renderWeekly() {
    const w = state.weekly;
    safeSetText(weeklyLine, `Demos ${w.demos} · Active shops ${w.activeShops} · Onboarded ${w.onboardedMonth}`);
  }

  function renderGlobal() {
    const g = state.global;
    safeSetText(globalLine, `ProjectFlows ${g.projectflows} · Reschedules ${g.reschedules} · CareWatch ${g.carewatch}`);
  }

  function renderShops() {
    if (!shopList) return;
    clear(shopList);

    for (const s of state.shops) {
      const row = document.createElement('div');
      row.className = 'item';
      row.setAttribute('role', 'button');
      row.tabIndex = 0;

      const buoy = (s.buoy === 'pulse') ? 'Slow pulse' : 'Steady';
      row.innerHTML = `
        <div class="itemTop">
          <div class="name">${escapeHtml(s.name)}</div>
          <div class="meta">${escapeHtml(buoy)} · ProjectFlows ${s.projectflows} · Reschedules ${s.reschedules} · CareWatch ${s.carewatch}</div>
          <button class="pill" type="button">View shop</button>
        </div>
      `;

      row.addEventListener('click', () => openShopSheet(s));
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openShopSheet(s); });

      shopList.appendChild(row);
    }
  }

  function renderCalendar() {
    if (!calList) return;
    clear(calList);

    if (!state.calendar.length) {
      const empty = document.createElement('div');
      empty.className = 'item';
      empty.textContent = '—';
      calList.appendChild(empty);
      return;
    }

    let currentDate = null;
    for (const c of state.calendar) {
      if (c.date !== currentDate) {
        currentDate = c.date;
        const h = document.createElement('div');
        h.className = 'item';
        h.innerHTML = `<div class="name">${escapeHtml(currentDate)}</div>`;
        calList.appendChild(h);
      }

      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div class="itemTop">
          <div class="time">${escapeHtml(c.time)}</div>
          <div class="name">${escapeHtml(c.title)}</div>
          <a class="pill" href="${escapeAttr(c.ctx)}">Demo context</a>
        </div>
      `;
      calList.appendChild(row);
    }
  }

  function renderBooks() {
    if (!booksGrid) return;
    clear(booksGrid);

    for (const b of state.books) {
      const tile = document.createElement('div');
      tile.className = 'bookTile';
      tile.innerHTML = `
        <div class="bookNum">${escapeHtml(b.num)}</div>
        <div class="bookLabel">${escapeHtml(b.label)}</div>
      `;
      booksGrid.appendChild(tile);
    }
  }

  // ----- Attention Model -----
  function computeAttention() {
    // Replace later: derived from real events
    state.attention.failedPayments = state.attention.items.filter(i => i.type === 'payments').length;
    state.attention.brokenIslas = state.attention.items.filter(i => i.type === 'broken').length;

    safeSetText(payCountEl, String(state.attention.failedPayments));
    safeSetText(hitlCountEl, String(state.attention.brokenIslas));

    const total = state.attention.failedPayments + state.attention.brokenIslas;
    if (attentionRow) attentionRow.hidden = (total === 0);

    // Buoy: steady red default, pulse only when attention exists
    setBuoyPulse(total > 0);
  }

  // ----- Sheet UI -----
  function openSheet(title, bodyHtml) {
    if (!sheet) return;

    sheet.innerHTML = `
      <div class="sheetCard" role="dialog" aria-modal="true">
        <div class="sheetTop">
          <div style="width:44px"></div>
          <div class="sheetTitle">${escapeHtml(title)}</div>
          <button class="sheetClose" type="button" id="sheetClose">Close</button>
        </div>
        <div>${bodyHtml}</div>
      </div>
    `;

    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');

    const closeBtn = $('#sheetClose');
    if (closeBtn) closeBtn.addEventListener('click', closeSheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); }, { once:true });
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = '';
  }

  function openShopSheet(s) {
    const health = `
      <div class="item">
        <div class="itemTop">
          <div class="meta">ProjectFlows booked</div>
          <div class="name">${escapeHtml(String(s.projectflows))}</div>
        </div>
      </div>
      <div class="item">
        <div class="itemTop">
          <div class="meta">Reschedules completed</div>
          <div class="name">${escapeHtml(String(s.reschedules))}</div>
        </div>
      </div>
      <div class="item">
        <div class="itemTop">
          <div class="meta">CareWatch sequences run</div>
          <div class="name">${escapeHtml(String(s.carewatch))}</div>
        </div>
      </div>
    `;

    const reports = `
      <div class="item">
        <div class="itemTop">
          <div class="name">Isla reports</div>
          <a class="pill" href="${escapeAttr(s.daily)}">Daily report</a>
          <a class="pill" href="${escapeAttr(s.weekly)}">Weekly report</a>
        </div>
      </div>
    `;

    openSheet(s.name, `${health}${reports}`);
  }

  function openAttentionSheet(type) {
    const list = state.attention.items.filter(i => i.type === type);
    if (!list.length) {
      openSheet(type === 'payments' ? 'Failed payments' : 'Broken Islas', `<div class="item">—</div>`);
      return;
    }
    const items = list.map(i => `
      <div class="item">
        <div class="itemTop">
          <div class="name">${escapeHtml(i.shop || '—')}</div>
          <div class="meta">${escapeHtml(i.note || '—')}</div>
          ${i.link ? `<a class="pill" href="${escapeAttr(i.link)}">Open</a>` : ''}
        </div>
      </div>
    `).join('');
    openSheet(type === 'payments' ? 'Failed payments' : 'Broken Islas', items);
  }

  // ----- Navigation -----
  function setActiveTab(tab) {
    if (!tabHome || !tabCalendar || !tabBooks) return;

    tabHome.classList.toggle('active', tab === 'home');
    tabCalendar.classList.toggle('active', tab === 'calendar');
    tabBooks.classList.toggle('active', tab === 'books');

    if (viewHome) viewHome.classList.toggle('viewActive', tab === 'home');
    if (viewCalendar) viewCalendar.classList.toggle('viewActive', tab === 'calendar');
    if (viewBooks) viewBooks.classList.toggle('viewActive', tab === 'books');
  }

  function wireEvents() {
    if (tabHome) tabHome.addEventListener('click', () => setActiveTab('home'));
    if (tabCalendar) tabCalendar.addEventListener('click', () => setActiveTab('calendar'));
    if (tabBooks) tabBooks.addEventListener('click', () => setActiveTab('books'));

    if (chipPayments) chipPayments.addEventListener('click', () => openAttentionSheet('payments'));
    if (chipBroken) chipBroken.addEventListener('click', () => openAttentionSheet('broken'));
  }

  function init() {
    safeSetText(todayLabel, fmtToday());
    computeAttention();

    renderDemos();
    renderWeekly();
    renderShops();
    renderGlobal();

    renderCalendar();
    renderBooks();

    wireEvents();
  }

  // ----- Escaping (basic) -----
  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
  function escapeAttr(str){ return escapeHtml(str).replaceAll('`',''); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();