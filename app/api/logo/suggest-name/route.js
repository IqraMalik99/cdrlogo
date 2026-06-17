import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── OpenAI call with 1 retry (same pattern as upload-logo route) ─────────────
async function callOpenAIWithRetry(params, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[OpenAI] Attempt ${attempt + 1} failed, retrying...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
// POST /api/logo/suggest-name
// Body: { logoName: string, brand?: string, category?: string }
// Returns: { suggestion: string } or { suggestion: null } if input is too
// short / already clean enough that no useful suggestion exists.
export async function POST(req) {
  try {
    const body = await req.json();
    const logoName = (body.logoName || "").trim();
    const brand = (body.brand || "").trim();
    const category = (body.category || "").trim();

    // Don't bother calling the LLM for very short/empty input — avoids
    // wasted calls while the user has barely typed anything.
    if (logoName.length < 2) {
      return NextResponse.json({ suggestion: null });
    }

    const systemPrompt = `You are a naming assistant for a logo download website's admin upload form. Given a partial or rough logo name typed by an admin, you suggest ONE clean, properly capitalized, conventional logo entry name (e.g. "Nike", "Coca-Cola", "Nike Air Jordan"). You do not invent brand details. You do not add marketing language, taglines, or extra words like "Logo" or "Official". If the input is already a clean, properly formatted name, return it unchanged. You always respond with valid JSON only, no markdown formatting, no code fences.`;

    const userPrompt = `Admin is typing a logo name into an upload form.

Current input: "${logoName}"
${brand ? `Brand/Company field: "${brand}"` : ""}
${category ? `Category: "${category}"` : ""}

Suggest the cleanest, correctly capitalized version of this as a logo entry name. Fix casing and obvious typos only — do not change the brand identity or guess at a different brand.

Respond ONLY with valid JSON in this exact format:
{
  "suggestion": "..."
}`;

    const completion = await callOpenAIWithRetry({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const suggestion = (parsed.suggestion || "").trim();

    // Don't send back a "suggestion" that's identical to what they already typed.
    if (!suggestion || suggestion.toLowerCase() === logoName.toLowerCase()) {
      return NextResponse.json({ suggestion: null });
    }

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("[suggest-name] error:", error.message);
    // Fail soft — suggestion UI just stays hidden, doesn't block the form.
    return NextResponse.json({ suggestion: null }, { status: 200 });
  }
}