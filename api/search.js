const { readBoard } = require("../lib/store");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const board = readBoard();
  const q = String(req.query.q || "").trim().toLowerCase();
  const signal = String(req.query.signal || "").trim().toLowerCase();
  let rows = board.rows || [];
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.domain || "").includes(q) ||
        (r.notes || []).join(" ").toLowerCase().includes(q) ||
        (r.signals || []).join(" ").toLowerCase().includes(q)
    );
  }
  if (signal) rows = rows.filter((r) => (r.signals || []).includes(signal));

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const slice = rows.slice(offset, offset + limit);

  res.status(200).json({
    generated_at: board.generated_at,
    ua: board.ua,
    methodology: board.methodology,
    total: rows.length,
    offset,
    limit,
    disclaimer:
      "Automated public-signal snapshot. Not legal advice. Prices and policies change; verify on the source site. No reliance.",
    rows: slice,
  });
};
