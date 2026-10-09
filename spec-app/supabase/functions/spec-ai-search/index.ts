// spec-ai-search: matches what a branch manager types (any language, typos,
// quantities) to products in the SPEC catalogue using OpenAI.
//
// POST { branch, pin, query, mode: "search" | "order" }
//  → { items: [{ product_id, name, qty, unit, reason }], unmatched: [string], message }
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
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const MAX_QUERY = 600;

type Product = {
  id: string; name: string; category: string | null; unit: string | null;
  pack_size: string | null; unit_options: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function isSizedMeat(p: Product) { return p.name === "Kurczak" || p.name === "Baranina"; }

function allowedUnits(p: Product): string[] {
  if (isSizedMeat(p)) {
    const sizes = String(p.pack_size || "").match(/\d+\s*kg/gi)?.map(s => s.replace(/\s+/g, "").toLowerCase());
    return sizes?.length ? [...new Set(sizes)] : ["10kg", "15kg", "20kg", "25kg", "30kg"];
  }
  let options = p.unit_options as unknown;
  if (typeof options === "string") { try { options = JSON.parse(options); } catch { options = []; } }
  const units = Array.isArray(options)
    ? options.map(o => (typeof o === "string" ? o : (o as { unit?: string; label?: string })?.unit || (o as { label?: string })?.label)).filter(Boolean) as string[]
    : [];
  if (p.unit && !units.includes(p.unit)) units.unshift(p.unit);
  return units;
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
        required: ["product_id", "qty", "unit", "reason"],
        properties: {
          product_id: { type: "string" },
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
    "You help a manager of a Polish kebab restaurant order supplies from the SPEC wholesaler.",
    "You get the product catalogue and the manager's text. The text may be Polish, English, Bengali, Urdu, Hindi or a mix, with typos, abbreviations and no Polish letters.",
    "Match the text only to products in the catalogue, using their exact id. Never invent products.",
    "Products marked 'usual' are ones this branch orders often: prefer them when the text fits several products (for example 'ketchup' or 'gloves').",
    "qty: only when the manager gave a number for that product, otherwise null. Never guess quantities.",
    "unit: one of that product's listed units, or null. For Kurczak and Baranina the units are cone sizes like '15kg'; '2 kurczak 20' means qty 2, unit '20kg'.",
    mode === "order"
      ? "The text is a whole order: return one item per product mentioned, in the order mentioned. Put anything you cannot match in 'unmatched'."
      : "The text is a search: return the best matching products, best first, at most 8. If nothing fits, return no items and explain in 'message'.",
    "reason: a few words in English on why this product matches. message: one short English sentence for the manager.",
  ].join("\n");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: { branch?: string; pin?: string; query?: string; mode?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const branch = String(body.branch || "").trim();
  const pin = String(body.pin || "").trim();
  const query = String(body.query || "").trim().slice(0, MAX_QUERY);
  const mode = body.mode === "order" ? "order" : "search";
  if (!branch || !pin || !query) return json({ error: "Branch, PIN and text are required." }, 400);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "AI search is not set up yet (missing OPENAI_API_KEY)." }, 503);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: branchRow, error: branchError } = await db
    .from("branch_settings").select("branch").eq("branch", branch).eq("pin", pin).eq("active", true).maybeSingle();
  if (branchError) return json({ error: "Could not check the branch." }, 500);
  if (!branchRow) return json({ error: "Branch PIN not accepted." }, 401);

  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const [{ data: products, error: productError }, { data: orders }] = await Promise.all([
    db.from("spec_products").select("id,name,category,unit,pack_size,unit_options").eq("active", true).order("sort_order"),
    db.from("spec_orders").select("items").eq("branch", branch).gte("date", since),
  ]);
  if (productError || !products?.length) return json({ error: "Could not load the product list." }, 500);

  const usage = new Map<string, number>();
  for (const o of orders || []) {
    const items = Array.isArray(o.items) ? o.items : [];
    for (const it of items as { id?: string }[]) if (it?.id) usage.set(it.id, (usage.get(it.id) || 0) + 1);
  }
  const catalogue = (products as Product[]).map(p =>
    `${p.id} | ${p.name} | ${p.category || ""} | units: ${allowedUnits(p).join(", ")}${p.pack_size ? ` | pack: ${p.pack_size}` : ""}${(usage.get(p.id) || 0) >= 3 ? " | usual" : ""}`
  ).join("\n");

  const ai = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: { name: "spec_match", strict: true, schema: SCHEMA } },
      messages: [
        { role: "system", content: systemPrompt(mode) },
        { role: "user", content: `CATALOGUE (id | name | category | units | pack):\n${catalogue}\n\nMANAGER TEXT:\n${query}` },
      ],
    }),
  });
  if (!ai.ok) {
    console.error("openai", ai.status, (await ai.text()).slice(0, 500));
    return json({ error: "The AI service is not available right now." }, 502);
  }
  const completion = await ai.json();
  let parsed: { items?: { product_id: string; qty: number | null; unit: string | null; reason: string }[]; unmatched?: string[]; message?: string };
  try { parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }

  // Keep only real products and units, whatever the model returned.
  const byId = new Map((products as Product[]).map(p => [p.id, p]));
  const seen = new Set<string>();
  const items = (parsed.items || []).flatMap(it => {
    const p = byId.get(it.product_id);
    if (!p) return [];
    const units = allowedUnits(p);
    const unit = it.unit && units.includes(it.unit) ? it.unit : null;
    const qty = typeof it.qty === "number" && it.qty > 0 && it.qty < 1000 ? it.qty : null;
    const key = `${p.id}:${unit}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ product_id: p.id, name: p.name, qty, unit, reason: String(it.reason || "").slice(0, 120) }];
  });

  return json({
    items,
    unmatched: (parsed.unmatched || []).map(s => String(s).slice(0, 80)).slice(0, 10),
    message: String(parsed.message || "").slice(0, 200),
  });
});
