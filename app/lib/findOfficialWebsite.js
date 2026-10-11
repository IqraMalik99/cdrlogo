// lib/findOfficialWebsite.js
// Finds a brand's official website using Tavily web search (up to 3 attempts).
// Returns "" if no website can be confirmed.
//
// Verification now uses the Tavily results themselves (the site must appear in the
// search results AND be tied to the brand). The live check only rejects a site that is
// clearly dead (DNS failure / 404 / 410) — bot blocking or slow sites no longer cause
// a false "blank".

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BLOCKLIST = [
  "wikipedia.org", "wikimedia.org", "wikidata.org", "facebook.com", "instagram.com",
  "twitter.com", "x.com", "linkedin.com", "youtube.com", "tiktok.com", "pinterest.com",
  "reddit.com", "quora.com", "medium.com", "amazon.com", "ebay.com", "alibaba.com",
  "aliexpress.com", "etsy.com", "walmart.com", "crunchbase.com", "bloomberg.com",
  "reuters.com", "forbes.com", "glassdoor.com", "indeed.com", "yelp.com",
  "tripadvisor.com", "trustpilot.com", "zoominfo.com", "dnb.com", "owler.com",
  "brandfetch.com", "logos-world.net", "logowik.com", "seeklogo.com", "1000logos.net",
  "worldvectorlogo.com", "brandslogos.com", "freelogovectors.net",
  "fandom.com", "github.com", "play.google.com", "apps.apple.com", "britannica.com",
  "google.com", "bing.com", "yahoo.com", "mapquest.com",
  "cbinsights.com", "preqin.com", "dealroom.co", "pitchbook.com", "ifninvestor.com",
  "altss.com", "washingtontimes.com", "gulfnews.com", "wikiwand.com", "ipfs.aleph.im",
];

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hostOf(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function domainLabel(host) {
  const parts = host.split(".");
  if (parts.length <= 2) return parts[0];
  const sld = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);
  return sld.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2
    ? parts[parts.length - 3]
    : parts[parts.length - 2];
}

function brandMatchesDomain(brand, host) {
  const b = norm(brand);
  const d = norm(domainLabel(host));
  if (!b || !d || d.length < 3) return false;
  return d === b || (d.length >= 4 && b.includes(d)) || (b.length >= 4 && d.includes(b));
}

// Blocked unless it is the brand's own site (brand "Amazon" may use amazon.com).
function isBlocked(host, brand) {
  if (host === "cdrlogo.com" || host.endsWith(".cdrlogo.com")) return true;
  const listed = BLOCKLIST.some((b) => host === b || host.endsWith(`.${b}`));
  return listed && !brandMatchesDomain(brand, host);
}

async function tavily(query, max = 10) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn(`  [website] TAVILY_API_KEY is NOT set in this environment — search skipped, website will be blank`);
    return [];
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: max,
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`  [website] Tavily error ${res.status}: ${body.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (err) {
    console.warn(`  [website] Tavily request failed: ${err.message}`);
    return [];
  }
}

function collectCandidates(results, brand) {
  const b = norm(brand);
  const first = norm(String(brand).split(/\s+/)[0]);
  const map = new Map();

  for (const r of results) {
    const host = hostOf(r?.url || "");
    if (!host || isBlocked(host, brand)) continue;

    const e = map.get(host) || { host, title: "", snippet: "", hits: 0, strong: false, mentionsBrand: false };
    e.hits += 1;
    if (!e.title && r.title) e.title = String(r.title).slice(0, 120);
    if (!e.snippet && r.content) e.snippet = String(r.content).slice(0, 200);

    const blob = norm(`${r.title || ""} ${r.content || ""} ${r.url || ""}`);
    if ((b && blob.includes(b)) || (first.length >= 3 && blob.includes(first))) e.mentionsBrand = true;

    e.strong = e.strong || brandMatchesDomain(brand, host);
    map.set(host, e);
  }

  return [...map.values()].sort(
    (a, c) => Number(c.strong) - Number(a.strong) || c.hits - a.hits
  );
}

// The LLM may only PICK from real Tavily results — it can never invent a domain.
async function pickFromCandidates({ brand, country, industry, candidates }) {
  const pool = candidates.filter((c) => c.mentionsBrand).slice(0, 8);
  if (!pool.length) return "";

  const list = pool.map((c, i) => `${i + 1}. ${c.host} — ${c.title} | ${c.snippet}`).join("\n");
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You choose a company's OWN official website from a list of real web-search results. Only choose a domain that appears in the list. If none is clearly the company's own site (not news, a directory, a reseller, or a different company), return an empty string. Return only JSON.",
        },
        {
          role: "user",
          content: `Brand: ${brand}\nCountry: ${country || "unknown"}\nIndustry: ${industry || "unknown"}\n\nRESULTS:\n${list}\n\nReturn ONLY: { "domain": "example.com" or "" }`,
        },
      ],
      response_format: { type: "json_object" },
    });
    let parsed = {};
    try { parsed = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch { }
    const domain = String(parsed.domain || "")
      .toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    return pool.some((c) => c.host === domain) ? domain : "";
  } catch (err) {
    console.warn(`  [website] LLM pick failed: ${err.message}`);
    return "";
  }
}

// Only rejects a site that is clearly dead. Timeouts / bot-blocking / odd errors => accepted.
async function isClearlyDead(host) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://${host}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LogoArchiveBot/1.0)" },
    });
    return res.status === 404 || res.status === 410;
  } catch (err) {
    const code = err?.cause?.code || err?.code || "";
    return code === "ENOTFOUND" || code === "ECONNREFUSED";
  } finally {
    clearTimeout(timer);
  }
}

export async function findOfficialWebsite({ brand, country, industry }) {
  if (!brand) return "";

  const queries = [
    `${brand} official website`,
    `${brand} ${country || ""} ${industry || ""} official site`.replace(/\s+/g, " ").trim(),
    `${brand} company homepage`,
  ];
  const rejected = new Set();

  for (let i = 0; i < queries.length; i++) {
    console.log(`  [website] Attempt ${i + 1}/3 — Tavily: "${queries[i]}"`);
    const results = await tavily(queries[i]);
    const candidates = collectCandidates(results, brand).filter((c) => !rejected.has(c.host));

    console.log(
      `  [website] Attempt ${i + 1}: ${results.length} result(s), candidates: ${
        candidates.map((c) => `${c.host}${c.strong ? "*" : ""}`).join(", ") || "(none)"
      }`
    );
    if (!candidates.length) continue;

    const tryHosts = [];
    const strong = candidates.find((c) => c.strong);
    if (strong) tryHosts.push(strong.host);

    const picked = await pickFromCandidates({ brand, country, industry, candidates });
    if (picked && !tryHosts.includes(picked)) tryHosts.push(picked);

    for (const host of tryHosts) {
      if (await isClearlyDead(host)) {
        rejected.add(host);
        console.log(`  [website] ✗ ${host} looks dead (DNS/404) — rejected`);
        continue;
      }
      console.log(`  [website] ✓ Accepted https://${host} (attempt ${i + 1}/3)`);
      return `https://${host}`;
    }
  }

  console.warn(`  [website] No official website confirmed for "${brand}" after 3 attempts — leaving blank.`);
  return "";
}