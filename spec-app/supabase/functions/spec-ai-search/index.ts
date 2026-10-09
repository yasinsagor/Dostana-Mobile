// spec-ai-search: finds the correct SPEC product and the correct unit to order
// from what a branch manager types, says or photographs, in any language.
//
// POST { branch, pin, query?, audio?, audio_format?, image?, mode? }
//   query: text · audio: base64 m4a (voice) · image: base64 JPEG (product, label or list)
//   mode: "search" (search box) or "order" (whole order)
// → { items: [{ product_id, name, qty, unit, reason }], unmatched: [string], message, transcript }
//
// The OpenAI key lives only in the Supabase secret OPENAI_API_KEY.
// The branch PIN is checked against branch_settings before any OpenAI call.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// gpt-5-mini was the most accurate in tests on the real catalogue (product + unit).
// Set OPENAI_MODEL (e.g. "gpt-4.1") for faster answers at a higher price.
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5-mini";
const TRANSCRIBE_MODEL = Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe";
const MAX_QUERY = 600;
const MAX_AUDIO_B64 = 4_000_000;  // ~3 MB of audio, far more than 30 s
const MAX_IMAGE_B64 = 3_000_000;  // ~2.2 MB JPEG

type Product = {
  id: string; name: string; category: string | null; unit: string | null;
  pack_size: string | null; unit_options: unknown;
};
type UnitOption = { unit: string; multiplier: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function isSizedMeat(p: Product) { return p.name === "Kurczak" || p.name === "Baranina"; }

function unitOptions(p: Product): UnitOption[] {
  if (isSizedMeat(p)) {
    const sizes = String(p.pack_size || "").match(/\d+\s*kg/gi)?.map(s => s.replace(/\s+/g, "").toLowerCase());
    return (sizes?.length ? [...new Set(sizes)] : ["10kg", "15kg", "20kg", "25kg", "30kg"]).map(unit => ({ unit, multiplier: 1 }));
  }
  let raw = p.unit_options as unknown;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = []; } }
  const list: UnitOption[] = Array.isArray(raw)
    ? raw.map(o => typeof o === "string"
        ? { unit: o, multiplier: 1 }
        : { unit: String((o as { unit?: string; label?: string })?.unit || (o as { label?: string })?.label || ""), multiplier: Number((o as { multiplier?: number })?.multiplier || 1) })
      .filter(o => o.unit)
    : [];
  if (p.unit && !list.some(o => o.unit === p.unit)) list.unshift({ unit: p.unit, multiplier: 1 });
  return list.length ? list : [{ unit: p.unit || "szt", multiplier: 1 }];
}

/* "karton (= 12 × szt), szt" so the model can convert between units. */
function describeUnits(p: Product) {
  const list = unitOptions(p);
  if (isSizedMeat(p)) return `cone sizes: ${list.map(o => o.unit).join(", ")}`;
  const smallest = list.reduce((a, b) => (b.multiplier < a.multiplier ? b : a), list[0]);
  return list.map(o => {
    const ratio = Math.round((o.multiplier / smallest.multiplier) * 100) / 100;
    return o.unit !== smallest.unit && ratio > 1 ? `${o.unit} (= ${ratio} × ${smallest.unit})` : o.unit;
  }).join(", ");
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "unmatched", "message"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "name", "qty", "unit", "reason"],
        properties: {
          ref: { type: "integer" },
          name: { type: "string" },
          qty: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          reason: { type: "string" },
        },
      },
    },
    unmatched: { type: "array", items: { type: "string" } },
    message: { type: "string" },
  },
};

function systemPrompt(mode: string) {
  return [
    "You help managers of Dostana Kebab restaurants in Poland order supplies from the SPEC wholesaler.",
    "Your job: find the correct product in the catalogue and the correct unit to order it in.",
    "Input can be text, a voice transcript or a photo, in any language (Polish, English, Bengali, Urdu, Hindi, Turkish, Ukrainian, Arabic…), with typos, slang, abbreviations and no Polish letters.",
    "A photo can show a product or its label (find that product), an empty box or shelf (find what it is), or a handwritten or printed list (read every line as an order).",
    "",
    "Rules:",
    "- Use only products from the catalogue. For each item give its catalogue number (ref) and copy its name exactly. Never invent products.",
    "- Products marked 'usual' are ordered often by this branch: prefer them when several products fit (e.g. 'ketchup', 'gloves', 'pita').",
    "- unit: always one of the product's listed units. If the manager named a listed unit (e.g. 'szt', 'karton', 'wiadro'), use that unit and their number as it is, with no conversion.",
    "- If no unit was named, use the first listed unit (the normal order unit).",
    "- Only if the manager gave the amount in a measure that is not a listed unit (kg, litres, grams, bottles), convert it into the order unit using the pack info and unit ratios, rounding up. Example: Frytki with units 'karton (= 4 × szt)' and pack '2.5kg/4wor' → one szt is a 2.5 kg bag and one karton is 10 kg, so '10 kg frytki' = 1 karton and '5 kg frytki' = 2 szt. Say the conversion in 'reason'.",
    "- qty: only when the manager gave an amount for that product (after conversion). Otherwise null. Never guess quantities.",
    "- Kurczak and Baranina are ordered as kebab cones; their units are cone sizes like '15kg'. '2 kurczak 20' means qty 2, unit '20kg'. If no size was given, unit is null.",
    "- Return every product the manager mentioned; do not drop any.",
    "- reason: a few words in English: why this product, and the order unit (e.g. 'Mayonnaise · order per 10 kg bucket').",
    mode === "order"
      ? "- This is a whole order: return one item per product mentioned, in the same order. Anything you cannot match goes to 'unmatched' in the manager's words."
      : "- This is a search: return the products that best match, best first, at most 6. If the text names several products with amounts, return all of them. If nothing fits, return no items and explain in 'message'.",
    "- message: one short, plain English sentence for the manager about what you found or could not find. Never say the order was placed or sent: the manager checks it and sends it.",
  ].join("\n");
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Speech models sometimes "hear" their own prompt in silence or noise, so no
// prompt is sent, and a transcript that looks like an instruction echo is dropped.
function looksLikeEcho(text: string) {
  const t = text.toLowerCase();
  return /^\s*(context|prompt|transcript|subtitles?)\s*[:#]/.test(t) || t.includes("###") || t.includes("supply order. products:");
}

async function transcribe(apiKey: string, audioB64: string, format: string) {
  const type = format === "wav" ? "audio/wav" : format === "webm" ? "audio/webm" : "audio/mp4";
  const tryModel = async (model: string) => {
    const form = new FormData();
    form.append("file", new Blob([b64ToBytes(audioB64)], { type }), `voice.${format || "m4a"}`);
    form.append("model", model);
    return fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form,
    });
  };
  let res = await tryModel(TRANSCRIBE_MODEL);
  if (!res.ok && TRANSCRIBE_MODEL !== "whisper-1") {
    console.error("transcribe", TRANSCRIBE_MODEL, res.status, (await res.text()).slice(0, 300));
    res = await tryModel("whisper-1");
  }
  if (!res.ok) {
    console.error("transcribe", res.status, (await res.text()).slice(0, 300));
    throw new Error("Could not understand the recording.");
  }
  const data = await res.json();
  const text = String(data.text || "").trim();
  return looksLikeEcho(text) ? "" : text;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: { branch?: string; pin?: string; query?: string; mode?: string; audio?: string; audio_format?: string; image?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const branch = String(body.branch || "").trim();
  const pin = String(body.pin || "").trim();
  let query = String(body.query || "").trim().slice(0, MAX_QUERY);
  const mode = body.mode === "order" ? "order" : "search";
  const audio = typeof body.audio === "string" && body.audio.length ? body.audio : null;
  const image = typeof body.image === "string" && body.image.length ? body.image.replace(/^data:image\/\w+;base64,/, "") : null;
  if (!branch || !pin) return json({ error: "Branch and PIN are required." }, 400);
  if (!query && !audio && !image) return json({ error: "Type, speak or take a photo first." }, 400);
  if (audio && audio.length > MAX_AUDIO_B64) return json({ error: "The recording is too long. Keep it under 30 seconds." }, 413);
  if (image && image.length > MAX_IMAGE_B64) return json({ error: "The photo is too large." }, 413);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "AI search is not set up yet (missing OPENAI_API_KEY)." }, 503);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: branchRow, error: branchError } = await db
    .from("branch_settings").select("branch").eq("branch", branch).eq("pin", pin).eq("active", true).maybeSingle();
  if (branchError) return json({ error: "Could not check the branch." }, 500);
  if (!branchRow) return json({ error: "Branch PIN not accepted. Log out and log in again." }, 401);

  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const [{ data: products, error: productError }, { data: orders }] = await Promise.all([
    db.from("spec_products").select("id,name,category,unit,pack_size,unit_options").eq("active", true).order("sort_order"),
    db.from("spec_orders").select("items").eq("branch", branch).gte("date", since),
  ]);
  if (productError || !products?.length) return json({ error: "Could not load the product list." }, 500);
  const catalogueProducts = products as Product[];

  let transcript = "";
  if (audio) {
    try { transcript = await transcribe(apiKey, audio, String(body.audio_format || "m4a")); }
    catch (e) { return json({ error: (e as Error).message }, 502); }
    if (!transcript) return json({ items: [], unmatched: [], message: "I could not hear any words. Try again closer to the phone.", transcript });
    query = [query, transcript].filter(Boolean).join("\n").slice(0, MAX_QUERY);
  }

  const usage = new Map<string, number>();
  for (const o of orders || []) {
    const items = Array.isArray(o.items) ? o.items : [];
    for (const it of items as { id?: string }[]) if (it?.id) usage.set(it.id, (usage.get(it.id) || 0) + 1);
  }
  const catalogue = catalogueProducts.map((p, i) =>
    `${i + 1} | ${p.name} | ${p.category || ""} | units: ${describeUnits(p)}${p.pack_size ? ` | pack: ${p.pack_size}` : ""}${(usage.get(p.id) || 0) >= 3 ? " | usual" : ""}`
  ).join("\n");

  const userContent: unknown[] = [{
    type: "text",
    text: `CATALOGUE (ref | name | category | units | pack):\n${catalogue}\n\n` +
      (query ? `MANAGER ${audio ? "SAID" : "WROTE"}:\n${query}` : "MANAGER SENT A PHOTO. Find the products in it."),
  }];
  if (image) userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}`, detail: "high" } });

  const ai = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      ...(MODEL.startsWith("gpt-5") ? { reasoning_effort: "low" } : { temperature: 0 }),
      response_format: { type: "json_schema", json_schema: { name: "spec_match", strict: true, schema: SCHEMA } },
      messages: [
        { role: "system", content: systemPrompt(mode) },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!ai.ok) {
    console.error("openai", ai.status, (await ai.text()).slice(0, 500));
    return json({ error: "The AI service is not available right now." }, 502);
  }
  const completion = await ai.json();
  let parsed: { items?: { ref: number; name: string; qty: number | null; unit: string | null; reason: string }[]; unmatched?: string[]; message?: string };
  try { parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }

  // Keep only real products and units, whatever the model returned.
  // The model gives a catalogue number and the product name. If the two clearly
  // disagree, the name decides (when it points to one product); otherwise drop it.
  const norm = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, " ").trim();
  const words = (t: string) => new Set(norm(t).split(" ").filter(w => w.length > 1));
  const similarity = (a: string, b: string) => {
    const A = words(a), B = words(b);
    if (!A.size || !B.size) return 0;
    let shared = 0;
    for (const w of A) if (B.has(w)) shared++;
    return shared / Math.min(A.size, B.size);
  };
  const bestByName = (name: string) => {
    let product: Product | undefined, score = 0;
    for (const q of catalogueProducts) { const s = similarity(name, q.name); if (s > score) { score = s; product = q; } }
    return score >= 0.6 ? { product: product!, score } : null;
  };
  const seen = new Set<string>();
  const items = (parsed.items || []).flatMap(it => {
    let p: Product | undefined = catalogueProducts[Number(it.ref) - 1];
    if (it.name) {
      const refScore = p ? similarity(it.name, p.name) : 0;
      const best = bestByName(it.name);
      if (best && best.score > refScore) p = best.product;
      else if (refScore < 0.5) p = undefined;
    }
    if (!p) return [];
    const units = unitOptions(p).map(o => o.unit);
    let unit = it.unit && units.find(u => u.toLowerCase() === String(it.unit).toLowerCase()) || null;
    if (!unit && !isSizedMeat(p)) unit = units[0];
    const qty = typeof it.qty === "number" && it.qty > 0 && it.qty < 1000 ? Math.round(it.qty * 100) / 100 : null;
    const key = `${p.id}:${unit}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ product_id: p.id, name: p.name, qty, unit, reason: String(it.reason || "").slice(0, 160) }];
  });

  return json({
    items,
    unmatched: (parsed.unmatched || []).map(s => String(s).slice(0, 80)).slice(0, 10),
    message: String(parsed.message || "").slice(0, 200),
    transcript,
  });
});
