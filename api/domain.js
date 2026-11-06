const { readBoard } = require("../lib/store");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const host = String(req.query.domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!host) return res.status(400).json({ error: "domain required" });
  const board = readBoard();
  const row = (board.rows || []).find((r) => r.domain === host);
  if (!row) return res.status(404).json({ error: "not in board", domain: host, generated_at: board.generated_at });
  res.status(200).json({
    generated_at: board.generated_at,
    disclaimer: "Automated public-signal snapshot. Verify on source. No reliance.",
    row,
  });
};
