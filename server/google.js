// Envi's own Google sign-in and the Google calls behind its app tools. Kunal's choice, 2026-11-12:
// Envi talks to Google directly, so mail and files travel only between Google and this PC.
//
// Setup (once): a Google Cloud OAuth client of type "Web application" with the redirect
// http://127.0.0.1:<PORT>/oauth/google/callback. Kunal puts GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
// in envi/.env, then clicks "Connect Google" in Envi. The refresh token is kept in
// envi/.secrets/google.json (git-ignored). Agents never read or print that file.
//
// Scopes: read mail, write drafts (gmail.compose also permits sending, but Envi has no send code),
// read calendar, read Drive, create files Envi makes (drive.file), read Sheets.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(HERE, "..", ".secrets", "google.json");
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];
const err = (message, code = "google_error") => Object.assign(new Error(message), { code });
const redirectUri = () => `http://127.0.0.1:${process.env.PORT || 4777}/oauth/google/callback`;
const configured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
function readToken() { try { return JSON.parse(readFileSync(TOKEN_FILE, "utf8")); } catch { return null; } }
function saveToken(t) { mkdirSync(path.dirname(TOKEN_FILE), { recursive: true }); writeFileSync(TOKEN_FILE, JSON.stringify(t), { encoding: "utf8", mode: 0o600 }); }

export function status() {
  const t = readToken();
  return { configured: configured(), connected: !!t?.refresh_token, account: t?.account || null, since: t?.since || null, redirect: redirectUri() };
}

/* ---------- sign-in ---------- */
let pendingState = null;
export function authUrl() {
  if (!configured()) throw err("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to envi/.env first, then restart Envi.", "not_configured");
  pendingState = randomBytes(16).toString("hex");
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: pendingState });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
export async function finishAuth(code, state) {
  if (!pendingState || state !== pendingState) throw err("This sign-in link is old or was not started by Envi. Click Connect Google again.", "bad_state");
  pendingState = null;
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw err("Google did not send a long-lived sign-in. Remove Envi's access at myaccount.google.com/permissions and connect again.");
  const profile = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}));
  saveToken({ refresh_token: t.refresh_token, access_token: t.access_token, expires_at: Date.now() + (t.expires_in - 60) * 1000, account: profile.emailAddress || null, since: new Date().toISOString() });
}
export function disconnect() { try { rmSync(TOKEN_FILE); } catch {} }

async function tokenRequest(params) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === "invalid_grant") { disconnect(); throw err("Google sign-in has expired (test-mode sign-ins last 7 days). Click Connect Google in Envi again.", "google_expired"); }
    throw err(`Google sign-in failed: ${j.error_description || j.error || r.status}`);
  }
  return j;
}
async function accessToken() {
  const t = readToken();
  if (!t?.refresh_token) throw err("Google isn't connected. Click Connect Google in Envi.", "google_not_connected");
  if (t.access_token && Date.now() < t.expires_at) return t.access_token;
  const n = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
  saveToken({ ...t, access_token: n.access_token, expires_at: Date.now() + (n.expires_in - 60) * 1000 });
  return n.access_token;
}
async function g(url, { method = "GET", body, headers = {}, raw = false } = {}) {
  const r = await fetch(url, { method, body, headers: { authorization: `Bearer ${await accessToken()}`, ...headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw err(`Google said ${r.status}: ${j.error?.message || "request failed"}`); }
  return raw ? r.text() : r.json();
}

/* ---------- Gmail ---------- */
const header = (msg, name) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
const b64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
function bodyText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return b64(part.body.data);
  for (const p of part.parts || []) { const t = bodyText(p); if (t) return t; }
  if (part.mimeType === "text/html" && part.body?.data) return b64(part.body.data).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return "";
}
export async function gmailSearch({ query = "", max = 10 }) {
  const list = await g(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${new URLSearchParams({ q: query, maxResults: String(Math.min(25, max)) })}`);
  const out = [];
  for (const th of list.threads || []) {
    const t = await g(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${th.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
    const m = t.messages?.[t.messages.length - 1];
    out.push({ thread_id: th.id, subject: header(m, "Subject"), from: header(m, "From"), date: header(m, "Date"), snippet: m?.snippet || "", messages: t.messages?.length || 0 });
  }
  return { threads: out };
}
export async function gmailRead({ thread_id }) {
  const t = await g(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(thread_id)}?format=full`);
  return { thread_id, messages: (t.messages || []).map((m) => ({ from: header(m, "From"), to: header(m, "To"), date: header(m, "Date"), subject: header(m, "Subject"), text: bodyText(m.payload).slice(0, 6000) })) };
}
export async function gmailDraft({ to = "", subject = "", body = "" }) {
  const mime = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
  const raw = Buffer.from(mime, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const d = await g("https://gmail.googleapis.com/gmail/v1/users/me/drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: { raw } }) });
  return { draft_id: d.id, note: "Saved as a draft in Gmail. Not sent." };
}

/* ---------- Calendar ---------- */
export async function calendarEvents({ from, to, query = "", max = 20 }) {
  const timeMin = new Date(from || Date.now()).toISOString(), timeMax = new Date(to || Date.now() + 7 * 864e5).toISOString();
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: String(Math.min(50, max)) });
  if (query) q.set("q", query);
  const r = await g(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`);
  return { events: (r.items || []).map((e) => ({ title: e.summary || "(no title)", start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, location: e.location || "", attendees: (e.attendees || []).length, link: e.htmlLink })) };
}

/* ---------- Drive, Docs, Sheets ---------- */
export async function driveSearch({ query = "", max = 10 }) {
  const safe = query.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = safe ? `(name contains '${safe}' or fullText contains '${safe}') and trashed = false` : "trashed = false";
  const r = await g(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, pageSize: String(Math.min(25, max)), orderBy: safe ? "" : "modifiedTime desc", fields: "files(id,name,mimeType,modifiedTime,webViewLink)" })}`);
  return { files: (r.files || []).map((f) => ({ file_id: f.id, name: f.name, type: f.mimeType.replace("application/vnd.google-apps.", "google-"), modified: f.modifiedTime, link: f.webViewLink })) };
}
export async function driveRead({ file_id }) {
  const id = encodeURIComponent(file_id);
  const meta = await g(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType,size`);
  let text;
  if (meta.mimeType === "application/vnd.google-apps.document") text = await g(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`, { raw: true });
  else if (meta.mimeType === "application/vnd.google-apps.spreadsheet") text = await g(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/csv`, { raw: true });
  else if (meta.mimeType === "application/vnd.google-apps.presentation") text = await g(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`, { raw: true });
  else if (/^text\/|json|csv|markdown/.test(meta.mimeType) && Number(meta.size || 0) < 2e6) text = await g(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { raw: true });
  else return { name: meta.name, type: meta.mimeType, text: null, note: "Not a text document, so Envi can't read its contents." };
  return { name: meta.name, type: meta.mimeType, text: text.slice(0, 12000), truncated: text.length > 12000 };
}
export async function sheetsRead({ spreadsheet_id, range = "A1:Z100" }) {
  const r = await g(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet_id)}/values/${encodeURIComponent(range)}`);
  return { range: r.range, rows: (r.values || []).slice(0, 200) };
}
export async function driveCreateDoc({ title = "Envi draft", text = "" }) {
  const boundary = "envi" + randomBytes(8).toString("hex");
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.document" })}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
  const f = await g("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body });
  return { file_id: f.id, name: f.name, link: f.webViewLink, note: "New Google Doc created in Kunal's Drive." };
}
