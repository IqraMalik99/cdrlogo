import { NextResponse } from "next/server";
import sharp from "sharp";
import OpenAI from "openai";
import { prisma } from "../../../lib/prisma";
import { r2 } from "../../../lib/r2";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

// ============================================================================
// BACKFILL API: jin TEMPLATE logos ki templateCategory khali hai, unko
// category assign karta hai (image + naam se, OpenAI). Tavily use nahi hoti.
//
// Thunder Client mein bar bar chalayein jab tak response mein done: true na aa
// jaye. Har call ~45 second tak kaam karti hai aur nextCursor wapas deti hai.
//
// Examples:
//   GET  /api/admin/assign-template-categories?dryRun=true
//   GET  /api/admin/assign-template-categories
//   GET  /api/admin/assign-template-categories?cursor=<nextCursor>
//   GET  /api/admin/assign-template-categories?force=true   (sab dobara classify)
//   POST body JSON: { "cursor": "...", "dryRun": false, "force": false }
// ============================================================================

export const maxDuration = 300;

const TIME_BUDGET_MS = Infinity; // time ki koi limit nahi (jab tak sab logos na ho jayein)
const BATCH_SIZE = 5;            // default: ek sath kitne logos. ?batchSize=N se badal sakte hain

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Fixed template categories (upload route wali list ki copy) ──────────────
const TEMPLATE_CATEGORIES = [
  { id: "business-professional", name: "Business & Professional", definition: "Consulting, finance, legal, accounting, insurance, real estate, corporate services, HR, general business." },
  { id: "digital-innovation", name: "Digital & Innovation", definition: "Software, apps, SaaS, IT services, AI, gaming tech, telecom, electronics, startups, e-commerce, cybersecurity." },
  { id: "building-engineering", name: "Building & Engineering", definition: "Construction, architecture, interior/home improvement, plumbing, electrical, mechanical, industrial and energy work." },
  { id: "food-dining", name: "Food & Dining", definition: "Restaurants, cafes, bakeries, fast food, bars, catering, beverages, food products and food delivery." },
  { id: "clothing-beauty", name: "Clothing & Beauty", definition: "Fashion, apparel, jewelry, accessories, salons, barbers, spas, cosmetics, skincare and tailoring." },
  { id: "vehicles-logistics", name: "Vehicles & Logistics", definition: "Cars, auto repair, motorcycles, trucking, shipping, delivery, courier, aviation, marine and transport services." },
  { id: "fitness-team", name: "Fitness & Team", definition: "Gyms, yoga, martial arts, sports clubs and teams, esports teams, coaching and athletic brands." },
  { id: "health-wellness", name: "Health & Wellness", definition: "Clinics, hospitals, dental, pharmacy, therapy, mental health, medical devices, wellness and alternative medicine." },
  { id: "learning-research", name: "Learning & Research", definition: "Schools, universities, tutoring, training, libraries, laboratories, science and research institutes." },
  { id: "tourism-accommodation", name: "Tourism & Accommodation", definition: "Hotels, resorts, travel agencies, tours, vacation rentals, hostels, camping and destinations." },
  { id: "creative-arts-leisure", name: "Creative Arts & Leisure", definition: "Music, film, photography, design studios, art, entertainment, events, hobbies, toys, games and publishing." },
  { id: "community-charity", name: "Community & Charity", definition: "Non-profits, charities, religious organizations, clubs, associations, foundations and community groups." },
  { id: "civic-public-service", name: "Civic & Public Service", definition: "Government bodies, municipalities, police, fire, military, public agencies, political and civic organizations." },
  { id: "agriculture-eco", name: "Agriculture & Eco", definition: "Farming, gardening, landscaping, forestry, organic products, recycling, renewable/green and environmental causes." },
  { id: "animal-pet", name: "Animal & Pet", definition: "Pet shops, veterinary, grooming, pet food, animal shelters, zoos and wildlife." },
  { id: "abstract-geometric", name: "Abstract & Geometric", definition: "Purely abstract marks, shapes, swirls, gradients and geometric symbols with NO clear industry. Use as primary ONLY when the industry is unclear." },
  { id: "lettermark-monogram", name: "Lettermark & Monogram", definition: "Initials, single letters or monogram-based marks with NO clear industry. Use as primary ONLY when the industry is unclear." },
];
const TEMPLATE_CATEGORY_BY_ID = new Map(TEMPLATE_CATEGORIES.map((c) => [c.id, c]));
const TEMPLATE_STYLE_TAGS = ["abstract", "monogram"];

// ── OpenAI with 1 retry ─────────────────────────────────────────────────────
async function callOpenAIWithRetry(params, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// ── Image se sirf wahi cheezein jo nazar aa rahi hain ───────────────────────
async function analyzeLogoImageVisually(pngBuffer) {
  if (!pngBuffer) return { hasVisualFacts: false, visualFactsText: "", rawColors: [] };
  try {
    const base64Image = pngBuffer.toString("base64");
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a precise visual analyst. Describe ONLY what is literally visible in the image — actual colors present, actual shapes, actual visible text, actual symbols. Never guess brand history or meaning. Return only JSON.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this logo image. Describe ONLY what is literally visible.

Return ONLY this JSON:
{
  "colors": ["plain color name"],
  "shape": "e.g. circular badge / shield / wordmark / abstract mark / icon+text combo",
  "text_visible": "exact text visible, or empty string",
  "symbols": "literal description of any icon/symbol/mascot — what is drawn",
  "layout": "e.g. icon above text / text only / icon only"
}`,
            },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    let parsed = {};
    try { parsed = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch { parsed = {}; }

    const colors = Array.isArray(parsed.colors)
      ? parsed.colors.filter(Boolean).map((c) => String(c).toLowerCase().trim())
      : [];

    const parts = [];
    if (colors.length) parts.push(`Colors actually visible in the image: ${colors.join(", ")}.`);
    if (parsed.shape) parts.push(`Shape: ${parsed.shape}.`);
    if (parsed.text_visible) parts.push(`Visible text: "${parsed.text_visible}".`);
    if (parsed.symbols) parts.push(`Symbols/icon: ${parsed.symbols}.`);
    if (parsed.layout) parts.push(`Layout: ${parsed.layout}.`);

    const visualFactsText = parts.join(" ");
    return {
      hasVisualFacts: !!visualFactsText,
      visualFactsText,
      rawColors: colors,
      textVisible: String(parsed.text_visible || "").trim(),
      symbolsText: String(parsed.symbols || "").trim(),
    };
  } catch (err) {
    console.warn(`  [vision] Image analysis failed: ${err.message}`);
    return { hasVisualFacts: false, visualFactsText: "", rawColors: [] };
  }
}

// ── Image + naam + visual facts → ek primary template category ──────────────
async function classifyTemplateCategory({ logoName, pngBuffer, visualFacts }) {
  const categoryList = TEMPLATE_CATEGORIES
    .map((c) => `- ${c.id} | ${c.name}: ${c.definition}`)
    .join("\n");

  const visualBlock = visualFacts?.hasVisualFacts
    ? visualFacts.visualFactsText
    : "(no image analysis available)";

  const prompt = `You are assigning a logo TEMPLATE to exactly ONE primary category from a FIXED list.

LOGO NAME: ${logoName}
VISUAL FACTS (what is literally visible): ${visualBlock}

CATEGORY LIST (copy the id EXACTLY — never invent one):
${categoryList}

RULES:
1. Use the IMAGE, the NAME, and the business context they suggest (e.g. a pizza slice, a dumbbell, a house, a paw print).
2. If the industry/business is CLEAR, the matching industry category is the primary category.
3. "abstract-geometric" and "lettermark-monogram" are primary ONLY when the industry is genuinely unclear. If the industry is clear, return the industry category and add "abstract" and/or "monogram" in style_tags instead.
4. style_tags may contain only: "abstract", "monogram" (can be empty).
5. If you cannot decide with reasonable confidence, set confidence to "low" — do not guess.

Return ONLY JSON:
{
  "category_id": "...",
  "style_tags": [],
  "confidence": "high" | "medium" | "low",
  "reason": "one short sentence"
}`;

  const userContent = [{ type: "text", text: prompt }];
  if (pngBuffer) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${pngBuffer.toString("base64")}` },
    });
  }

  try {
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You classify logo templates into a fixed category list using the image and name. You never invent category ids. Return only JSON.",
        },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    let parsed = {};
    try { parsed = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch { parsed = {}; }

    const picked = TEMPLATE_CATEGORY_BY_ID.get(String(parsed.category_id || "").trim());
    const confidence = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";
    const styleTags = (Array.isArray(parsed.style_tags) ? parsed.style_tags : [])
      .map((t) => String(t).toLowerCase().trim())
      .filter((t) => TEMPLATE_STYLE_TAGS.includes(t));

    return {
      categoryId: picked ? picked.id : "",
      categoryName: picked ? picked.name : "",
      styleTags: [...new Set(styleTags)],
      confidence,
      reason: String(parsed.reason || "").trim(),
    };
  } catch (err) {
    return {
      categoryId: "", categoryName: "", styleTags: [],
      confidence: "low", reason: `classification call failed (${err.message})`,
    };
  }
}

// ── Logo ki image download karke chhota PNG banao ───────────────────────────
// ── Naam aur image ka match check ───────────────────────────────────────────
// Sirf tab mismatch jab image mein koi DOOSRA, pehchana jaane wala brand ka
// naam saaf likha ho (jaise "Arrow Logo Template" par SAMSUNG). Text na ho,
// ya naam se milta ho, ya shak ho to mismatch NAHI maana jata (conservative).
function normForCompare(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanTemplateName(name) {
  return String(name || "")
    .replace(/\s+V\d+$/i, "")
    .replace(/\b(logo\s+template|template\s+logo|template|logo)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function detectNameMismatch({ logoName, visualFacts }) {
  const visible = String(visualFacts?.textVisible || "").trim();
  if (!visible) return { isMismatch: false, reason: "no visible text in image" };

  const nameCore = cleanTemplateName(logoName);
  const a = normForCompare(nameCore);
  const b = normForCompare(visible);
  if (!a || !b) return { isMismatch: false, reason: "empty after normalizing" };
  if (a.includes(b) || b.includes(a)) return { isMismatch: false, reason: "name and visible text match" };

  const prompt = `A logo TEMPLATE page has this name: "${nameCore}"
The uploaded image literally shows this text: "${visible}"
Symbols in the image: ${visualFacts?.symbolsText || "(none)"}

Template logos are usually generic designs with invented names, so the text in the image normally matches the name (even if spelled/spaced differently) or there is no text.

Answer mismatch=true ONLY IF the image text spells out a DIFFERENT, recognizable real-world brand or company name (for example a famous electronics, apparel or software brand) that has no relation to the logo name.
Answer mismatch=false if the texts are similar, the difference is just spacing/spelling/word order, the image text is a tagline/slogan/generic word, or you are unsure.

Return ONLY JSON: { "mismatch": true | false, "reason": "one short sentence" }`;

  try {
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a conservative checker. You only flag a mismatch when it is obvious. Return only JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    let parsed = {};
    try { parsed = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch { parsed = {}; }
    return { isMismatch: parsed.mismatch === true, reason: String(parsed.reason || "").trim() };
  } catch (err) {
    return { isMismatch: false, reason: `mismatch check failed (${err.message})` };
  }
}

// ── Logo poora delete: DB row + R2 files (public/<slug>/ aur separate/<slug>/) ──
async function deleteLogoCompletely(logo) {
  // Pehle DB row — agar yeh fail ho to files bhi bachi rahengi
  await prisma.logo.delete({ where: { id: logo.id } });

  let deletedFiles = 0;
  try {
    const bucket = process.env.R2_BUCKET_NAME;
    if (logo.slug && bucket) {
      for (const prefix of [`public/${logo.slug}/`, `separate/${logo.slug}/`]) {
        const listed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
        const objects = (listed.Contents || []).map((o) => ({ Key: o.Key }));
        if (objects.length) {
          await r2.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
          deletedFiles += objects.length;
        }
      }
    }
  } catch (err) {
    console.warn(`  [delete] R2 cleanup failed for "${logo.slug}": ${err.message}`);
  }

  try {
    await prisma.log.create({
      data: {
        who: "api:assign-template-categories",
        content: `Deleted mismatched logo "${logo.logoName}" (slug: ${logo.slug}, id: ${logo.id}), ${deletedFiles} R2 file(s) removed`,
      },
    });
  } catch { /* log optional */ }

  return deletedFiles;
}

async function loadPngBuffer(logo) {
  const url = logo.pngUrl || logo.webpUrl;
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf)
      .resize(768, 768, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (err) {
    console.warn(`  [image] "${logo.logoName}" image load failed: ${err.message}`);
    return null;
  }
}

// ── Query helpers ───────────────────────────────────────────────────────────
function buildWhere({ force, cursor, useNullCheck }) {
  const where = { category: { has: "template" } };
  if (!force) {
    where.OR = useNullCheck
      ? [{ templateCategory: "" }, { templateCategory: null }]
      : [{ templateCategory: "" }];
  }
  if (cursor !== undefined && cursor !== null && cursor !== "") {
    where.id = { gt: cursor };
  }
  return where;
}

async function findNextBatch({ force, cursor, batchSize = BATCH_SIZE }) {
  const args = {
    select: {
      id: true, logoName: true, slug: true,
      pngUrl: true, webpUrl: true,
      templateCategory: true, validationReasons: true,
    },
    orderBy: { id: "asc" },
    take: batchSize,
  };
  try {
    return await prisma.logo.findMany({ ...args, where: buildWhere({ force, cursor, useNullCheck: true }) });
  } catch {
    // templateCategory required String hai to null filter error deta hai — sirf "" se try karo
    return await prisma.logo.findMany({ ...args, where: buildWhere({ force, cursor, useNullCheck: false }) });
  }
}

async function countRemaining({ force }) {
  try {
    return await prisma.logo.count({ where: buildWhere({ force, useNullCheck: true }) });
  } catch {
    try {
      return await prisma.logo.count({ where: buildWhere({ force, useNullCheck: false }) });
    } catch {
      return null;
    }
  }
}

// ── Ek logo process karo ────────────────────────────────────────────────────
async function processLogo(logo, { dryRun, deleteMismatched, mismatchOnly }) {
  const cleanName = String(logo.logoName || "").replace(/\s+V\d+$/i, "").trim();

  const pngBuffer = await loadPngBuffer(logo);
  const visualFacts = await analyzeLogoImageVisually(pngBuffer);

  // Naam aur image ka match check — mismatch wale logos par category nahi lagti
  const mismatch = await detectNameMismatch({ logoName: cleanName, visualFacts });
  if (mismatch.isMismatch) {
    const base = {
      id: logo.id,
      logoName: logo.logoName,
      slug: logo.slug,
      visibleText: visualFacts.textVisible,
      reason: mismatch.reason,
    };
    if (!deleteMismatched) return { ...base, status: "mismatch-found" };
    if (dryRun) return { ...base, status: "mismatch-would-delete" };
    const deletedFiles = await deleteLogoCompletely(logo);
    return { ...base, status: "mismatch-deleted", deletedFiles };
  }

  if (mismatchOnly) {
    return { id: logo.id, logoName: logo.logoName, status: "ok-matches" };
  }

  const result = await classifyTemplateCategory({ logoName: cleanName, pngBuffer, visualFacts });

  if (!result.categoryId) {
    return {
      id: logo.id, logoName: logo.logoName, status: "failed",
      reason: result.reason || "no valid category returned",
    };
  }

  if (!dryRun) {
    const data = {
      templateCategory: result.categoryId,
      templateStyleTags: result.styleTags,
    };
    if (result.confidence === "low") {
      data.validationStatus = "needs_review";
      data.validationReasons = [
        ...(Array.isArray(logo.validationReasons) ? logo.validationReasons : []),
        `Template category auto-assigned with LOW confidence (${result.categoryName}) — please verify. ${result.reason}`.trim(),
      ];
    }
    await prisma.logo.update({ where: { id: logo.id }, data });
  }

  return {
    id: logo.id,
    logoName: logo.logoName,
    status: result.confidence === "low" ? "assigned-low-confidence" : "assigned",
    categoryId: result.categoryId,
    styleTags: result.styleTags,
    confidence: result.confidence,
    reason: result.reason,
    hadImage: !!pngBuffer,
  };
}

// ── Main handler ────────────────────────────────────────────────────────────
function parseCursor(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "number") return raw;
  const s = String(raw);
  // Int id ho to number banao (cuid/ObjectId lambi strings hoti hain)
  return /^\d{1,9}$/.test(s) ? Number(s) : s;
}

async function handle(params) {
  const startTime = Date.now();

  const dryRun = String(params.dryRun ?? "false") === "true";
  const mismatchOnly = String(params.mismatchOnly ?? "false") === "true";
  // Default TRUE: mismatch wale seedha delete. Rokne ke liye ?deleteMismatched=false ya ?dryRun=true
  const deleteMismatched = String(params.deleteMismatched ?? "true") === "true";
  // mismatchOnly mein SAB template logos scan hote hain (category pehle se ho tab bhi)
  const force = String(params.force ?? "false") === "true" || mismatchOnly;
  let cursor = parseCursor(params.cursor);

  // Production (Vercel) mein 35s; local par 10 minute. ?budgetSeconds=1800 se badal sakte hain.
  const defaultBudgetMs = process.env.NODE_ENV === "production" ? TIME_BUDGET_MS : Infinity;
  const budgetSec = Number(params.budgetSeconds);
  const budgetMs = Number.isFinite(budgetSec) && budgetSec > 0 ? budgetSec * 1000 : defaultBudgetMs;

  const batchParam = Math.floor(Number(params.batchSize));
  const batchSize = Number.isFinite(batchParam) && batchParam > 0 ? batchParam : BATCH_SIZE;

  const results = [];
  let done = false;

  while (Date.now() - startTime < budgetMs) {
    const batch = await findNextBatch({ force, cursor, batchSize });
    if (!batch.length) { done = true; break; }

    const settled = await Promise.allSettled(batch.map((logo) => processLogo(logo, { dryRun, deleteMismatched, mismatchOnly })));
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") results.push(s.value);
      else results.push({
        id: batch[i].id, logoName: batch[i].logoName,
        status: "failed", reason: s.reason?.message || "unknown error",
      });
    });

    cursor = batch[batch.length - 1].id;
  }

  const assigned = results.filter((r) => r.status === "assigned").length;
  const lowConfidence = results.filter((r) => r.status === "assigned-low-confidence").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const mismatched = results.filter((r) => String(r.status).startsWith("mismatch")).length;
  const deleted = results.filter((r) => r.status === "mismatch-deleted").length;

  // dryRun mein DB badalta nahi, isliye "remaining" sahi nahi hoga — cursor se aage chalein
  const remaining = dryRun || mismatchOnly ? null : await countRemaining({ force });

  return {
    ok: true,
    dryRun,
    force,
    processed: results.length,
    assigned,
    lowConfidence,
    failed,
    mismatched,
    deleted,
    done,
    nextCursor: done ? null : cursor ?? null,
    remainingInDb: remaining,
    durationMs: Date.now() - startTime,
    note: done
      ? "Khatam — koi aur logo baqi nahi."
      : "Dobara chalayein, nextCursor ke sath (cursor query param mein).",
    results,
  };
}

function checkAuth(req) {
  const secret = process.env.BACKFILL_SECRET;
  if (!secret) return true; // env set nahi to open (existing routes jaisa)
  return req.headers.get("x-secret") === secret;
}

export async function GET(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sp = new URL(req.url).searchParams;
    const out = await handle({
      cursor: sp.get("cursor"),
      dryRun: sp.get("dryRun"),
      force: sp.get("force"),
      mismatchOnly: sp.get("mismatchOnly"),
      deleteMismatched: sp.get("deleteMismatched"),
      budgetSeconds: sp.get("budgetSeconds"),
      batchSize: sp.get("batchSize"),
    });
    return NextResponse.json(out);
  } catch (error) {
    console.error("assign-template-categories error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const out = await handle(body);
    return NextResponse.json(out);
  } catch (error) {
    console.error("assign-template-categories error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}