#!/usr/bin/env node
/**
 * Seed Crawl Price Board from public signals only.
 * Rate-limited, honest UA, robots.txt + llms.txt + root only.
 */
const { probeDomain, UA, sleep } = require("../lib/probe");
const { writeBoard, appendHistory } = require("../lib/store");

// Well-known publishers, platforms, docs, and commerce sites (public).
const SEED = [
  // AI / docs
  "openai.com","anthropic.com","x.ai","perplexity.ai","google.com","microsoft.com",
  "cloudflare.com","developers.cloudflare.com","docs.stripe.com","stripe.com",
  "shopify.com","shopify.dev","github.com","vercel.com","supabase.com",
  // News / publishers often in crawl debates
  "nytimes.com","washingtonpost.com","wsj.com","reuters.com","bloomberg.com",
  "theguardian.com","bbc.com","cnn.com","forbes.com","techcrunch.com",
  "wired.com","theverge.com","arstechnica.com","nature.com","science.org",
  "ft.com","economist.com","npr.org","apnews.com","axios.com",
  // Commerce
  "amazon.com","ebay.com","etsy.com","walmart.com","target.com","bestbuy.com",
  "nike.com","apple.com","adidas.com","wayfair.com","homedepot.com",
  // Local / SMB style
  "yelp.com","tripadvisor.com","zillow.com","realtor.com","craigslist.org",
  // Dev / content
  "stackoverflow.com","medium.com","substack.com","wordpress.com","ghost.org",
  "notion.so","figma.com","canva.com","dropbox.com","box.com",
  // More publishers
  "latimes.com","chicagotribune.com","usatoday.com","time.com","newsweek.com",
  "politico.com","theatlantic.com","newyorker.com","vox.com","slate.com",
  "huffpost.com","buzzfeed.com","businessinsider.com","cnbc.com","marketwatch.com",
  // Tech
  "mozilla.org","w3.org","ietf.org","python.org","nodejs.org","npmjs.com",
  "pypi.org","crates.io","docker.com","kubernetes.io","hashicorp.com",
  // More retail / travel
  "booking.com","expedia.com","airbnb.com","uber.com","lyft.com",
  "doordash.com","ubereats.com","instacart.com","costco.com","samsclub.com",
  // Finance / reference
  "sec.gov","irs.gov","usa.gov","wikipedia.org","wikidata.org","archive.org",
  "scholar.google.com","arxiv.org","pubmed.ncbi.nlm.nih.gov","nih.gov",
  // More
  "reddit.com","quora.com","linkedin.com","x.com","facebook.com","instagram.com",
  "tiktok.com","pinterest.com","snapchat.com","discord.com","slack.com",
  "spotify.com","netflix.com","hulu.com","disneyplus.com","twitch.tv",
  "salesforce.com","hubspot.com","zendesk.com","intercom.com","mailchimp.com",
  "twilio.com","sendgrid.com","okta.com","auth0.com","cloudinary.com",
  // Local service aggregators + niches
  "angi.com","thumbtack.com","homeadvisor.com","taskrabbit.com","nextdoor.com",
  "opentable.com","resy.com","grubhub.com","postmates.com",
  // More publishers / research
  "sciencedirect.com","springer.com","wiley.com","ieee.org","acm.org",
  "jstor.org","ssrn.com","researchgate.net","semanticscholar.org",
  // EU / intl news
  "lemonde.fr","spiegel.de","elpais.com","asahi.com","scmp.com",
  "aljazeera.com","dw.com","france24.com","cbc.ca","abc.net.au",
  // SaaS / tools agents hit
  "notion.com","airtable.com","asana.com","monday.com","trello.com",
  "atlassian.com","jira.atlassian.com","linear.app","coda.io",
  // Payment / commerce infra
  "paypal.com","square.com","adyen.com","braintreepayments.com","klarna.com",
  "affirm.com","shop.app","bigcommerce.com","woocommerce.com","magento.com",
  // Misc high-traffic
  "imdb.com","rottentomatoes.com","goodreads.com","allrecipes.com","epicurious.com",
  "webmd.com","mayoclinic.org","healthline.com","nih.gov",
  "weather.com","accuweather.com","mapquest.com","openstreetmap.org",
  // Developer blogs / CDN
  "dev.to","hashnode.com","css-tricks.com","smashingmagazine.com",
  "cdnjs.com","jsdelivr.com","unpkg.com","cdn.jsdelivr.net",
  // More
  "producthunt.com","ycombinator.com","crunchbase.com","pitchbook.com",
  "statista.com","similarweb.com","semrush.com","ahrefs.com","moz.com",
  "cloudflare.tv","workers.dev","pages.dev","netlify.com","render.com",
  "railway.app","fly.io","heroku.com","digitalocean.com","linode.com",
  "aws.amazon.com","azure.microsoft.com","cloud.google.com",
  // Content licensing examples often discussed
  "gettyimages.com","shutterstock.com","unsplash.com","pexels.com",
  "flickr.com","deviantart.com","behance.net","dribbble.com",
  // Education
  "coursera.org","udemy.com","edx.org","khanacademy.org","duolingo.com",
  "mit.edu","stanford.edu","harvard.edu","berkeley.edu","ox.ac.uk",
  // Government / open data
  "data.gov","census.gov","bls.gov","fda.gov","cdc.gov","who.int",
  "europa.eu","gov.uk","canada.ca","australia.gov.au",
];

// Deduplicate
const domains = [...new Set(SEED.map((d) => d.toLowerCase()))];

async function main() {
  console.log(`Seeding ${domains.length} domains with UA=${UA}`);
  const rows = [];
  let i = 0;
  for (const d of domains) {
    i++;
    process.stdout.write(`[${i}/${domains.length}] ${d} ... `);
    try {
      const row = await probeDomain(d);
      rows.push(row);
      console.log(
        `ok robots=${row.robots.status} llms=${row.llms_txt.present} root=${row.root.status} signals=${row.signals.join("|") || "-"}`
      );
    } catch (e) {
      console.log(`fail ${e.message || e}`);
      rows.push({
        domain: d,
        retrieved_at: new Date().toISOString(),
        error: String(e.message || e),
        signals: ["probe-error"],
        notes: [String(e.message || e)],
        confidence: "low",
        robots: { status: 0, ai_bots: {} },
        llms_txt: { present: false, status: 0 },
        root: { status: 0 },
      });
    }
    // polite gap between hosts
    await sleep(700);
  }
  const board = {
    generated_at: new Date().toISOString(),
    ua: UA,
    methodology:
      "Public GETs of /robots.txt, /llms.txt, and site root only. Honest research UA. No form posts, no login, no bypass. HTTP 402 / crawler-price headers recorded when present. Not affiliated with Cloudflare or any AI vendor.",
    row_count: rows.length,
    rows,
  };
  writeBoard(board);
  appendHistory(board);
  console.log(`Wrote ${rows.length} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
