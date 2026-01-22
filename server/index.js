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
  console.error("Create /server/.env with OPENAI_API_KEY=... then restart the server.");
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
const mg = hasMailgun
  ? mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
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
   System Prompt for ChatGPT
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

SANKALP'S BASIC INFO:
- Name: Sankalp Singh
- Title: Full Stack Developer
- Location: Dallas, Texas
- Phone: 682-219-8682
- Availability: Monday-Friday, 9 AM - 6 PM CST
- Response Time: Within 24 hours

If user asks something personal/biographical and it is not in the knowledge base, do NOT guess.`;

/* ================================
   Simple Knowledge Base (RAG)
   - Reads /server/profile.json
   - Reads /server/knowledge/*.md
   - Keyword retrieval (simple + fast)
================================ */
const PROFILE_PATH = path.join(__dirname, "profile.json");
const KNOWLEDGE_DIR = path.join(__dirname, "knowledge");

let PROFILE = {};
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

async function loadProfile() {
  try {
    const raw = await fs.readFile(PROFILE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
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
      // Bonus points if user references a file name conceptually
      const fileHint = ch.source.replace(".md", "").toLowerCase();
      if (q.includes(fileHint)) score += 2;

      return { ...ch, score };
    })
    .filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * This is the “brain builder”:
 * - It merges SYSTEM_PROMPT + PROFILE + top knowledge excerpts
 * - Then ChatGPT answers grounded in your real info (not generic)
 */
function buildAssistantInstructions(userMessage) {
  const name = PROFILE.preferredName || PROFILE.name || "Sankalp Singh";
  const tone = PROFILE.tone || "professional, confident, concise";

  const top = retrieveByKeywords(userMessage, KNOWLEDGE_CHUNKS, 6);

  // If no matching chunks, force safe behavior (no generic hallucinations)
  if (!top.length) {
    return `
${SYSTEM_PROMPT}

VOICE:
- ${tone}
- Be specific. Avoid generic filler.
- Ask ONE follow-up question if the user’s question is missing detail.
- Max 6–10 sentences unless user asks for more.

RULES:
- Use PROFILE as the only source of truth for personal details.
- If missing, say: "I don’t want to guess—if you share a bit more detail, I’ll answer accurately."

PROFILE (JSON):
${JSON.stringify(PROFILE, null, 2)}
`.trim();
  }

  const knowledgeBlock = top
    .map((c) => `[${c.source}]\n${c.text}`)
    .join("\n\n---\n\n");

  return `
${SYSTEM_PROMPT}

You are the AI assistant for ${name}.

VOICE:
- ${tone}
- Be specific. Avoid generic filler.
- Max 6–10 sentences unless user asks for more.
- Ask ONE follow-up question if needed.

RULES:
- Use PROFILE + KNOWLEDGE excerpts as source of truth.
- If missing, say: "I can confirm that and get back to you."
- Do not invent details.
- No markdown headers like "##". Plain text.

PROFILE (JSON):
${JSON.stringify(PROFILE, null, 2)}

KNOWLEDGE (most relevant excerpts):
${knowledgeBlock}
`.trim();
}

async function initRAG() {
  PROFILE = await loadProfile();
  KNOWLEDGE_CHUNKS = await loadKnowledge();
  KNOWLEDGE_LAST_LOADED_AT = new Date().toISOString();

  console.log(
    `📚 Knowledge loaded: ${KNOWLEDGE_CHUNKS.length} chunks | profile: ${
      Object.keys(PROFILE).length ? "yes" : "no"
    } | ${KNOWLEDGE_LAST_LOADED_AT}`
  );
}

/* ================================
   API Routes
================================ */

/**
 * POST /api/chat
 * Handle chatbot messages using OpenAI (ChatGPT) API
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

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

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions: buildAssistantInstructions(message),
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
 * OPTIONAL: manual reload endpoint (handy while editing .md files)
 * GET /api/reload-knowledge
 */
app.get("/api/reload-knowledge", async (req, res) => {
  try {
    await initRAG();
    return res.json({
      success: true,
      message: "Knowledge reloaded",
      meta: {
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
 * Handle contact form submissions via Mailgun
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
              <p style="color: #999; font-size: 14px;">📱 682-219-8682 | 📍 Dallas, Texas</p>
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
 * Handle meeting scheduling requests
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

    // Keeping your meeting flow intact (simple email version)
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
console.log("MAILGUN_DOMAIN:", process.env.MAILGUN_DOMAIN);
console.log("OWNER_EMAIL:", process.env.OWNER_EMAIL);
console.log("MAILGUN_KEY exists:", Boolean(process.env.MAILGUN_API_KEY));

/**
 * Health check endpoint
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

// Auto-refresh knowledge every 5 minutes (so you can edit .md files without restart)
setInterval(initRAG, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Sankalp Singh Portfolio Server                       ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║                                                           ║
║   API Endpoints:                                          ║
║   • POST /api/chat              - AI Chatbot               ║
║   • GET  /api/reload-knowledge  - Reload RAG (dev)         ║
║   • POST /api/contact           - Contact Form             ║
║   • POST /api/schedule-meeting  - Meeting Scheduler        ║
║   • GET  /api/health            - Health Check             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
});
