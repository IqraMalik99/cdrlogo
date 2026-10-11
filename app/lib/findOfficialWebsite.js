// lib/findOfficialWebsite.js
// Finds a brand's official website using Tavily web search (up to 3 attempts).
// Returns "" if no website can be confirmed. It never guesses a domain.

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
  "indeed.com", "naukri.com", "oraclecloud.com", "scribd.com", "slideshare.net",
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

function isHomepageUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const p = u.pathname.replace(/\/+$/, "");
    return p === "" || /^\/(en|ar|us|uk|home|index(\.\w+)?)$/i.test(p);
  } catch {
    return false;
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

async function tavily(query, depth = "basic", max = 10) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn(`  [website] TAVILY_API_KEY is NOT set in this environment — search skipped, website will be blank`);
    return [];
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: depth,
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

    const e = map.get(host) || {
      host, title: "", snippet: "", hits: 0, maxScore: 0,
      strong: false, exact: false, homepage: false, mentionsBrand: false,
    };
    e.hits += 1;
    e.maxScore = Math.max(e.maxScore, Number(r.score) || 0);
    if (!e.title && r.title) e.title = String(r.title).slice(0, 120);
    if (!e.snippet && r.content) e.snippet = String(r.content).slice(0, 220);
    if (isHomepageUrl(r.url)) e.homepage = true;

    const blob = norm(`${r.title || ""} ${r.content || ""}`);
    if ((b && blob.includes(b)) || (first.length >= 3 && blob.includes(first))) e.mentionsBrand = true;

    e.strong = e.strong || brandMatchesDomain(brand, host);
    e.exact = e.exact || (!!b && norm(domainLabel(host)) === b);
    map.set(host, e);
  }

  const score = (c) =>
    (c.exact ? 5 : 0) + (c.strong ? 2 : 0) + (c.homepage ? 2 : 0) +
    (c.mentionsBrand ? 1 : 0) + c.maxScore + Math.min(c.hits, 3) * 0.3;

  return [...map.values()].sort((a, c) => score(c) - score(a));
}

// The LLM may only PICK from real Tavily results — it can never invent a domain.
async function pickFromCandidates({ brand, country, industry, candidates }) {
  const pool = candidates.slice(0, 10);
  if (!pool.length) return "";

  const list = pool
    .map((c, i) => `${i + 1}. ${c.host}${c.homepage ? " [homepage result]" : ""} — ${c.title} | ${c.snippet}`)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You choose an organization's OWN official website from a list of real web-search results. Only choose a domain from the list. The official site is operated by the organization itself (often its own name or abbreviation as the domain, possibly with a country domain like .ae or .co.uk). Reject travel guides, booking or flight-info sites, directories, job boards, news, resellers, fan sites, and sites that only have a similar-looking name. If none is clearly the organization's own site, return an empty domain. Return only JSON.",
        },
        {
          role: "user",
          content: `Organization: ${brand}\nCountry: ${country || "unknown"}\nIndustry: ${industry || "unknown"}\n\nRESULTS:\n${list}\n\nReturn ONLY: { "domain": "example.com" or "", "reason": "one short sentence" }`,
        },
      ],
      response_format: { type: "json_object" },
    });
    let parsed = {};
    try { parsed = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch { }
    const domain = String(parsed.domain || "")
      .toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    console.log(`  [website] LLM pick: "${domain || "(none)"}" — ${parsed.reason || ""}`);
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

  const attempts = [
    { q: `${brand} official website`, depth: "basic" },
    { q: `${brand} ${country || ""} official site homepage`.replace(/\s+/g, " ").trim(), depth: "basic" },
    { q: `${brand} ${industry || ""} official website`.replace(/\s+/g, " ").trim(), depth: "advanced" },
  ];
  const rejected = new Set();

  for (let i = 0; i < attempts.length; i++) {
    const { q, depth } = attempts[i];
    console.log(`  [website] Attempt ${i + 1}/3 — Tavily (${depth}): "${q}"`);
    const results = await tavily(q, depth);
    const candidates = collectCandidates(results, brand).filter((c) => !rejected.has(c.host));

    console.log(
      `  [website] Attempt ${i + 1}: ${results.length} result(s). Candidates (best first): ${
        candidates.slice(0, 8).map((c) => `${c.host}${c.exact ? "=" : c.strong ? "*" : ""}${c.homepage ? "^" : ""}`).join(", ") || "(none)"
      }   [= exact name, * similar name, ^ homepage result]`
    );
    if (!candidates.length) continue;

    const tryHosts = [];
    // Only an EXACT name match (nike -> nike.com) is trusted without asking the LLM.
    const exact = candidates.find((c) => c.exact);
    if (exact) tryHosts.push(exact.host);

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