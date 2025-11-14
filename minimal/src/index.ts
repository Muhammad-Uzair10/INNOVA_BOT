// src/index.ts
import express from "express";
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

export {}; // ensure this file is treated as a module for declaration merging

// --- add Request augmentation so req.rawBody is typed ---
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// --- env / config ---
const PORT = Number(process.env.PORT || 80);
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v24.0";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "change_me";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || ""; // optional if payload supplies it
const APP_SECRET = process.env.APP_SECRET || ""; // optional: for verifying x-hub-signature-256

if (!WHATSAPP_ACCESS_TOKEN) {
  console.warn("WARNING: WHATSAPP_ACCESS_TOKEN is not set. Sending will fail.");
}
if (!PHONE_NUMBER_ID) {
  console.warn("NOTE: PHONE_NUMBER_ID not set. Will use phone id from incoming payload metadata if present.");
}

const app = express();

// capture raw body for signature verification
app.use(
  express.json({
    verify: (req: express.Request, _res, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);

// optional signature verification
function verifySignature(req: express.Request): boolean {
  if (!APP_SECRET) return true; // skip verification in dev if no secret provided
  const signature = req.get("x-hub-signature-256");
  if (!signature || !req.rawBody) return false;
  const hmac = crypto.createHmac("sha256", APP_SECRET).update(req.rawBody).digest("hex");
  const expected = `sha256=${hmac}`;
  try {
    // timingSafeEqual requires same-length buffers
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// --- routes ---
app.get("/", (_req, res) => res.send("WhatsApp Cloud API (TypeScript) webhook"));

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verified. Challenge:", challenge);
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  // respond quickly so Meta doesn't retry
  res.status(200).send("Webhook received");

  // optional signature check
  if (!verifySignature(req)) {
    console.warn("Invalid or missing x-hub-signature-256 — skipping processing");
    return;
  }

  const body = req.body;
  console.log("---- WEBHOOK HEADERS ----");
  console.log(req.headers);
  console.log("---- RAW BODY (preview) ----");
  console.log(req.rawBody ? req.rawBody.toString().slice(0, 2000) : "<no raw>");
  console.log("---- PARSED BODY ----");
  console.log(JSON.stringify(body, null, 2));

  if (!body || body.object !== "whatsapp_business_account") {
    console.log("Ignoring non-whatsapp_business_account event");
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const metadata = value.metadata || {};
        const phoneIdFromPayload: string | undefined = metadata.phone_number_id;
        const phoneIdToUse = phoneIdFromPayload || PHONE_NUMBER_ID;
        const messages = value.messages || [];
        const statuses = value.statuses || [];

        if (messages.length) {
          const msg = messages[0];
          const from = msg.from || (value.contacts && value.contacts[0] && value.contacts[0].wa_id);
          console.log("Incoming message:", msg);

          if (msg.type === "text") {
            const text = msg.text?.body || "";
            const lower = text.toLowerCase().trim();

            if (lower === "hello") {
              await replyMessage(from, "Hello. How are you?", msg.id, phoneIdToUse);
            } else if (lower === "list") {
              await sendList(from, phoneIdToUse);
            } else if (lower === "buttons") {
              await sendReplyButtons(from, phoneIdToUse);
            } else {
              // simple echo fallback
              await sendMessage(from, `You said: "${text}"`, phoneIdToUse);
            }
          } else if (msg.type === "interactive") {
            console.log("Interactive payload:", msg.interactive);
            if (msg.interactive?.type === "list_reply") {
              await sendMessage(from, `You selected: ${msg.interactive.list_reply.title}`, phoneIdToUse);
            } else if (msg.interactive?.type === "button_reply") {
              await sendMessage(from, `You tapped: ${msg.interactive.button_reply.title}`, phoneIdToUse);
            }
          } else {
            console.log("Unhandled message type:", msg.type);
          }
        }

        if (statuses.length) {
          console.log("Status update:", statuses[0]);
        }
      }
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
  }
});

// --- Graph API helpers ---
async function graphPost(phoneId: string | undefined, payload: any) {
  const phoneIdToUse = phoneId || PHONE_NUMBER_ID;
  if (!phoneIdToUse) throw new Error("PHONE_NUMBER_ID missing (either set PHONE_NUMBER_ID env or use metadata.phone_number_id)");
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneIdToUse}/messages`;

  try {
    const res = await axios({
      url,
      method: "post",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: payload,
    });
    console.log("Graph API response:", res.data);
    return res.data;
  } catch (e: any) {
    console.error("Graph API error:", e.response?.data ?? e.message);
    throw e;
  }
}

async function sendMessage(to: string, bodyText: string, phoneId?: string) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: bodyText },
  };
  return graphPost(phoneId, payload);
}

async function replyMessage(to: string, bodyText: string, messageId: string, phoneId?: string) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: bodyText },
    context: { message_id: messageId },
  };
  return graphPost(phoneId, payload);
}

async function sendList(to: string, phoneId?: string) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Message Header" },
      body: { text: "This is an interactive list message" },
      footer: { text: "Footer" },
      action: {
        button: "Tap for the options",
        sections: [{ title: "First Section", rows: [{ id: "first_option", title: "First option", description: "desc" }] }],
      },
    },
  };
  return graphPost(phoneId, payload);
}

async function sendReplyButtons(to: string, phoneId?: string) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: "Message Header" },
      body: { text: "This is an interactive reply buttons message" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "first_button", title: "First Button" } },
          { type: "reply", reply: { id: "second_button", title: "Second Button" } },
        ],
      },
    },
  };
  return graphPost(phoneId, payload);
}

// start
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
