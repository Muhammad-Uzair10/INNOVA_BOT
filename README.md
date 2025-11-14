# Innova WhatsApp Bot

WhatsApp webhook for Innova Education with:

- Conversational flows (study abroad, test prep, enrollment)
- Interactive buttons (Talk to an agent, Main Menu) and CTA URL
- SQLite persistence (./data/app.db) with simple admin APIs
- Optional Google Sheets sync for easy viewing/filtering
- Render deployment (render.yaml) with a persistent disk

## Prerequisites

- Node.js 18+
- `npm install`

Create a `.env` file (copy from `.env.example`) and set these values from your WhatsApp Dashboard:

- WHATSAPP_ACCESS_TOKEN – your long‑lived token
- WHATSAPP_PHONE_NUMBER_ID – the numeric ID of your sending number (not the phone number). From your screenshot it looks like `845243325338071`.
- WEBHOOK_VERIFY_TOKEN – any string you configure in the Meta app (e.g. `innova`)
- WHATSAPP_API_VERSION – keep in sync with your app version (e.g. `v22.0`)

Optional (Google Sheets):

- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PRIVATE_KEY (use `\n`-escaped newlines in .env)
- GOOGLE_SHEETS_ID (spreadsheet id)
- GOOGLE_SHEETS_STUDY_TAB (default `StudyApplications`)
- GOOGLE_SHEETS_ENROLL_TAB (default `Enrollments`)

On Windows PowerShell, you can also set env vars for a single run without a `.env` file:

```powershell
$env:WHATSAPP_ACCESS_TOKEN = "<YOUR_TOKEN>"
$env:WHATSAPP_PHONE_NUMBER_ID = "845243325338071"  # replace with yours
$env:WEBHOOK_VERIFY_TOKEN = "innova"
$env:WHATSAPP_API_VERSION = "v22.0"
```

## Running the webhook server

```powershell
npm run start
```

The server exposes `GET /health` which reports whether required env variables are present. By default it listens on port 80, so visit http://localhost/health (or http://localhost:<PORT>/health if you changed `PORT`).

Data & Admin APIs:

- `GET /admin/applications` – returns saved applications from SQLite (use `?type=study` or `?type=enrollment`)
- `GET /admin/sheets/test` – appends a test row to the configured Google Sheet (for connectivity checks)

## Trying the conversational flow locally

The CLI tester forces mock mode so no outbound messages leave your machine. Use it to explore button/list flows.

```powershell
npm run cli
```

Inside the CLI:

- Type any message (e.g. `menu`, `hello`).
- Use `/button <id>` to fire a button reply (`/button study_abroad`).
- Use `/list <id>` to pick a list item (`/list country_uk`).
- `/reset` clears the session, `/exit` quits.

Set `CLI_PHONE` in your environment to simulate multiple concurrent users.

## Database

SQLite database is stored at `./data/app.db` (auto-created). On Render, a persistent disk is mounted to this path.

## Google Sheets

The app will append rows to Google Sheets (if envs are set). Share the spreadsheet with your service account email and enable the "Google Sheets API" and "Google Drive API" in Google Cloud. Tabs are auto-created if missing.

## Deploying to Render

This repo contains `render.yaml`. To deploy:

1. Push this repository to GitHub.
2. In Render, create a "Blueprint" (New -> Blueprint) from the repo.
3. Set environment variables in the service settings (WhatsApp + Google):
	- WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WEBHOOK_VERIFY_TOKEN, WHATSAPP_API_VERSION
	- GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_ID
4. The service runs `npm start` and listens on `PORT` provided by Render.
5. Point your Meta webhook to `https://<your-service>.onrender.com/webhook` with the same verify token.

## Health endpoints

With the server running:

- `GET /health` – health status.
- `GET /admin/applications` – pending applications (in-memory).
