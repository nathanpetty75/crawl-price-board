async function loadStats() {
  const r = await fetch("/api/v1?path=stats");
  const j = await r.json();
  const el = document.getElementById("stats");
  if (!el) return;
  el.innerHTML = [
    ["Domains", j.row_count ?? "—"],
    ["robots blocks AI", j.robots_blocks_ai ?? "—"],
    ["llms.txt present", j.with_llms_txt ?? "—"],
    ["402 / price hdr", j.with_402_or_price_header ?? "—"],
    ["History snaps", j.history_snapshots ?? "—"],
  ]
    .map(([k, v]) => `<div class="stat"><b>${v}</b><span class="muted">${k}</span></div>`)
    .join("");
  const gen = document.getElementById("generated");
  if (gen && j.generated_at) gen.textContent = "Board generated " + new Date(j.generated_at).toLocaleString();
}

function pills(row) {
  const out = [];
  for (const s of row.signals || []) {
    const cls = s.includes("402") || s.includes("blocks") || s.includes("denied") ? "bad" : s.includes("llms") ? "ok" : "warn";
    out.push(`<span class="pill ${cls}">${s}</span>`);
  }
  if (row.root && row.root.crawler_price) out.push(`<span class="pill bad">price ${row.root.crawler_price}</span>`);
  return out.join(" ") || '<span class="pill">no special signal</span>';
}

function botSummary(row) {
  const bots = (row.robots && row.robots.ai_bots) || {};
  const disallow = Object.entries(bots).filter(([, v]) => v === "disallow").map(([k]) => k);
  if (!disallow.length) return '<span class="muted">no explicit AI disallow in robots.txt</span>';
  return `<span class="pill bad">${disallow.length} AI bots disallowed</span> <span class="muted">${disallow.slice(0, 4).join(", ")}${disallow.length > 4 ? "…" : ""}</span>`;
}

async function search() {
  const q = document.getElementById("q").value.trim();
  const signal = document.getElementById("signal").value;
  const params = new URLSearchParams({ limit: "100" });
  if (q) params.set("q", q);
  if (signal) params.set("signal", signal);
  const r = await fetch("/api/search?" + params.toString());
  const j = await r.json();
  const tbody = document.querySelector("#board tbody");
  const meta = document.getElementById("meta");
  meta.textContent = `${j.total} matches · ${j.disclaimer}`;
  tbody.innerHTML = (j.rows || [])
    .map(
      (row) => `<tr>
      <td><b>${row.domain}</b><br><span class="muted">${row.retrieved_at ? new Date(row.retrieved_at).toLocaleString() : ""}</span></td>
      <td>${botSummary(row)}</td>
      <td>${row.llms_txt && row.llms_txt.present ? '<span class="pill ok">yes</span>' : '<span class="pill">no</span>'}</td>
      <td>${row.root ? row.root.status : "—"} ${row.root && row.root.crawler_price ? `<br><span class="pill bad">${row.root.crawler_price}</span>` : ""}</td>
      <td>${pills(row)}<br><span class="muted">${(row.notes || []).slice(0, 2).join(" · ")}</span></td>
    </tr>`
    )
    .join("");
}

document.getElementById("go")?.addEventListener("click", (e) => {
  e.preventDefault();
  search();
});
document.getElementById("q")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    search();
  }
});
loadStats().then(search).catch(console.error);
