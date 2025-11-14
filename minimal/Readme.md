# Minimal INNOVA WhatsApp Cloud API Bot

This is a minimal bot to confirm your WhatsApp Cloud API setup is working. It:
- Verifies the webhook
- Waits for the user to send a message (user-initiated)
- Replies with a simple greeting and echoes the user's message

## 1) Configure environment
Copy `.env.example` to `.env` and fill:
- `WHATSAPP_TOKEN` — Permanent token from Meta for your app
- `WHATSAPP_PHONE_NUMBER_ID` — Phone Number ID from your WhatsApp app
- `VERIFY_TOKEN` — Any secret string; set the same in Meta App Webhooks "Verify token"
- Optional `GRAPH_API_VERSION` — defaults to `v21.0`

## 2) Install and run
```bash
npm install
npm run dev
```

If running locally, expose the port with HTTPS:
```bash
npx ngrok http 3000
```
Copy the `https://...` URL for the webhook.

## 3) Set webhook in Meta
In the Meta Developer Dashboard:
- App -> WhatsApp -> Configuration -> Webhooks
- Set the callback URL to: `https://<your-ngrok-domain>/webhook`
- Set the verify token to the same `VERIFY_TOKEN` used in `.env`
- Subscribe to `messages` for your phone number

## 4) Test
Send a WhatsApp message from your phone to your app's phone number.
You should receive a reply: 
> Hi! INNOVA WhatsApp bot is set up successfully 🎉  
> You said: "<your message>"

## Notes
- The endpoint used is `POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`
- For production, secure your server, use a proper HTTPS domain, and consider validating the X-Hub-Signature-256 header.