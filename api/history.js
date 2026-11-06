const { listHistory, readHistoryDay } = require("../lib/store");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=120");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const date = String(req.query.date || "").trim();
  if (!date) {
    return res.status(200).json({
      snapshots: listHistory(),
      note: "Pass ?date=YYYY-MM-DD for a full snapshot. Freshness/history is the data moat.",
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  try {
    const snap = readHistoryDay(date);
    return res.status(200).json(snap);
  } catch {
    return res.status(404).json({ error: "no snapshot for date", date });
  }
};
