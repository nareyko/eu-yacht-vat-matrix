import { evaluate, evaluateScenarios } from "./vat-matrix.mjs";

const CAPEX_URL = "https://fairhelm.com/en/yachts/tools/capex-scanner/";
const LISTING_URL = "https://fairhelm.com/en/yachts/services/listing-review/";

/** @type {any} */
let matrix = null;

async function boot() {
  const res = await fetch("./data/matrix.json");
  if (!res.ok) throw new Error(`Failed to load matrix.json (${res.status})`);
  matrix = await res.json();
  fillSelects();
  bindUi();
  renderVerdict();
  renderScenarioTable();
  renderNotes();
}

function fillSelects() {
  fillSelect("vat_evidence", matrix.axes.vat_evidence.options, "broker_claim");
  fillSelect("buyer_context", matrix.axes.buyer_context.options, "eu_resident_eu_berth");
  fillSelect("ce_status", matrix.axes.ce_status.options, "plate_only");
}

/**
 * @param {string} id
 * @param {Array<{id:string,label:string}>} options
 * @param {string} selected
 */
function fillSelect(id, options, selected) {
  const el = /** @type {HTMLSelectElement} */ (document.getElementById(id));
  el.innerHTML = options
    .map(
      (o) =>
        `<option value="${escapeAttr(o.id)}"${o.id === selected ? " selected" : ""}>${escapeHtml(o.label)}</option>`,
    )
    .join("");
}

function bindUi() {
  for (const id of ["vat_evidence", "buyer_context", "ce_status"]) {
    document.getElementById(id)?.addEventListener("change", renderVerdict);
  }
  document.getElementById("btn-reset")?.addEventListener("click", () => {
    fillSelects();
    renderVerdict();
  });
}

function currentAnswers() {
  return {
    vat_evidence: /** @type {HTMLSelectElement} */ (document.getElementById("vat_evidence"))
      .value,
    buyer_context: /** @type {HTMLSelectElement} */ (document.getElementById("buyer_context"))
      .value,
    ce_status: /** @type {HTMLSelectElement} */ (document.getElementById("ce_status")).value,
  };
}

function renderVerdict() {
  const started = performance.now();
  const verdict = evaluate(currentAnswers());
  const ms = performance.now() - started;

  const root = document.getElementById("verdict");
  if (!root) return;

  root.dataset.overall = verdict.overall;
  root.innerHTML = `
    <div class="verdict-top">
      <p class="verdict-kicker">${escapeHtml(overallLabel(verdict.overall))} · ${ms.toFixed(1)} ms</p>
      <h2>${escapeHtml(verdict.headline)}</h2>
      <p class="verdict-summary">${escapeHtml(verdict.summary)}</p>
    </div>
    <div class="axis-grid">
      ${axisCard(verdict.vat)}
      ${axisCard(verdict.t2l)}
      ${axisCard(verdict.ce)}
    </div>
    <ol class="before-list">
      ${verdict.before_deposit.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
    </ol>
    <div class="door-row">
      <a class="door door-primary" href="${CAPEX_URL}" rel="noopener noreferrer">CapEx scanner — paste the listing</a>
      <a class="door door-secondary" href="${LISTING_URL}" rel="noopener noreferrer">Listing review €49</a>
    </div>
  `;
}

/**
 * @param {{status:string,label:string,detail:string}} axis
 */
function axisCard(axis) {
  return `
    <article class="axis-card" data-status="${escapeAttr(axis.status)}">
      <p class="axis-status">${escapeHtml(statusWord(axis.status))}</p>
      <h3>${escapeHtml(axis.label)}</h3>
      <p>${escapeHtml(axis.detail)}</p>
    </article>
  `;
}

function renderScenarioTable() {
  const tbody = document.getElementById("scenario-body");
  if (!tbody) return;
  const rows = evaluateScenarios(matrix);
  tbody.innerHTML = rows
    .map((row) => {
      const v = row.verdict;
      return `<tr>
        <td>${escapeHtml(row.title)}</td>
        <td data-status="${v.vat.status}">${statusWord(v.vat.status)}</td>
        <td data-status="${v.t2l.status}">${statusWord(v.t2l.status)}</td>
        <td data-status="${v.ce.status}">${statusWord(v.ce.status)}</td>
        <td data-overall="${v.overall}">${overallLabel(v.overall)}</td>
      </tr>`;
    })
    .join("");
}

function renderNotes() {
  const box = document.getElementById("evidence-notes");
  if (!box) return;
  box.innerHTML = matrix.evidence_notes
    .map(
      (n) => `
      <article class="note-card">
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.body)}</p>
      </article>`,
    )
    .join("");

  const sources = document.getElementById("sources-list");
  if (sources) {
    sources.innerHTML = matrix.sources
      .map(
        (s) =>
          `<li><a href="${escapeAttr(s.url)}" rel="noopener noreferrer">${escapeHtml(s.title)}</a></li>`,
      )
      .join("");
  }

  const updated = document.getElementById("matrix-updated");
  if (updated) updated.textContent = matrix.updated;
}

/** @param {string} overall */
function overallLabel(overall) {
  if (overall === "go") return "GO";
  if (overall === "hold") return "HOLD";
  return "STOP";
}

/** @param {string} status */
function statusWord(status) {
  if (status === "ok") return "OK";
  if (status === "gap") return "GAP";
  return "RISK";
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** @param {string} s */
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}

boot().catch((err) => {
  const root = document.getElementById("verdict");
  if (root) {
    root.innerHTML = `<p class="boot-error">Could not load matrix: ${escapeHtml(err.message)}</p>`;
  }
  console.error(err);
});
