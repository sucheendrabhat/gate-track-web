const DATA_URL = "data/stats.json";

// SHA-256 hex of the site password. This placeholder matches "changeme" —
// replace it before you publish. Generate your own with:
//   python3 -c "import hashlib;print(hashlib.sha256('yourpassword'.encode()).hexdigest())"
// or, in any browser console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
const PASSWORD_HASH = "74a438d2559db2dc1f6f98a1008d6c50eb12f9f9932fd5173a6364cd5463a8a3";

let STATE = null;   // parsed stats.json
let SCOPE = "all";  // "all" or a source id (string)

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function initGate() {
  const overlay = document.getElementById("gate-overlay");
  const app = document.getElementById("app");
  const form = document.getElementById("gate-form");
  const input = document.getElementById("gate-input");
  const error = document.getElementById("gate-error");

  if (sessionStorage.getItem("gate-unlocked") === "1") {
    overlay.hidden = true;
    app.hidden = false;
    boot();
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(input.value);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem("gate-unlocked", "1");
      overlay.hidden = true;
      app.hidden = false;
      boot();
    } else {
      error.hidden = false;
      input.value = "";
      input.focus();
    }
  });
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

  const tbody = document.querySelector("#daily-table tbody");
  tbody.innerHTML =
    a.daily
      .map((d) => `<tr><td>${d.date}</td><td>${d.total}</td><td>${d.L1}</td><td>${d.L2}</td><td>${d.L3}</td></tr>`)
      .join("") || `<tr><td colspan="5" class="empty">Nothing marked yet.</td></tr>`;
}

function heatColor(count) {
  if (count <= 0) return "#ebedf0";
  if (count <= 1) return "#c6dbef";
  if (count <= 3) return "#6baed6";
  if (count <= 6) return "#2171b5";
  return "#08306b";
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
