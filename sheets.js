const { google } = require('googleapis')

// Environment variables expected:
// GOOGLE_SERVICE_ACCOUNT_EMAIL
// GOOGLE_PRIVATE_KEY  (use escaped newlines in .env like \n)
// GOOGLE_SHEETS_ID    (the Spreadsheet ID)
// TABS: optional overrides GOOGLE_SHEETS_STUDY_TAB, GOOGLE_SHEETS_ENROLL_TAB

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY
  if (!clientEmail || !privateKeyRaw) {
    return null
  }
  // Fix escaped newlines in env
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
  return auth
}

// Quote/escape a tab name so ranges work even if it has spaces or quotes.
function quoteTabName(title) {
  const escaped = String(title || 'Sheet1').replace(/'/g, "''")
  return `'${escaped}'`
}

async function ensureSheetExists(sheetsClient, sheetId, title) {
  const titleStr = String(title || 'Sheet1')
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties.title'
  })
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties && s.properties.title === titleStr
  )
  if (exists) return false

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: titleStr } } }]
    }
  })
  return true
}

async function appendRow({ sheetId, tabName, values }) {
  try {
    const auth = getAuth()
    if (!auth || !sheetId) {
      console.warn('[sheets] Missing auth or sheetId; skipping append')
      return
    }
    const sheets = google.sheets({ version: 'v4', auth })
    // Ensure the tab exists; create it if missing
    await ensureSheetExists(sheets, sheetId, tabName)
    const range = `${quoteTabName(tabName)}!A:Z`
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [values] }
    })
  } catch (e) {
    console.error('[sheets] appendRow error:', e.response?.data || e.message)
  }
}

module.exports = {
  appendRow,
}
