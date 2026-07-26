// Guestbook API — backed by Vercel KV (Upstash Redis REST API).
// Requires KV_REST_API_URL and KV_REST_API_TOKEN env vars, injected
// automatically once a KV/Upstash Redis store is connected to this
// Vercel project (Project → Storage → Create Database → Upstash Redis).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const LIST_KEY = "guestbook:entries";
const MAX_ENTRIES = 100;
const NAME_MAX = 30;
const MESSAGE_MAX = 200;
const RATE_LIMIT_SECONDS = 20;

async function kv(command) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`KV request failed (${res.status})`);
  const data = await res.json();
  return data.result;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (!KV_URL || !KV_TOKEN) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Guestbook storage isn't configured yet." }));
    return;
  }

  if (req.method === "GET") {
    try {
      const raw = await kv(["LRANGE", LIST_KEY, 0, MAX_ENTRIES - 1]);
      const entries = (raw || [])
        .map((s) => {
          try {
            return JSON.parse(s);
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean);
      res.statusCode = 200;
      res.end(JSON.stringify({ entries }));
    } catch (_) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Could not load the guestbook." }));
    }
    return;
  }

  if (req.method === "POST") {
    let parsed;
    try {
      const raw = await readBody(req);
      parsed = JSON.parse(raw || "{}");
    } catch (_) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid request." }));
      return;
    }

    const { name, message, website } = parsed || {};

    // Honeypot — bots tend to fill every field, real visitors never see this one.
    if (website) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "A message is required." }));
      return;
    }

    const cleanName = (typeof name === "string" ? name : "").trim().slice(0, NAME_MAX) || "Anonymous";
    const cleanMessage = message.trim().slice(0, MESSAGE_MAX);

    const ip = getClientIp(req);
    try {
      const rateKey = `guestbook:rate:${ip}`;
      const setResult = await kv(["SET", rateKey, "1", "NX", "EX", String(RATE_LIMIT_SECONDS)]);
      if (setResult !== "OK") {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: "Please wait a few seconds before posting again." }));
        return;
      }
    } catch (_) {
      // If the rate-limit check itself fails, let the post through rather
      // than block a genuine visitor over an infra hiccup.
    }

    const entry = { name: cleanName, message: cleanMessage, ts: Date.now() };

    try {
      await kv(["LPUSH", LIST_KEY, JSON.stringify(entry)]);
      await kv(["LTRIM", LIST_KEY, 0, MAX_ENTRIES - 1]);
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, entry }));
    } catch (_) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Could not save your note. Try again." }));
    }
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: "Method not allowed." }));
};
