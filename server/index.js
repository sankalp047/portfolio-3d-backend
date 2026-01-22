/* ================================
   Express Server - API Routes
   Sankalp Singh Portfolio

   Handles:
   - ChatGPT (OpenAI) Chatbot API
   - Mailgun Email Integration
   - Meeting Scheduling
   - Contact Form Submissions
================================ */

import "dotenv/config";

import fs from "fs/promises";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import OpenAI from "openai";
import FormData from "form-data";
import Mailgun from "mailgun.js";

const app = express();
const PORT = process.env.PORT || 3000;

/* ================================
   Path helpers (ESM has no __dirname)
================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your folder structure: /server/index.js, /public, /src
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SRC_DIR = path.join(ROOT_DIR, "src");

/* ================================
   Middleware
================================ */
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use(express.static(PUBLIC_DIR));
app.use("/src", express.static(SRC_DIR));

/* ================================
   Initialize OpenAI Client
================================ */
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables.");
  console.error("Add OPENAI_API_KEY in Render Environment Variables, then redeploy.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ================================
   Initialize Mailgun (optional)
================================ */
const hasMailgun =
  Boolean(process.env.MAILGUN_API_KEY) &&
  Boolean(process.env.MAILGUN_DOMAIN) &&
  Boolean(process.env.OWNER_EMAIL);

const mailgun = new Mailgun(FormData);

// Support US/EU endpoints (set MAILGUN_API_BASE_URL if needed)
const MAILGUN_API_BASE_URL = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

const mg = hasMailgun
  ? mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
      url: MAILGUN_API_BASE_URL,
    })
  : null;

/* ================================
   Configuration
================================ */
const CONFIG = {
  ownerEmail: process.env.OWNER_EMAIL || "sankalpsingh6@gmail.com",
  mailgunDomain: process.env.MAILGUN_DOMAIN || "mg.sankalpsinghrajput.com",
  ownerName: "Sankalp Singh",
};

/* ================================
   Default System Prompt (Professional)
================================ */
const SYSTEM_PROMPT = `You are the AI assistant for Sankalp Singh, a Full Stack Developer based in Dallas, Texas.

Your role is to:
1. Answer questions about Sankalp's experience, skills, and services professionally
2. Provide information about availability and rates
3. Help schedule meetings with potential clients
4. Maintain a highly professional, helpful, and knowledgeable tone

IMPORTANT GUIDELINES:
- Always be professional, courteous, and helpful
- Provide accurate information about Sankalp's skills and experience
- When asked about rates, provide the info but suggest a consultation for detailed quotes
- For meeting requests, guide the user to provide: name, email, preferred date/time, and brief project description
- Never make up information - if you don't know something, say you'll have Sankalp follow up
- Keep responses concise but informative (2-4 paragraphs max)
- Use proper business communication style
- Do NOT use markdown headers (##). Use plain text with line breaks.

If user asks something personal/biographical and it is not in the knowledge base, do NOT guess.`;

/* ================================
   Knowledge Base (RAG)
   - Reads /server/profiles.json  (multi profiles)
   - (Optional legacy) /server/profile.json
   - Reads /server/knowledge/*.md
   - Keyword retrieval
================================ */

// Optional legacy single profile support
const LEGACY_PROFILE_PATH = path.join(__dirname, "profile.json");

// NEW multi-profile file (put it in /server/profiles.json)
const PROFILES_PATH = path.join(__dirname, "profiles.json");

const KNOWLEDGE_DIR = path.join(__dirname, "knowledge");

let LEGACY_PROFILE = {};
let PROFILES = { default: "default", profiles: {} };

let KNOWLEDGE_CHUNKS = [];
let KNOWLEDGE_LAST_LOADED_AT = null;

function chunkText(text, maxLen = 900) {
  const parts = text
    .split(/\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];
  let buf = "";

  for (const p of parts) {
    if ((buf + "\n\n" + p).length > maxLen) {
      if (buf) chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function loadLegacyProfile() {
  try {
    const raw = await fs.readFile(LEGACY_PROFILE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeProfiles(raw) {
  // Supported shapes:
  // 1) { "default": "sankalp", "profiles": { "sankalp": {...}, "anaita": {...} } }
  // 2) { "default": "sankalp", "sankalp": {...}, "anaita": {...} }
  if (!raw || typeof raw !== "object") return { default: "default", profiles: {} };

  if (raw.profiles && typeof raw.profiles === "object") {
    const def = typeof raw.default === "string" ? raw.default : "default";
    return { default: def, profiles: raw.profiles };
  }

  const copy = { ...raw };
  const def = typeof copy.default === "string" ? copy.default : "default";
  delete copy.default;

  return { default: def, profiles: copy };
}

async function loadProfiles() {
  try {
    const raw = await fs.readFile(PROFILES_PATH, "utf8");
    return normalizeProfiles(JSON.parse(raw));
  } catch {
    return { default: "default", profiles: {} };
  }
}

async function loadKnowledge() {
  try {
    const files = await fs.readdir(KNOWLEDGE_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    const all = [];
    for (const f of mdFiles) {
      const full = await fs.readFile(path.join(KNOWLEDGE_DIR, f), "utf8");
      const chunks = chunkText(full).map((c) => ({ source: f, text: c }));
      all.push(...chunks);
    }
    return all;
  } catch {
    return [];
  }
}

function retrieveByKeywords(query, chunks, k = 6) {
  const q = String(query || "").toLowerCase();
  const terms = q.split(/\W+/).filter((t) => t.length >= 3);

  const scored = chunks
    .map((ch) => {
      const t = ch.text.toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (t.includes(term)) score += 1;
      }

      // Bonus if user mentions file concept
      const fileHint = ch.source.replace(".md", "").toLowerCase();
      if (q.includes(fileHint)) score += 2;

      return { ...ch, score };
    })
    .filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function normalizeProfileId(id) {
  return String(id || "").trim().toLowerCase();
}

function containsTerm(text, term) {
  const t = String(text || "").toLowerCase();
  const q = String(term || "").toLowerCase().trim();
  if (!q) return false;

  // numeric identifiers (phone etc) -> simple includes
  if (/^\d{6,}$/.test(q)) return t.includes(q);

  // word boundary match for names/aliases
  const re = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(t);
}

function inferProfileIdFromMessage(message) {
  const msg = String(message || "").toLowerCase();

  for (const [id, p] of Object.entries(PROFILES.profiles || {})) {
    const pid = normalizeProfileId(id);

    // terms to detect
    const terms = new Set([pid]);

    if (p?.name && typeof p.name === "string") {
      const first = p.name.split(/\s+/)[0]?.toLowerCase();
      if (first) terms.add(first);
      terms.add(p.name.toLowerCase());
    }

    if (Array.isArray(p?.aliases)) {
      for (const a of p.aliases) {
        if (typeof a === "string" && a.trim()) terms.add(a.trim().toLowerCase());
      }
    }

    for (const term of terms) {
      if (containsTerm(msg, term)) return pid;
    }
  }

  return null;
}

function getActiveProfile(profileId, userMessage) {
  const requested = normalizeProfileId(profileId);

  if (requested && PROFILES.profiles?.[requested]) {
    return { id: requested, ...PROFILES.profiles[requested] };
  }

  // Auto-detect from message if no profileId provided (or invalid)
  const inferred = inferProfileIdFromMessage(userMessage);
  if (inferred && PROFILES.profiles?.[inferred]) {
    return { id: inferred, ...PROFILES.profiles[inferred] };
  }

  const def = normalizeProfileId(PROFILES.default) || "default";
  if (PROFILES.profiles?.[def]) {
    return { id: def, ...PROFILES.profiles[def] };
  }

  // fallback: no profiles.json configured
  return { id: "default" };
}

function getKnowledgePoolForProfile(activeProfile) {
  const files = activeProfile?.knowledgeFiles;

  // IMPORTANT:
  // If knowledgeFiles is defined, we only use those files.
  // This prevents personal files (like anaita.md) leaking into default/public mode.
  if (Array.isArray(files)) {
    const allow = new Set(files.map((f) => String(f)));
    return KNOWLEDGE_CHUNKS.filter((ch) => allow.has(ch.source));
  }

  // No filter defined -> use all knowledge
  return KNOWLEDGE_CHUNKS;
}

function buildAssistantInstructions(userMessage, profileId) {
  const active = getActiveProfile(profileId, userMessage);

  const name =
    active.name ||
    LEGACY_PROFILE.preferredName ||
    LEGACY_PROFILE.name ||
    "Sankalp Singh";

  const tone =
    active.tone ||
    LEGACY_PROFILE.tone ||
    "professional, confident, concise";

  const systemPrompt =
    active.systemPrompt ||
    SYSTEM_PROMPT;

  const knowledgePool = getKnowledgePoolForProfile(active);
  const top = retrieveByKeywords(userMessage, knowledgePool, 6);

  // Keep prompt profile block small + safe
  const profileForPrompt = {
    id: active.id,
    name: active.name,
    tone: active.tone,
    rules: active.rules,
    notes: active.notes,
    // do NOT include secrets
  };

  if (!top.length) {
    return `
${systemPrompt}

ACTIVE PROFILE:
${JSON.stringify(profileForPrompt, null, 2)}

VOICE:
- ${tone}
- Be specific. Avoid generic filler.
- Ask ONE follow-up question if the user’s question is missing detail.
- Max 6–10 sentences unless user asks for more.

RULES:
- Use the PROFILE + KNOWLEDGE as the only source of truth.
- If missing, say: "I don’t want to guess—if you share a bit more detail, I’ll answer accurately."
- Do NOT invent personal facts or memories.
- No markdown headers like "##". Plain text with line breaks.
`.trim();
  }

  const knowledgeBlock = top
    .map((c) => `[${c.source}]\n${c.text}`)
    .join("\n\n---\n\n");

  return `
${systemPrompt}

You are speaking as the assistant for: ${name}

ACTIVE PROFILE:
${JSON.stringify(profileForPrompt, null, 2)}

VOICE:
- ${tone}
- Be specific. Avoid generic filler.
- Max 6–10 sentences unless user asks for more.
- Ask ONE follow-up question if needed.

RULES:
- Use the KNOWLEDGE excerpts as source of truth.
- Do not invent details or memories.
- No markdown headers like "##". Plain text with line breaks.

KNOWLEDGE (most relevant excerpts):
${knowledgeBlock}
`.trim();
}

async function initRAG() {
  LEGACY_PROFILE = await loadLegacyProfile();
  PROFILES = await loadProfiles();
  KNOWLEDGE_CHUNKS = await loadKnowledge();
  KNOWLEDGE_LAST_LOADED_AT = new Date().toISOString();

  console.log(
    `📚 Knowledge loaded: ${KNOWLEDGE_CHUNKS.length} chunks | profiles: ${
      Object.keys(PROFILES.profiles || {}).length
    } | defaultProfile: ${PROFILES.default || "default"} | ${KNOWLEDGE_LAST_LOADED_AT}`
  );
}

/* ================================
   API Routes
================================ */

/**
 * POST /api/chat
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], profileId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Only keep user/assistant history, limit size
    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-20)
      : [];

    const messages = [
      ...safeHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    // Determine active profile (so we can return it in meta)
    const active = getActiveProfile(profileId, message);

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions: buildAssistantInstructions(message, profileId),
      input: messages,
      max_output_tokens: 700,
      temperature: 0.6,
      store: false,
    });

    const assistantMessage = (response.output_text || "").trim();

    return res.json({
      response: assistantMessage,
      success: true,
      meta: {
        activeProfileId: active.id,
        knowledgeLoadedAt: KNOWLEDGE_LAST_LOADED_AT,
        chunks: KNOWLEDGE_CHUNKS.length,
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return res.status(500).json({
      error: "Failed to process chat message",
      message: error?.message || String(error),
    });
  }
});

/**
 * Debug: list profiles
 * GET /api/profiles
 */
app.get("/api/profiles", (req, res) => {
  const ids = Object.keys(PROFILES.profiles || {});
  res.json({
    success: true,
    default: PROFILES.default || "default",
    profiles: ids,
  });
});

/**
 * GET /api/reload-knowledge
 */
app.get("/api/reload-knowledge", async (req, res) => {
  try {
    await initRAG();
    return res.json({
      success: true,
      message: "Knowledge reloaded",
      meta: {
        defaultProfile: PROFILES.default || "default",
        profiles: Object.keys(PROFILES.profiles || {}).length,
        knowledgeLoadedAt: KNOWLEDGE_LAST_LOADED_AT,
        chunks: KNOWLEDGE_CHUNKS.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to reload knowledge",
      message: error?.message || String(error),
    });
  }
});

/**
 * POST /api/contact
 */
app.post("/api/contact", async (req, res) => {
  try {
    if (!hasMailgun || !mg) {
      return res.status(500).json({
        error: "Mailgun is not configured",
        message:
          "Missing MAILGUN_API_KEY / MAILGUN_DOMAIN / OWNER_EMAIL in server environment.",
      });
    }

    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const ownerEmailData = {
      from: `Portfolio Contact <postmaster@${CONFIG.mailgunDomain}>`,
      to: CONFIG.ownerEmail,
      subject: `New Contact Form Submission: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #99FFCC; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">Name:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">
                  <a href="mailto:${email}" style="color: #99FFCC;">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">Subject:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">${subject}</td>
              </tr>
            </table>
            <div style="margin-top: 20px;">
              <h3 style="color: #333; margin-bottom: 10px;">Message:</h3>
              <p style="color: #666; line-height: 1.6; background: #f9f9f9; padding: 15px; border-radius: 5px;">${String(
                message
              ).replace(/\n/g, "<br>")}</p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <a href="mailto:${email}" style="display: inline-block; background: #99FFCC; color: #1e1e1e; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                Reply to ${name}
              </a>
            </div>
          </div>
        </div>
      `,
    };

    const confirmationEmailData = {
      from: `Sankalp Singh <postmaster@${CONFIG.mailgunDomain}>`,
      to: email,
      subject: `Thank you for contacting Sankalp Singh`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: #99FFCC; margin: 0; font-size: 28px;">Thank You!</h1>
            <p style="color: #ffffff; margin-top: 10px; opacity: 0.8;">Your message has been received</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">Thank you for reaching out! I've received your message and will get back to you within 24 hours.</p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">Best regards,<br><strong style="color: #333;">Sankalp Singh</strong><br>Full Stack Developer</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="color: #999; font-size: 14px;">📍 Dallas, Texas</p>
            </div>
          </div>
        </div>
      `,
    };

    await mg.messages.create(CONFIG.mailgunDomain, ownerEmailData);
    await mg.messages.create(CONFIG.mailgunDomain, confirmationEmailData);

    return res.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("Contact Form Error:", error);
    return res.status(500).json({
      error: "Failed to send message",
      message: error?.message || String(error),
    });
  }
});

/**
 * POST /api/schedule-meeting
 */
app.post("/api/schedule-meeting", async (req, res) => {
  try {
    if (!hasMailgun || !mg) {
      return res.status(500).json({
        error: "Mailgun is not configured",
        message:
          "Missing MAILGUN_API_KEY / MAILGUN_DOMAIN / OWNER_EMAIL in server environment.",
      });
    }

    const { name, email, preferredDateTime, projectDescription } = req.body;

    if (!name || !email || !preferredDateTime || !projectDescription) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const meetingNotificationEmail = {
      from: `Portfolio Assistant <noreply@${CONFIG.mailgunDomain}>`,
      to: CONFIG.ownerEmail,
      subject: `🗓️ New Meeting Request from ${name}`,
      text: `Preferred Time: ${preferredDateTime}\nEmail: ${email}\nProject: ${projectDescription}`,
    };

    const requesterConfirmationEmail = {
      from: `Sankalp Singh <postmaster@${CONFIG.mailgunDomain}>`,
      to: email,
      subject: `Meeting Request Received - Sankalp Singh`,
      text: `Hi ${name},\n\nI received your meeting request for ${preferredDateTime}. I’ll confirm within 24 hours.\n\n- Sankalp`,
    };

    await mg.messages.create(CONFIG.mailgunDomain, meetingNotificationEmail);
    await mg.messages.create(CONFIG.mailgunDomain, requesterConfirmationEmail);

    return res.json({ success: true, message: "Meeting request submitted successfully" });
  } catch (error) {
    console.error("Meeting Scheduling Error:", error);
    return res.status(500).json({
      error: "Failed to schedule meeting",
      message: error?.message || String(error),
    });
  }
});

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// SPA routing fallback (must be last)
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ================================
   Start server + init RAG
================================ */
await initRAG();

// Auto-refresh knowledge every 5 minutes
setInterval(initRAG, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🚀 Sankalp Singh Portfolio Server                       ║
║   Running on: http://localhost:${PORT}                    ║
║   API: POST /api/chat | GET /api/health | GET /api/profiles ║
╚═══════════════════════════════════════════════════════════╝
`);
});
