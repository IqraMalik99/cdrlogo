

function generateSlugFromName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractCategoryEntries(categoriesJson) {
  if (!categoriesJson) return [];
  let list = categoriesJson;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => {
      if (typeof c === "string") {
        return { name: c, subname: "", slug: generateSlugFromName(c), brand: "", country: "", synonyms: [] };
      }
      if (c && typeof c === "object" && (c.name || c.title || c.label)) {
        const name = c.name || c.title || c.label || "";
        let synonyms = [];
        if (c.meaning && Array.isArray(c.meaning.synonym)) {
          synonyms = c.meaning.synonym.filter(Boolean).map(String);
        } else if (Array.isArray(c.synonym)) {
          synonyms = c.synonym.filter(Boolean).map(String);
        }
        return {
          name,
          subname: c.subname || c.subName || c.sub_category || "",
          slug: c.slug || generateSlugFromName(name),
          brand: c.brand || "",
          country: c.country || "",
          etype: c.etype || "",
          type: c.type || "",
          url: c.url || [],
          priority: c.priority || "",
          synonyms,
        };
      }
      return null;
    })
    .filter((c) => c && c.name);
}


function buildCategoryTree(entries) {
  const tree = new Map();
  for (const e of entries) {
    if (!e.name) continue;
    if (!tree.has(e.name)) tree.set(e.name, new Set());
    if (e.subname) tree.get(e.name).add(e.subname);
  }
  return tree;
}

function categoryTreeLines(tree) {
  const lines = [];
  for (const [main, subs] of tree.entries()) {
    lines.push(subs.size > 0 ? `- ${main}: ${Array.from(subs).join(", ")}` : `- ${main}`);
  }
  return lines;
}

// ── Normalization helpers ───────────────────────────────────────────────────
function normalizeLabel(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accent marks, keep base letters
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCompact(s) {
  return normalizeLabel(s).replace(/\s+/g, "");
}

function wordsOf(s) {
  const n = normalizeLabel(s);
  return n ? n.split(" ").filter(Boolean) : [];
}


function hasWordOverlap(a, b) {
  const wordsA = new Set(wordsOf(a));
  if (!wordsA.size) return false;
  return wordsOf(b).some((w) => wordsA.has(w));
}

const CATEGORY_STOPWORDS = new Set(["and", "of", "the", "for", "in", "on", "by", "a", "an"]);


function fuzzySubCategoryScore(candidateSub, gptSub) {
  const aWords = wordsOf(candidateSub).filter((w) => !CATEGORY_STOPWORDS.has(w));
  const bWords = new Set(wordsOf(gptSub).filter((w) => !CATEGORY_STOPWORDS.has(w)));
  if (!aWords.length || !bWords.size) return 0;

  const aNorm = normalizeLabel(candidateSub);
  const bNorm = normalizeLabel(gptSub);
  if (aNorm === bNorm) return 1;

  let shared = 0;
  for (const w of aWords) if (bWords.has(w)) shared++;
  if (!shared) return 0;

  // Fraction of the candidate label's own distinguishing words found in
  // GPT's answer — a short label fully covered scores near 1.0, a long
  // label with only one incidental shared word scores low.
  return shared / aWords.length;
}

// Finds the best-matching REAL sub-category (from the tree) for whatever
// string GPT returned under a given main category. Returns "" if nothing
// scores above a small minimum threshold — in that case the caller should
// fall back to "template" rather than fabricate a category.
function findClosestSubCategory(tree, mainCategory, gptSubRaw) {
  const subs = Array.from(tree.get(mainCategory) || new Set());
  if (!subs.length || !gptSubRaw) return "";

  let best = "";
  let bestScore = 0;
  for (const s of subs) {
    const score = fuzzySubCategoryScore(s, gptSubRaw);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  // Require at least a modest match — avoids picking a wildly unrelated
  // sub-category just because it shared one generic word.
  return bestScore >= 0.34 ? best : "";
}

// ── Brand fuzzy matching ────────────────────────────────────────────────────
// Generic/category-noise words that shouldn't count as a "brand match" on
// their own — e.g. every brand in an "American Football" subcategory will
// contain the words "football"/"league", so overlap on those alone is
// meaningless. Combined at call time with the words IN mainCategory/
// subCategory themselves (also category noise, not brand-distinguishing).
const GENERIC_BRAND_STOPWORDS = new Set([
  "of", "the", "and", "for", "in", "on", "by", "co", "inc", "ltd", "llc",
  "plc", "corp", "corporation", "company", "group", "international",
  "league", "federation", "association", "union", "organization",
  "organisation", "committee", "board", "council", "club", "team",
  "national", "world", "global", "holdings", "limited", "logo", "brand",
]);

function buildBrandStopWords(mainCategory, subCategory) {
  const stop = new Set(GENERIC_BRAND_STOPWORDS);
  for (const w of wordsOf(mainCategory)) stop.add(w);
  for (const w of wordsOf(subCategory)) stop.add(w);
  return stop;
}

function significantWords(s, stopWords) {
  return wordsOf(s).filter((w) => w.length > 2 && !stopWords.has(w));
}

// True if a and b share at least one BRAND-DISTINGUISHING word (i.e. not a
// generic/category-noise word from the stoplist above).
function hasSignificantWordOverlap(a, b, stopWords) {
  const setA = new Set(significantWords(a, stopWords));
  if (!setA.size) return false;
  return significantWords(b, stopWords).some((w) => setA.has(w));
}

// True if any run of `minWords`+ CONSECUTIVE words from `a` appears, in
// order, inside `b` — but only counts if that phrase contains at least one
// brand-distinguishing (non-stopword) word, so phrases like "of the" or
// "football league" (pure category noise) don't count as a match on their own.
function hasConsecutiveWordMatch(a, b, stopWords, minWords = 2) {
  const wordsA = wordsOf(a);
  const wordsB = wordsOf(b);
  if (wordsA.length < minWords || wordsB.length < minWords) return false;
  const bNorm = normalizeLabel(b);
  for (let len = wordsA.length; len >= minWords; len--) {
    for (let i = 0; i + len <= wordsA.length; i++) {
      const slice = wordsA.slice(i, i + len);
      const hasSignificant = slice.some((w) => w.length > 2 && !stopWords.has(w));
      if (!hasSignificant) continue;
      const phrase = slice.join(" ");
      if (phrase.length >= 3 && bNorm.includes(phrase)) return true;
    }
  }
  return false;
}

// Returns a numeric strength score (0 = no match at all) instead of a flat
// yes/no, weighted by what FRACTION of the brand's own distinguishing words
// are found in the logo name. This is the key fix for cases like "Nestle"
// (1 distinguishing word, fully covered by logo "Nestle Milk" → strong
// score) vs. "Amul (Gujarat Cooperative Milk Marketing Federation)" (6
// distinguishing words, only "milk" happens to overlap → weak score) — a
// flat "any shared word counts the same" rule would wrongly treat both as
// equally good and let list order decide.
//   ~1.0+ = brand's distinguishing vocabulary is (almost) fully present in the logo name
//   ~0.15–0.9 = only some of the brand's distinguishing words are present
//   ~0.15–0.3 = no shared word, but a loose letter-run overlap (acronyms, partial names)
//   0 = no match at all
function fuzzyBrandScore(brand, logoName, stopWords) {
  if (!brand || !logoName) return 0;

  const brandWords = significantWords(brand, stopWords);
  const logoWordSet = new Set(significantWords(logoName, stopWords));

  if (brandWords.length && logoWordSet.size) {
    const brandWordSet = new Set(brandWords);
    let shared = 0;
    for (const w of brandWordSet) if (logoWordSet.has(w)) shared++;

    if (shared > 0) {
      // Fraction of the BRAND's own distinguishing words found in the logo
      // name — a short, fully-matched brand name scores near 1.0; a long
      // brand name with only one incidental word overlapping scores low.
      let score = shared / brandWordSet.size;
      // Bonus for a genuine consecutive multi-word phrase match, a stronger
      // signal than scattered single-word overlap.
      if (
        hasConsecutiveWordMatch(brand, logoName, stopWords) ||
        hasConsecutiveWordMatch(logoName, brand, stopWords)
      ) {
        score += 0.5;
      }
      return score;
    }
  }

  // No shared significant word at all — last-resort loose letter-run check
  // (handles acronyms like "CFL", or partial/misspelled names), built from
  // SIGNIFICANT words only so a generic word can't sneak a match through as
  // a raw substring. Deliberately scored low — this is a weak signal.
  const bSig = brandWords.join("");
  const lSig = Array.from(logoWordSet).join("");
  if (!bSig || !lSig) return 0;
  if (bSig.includes(lSig) || lSig.includes(bSig)) return 0.3;
  for (let i = 0; i + 4 <= bSig.length; i++) {
    if (lSig.includes(bSig.slice(i, i + 4))) return 0.15;
  }
  return 0;
}

function recordFuzzyScore(record, logoName, stopWords) {
  let best = record.brand ? fuzzyBrandScore(record.brand, logoName, stopWords) : 0;
  if (Array.isArray(record.synonyms)) {
    for (const syn of record.synonyms) {
      best = Math.max(best, fuzzyBrandScore(syn, logoName, stopWords));
    }
  }
  return best;
}

// Words that repeat across MULTIPLE candidate brands (and their synonyms)
// within the same main+sub group — e.g. "football"/"league" showing up in
// every American Football governing body. A word unique to one candidate is
// a real brand signal; a word shared by two or more candidates is category
// noise and shouldn't drive a match. (Secondary safety net — the per-brand
// scoring above is the primary defense.)
function collectCandidateNoiseWords(candidates) {
  const freq = new Map();
  for (const c of candidates) {
    const wordsInRecord = new Set(wordsOf(c.brand || ""));
    for (const syn of c.synonyms || []) {
      for (const w of wordsOf(syn)) wordsInRecord.add(w);
    }
    for (const w of wordsInRecord) freq.set(w, (freq.get(w) || 0) + 1);
  }
  const noise = new Set();
  for (const [w, count] of freq.entries()) {
    if (count >= 2) noise.add(w);
  }
  return noise;
}

// ── EXACT category match (case-insensitive, accent/whitespace-normalized) ──
// main_category and sub_category must match the DB record's name/subname
// EXACTLY (after normalization) to be considered a candidate at all. This
// replaces the old fuzzy hasWordOverlap-based candidate filter.
function exactLabelMatch(a, b) {
  return normalizeLabel(a) === normalizeLabel(b);
}

// findCategoryMatch — the single entry point used by the upload route:
//
//   STEP 1: filter `entries` (from website.categories, via
//           extractCategoryEntries) down to records whose name/subname
//           EXACTLY match mainCategory/subCategory (case-insensitive,
//           accent/whitespace-normalized — not fuzzy word-overlap).
//
//   STEP 2: among those candidates, score EVERY candidate's brand (+
//           synonyms) against logoName using fuzzyBrandScore, and select
//           the HIGHEST-scoring one above a minimum threshold. This is pure
//           code — no LLM call.
//
// Every step is both pushed into `log` (for callers like the debug route)
// and printed directly to the console for quick visibility while testing.
function findCategoryMatch(entries, mainCategory, subCategory, logoName) {
  const log = [];

  console.log(`\n[findCategoryMatch] ══════════════════════════════════════`);
  console.log(`  source        : website.categories (DB)`);
  console.log(`  entries total : ${entries.length}`);
  console.log(`  logoName      : "${logoName}"`);
  console.log(`  mainCategory  : "${mainCategory}"`);
  console.log(`  subCategory   : "${subCategory}"`);

  if (!mainCategory || !subCategory) {
    log.push("No mainCategory/subCategory provided — skipping DB lookup.");
    console.log(`  → SKIPPED, missing mainCategory/subCategory.\n`);
    return { match: null, candidates: [], log };
  }

  // ── STEP 1: EXACT category match ─────────────────────────────────────────
  const candidates = entries.filter(
    (e) => exactLabelMatch(e.name, mainCategory) && exactLabelMatch(e.subname || "", subCategory)
  );

  log.push(`EXACT match → main="${mainCategory}" sub="${subCategory}" → ${candidates.length} DB record(s).`);
  console.log(`  ── STEP 1: exact category filter ──`);
  console.log(`  candidates found: ${candidates.length}`);

  if (!candidates.length) {
    log.push('No DB records exist for this EXACT main+sub pair — brand will fall back to "Other {sub_category}".');
    console.log(`  → NO candidates for this exact main+sub. Brand will fallback to "Other ${subCategory}".\n`);
    return { match: null, candidates, log };
  }

  console.log(`  candidate pool (brand | country | industry):`);
  candidates.forEach((c, i) => {
    console.log(`    ${i + 1}. brand="${c.brand || "(unknown)"}" | country="${c.country || "(unknown)"}" | industry="${c.etype || "(unknown)"}"`);
  });

  // ── STEP 2: fuzzy brand score against logoName ───────────────────────────
  const stopWords = buildBrandStopWords(mainCategory, subCategory);
  console.log(`  ── STEP 2: fuzzy brand scoring against logoName="${logoName}" ──`);

  let best = null;
  let bestScore = 0;
  const scored = [];

  for (const c of candidates) {
    const score = recordFuzzyScore(c, logoName, stopWords);
    scored.push({ candidate: c, score });
    console.log(`    brand="${c.brand || "(unknown)"}" → fuzzyScore=${score.toFixed(3)}`);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  // Minimum threshold — avoid picking a candidate on pure noise (score ~0.15
  // is the weakest "letter-run" signal from fuzzyBrandScore; require at
  // least a real shared-word signal, i.e. > 0.15, to count as a match).
  const MIN_SCORE = 0.15;

  if (best && bestScore > MIN_SCORE) {
    log.push(`Fuzzy brand match → brand="${best.brand}" score=${bestScore.toFixed(3)} (highest among ${candidates.length} candidates).`);
    console.log(`  → SELECTED: brand="${best.brand}" (score=${bestScore.toFixed(3)})\n`);
    return { match: best, candidates, log };
  }

  log.push(`No candidate brand scored above threshold (${MIN_SCORE}) — brand falls back to "Other {sub_category}".`);
  console.log(`  → NO candidate scored above ${MIN_SCORE}. Brand falls back to "Other ${subCategory}".\n`);
  return { match: null, candidates, log };
}

async function classifyMainSubCategory({ openai, logoName, tree }) {
  const lines = categoryTreeLines(tree);

  const prompt = `Classify this logo into the EXISTING main_category and sub_category taxonomy below. Your job is to find the closest real match — not to default to "no match" just because the wording isn't identical.

Logo Name: ${logoName}

Main Category → Sub Categories (copy verbatim, do not invent names):
${lines.join("\n")}

HOW TO CLASSIFY (do this in order):
1. Work out what the logo actually IS or represents — what product, service, or industry does "${logoName}" belong to in real life?
2. Scan every sub_category listed under every main_category for the one that matches that real-world product/service/industry by MEANING, not by literal spelling.
3. You MUST always return BOTH a main_category AND a matching sub_category from the list above — a sub_category is required every time, it is never left blank and never "Other {main_category}".
4. Only return main_category = "template" (and sub_category = "") in the extremely rare case that the logo genuinely does not fit ANY main_category at all.

Rules:
- main_category and sub_category MUST be copied verbatim (exact spelling) from the list above.
- sub_category MUST belong to the listed main_category, and MUST be present whenever main_category isn't "template".
- Do NOT return brand, website, industry, or country — not asked for here.

Return ONLY valid JSON: { "reasoning": "one short sentence on what the logo represents and why this category fits", "main_category": "...", "sub_category": "..." }`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You classify logos into an existing main/sub category taxonomy by real-world meaning (what the brand actually sells or represents), not by literal keyword matching against the logo name. main_category and sub_category are BOTH required on every response — sub_category is never left blank and never set to \"Other {main_category}\". You always keep searching the sub_category list for the real match. You never invent category names that aren't in the provided list. You return only JSON.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    mainCategory: (parsed.main_category && String(parsed.main_category).trim()) || "template",
    subCategory: (parsed.sub_category && String(parsed.sub_category).trim()) || "",
    reasoning: parsed.reasoning || "",
    raw,
  };
}

// Validates/normalizes GPT's main/sub choice against the real tree.
//
// sub_category validation uses fuzzy word-overlap scoring
// (findClosestSubCategory) instead of requiring byte-for-byte string
// equality — this is validation against the GPT taxonomy tree only, NOT
// the DB candidate lookup (which is exact — see findCategoryMatch above).
// If GPT's wording for sub_category didn't match the tree exactly (word
// order, minor paraphrase, plural/singular), subCategory would otherwise be
// silently reset to "" and mainCategory reset to "template". Now we look
// for the closest real sub_category under the chosen main_category by
// shared-word fraction, and only fall back to "template" if nothing scores
// above a sane threshold (see findClosestSubCategory's 0.34 cutoff).
function validateMainSubAgainstTree(tree, mainCategoryRaw, subCategoryRaw) {
  let mainCategory = mainCategoryRaw;
  let subCategory = subCategoryRaw;

  if (mainCategory.toLowerCase() !== "template" && !tree.has(mainCategory)) {
    const mainNorm = normalizeLabel(mainCategory);
    const foundKey = Array.from(tree.keys()).find((k) => normalizeLabel(k) === mainNorm);
    mainCategory = foundKey || "template";
  }

  if (mainCategory !== "template" && subCategory) {
    const subs = Array.from(tree.get(mainCategory) || new Set());
    const subNorm = normalizeLabel(subCategory);

    // 1) Try exact match first (cheapest, most confident).
    let foundSub = subs.find((s) => normalizeLabel(s) === subNorm);

    // 2) Fall back to fuzzy word-overlap match instead of giving up.
    if (!foundSub) {
      foundSub = findClosestSubCategory(tree, mainCategory, subCategory);
    }

    subCategory = foundSub || "";
  }

  if (mainCategory !== "template" && !subCategory) {
    // Even the fuzzy match found nothing reasonable — this is the only
    // remaining case where we fall back to template, since we still never
    // fabricate a category that isn't in the tree.
    mainCategory = "template";
    subCategory = "";
  }

  return { mainCategory, subCategory };
}


// Parses CATEGORY_TAXONOMY_TEXT directly into the same "Main -> Set(Subs)"
// shape as buildCategoryTree(), guaranteeing the validation tree is always
// byte-identical to what GPT was actually shown in the prompt — no drift
// possible between two separately-maintained sources.
function buildCategoryTreeFromText(text) {
  const tree = new Map();
  const blocks = String(text || "").split(/\n\s*\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const main = trimmed.slice(0, colonIdx).trim();
    const subs = trimmed
      .slice(colonIdx + 1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!main) continue;
    if (!tree.has(main)) tree.set(main, new Set());
    for (const s of subs) tree.get(main).add(s);
  }
  return tree;
}

// ── LLM-based brand selection among EXACT category candidates ─────────────
// Instead of scoring candidate.brand strings against logoName with fuzzy
// word-overlap, hand the LLM the logo name + the full candidate row list
// (brand, synonyms, country, industry) and let it pick by REAL brand
// identity. This needs an OpenAI client, so it's async and takes `openai`.
async function selectBrandWithLLM({ openai, logoName, candidates }) {
  if (!candidates.length) return { match: null, reasoning: "" };

  const rows = candidates.map((c, i) => ({
    index: i,
    brand: c.brand || "",
    synonyms: Array.isArray(c.synonyms) ? c.synonyms : [],
    country: c.country || "",
    industry: c.etype || "",
  }));

  const prompt = `You are matching a logo name to the correct real-world brand from a fixed list of candidate brand records already narrowed down to the right category.

Logo Name: ${logoName}

Candidate brand records:
${rows.map(r => `${r.index}: brand="${r.brand}" | synonyms=[${r.synonyms.join(", ")}] | country="${r.country}" | industry="${r.industry}"`).join("\n")}

TASK:
Using your real-world knowledge of brands, decide which ONE candidate record (if any) is genuinely the brand behind "${logoName}". Match by real-world identity — the candidate's brand or one of its synonyms should actually refer to the same real company/brand as the logo name, not just share letters or words.

Rules:
- Return the index of the single best-matching candidate, or -1 if NONE of the candidates are actually the real brand.
- Do not force a match if you're not confident — return -1 instead.
- Never pick a candidate just because it "sounds close"; it must be the same real-world brand.

Return ONLY valid JSON: { "reasoning": "one short sentence", "index": <number> }`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You match logo names to real-world brands from a fixed candidate list, using genuine brand knowledge — not string/spelling similarity. Return only JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const idx = Number.isInteger(parsed.index) ? parsed.index : parseInt(parsed.index, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < candidates.length) {
      return { match: candidates[idx], reasoning: parsed.reasoning || "" };
    }
    return { match: null, reasoning: parsed.reasoning || "" };
  } catch (err) {
    console.warn(`[selectBrandWithLLM] Failed: ${err.message}`);
    return { match: null, reasoning: "" };
  }
}

// ── findCategoryMatch, but brand pick delegated to the LLM ────────────────
// STEP 1 is identical to findCategoryMatch (exact main/sub filter). STEP 2
// replaces fuzzyBrandScore with selectBrandWithLLM.
async function findCategoryMatchLLM(openai, entries, mainCategory, subCategory, logoName) {
  const log = [];

  console.log(`\n[findCategoryMatchLLM] ══════════════════════════════════════`);
  console.log(`  logoName      : "${logoName}"`);
  console.log(`  mainCategory  : "${mainCategory}"`);
  console.log(`  subCategory   : "${subCategory}"`);

  if (!mainCategory || !subCategory) {
    log.push("No mainCategory/subCategory provided — skipping DB lookup.");
    return { match: null, candidates: [], log };
  }

  // STEP 1 — EXACT category match (unchanged)
  const candidates = entries.filter(
    (e) => exactLabelMatch(e.name, mainCategory) && exactLabelMatch(e.subname || "", subCategory)
  );

  log.push(`EXACT match → main="${mainCategory}" sub="${subCategory}" → ${candidates.length} DB record(s).`);
  console.log(`  candidates found: ${candidates.length}`);

  if (!candidates.length) {
    log.push('No DB records exist for this EXACT main+sub pair — brand will fall back to "Other {sub_category}".');
    return { match: null, candidates, log };
  }

  candidates.forEach((c, i) => {
    console.log(`    ${i + 1}. brand="${c.brand || "(unknown)"}" | synonyms=[${(c.synonyms || []).join(", ")}] | country="${c.country || "(unknown)"}"`);
  });

  // STEP 2 — LLM picks the real brand among candidates
  const { match, reasoning } = await selectBrandWithLLM({ openai, logoName, candidates });

  if (reasoning) console.log(`  [brand:llm] reasoning: ${reasoning}`);

  if (match) {
    log.push(`LLM brand match → brand="${match.brand}" (reasoning: ${reasoning}).`);
    console.log(`  → SELECTED: brand="${match.brand}"\n`);
    return { match, candidates, log };
  }

  log.push(`LLM found no confident brand match among candidates — brand falls back to "Other {sub_category}".`);
  console.log(`  → NO confident LLM match. Brand falls back to "Other ${subCategory}".\n`);
  return { match: null, candidates, log };
}

// ── URL validity guard ──────────────────────────────────────────────────
// Rejects anything that isn't a well-formed http(s) URL with a real-looking
// hostname — protects resolveOfficialWebsite() from an LLM response that
// isn't a proper URL, even when it claimed to be confident.
function isPlausibleUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}


async function resolveOfficialWebsite({ openai, logoName, brand }) {
  if (!brand) return { website: "", reasoning: "" };

  const prompt = `You are identifying the REAL, OFFICIAL website of a specific brand.

Logo Name : ${logoName}
Brand     : ${brand}

TASK:
Using your own knowledge, recall the brand's actual official website — the
root domain the company itself owns and operates (e.g. "https://nike.com",
not a Wikipedia page, news article, social media profile, marketplace
listing, or fan site).

RULES:
- Only return a domain you are NEAR-CERTAIN is correct.
- If you are unsure, or if this brand/logo name is too generic/obscure to
  know for certain, return an empty string — do NOT guess a domain that
  "looks right" (e.g. brand.com) without being sure it's real.
- Never return a subpage, search results URL, or social media link.
- Return the bare root domain with https:// only (no trailing path).

Return ONLY valid JSON:
{
  "confident": true or false,
  "reasoning": "one short sentence",
  "website": "https://example.com" or ""
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You identify official brand websites from genuine knowledge only. You never guess or fabricate a plausible-looking domain. When uncertain, you return an empty string. Return only JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const confident = parsed.confident === true;
    const website = confident && isPlausibleUrl(parsed.website) ? String(parsed.website).trim() : "";

    if (parsed.reasoning) console.log(`  [website:llm] reasoning: ${parsed.reasoning}`);

    return { website, reasoning: parsed.reasoning || "" };
  } catch (err) {
    console.warn(`[resolveOfficialWebsite] Failed: ${err.message}`);
    return { website: "", reasoning: "" };
  }
}

export {
  isPlausibleUrl,
  resolveOfficialWebsite,
  extractCategoryEntries,
  buildCategoryTree,
  buildCategoryTreeFromText,
  categoryTreeLines,
  normalizeLabel,
  normalizeCompact,
  wordsOf,
  hasWordOverlap,
  fuzzySubCategoryScore,
  findClosestSubCategory,
  buildBrandStopWords,
  fuzzyBrandScore,
  recordFuzzyScore,
  findCategoryMatch,
  classifyMainSubCategory,
  validateMainSubAgainstTree,
  generateSlugFromName,
  findCategoryMatchLLM
};