// ── Shared category + brand matching logic ─────────────────────────────────
// Used by BOTH the bulk-upload route and the /api/debug/category-match route,
// so the debug endpoint always reflects exactly what production does.

function generateSlugFromName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

// Parses website.categories JSON into full entries: { name, subname, brand,
// country, etype, synonyms, ... }. `name` = main category, `subname` = sub
// category, `brand`/`country` are the real-world facts we look up instead of
// ever asking the LLM to generate them.
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

// Builds "Main Category -> Set(Sub Categories)" from the entries above, used
// both for the GPT prompt and to validate GPT's chosen main/sub pair.
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

// Fuzzy, case-insensitive word-overlap match: true if ANY whole word is
// shared between the two labels. Used for main/sub CATEGORY matching only
// (deliberately lenient — DB wording can differ slightly from the
// classification taxonomy).
function hasWordOverlap(a, b) {
  const wordsA = new Set(wordsOf(a));
  if (!wordsA.size) return false;
  return wordsOf(b).some((w) => wordsA.has(w));
}

// Generic connector/stop words that shouldn't count on their own when
// scoring how well two CATEGORY LABELS (not brands) match each other —
// e.g. "and", "of" appearing in both "Rugby & Football" and "Sailing & Football"
// shouldn't be treated as a meaningful signal.
const CATEGORY_STOPWORDS = new Set(["and", "of", "the", "for", "in", "on", "by", "a", "an"]);

// Scores how well a candidate sub-category label matches GPT's returned
// sub-category string, using fraction-of-words-shared (same style as
// fuzzyBrandScore below) rather than requiring an exact string match.
// This is what fixes the old bug where a correct main_category was reset to
// "template" just because sub_category wording didn't match byte-for-byte.
//   1.0        = identical after normalization
//   0.15–0.99  = partial word overlap, scaled by how much of the candidate
//                label's own words are present in GPT's string
//   0          = no meaningful overlap at all
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
// equally good and let list order decide, which is how "Nestle Milk" was
// incorrectly matching Amul before.
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

// Finds the DB record(s) for the chosen main+sub pair (fuzzy word-overlap on
// name/subname), scores EVERY candidate's brand/synonyms against the logo
// name, and returns the HIGHEST-SCORING one — not just the first one that
// clears some minimum bar. This matters because a weak, coincidental match
// (e.g. the word "milk" appearing inside one candidate's long legal name)
// must never outrank a strong, direct brand-name match on another candidate
// (e.g. "Nestle" matching "Nestle Milk" almost exactly). Ties (equal score)
// keep the first candidate in list order. Every step is recorded into `log`
// so callers — including the debug route — can see exactly why a brand was
// or wasn't picked, not just the final answer.
// STRICT brand match: no synonyms, no scoring — just loop through
// candidates in list order and stop at the FIRST one whose brand shares
// any word with the logo name. This is deliberate: a scored "best match"
// let something like "Amul" win over "Nestle" if it scored a fraction
// higher on a coincidental word. Strict first-match avoids that entirely.
function findCategoryMatch(entries, mainCategory, subCategory, logoName) {
  const log = [];
  if (!mainCategory || !subCategory) {
    log.push("No mainCategory/subCategory provided — skipping DB lookup.");
    return { match: null, candidates: [], log };
  }

  const candidates = entries.filter(
    (e) => hasWordOverlap(e.name, mainCategory) && hasWordOverlap(e.subname || "", subCategory)
  );
  log.push(`main="${mainCategory}" sub="${subCategory}" → ${candidates.length} DB record(s) matched on category.`);

  if (!candidates.length) {
    log.push('No DB records exist for this main+sub pair — brand will fall back to "Other {sub_category}".');
    return { match: null, candidates, log };
  }

  let match = null;
  for (const c of candidates) {
    if (c.brand && hasWordOverlap(c.brand, logoName)) {
      match = c;
      log.push(`  candidate brand="${c.brand}" → word match with logo="${logoName}" → SELECTED (first match, stop searching).`);
      break;
    }
    log.push(`  candidate brand="${c.brand}" → no word overlap with logo="${logoName}", skip.`);
  }

  if (!match) {
    log.push('No candidate brand word-matched the logo name — brand falls back to "Other {sub_category}", country "Worldwide".');
  }

  return { match, candidates, log };
}
// ── GPT category classification (main_category + sub_category ONLY) ───────
// Kept here too so the debug route exercises the exact same call the upload
// route makes — never a re-implementation that could drift.
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
// CHANGED: sub_category validation now uses fuzzy word-overlap scoring
// (findClosestSubCategory) instead of requiring byte-for-byte string
// equality. Previously, if GPT's wording for sub_category didn't match the
// tree EXACTLY (different word order, minor paraphrase, plural/singular,
// etc.), subCategory was silently reset to "" and mainCategory — even when
// it was correctly identified — got reset all the way down to "template".
// That meant a fully correct main_category answer was routinely discarded
// over a trivial sub_category wording mismatch. Now we look for the closest
// real sub_category under the chosen main_category by shared-word fraction,
// and only fall back to "template" if nothing scores above a sane threshold
// (see findClosestSubCategory's 0.34 cutoff).
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

export {
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
};