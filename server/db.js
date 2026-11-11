// Supabase (account 2, project lanuk-x). Server-side only: the service role key never reaches the browser.
import { createClient } from "@supabase/supabase-js";
import { SEED } from "./seed.js";

let client = null;
export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
export const dbReady = () => !!db();

function must({ data, error }) {
  if (error) throw Object.assign(new Error(`Supabase: ${error.message}`), { code: "db_error" });
  return data;
}

export async function getMissions() {
  const s = db();
  if (!s) return { source: "seed", rows: SEED.missions };
  return { source: "supabase", rows: must(await s.from("envi_missions").select("*").order("sort")) };
}

export async function setMissionDone(id, done) {
  const s = db();
  if (!s) throw Object.assign(new Error("Supabase isn't set up yet, so missions can't be saved. Add the key to envi/.env."), { code: "no_db" });
  const rows = must(await s.from("envi_missions")
    .update({ done: !!done, done_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id).select());
  if (!rows.length) throw Object.assign(new Error("No mission with that id."), { code: "not_found" });
  return rows[0];
}

export async function getMoney() {
  const s = db();
  if (!s) return { source: "seed", ...SEED };
  const [costs, income, config] = await Promise.all([
    s.from("envi_costs").select("*").order("amount", { ascending: false }),
    s.from("envi_income").select("*").order("date"),
    s.from("envi_config").select("*").eq("id", "main").maybeSingle(),
  ]);
  return { source: "supabase", costs: must(costs), income: must(income), config: must(config) || SEED.config };
}

export async function ensureConversation(id, firstMessage) {
  const s = db();
  if (!s) return null;
  if (id) return id;
  const title = firstMessage.replace(/\s+/g, " ").slice(0, 80) || "New conversation";
  const [row] = must(await s.from("envi_conversations").insert({ title }).select("id"));
  return row.id;
}

export async function saveMessages(conversationId, rows) {
  const s = db();
  if (!s || !conversationId) return;
  must(await s.from("envi_messages").insert(rows.map((r) => ({ ...r, conversation_id: conversationId }))));
  must(await s.from("envi_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId));
}

export async function listConversations(limit = 20) {
  const s = db();
  if (!s) return [];
  return must(await s.from("envi_conversations").select("id,title,updated_at").order("updated_at", { ascending: false }).limit(limit));
}

export async function getConversation(id) {
  const s = db();
  if (!s) return [];
  return must(await s.from("envi_messages").select("role,content,provider,model,ms,created_at").eq("conversation_id", id).order("created_at"));
}

// Recent assistant replies, oldest first, for the reply-time chart.
export async function recentReplies(limit = 30) {
  const s = db();
  if (!s) return [];
  const rows = must(await s.from("envi_messages").select("provider,model,ms,created_at").eq("role", "assistant").not("ms", "is", null).order("created_at", { ascending: false }).limit(limit));
  return rows.reverse();
}
