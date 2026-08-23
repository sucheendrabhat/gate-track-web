const DATA_URL = "data/stats.json";

let STATE = null;   // parsed stats.json
let SCOPE = "all";  // "all" or a source id (string)

function initGate() {
  const overlay = document.getElementById("gate-overlay");
  const app = document.getElementById("app");
  if (overlay) overlay.hidden = true;
  if (app) app.hidden = false;
  boot();
}

async function boot() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  STATE = await res.json();
  renderVolumeSwitch();
  renderAll();
}

function currentSlice() {
  if (SCOPE === "all") return STATE.unified;
  return STATE.by_source[SCOPE];
}

function renderVolumeSwitch() {
  const el = document.getElementById("volume-switch");
  const items = [
    { id: "all", label: "All volumes" },
    ...STATE.sources.map((s) => ({ id: String(s.id), label: s.filename.replace(/\.pdf$/i, "") })),
  ];
  el.innerHTML = "";
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label;
    btn.className = "pill" + (SCOPE === item.id ? " active" : "");
    btn.addEventListener("click", () => {
      SCOPE = item.id;
      renderVolumeSwitch();
      renderAll();
    });
    el.appendChild(btn);
  });
}

function renderAll() {
  renderSummary();
  renderChapters();
  renderActivity();
  renderFooter();
}

function renderSummary() {
  const s = currentSlice().stats;
  const attempted = s.L1 + s.L2 + s.L3;
  const pct = s.total ? Math.round((attempted / s.total) * 100) : 0;
  const cards = [
    { label: "Total questions", value: s.total, cls: "" },
    { label: "Attempted", value: `${attempted} (${pct}%)`, cls: "accent" },
    { label: "Pending", value: s.NONE, cls: "muted" },
    { label: "L1 \u00b7 easy", value: s.L1, cls: "l1" },
    { label: "L2 \u00b7 forgot something", value: s.L2, cls: "l2" },
    { label: "L3 \u00b7 didn't understand", value: s.L3, cls: "l3" },
  ];
  document.getElementById("summary-grid").innerHTML = cards
    .map(
      (c) => `
      <div class="stat-card ${c.cls}">
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>`
    )
    .join("");
}

function renderChapters() {
  const chapters = currentSlice().by_chapter;
  const list = document.getElementById("chapter-list");
  if (!chapters.length) {
    list.innerHTML = `<div class="empty">No questions indexed yet.</div>`;
    return;
  }
  list.innerHTML = chapters
    .map((c, i) => {
      const t = c.total || 1;
      const w = (n) => ((n / t) * 100).toFixed(2);
      return `
      <div class="chapter-row">
        <div class="chapter-rank">${String(i + 1).padStart(2, "0")}</div>
        <div class="chapter-main">
          <div class="chapter-top">
            <span class="chapter-name">${escapeHtml(c.chapter_name)}${
        c.urgent ? '<span class="urgent-dot" title="5+ questions marked didn\'t understand"></span>' : ""
      }</span>
            <span class="chapter-pct">${c.pct_done}%</span>
          </div>
          <div class="bar">
            <span style="width:${w(c.L1)}%; background:var(--l1)" title="L1: ${c.L1}"></span>
            <span style="width:${w(c.L2)}%; background:var(--l2)" title="L2: ${c.L2}"></span>
            <span style="width:${w(c.L3)}%; background:var(--l3)" title="L3: ${c.L3}"></span>
          </div>
          <div class="chapter-meta">${c.total - c.NONE}/${c.total} attempted &middot; ${c.NONE} pending</div>
        </div>
      </div>`;
    })
    .join("");
}

function renderActivity() {
  const a = currentSlice().activity;
  const cards = [
    { label: "Current streak", value: `${a.current_streak} day${a.current_streak === 1 ? "" : "s"}`, cls: "accent" },
    { label: "Longest streak", value: `${a.longest_streak} day${a.longest_streak === 1 ? "" : "s"}`, cls: "" },
    { label: "Active days", value: a.active_days, cls: "" },
    { label: "Questions marked", value: a.total_marked, cls: "" },
  ];
  document.getElementById("activity-cards").innerHTML = cards
    .map(
      (c) => `
      <div class="stat-card small ${c.cls}">
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>`
    )
    .join("");

  renderHeatmap(a.daily);
  renderDailyCalendar(a.daily);
}

function heatColor(count) {
  if (count <= 0) return "#ebedf0";
  if (count <= 1) return "#9be9a8";
  if (count <= 3) return "#40c463";
  if (count <= 6) return "#30a14e";
  return "#216e39";
}

function heatTextColor(count) {
  return count > 3 ? "#ffffff" : "#1f2430";
}

function renderHeatmap(daily) {
  const countsByDate = Object.fromEntries(daily.map((d) => [d.date, d.total]));
  const weeks = 18;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  const mondayOffset = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - mondayOffset);

  const cols = [];
  let cursor = new Date(start);
  while (cursor <= today) {
    const col = [];
    for (let row = 0; row < 7; row++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + row);
      col.push(d > today ? null : d);
    }
    cols.push(col);
    cursor.setDate(cursor.getDate() + 7);
  }

  const dayLabelsEl = document.querySelector(".heatmap-daylabels") || document.createElement("div");
  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];
  dayLabelsEl.className = "heatmap-daylabels";
  dayLabelsEl.innerHTML = dayLabels.map((l) => `<span>${l}</span>`).join("");

  let lastMonth = null;
  const colsHtml = cols
    .map((col) => {
      const first = col.find((d) => d);
      let monthLabel = "";
      if (first && first.getMonth() !== lastMonth) {
        monthLabel = first.toLocaleString("en-US", { month: "short" });
        lastMonth = first.getMonth();
      }
      const cellsHtml = col
        .map((d) => {
          if (!d) return `<span class="heatmap-cell empty"></span>`;
          const iso = toIsoDate(d);
          const cnt = countsByDate[iso] || 0;
          return `<span class="heatmap-cell" data-date="${iso}" data-count="${cnt}" style="background:${heatColor(cnt)}"></span>`;
        })
        .join("");
      return `<div class="heatmap-col"><span class="heatmap-month">${monthLabel}</span>${cellsHtml}</div>`;
    })
    .join("");

  const el = document.getElementById("heatmap");
  el.innerHTML = "";
  el.appendChild(dayLabelsEl);
  const gridEl = document.createElement("div");
  gridEl.className = "heatmap-grid";
  gridEl.innerHTML = colsHtml;
  el.appendChild(gridEl);

  const hint = document.getElementById("heatmap-hint");
  el.querySelectorAll(".heatmap-cell[data-date]").forEach((cell) => {
    cell.addEventListener("mouseenter", () => {
      const d = new Date(cell.dataset.date + "T00:00:00");
      const label = d.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
      hint.textContent = `${label}: ${cell.dataset.count} question(s) marked`;
    });
  });
}

function renderDailyCalendar(daily) {
  const countsByDate = Object.fromEntries(daily.map((d) => [d.date, d.total]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = daily.map((d) => new Date(d.date + "T00:00:00"));
  const earliest = dates.length ? new Date(Math.min(...dates)) : new Date(today);

  const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 1);

  const months = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const monthsHtml = months
    .map((monthDate) => {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const leadingBlanks = new Date(year, month, 1).getDay(); // 0 = Sunday

      const cells = [];
      for (let i = 0; i < leadingBlanks; i++) cells.push(null);
      for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));

      const cellsHtml = cells
        .map((d) => {
          if (!d) return `<span class="cal-cell pad"></span>`;
          if (d > today) return `<span class="cal-cell future">${d.getDate()}</span>`;
          const iso = toIsoDate(d);
          const cnt = countsByDate[iso] || 0;
          const bg = heatColor(cnt);
          const fg = heatTextColor(cnt);
          return `<span class="cal-cell" data-date="${iso}" data-count="${cnt}" style="background:${bg}; color:${fg}">${d.getDate()}</span>`;
        })
        .join("");

      const title = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" });

      return `
        <div class="cal-month">
          <div class="cal-month-title">${title}</div>
          <div class="cal-weekdays">${weekdayLabels.map((l) => `<span>${l}</span>`).join("")}</div>
          <div class="cal-grid">${cellsHtml}</div>
        </div>`;
    })
    .join("");

  const el = document.getElementById("daily-calendar");
  el.innerHTML = monthsHtml || `<div class="empty">Nothing marked yet.</div>`;

  const hint = document.getElementById("daily-calendar-hint");
  el.querySelectorAll(".cal-cell[data-date]").forEach((cell) => {
    cell.addEventListener("mouseenter", () => {
      const d = new Date(cell.dataset.date + "T00:00:00");
      const label = d.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
      hint.textContent = `${label}: ${cell.dataset.count} question(s) marked`;
    });
  });
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderFooter() {
  const gen = new Date(STATE.generated_at);
  document.getElementById("synced-at").textContent = `Synced ${gen.toLocaleString()}`;
  document.getElementById("footer-total").textContent = `${STATE.unified.stats.total} questions across ${STATE.sources.length} volume(s)`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

initGate();
