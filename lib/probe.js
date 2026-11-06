/**
 * Polite public-signal probe for Crawl Price Board.
 * Only fetches robots.txt, llms.txt, and a single HEAD/GET of /.
 * Honest UA, respects robots delay heuristics, no form posts, no auth bypass.
 */

const UA =
  "CrawlPriceBoardBot/0.1 (+https://crawl-price-board.vercel.app; research; nathan@nathanpetty.com)";

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Googlebot",
  "PerplexityBot",
  "Bytespider",
  "CCBot",
  "Amazonbot",
  "meta-externalagent",
  "Applebot",
  "Applebot-Extended",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, { method = "GET", timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/plain,text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    const headers = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    let body = "";
    if (method !== "HEAD") {
      body = await res.text();
      if (body.length > 200_000) body = body.slice(0, 200_000);
    }
    return { ok: res.ok, status: res.status, headers, body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: String(e && e.name === "AbortError" ? "timeout" : e.message || e),
    };
  } finally {
    clearTimeout(t);
  }
}

function parseRobots(text) {
  const lines = String(text || "").split(/\r?\n/);
  const rules = {}; // bot -> { allow: [], disallow: [] }
  let current = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^(user-agent|allow|disallow|crawl-delay)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      current = [val];
      if (!rules[val]) rules[val] = { allow: [], disallow: [], crawlDelay: null };
    } else if (key === "allow") {
      for (const ua of current) {
        if (!rules[ua]) rules[ua] = { allow: [], disallow: [], crawlDelay: null };
        rules[ua].allow.push(val);
      }
    } else if (key === "disallow") {
      for (const ua of current) {
        if (!rules[ua]) rules[ua] = { allow: [], disallow: [], crawlDelay: null };
        rules[ua].disallow.push(val);
      }
    } else if (key === "crawl-delay") {
      for (const ua of current) {
        if (!rules[ua]) rules[ua] = { allow: [], disallow: [], crawlDelay: null };
        rules[ua].crawlDelay = Number(val) || val;
      }
    }
  }
  return rules;
}

function botStatus(rules) {
  const out = {};
  for (const bot of AI_BOTS) {
    // Prefer exact match, else *
    const r = rules[bot] || rules["*"] || null;
    if (!r) {
      out[bot] = "unknown";
      continue;
    }
    const blocksAll =
      r.disallow.includes("/") &&
      !r.allow.some((a) => a === "/" || a === "/*");
    const allowsAll =
      r.allow.includes("/") ||
      (r.disallow.length === 0 && r.allow.length === 0) ||
      (r.disallow.every((d) => d === "") && r.allow.length === 0);
    if (blocksAll) out[bot] = "disallow";
    else if (allowsAll || r.allow.length) out[bot] = "allow";
    else if (r.disallow.length) out[bot] = "partial-disallow";
    else out[bot] = "allow";
  }
  return out;
}

async function probeDomain(domain) {
  const host = String(domain)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const base = `https://${host}`;
  const retrieved_at = new Date().toISOString();
  const row = {
    domain: host,
    retrieved_at,
    robots: { status: 0, ai_bots: {}, crawl_delay: null, evidence: "" },
    llms_txt: { status: 0, present: false, evidence: "" },
    root: { status: 0, crawler_price: null, crawler_charged: null, server: null },
    signals: [],
    notes: [],
    confidence: "low",
  };

  const robots = await fetchText(`${base}/robots.txt`);
  row.robots.status = robots.status;
  if (robots.status === 200 && robots.body) {
    const rules = parseRobots(robots.body);
    row.robots.ai_bots = botStatus(rules);
    const star = rules["*"];
    if (star && star.crawlDelay != null) row.robots.crawl_delay = star.crawlDelay;
    row.robots.evidence = robots.body.slice(0, 500);
    const blocked = Object.entries(row.robots.ai_bots).filter(([, v]) => v === "disallow");
    if (blocked.length) {
      row.signals.push("robots-blocks-ai");
      row.notes.push(`robots.txt disallows: ${blocked.map(([k]) => k).join(", ")}`);
    } else {
      row.signals.push("robots-allows-or-silent");
    }
  } else if (robots.error) {
    row.notes.push(`robots.txt error: ${robots.error}`);
  } else {
    row.notes.push(`robots.txt HTTP ${robots.status}`);
  }

  await sleep(400);
  const llms = await fetchText(`${base}/llms.txt`);
  row.llms_txt.status = llms.status;
  row.llms_txt.present = llms.status === 200 && /llms|llm|#/i.test(llms.body || "");
  if (row.llms_txt.present) {
    row.llms_txt.evidence = (llms.body || "").slice(0, 300);
    row.signals.push("llms-txt");
  }

  await sleep(400);
  const root = await fetchText(base, { method: "GET" });
  row.root.status = root.status;
  row.root.server = root.headers["server"] || null;
  row.root.crawler_price = root.headers["crawler-price"] || null;
  row.root.crawler_charged = root.headers["crawler-charged"] || null;
  if (root.status === 402 || row.root.crawler_price) {
    row.signals.push("http-402-or-crawler-price");
    row.notes.push(
      `Possible pay-per-crawl: status=${root.status} crawler-price=${row.root.crawler_price || "n/a"}`
    );
    row.confidence = "medium";
  }
  if (/cloudflare/i.test(row.root.server || "") || /cf-ray/i.test(JSON.stringify(root.headers))) {
    row.signals.push("cloudflare");
  }
  if (root.status === 403 || root.status === 401) {
    row.signals.push("access-denied");
    row.notes.push(`Root returned HTTP ${root.status}`);
  }

  // Confidence
  if (row.robots.status === 200) row.confidence = row.confidence === "low" ? "medium" : row.confidence;
  if (row.signals.includes("http-402-or-crawler-price")) row.confidence = "high";

  return row;
}

module.exports = { probeDomain, UA, AI_BOTS, sleep, fetchText };
