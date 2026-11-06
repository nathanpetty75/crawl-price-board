/**
 * Machine-readable API for agents (JSON). MCP-shaped tool list for discovery.
 * Free tier: search + domain. Paid API placeholder until Stripe keys exist.
 */
const { readBoard, listHistory } = require("../lib/store");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60");
  const path = String(req.query.path || req.query.action || "tools").toLowerCase();

  if (path === "tools" || path === "mcp") {
    return res.status(200).json({
      name: "crawl-price-board",
      version: "0.1.0",
      description:
        "Public board of AI-crawler access signals (robots.txt, llms.txt, HTTP 402/crawler-price) gathered politely from public URLs.",
      tools: [
        {
          name: "search_crawl_prices",
          description: "Search the board by domain substring or signal tag",
          endpoint: "GET /api/search?q=&signal=&limit=",
        },
        {
          name: "get_domain",
          description: "Get one domain row",
          endpoint: "GET /api/domain?domain=",
        },
        {
          name: "list_history",
          description: "List freshness snapshots (data moat)",
          endpoint: "GET /api/history",
        },
      ],
      paid_api: {
        status: "placeholder",
        note: "Stripe not connected in this environment. Planned: $29/mo API key for higher rate limits + webhook alerts when a watched domain's robots/402 signal changes. Contact nathan@nathanpetty.com to enable.",
      },
      disclaimer: "No reliance. Automated estimates from public signals only.",
    });
  }

  if (path === "stats") {
    const board = readBoard();
    const rows = board.rows || [];
    const with402 = rows.filter((r) => (r.signals || []).includes("http-402-or-crawler-price")).length;
    const withLlms = rows.filter((r) => r.llms_txt && r.llms_txt.present).length;
    const blocksAi = rows.filter((r) => (r.signals || []).includes("robots-blocks-ai")).length;
    return res.status(200).json({
      generated_at: board.generated_at,
      row_count: rows.length,
      with_402_or_price_header: with402,
      with_llms_txt: withLlms,
      robots_blocks_ai: blocksAi,
      history_snapshots: listHistory().length,
    });
  }

  res.status(404).json({ error: "unknown path", try: ["tools", "stats"] });
};
