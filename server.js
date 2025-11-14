const express = require('express')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const { appendRow } = require('./sheets')
require('dotenv').config()

// Read configuration from environment variables
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'innova'
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0' // align with your Meta app version
const PORT = parseInt(process.env.PORT || '80', 10)

// Construct the correct WhatsApp API URL using the Phone Number ID from your dashboard
const WHATSAPP_API_URL = WHATSAPP_PHONE_NUMBER_ID
  ? `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  : null

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.send('WhatsApp with Node.js and Webhooks')
})

// Simple health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    apiVersion: WHATSAPP_API_VERSION,
    hasAccessToken: Boolean(WHATSAPP_ACCESS_TOKEN),
    hasPhoneNumberId: Boolean(WHATSAPP_PHONE_NUMBER_ID)
  })
})

// Minimal placeholder for admin applications (in-memory)
const applications = [] // kept for backward-compat but DB is the source of truth now

// ================= SQLite setup =================
const DB_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DB_DIR, 'app.db')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS study_applications (
  id TEXT PRIMARY KEY,
  name TEXT,
  whatsapp TEXT,
  qualification TEXT,
  completionYear TEXT,
  grade TEXT,
  university TEXT,
  englishTest TEXT,
  currentCity TEXT,
  preferredCity TEXT,
  budget TEXT,
  country TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  firstName TEXT,
  lastName TEXT,
  email TEXT,
  phone TEXT,
  startDate TEXT,
  courseName TEXT,
  packageType TEXT,
  cost INTEGER,
  createdAt TEXT
);
`)

const insertStudyStmt = db.prepare(`INSERT INTO study_applications (
  id, name, whatsapp, qualification, completionYear, grade, university, englishTest, currentCity, preferredCity, budget, country, createdAt
) VALUES (@id, @name, @whatsapp, @qualification, @completionYear, @grade, @university, @englishTest, @currentCity, @preferredCity, @budget, @country, @createdAt)`) 

const insertEnrollmentStmt = db.prepare(`INSERT INTO enrollments (
  id, firstName, lastName, email, phone, startDate, courseName, packageType, cost, createdAt
) VALUES (@id, @firstName, @lastName, @email, @phone, @startDate, @courseName, @packageType, @cost, @createdAt)`)

function listApplications(type) {
  if (type === 'study') {
    const rows = db.prepare('SELECT *, "study" as type FROM study_applications ORDER BY datetime(createdAt) DESC').all()
    return rows
  }
  if (type === 'enrollment') {
    const rows = db.prepare('SELECT *, "enrollment" as type FROM enrollments ORDER BY datetime(createdAt) DESC').all()
    return rows
  }
  const study = db.prepare('SELECT *, "study" as type FROM study_applications').all()
  const enr = db.prepare('SELECT *, "enrollment" as type FROM enrollments').all()
  // combine and sort by createdAt desc
  return [...study, ...enr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

app.get('/admin/applications', (req, res) => {
  try {
    const type = req.query.type // 'study' | 'enrollment' | undefined
    const rows = listApplications(type)
    res.json(rows)
  } catch (e) {
    console.error('admin/applications error', e)
    res.status(500).json({ error: 'db_error', message: e.message })
  }
})

// In-memory session store keyed by WhatsApp wa_id (sender number string)
const sessions = new Map()

function getSession(waId) {
  if (!sessions.has(waId)) {
    sessions.set(waId, { step: 'welcome', data: {}, suppressMenuOnce: false })
  }
  return sessions.get(waId)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function sendSequence(to, parts, firstMessageId) {
  for (let i = 0; i < parts.length; i++) {
    const text = parts[i]
    if (i === 0 && firstMessageId) {
      await replyMessage(to, text, firstMessageId)
    } else {
      await sendMessage(to, text)
    }
    if (i < parts.length - 1) await sleep(900)
  }
}

// ========= Conversation flows (mirrors the frontend component) =========
async function sendWelcomeFlow(to, messageId, session) {
  const greeting = "Hey there! 👋 Welcome to INNOVA Education Consultant!\n\nI'm here to help you with your Study Abroad Journey! ✈"
  const optionsText = "What would you like to explore Today?\nJust type the number, I'm thrilled to help you.\n\n⓵ Study Abroad Destination.\n⓶ English Test Preparation.\n⓷ Book Counselling Session.\n⓸ About INNOVA Education Consultant."
  // Send greeting as a reply (if messageId) or normal text
  if (messageId) {
    await replyMessage(to, greeting, messageId)
  } else {
    await sendMessage(to, greeting)
  }
  // Send the options as an interactive message that contains a single "Talk to an agent" button
  await sendTalkToAgentButton(to, optionsText)
  session.step = 'main_menu'
  session.data = {}
  // Suppress the global Main Menu button once (we're already at main menu)
  session.suppressMenuOnce = true
}

async function showStudyAbroadDestinations(to) {
  await sendSequence(to, [
    'Fantastic choice! Studying abroad is an incredible opportunity. Let me show you the countries we specialize in:',
    'Select a destination to explore:\n\n⓵ 🇬🇧 United Kingdom\n⓶ 🇺🇸 United States\n⓷ 🇨🇾 South Cyprus\n⓸ 🇬🇪 Georgia\n⓹ 🇸🇪 Sweden\n⓺ 🇫🇮 Finland\n⓻ 🇰🇷 South Korea\n⓼ 🇨🇳 China\n⓽ 🌎 Other Destinations\n\nType the number!'
  ])
}

const countryData = {
  uk: { name: 'United Kingdom 🇬🇧', code: 'UK' },
  usa: { name: 'United States 🇺🇸', code: 'USA' },
  cyprus: { name: 'South Cyprus 🇨🇾', code: 'Cyprus' },
  georgia: { name: 'Georgia 🇬🇪', code: 'Georgia' },
  sweden: { name: 'Sweden 🇸🇪', code: 'Sweden' },
  finland: { name: 'Finland 🇫🇮', code: 'Finland' },
  south_korea: { name: 'South Korea 🇰🇷', code: 'South Korea' },
  china: { name: 'China 🇨🇳', code: 'China' },
  other: { name: 'Other Destinations 🌎', code: 'Other' }
}

async function showCountryForm(to, countryKey, session) {
  const country = countryData[countryKey]
  if (!country) return
  await sendSequence(to, [
    `Great choice! ${country.name}`,
    `Please share the details below for our record and Quick assessment.\n\nYour Name:\nWhatsApp Number:\nLast Qualification:\nLast Degree Completion Year:\nLast Degree %age/CGPA:\nLast Attended University:\nAny English Test:\nYour Current City:\nPreferred City in ${country.code}:\nAvailable Budget:\n\n📝 Please provide all details in order, one per line (except name can be first and last name on same line).`
  ])
  session.step = 'study_abroad_form'
  session.data = { country: country.name, countryCode: country.code }
}

async function showEnglishTests(to) {
  await sendMessage(
    to,
    "Great choice! Let's prepare you for success! 📚\n\nJust type the number, I'm thrilled to help you.\n\n⓵ IELTS\n⓶ PTE\n⓷ Oxford ELLT\n⓸ Language Cert ESOL\n⓹ English Spoken Course"
  )
}

async function showIELTSTypes(to) {
  await sendMessage(
    to,
    'Excellent! Which IELTS test are you preparing for?\n\nJust type the number:\n\n⓵ IELTS UKVI\n⓶ IELTS Academic\n⓷ IELTS General Training'
  )
}

async function showPTETypes(to) {
  await sendMessage(
    to,
    'Excellent! Which PTE test are you preparing for?\n\nJust type the number:\n\n⓵ PTE UKVI\n⓶ PTE Academic'
  )
}

async function showTestPackages(to, testType) {
  const typeNames = {
    ielts_ukvi: 'IELTS UKVI',
    ielts_academic: 'IELTS Academic',
    ielts_general: 'IELTS General Training',
    pte_ukvi: 'PTE UKVI',
    pte_academic: 'PTE Academic',
    oxford: 'Oxford ELLT',
    language_cert: 'Language Cert ESOL'
  }
  await sendMessage(
    to,
    `Perfect! For ${typeNames[testType]}, we offer:\n\nJust type the number:\n\n⓵ Full Preparation Course\n⓶ Speaking Module Only`
  )
}

async function showEnrollmentForm(to, session, packageType, cost, courseName) {
  let offer = ''
  if (packageType === 'Full Preparation Course') {
    offer = '🎉 EXCLUSIVE LIMITED TIME OFFER! 🎉\n\n💰 Save PKR 7,000 Today!\n✨ Full Course: Only 25,000 PKR\n❌ Regular Price: 32,000 PKR\n\n✅ All Modules Covered\n✅ Expert Instructors\n✅ Mock Tests Included\n✅ Study Materials Provided'
  } else if (packageType === 'Speaking Module Only') {
    offer = '🎯 Speaking Module Specialization\n\n💰 Price: 15,000 PKR\n\n✅ Focused Practice Sessions\n✅ Expert Feedback\n✅ Score Improvement Guaranteed'
  } else if (packageType === 'Spoken English Course') {
    offer = '🎉 EXCLUSIVE LIMITED TIME OFFER! 🎉\n\n💰 Save PKR 5,000 Today!\n✨ Spoken English: Only 20,000 PKR\n❌ Regular Price: 25,000 PKR\n\n✅ Conversational English\n✅ Fluency Development\n✅ Confidence Building'
  }
  await sendSequence(to, [
    offer,
    'Ready to get started? Please provide your details:\n\nFirst Name:\nLast Name:\nEmail Address:\nPhone Number:\nPreferred Start Date:\n\n📝 Please provide all details in order, one per line.'
  ])
  session.step = 'enrollment_form'
  session.data = { ...session.data, packageType, cost, courseName }
}

async function showSpokenCourse(to, session) {
  await showEnrollmentForm(to, session, 'Spoken English Course', 20000, 'English Spoken Course')
}

async function showBookSession(to) {
  await sendCtaUrlButton(
    to,
    '📅 Book your counselling session now:',
    'Open booking page',
    'https://innovaconsultant.com/testing/study-in-united-kingdom/'
  )
  await sendMessage(
    to,
    'What would you like to do next?\n\nType the number:\n⓵ Study Abroad Destination\n⓶ English Test Preparation\n⓷ Main Menu'
  )
}

async function showAboutUs(to) {
  await sendSequence(to, [
    'Visit our website: https://www.innovaconsultant.com 🌟\n\nExplore our services, success stories, and more!',
    'What would you like to explore next?\n\nType the number:\n⓵ Study Abroad Destination\n⓶ English Test Preparation\n⓷ Book Counselling Session\n⓸ Main Menu'
  ])
}

function parseCountryInput(text) {
  const map = { '1': 'uk', '2': 'usa', '3': 'cyprus', '4': 'georgia', '5': 'sweden', '6': 'finland', '7': 'south_korea', '8': 'china', '9': 'other' }
  return map[text] || null
}

async function handleStudyAbroadForm(to, text, session) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 10) {
    await sendMessage(
      to,
      `Please provide all 10 required details, one per line:\n\n1. Your Name\n2. WhatsApp Number\n3. Last Qualification\n4. Last Degree Completion Year\n5. Last Degree %age/CGPA\n6. Last Attended University\n7. Any English Test\n8. Your Current City\n9. Preferred City in ${session.data.countryCode}\n10. Available Budget`
    )
    return
  }
  const formData = {
    name: lines[0],
    whatsapp: lines[1],
    qualification: lines[2],
    completionYear: lines[3],
    grade: lines[4],
    university: lines[5],
    englishTest: lines[6],
    currentCity: lines[7],
    preferredCity: lines[8],
    budget: lines[9],
    country: session.data.country
  }
  const appId = `SA${Date.now()}`
  const createdAt = new Date().toISOString()
  // Save in DB
  insertStudyStmt.run({ id: appId, ...formData, createdAt })
  // Keep in-memory for backward-compat
  applications.push({ id: appId, type: 'study', ...formData, createdAt })
  // Append to Google Sheets (if configured)
  const SHEET_ID = process.env.GOOGLE_SHEETS_ID
  const STUDY_TAB = process.env.GOOGLE_SHEETS_STUDY_TAB || 'StudyApplications'
  await appendRow({
    sheetId: SHEET_ID,
    tabName: STUDY_TAB,
    values: [
      appId,
      formData.name,
      formData.whatsapp,
      formData.qualification,
      formData.completionYear,
      formData.grade,
      formData.university,
      formData.englishTest,
      formData.currentCity,
      formData.preferredCity,
      formData.budget,
      formData.country,
      createdAt
    ]
  })
  await sendSequence(to, [
    `✅ Your application has been submitted successfully!\n\n📋 Application ID: ${appId}\n👤 Name: ${formData.name}\n🌍 Destination: ${formData.country}\n🎓 Qualification: ${formData.qualification}\n🏛️ University: ${formData.university}\n💰 Budget: ${formData.budget}`,
    "What happens next?\n\n✓ Our counselors will review your profile\n✓ We'll contact you within 24 hours on WhatsApp\n✓ Discuss university options and admission process\n✓ Guide you through visa requirements\n\nWe're excited to help you achieve your study abroad dreams! 🎯"
  ])
  session.step = 'after_study_abroad'
  session.data = {}
}

async function handleEnrollmentForm(to, text, session) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 5) {
    await sendMessage(
      to,
      'Please provide all 5 required details, one per line:\n\n1. First Name\n2. Last Name\n3. Email Address\n4. Phone Number\n5. Preferred Start Date'
    )
    return
  }
  if (!lines[2].includes('@')) {
    await sendMessage(to, "The email address doesn't look valid. Please provide all details again with a valid email.")
    return
  }
  const formData = { firstName: lines[0], lastName: lines[1], email: lines[2], phone: lines[3], startDate: lines[4] }
  const appId = `ENR${Date.now()}`
  const createdAt = new Date().toISOString()
  // Persist to DB
  insertEnrollmentStmt.run({
    id: appId,
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone,
    startDate: formData.startDate,
    courseName: session.data.courseName || null,
    packageType: session.data.packageType || null,
    cost: Number(session.data.cost || 0),
    createdAt
  })
  applications.push({ id: appId, type: 'enrollment', ...formData, ...session.data, createdAt })
  // Append to Google Sheets (if configured)
  const SHEET_ID2 = process.env.GOOGLE_SHEETS_ID
  const ENROLL_TAB = process.env.GOOGLE_SHEETS_ENROLL_TAB || 'Enrollments'
  await appendRow({
    sheetId: SHEET_ID2,
    tabName: ENROLL_TAB,
    values: [
      appId,
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.phone,
      formData.startDate,
      session.data.courseName || '',
      session.data.packageType || '',
      Number(session.data.cost || 0),
      createdAt
    ]
  })
  await sendSequence(to, [
    `✅ Your enrollment has been confirmed!\n\n📋 Enrollment ID: ${appId}\n👤 Name: ${formData.firstName} ${formData.lastName}\n📚 Course: ${session.data.courseName || session.data.packageType}\n💰 Fee: PKR ${Number(session.data.cost || 0).toLocaleString()}\n📅 Preferred Start: ${formData.startDate}`,
    "What happens next?\n\n✓ Our team will contact you within 24 hours\n✓ We'll schedule your first session\n✓ You'll receive study materials\n✓ Payment details via email\n\nWe're excited to help you succeed! 🎯"
  ])
  session.step = 'after_enrollment'
  session.data = {}
}

async function handleIncomingText(waId, text, messageId) {
  const session = getSession(waId)
  const lower = text.trim().toLowerCase()

  // Global quick actions from interactive buttons
  if (lower === 'main_menu') {
    return sendWelcomeFlow(waId, null, session)
  }
  if (['talk_to_agent', 'live_agent', 'agent'].includes(lower)) {
    await sendMessage(waId, '👍 An agent will contact you shortly.')
    return
  }

  // Start/welcome shortcuts
  if (['hi', 'hello', 'start', 'menu', 'help'].some((k) => lower.includes(k))) {
    return sendWelcomeFlow(waId, messageId, session)
  }

  switch (session.step) {
    case 'welcome':
      return sendWelcomeFlow(waId, messageId, session)
    case 'main_menu': {
      if (lower === '1') {
        await showStudyAbroadDestinations(waId)
        session.step = 'select_country'
        return
      }
      if (lower === '2') {
        await showEnglishTests(waId)
        session.step = 'select_test_type'
        return
      }
      if (lower === '3') {
        await showBookSession(waId)
        session.step = 'after_booking_link'
        return
      }
      if (lower === '4') {
        await showAboutUs(waId)
        session.step = 'after_about'
        return
      }
      return sendMessage(waId, 'Please type a number between 1-4 to continue.')
    }
    case 'select_country': {
      const key = parseCountryInput(lower)
      if (key) return showCountryForm(waId, key, session)
      return sendMessage(waId, 'Please type a number between 1-9.')
    }
    case 'study_abroad_form':
      return handleStudyAbroadForm(waId, text, session)
    case 'after_study_abroad': {
      if (['talk_to_agent', 'live_agent', 'agent'].includes(lower)) { await sendMessage(waId, '👍 An agent will contact you shortly.'); return }
      if (lower === 'main_menu' || lower === '3') { return sendWelcomeFlow(waId, null, session) }
      if (lower === '1') { await showStudyAbroadDestinations(waId); session.step = 'select_country'; return }
      if (lower === '2') { await showEnglishTests(waId); session.step = 'select_test_type'; return }
      return sendMessage(waId, 'Please type 1, 2, or 3.')
    }
    case 'select_test_type': {
      if (lower === '1') { await showIELTSTypes(waId); session.step = 'select_ielts_type'; return }
      if (lower === '2') { await showPTETypes(waId); session.step = 'select_pte_type'; return }
      if (lower === '3') { await showTestPackages(waId, 'oxford'); session.step = 'select_package'; session.data = { testName: 'Oxford ELLT' }; return }
      if (lower === '4') { await showTestPackages(waId, 'language_cert'); session.step = 'select_package'; session.data = { testName: 'Language Cert ESOL' }; return }
      if (lower === '5') { await showSpokenCourse(waId, session); return }
      return sendMessage(waId, 'Please type a number between 1-5.')
    }
    case 'select_ielts_type': {
      if (['1','2','3'].includes(lower)) {
        const map = { '1': 'ielts_ukvi', '2': 'ielts_academic', '3': 'ielts_general' }
        await showTestPackages(waId, map[lower])
        session.step = 'select_package'
        session.data = { testName: 'IELTS' }
        return
      }
      return sendMessage(waId, 'Please type 1, 2, or 3.')
    }
    case 'select_pte_type': {
      if (lower === '1' || lower === '2') {
        const map = { '1': 'pte_ukvi', '2': 'pte_academic' }
        await showTestPackages(waId, map[lower])
        session.step = 'select_package'
        session.data = { testName: 'PTE' }
        return
      }
      return sendMessage(waId, 'Please type 1 or 2.')
    }
    case 'select_package': {
      if (lower === '1') { await showEnrollmentForm(waId, session, 'Full Preparation Course', 25000, session.data.testName); return }
      if (lower === '2') { await showEnrollmentForm(waId, session, 'Speaking Module Only', 15000, `${session.data.testName} Speaking`); return }
      return sendMessage(waId, 'Please type 1 or 2.')
    }
    case 'enrollment_form':
      return handleEnrollmentForm(waId, text, session)
    case 'after_enrollment': {
      if (['talk_to_agent', 'live_agent', 'agent'].includes(lower)) { await sendMessage(waId, '👍 An agent will contact you shortly.'); return }
      if (lower === 'main_menu' || lower === '3') { return sendWelcomeFlow(waId, null, session) }
      if (lower === '1') { await showStudyAbroadDestinations(waId); session.step = 'select_country'; return }
      if (lower === '2') { await showBookSession(waId); session.step = 'after_booking_link'; return }
      return sendMessage(waId, 'Please type 1, 2, or 3.')
    }
    case 'after_booking_link': {
      if (lower === '1') { await showStudyAbroadDestinations(waId); session.step = 'select_country'; return }
      if (lower === '2') { await showEnglishTests(waId); session.step = 'select_test_type'; return }
      if (lower === '3') { return sendWelcomeFlow(waId, null, session) }
      return sendMessage(waId, 'Please type 1, 2, or 3.')
    }
    case 'after_about': {
      if (lower === '1') { await showStudyAbroadDestinations(waId); session.step = 'select_country'; return }
      if (lower === '2') { await showEnglishTests(waId); session.step = 'select_test_type'; return }
      if (lower === '3') { await showBookSession(waId); session.step = 'after_booking_link'; return }
      if (lower === '4') { return sendWelcomeFlow(waId, null, session) }
      return sendMessage(waId, 'Please type a number between 1-4.')
    }
    default:
      return sendMessage(waId, "I didn't quite understand that. Type 'menu' to see options!")
  }
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const challenge = req.query['hub.challenge']
  const token = req.query['hub.verify_token']

  if (mode && token === WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

app.post('/webhook', async (req, res) => {
  const { entry } = req.body

  if (!entry || entry.length === 0) {
    return res.status(400).send('Invalid Request')
  }

  const changes = entry[0].changes

  if (!changes || changes.length === 0) {
    return res.status(400).send('Invalid Request')
  }

  const statuses = changes[0].value.statuses ? changes[0].value.statuses[0] : null
  const messages = changes[0].value.messages ? changes[0].value.messages[0] : null

  if (statuses) {
    // Handle message status
    console.log(`
      MESSAGE STATUS UPDATE:
      ID: ${statuses.id},
      STATUS: ${statuses.status}
    `)
  }

  if (messages) {
    // Handle received messages
    if (messages.type === 'text') {
      const text = (messages.text && messages.text.body) ? messages.text.body : ''
  await handleIncomingText(messages.from, text, messages.id)
  // Global: show Main Menu button once after each complete bot response, except when suppressed
  try { await maybeSendMainMenu(messages.from, 'Tap below to go to Main Menu') } catch (e) { console.error('maybeSendMainMenu failed', e?.response?.data || e.message) }
    }

    if (messages.type === 'interactive') {
      // Optional: handle list/button replies by forwarding their id/title into the text state machine
      try {
        if (messages.interactive.type === 'list_reply') {
          const id = messages.interactive.list_reply.id || ''
          await handleIncomingText(messages.from, id, messages.id)
          try { await maybeSendMainMenu(messages.from, 'Tap below to go to Main Menu') } catch (e) { console.error('maybeSendMainMenu failed', e?.response?.data || e.message) }
        } else if (messages.interactive.type === 'button_reply') {
          const id = messages.interactive.button_reply.id || ''
          await handleIncomingText(messages.from, id, messages.id)
          try { await maybeSendMainMenu(messages.from, 'Tap below to go to Main Menu') } catch (e) { console.error('maybeSendMainMenu failed', e?.response?.data || e.message) }
        }
      } catch (e) {
        console.error('interactive handling error', e)
      }
    }

    console.log(JSON.stringify(messages, null, 2))
  }

  res.status(200).send('Webhook processed')
})

async function sendMessage(to, body) {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body
      }
    })
  })
}

async function replyMessage(to, body, messageId) {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body
      },
      context: {
        message_id: messageId
      }
    })
  })
}

async function sendList(to) {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: 'Message Header'
        },
        body: {
          text: 'This is a interactive list message'
        },
        footer: {
          text: 'This is the message footer'
        },
        action: {
          button: 'Tap for the options',
          sections: [
            {
              title: 'First Section',
              rows: [
                {
                  id: 'first_option',
                  title: 'First option',
                  description: 'This is the description of the first option'
                },
                {
                  id: 'second_option',
                  title: 'Second option',
                  description: 'This is the description of the second option'
                }
              ]
            },
            {
              title: 'Second Section',
              rows: [
                {
                  id: 'third_option',
                  title: 'Third option'
                }
              ]
            }
          ]
        }
      }
    })
  })
}

async function sendReplyButtons(to) {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: 'Message Header'
        },
        body: {
          text: 'This is a interactive reply buttons message'
        },
        footer: {
          text: 'This is the message footer'
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'first_button',
                title: 'First Button'
              }
            },
            {
              type: 'reply',
              reply: {
                id: 'second_button',
                title: 'Second Button'
              }
            }
          ]
        }
      }
    })
  })
}

// Interactive CTA URL button (tap-to-open)
async function sendCtaUrlButton(to, bodyText, buttonText, url) {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: bodyText },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: buttonText,
            url
          }
        }
      }
    })
  })
}

// Send buttons: "Talk to live agent" and "Main Menu" (mirrors the screenshot style)
async function sendAgentMainMenuButtons(to, promptText = 'Do you want to talk to an agent?') {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: promptText },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'talk_to_agent', title: 'Talk to an agent' } },
            { type: 'reply', reply: { id: 'main_menu', title: 'Main Menu' } }
          ]
        }
      }
    })
  })
}

// Solo: Talk to an agent
async function sendTalkToAgentButton(to, promptText = 'Do you want to talk to an agent?') {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: promptText },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'talk_to_agent', title: 'Talk to an agent' } }
          ]
        }
      }
    })
  })
}

// Solo: Main Menu
async function sendMainMenuButton(to, promptText = 'Tap below to go to Main Menu') {
  if (!WHATSAPP_API_URL) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  await axios({
    url: WHATSAPP_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: promptText },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'main_menu', title: 'Main Menu' } }
          ]
        }
      }
    })
  })
}

// Helper: only send Main Menu once per response, skip if suppressed for this session
async function maybeSendMainMenu(to, promptText = 'Tap below to go to Main Menu') {
  const session = getSession(to)
  if (session.suppressMenuOnce) {
    // clear the flag and skip sending this time
    session.suppressMenuOnce = false
    return
  }
  await sendMainMenuButton(to, promptText)
}

app.listen(PORT, () => {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[WARN] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID. Set them in your environment or .env file.')
  }
  console.log(`Server started on port ${PORT}`)
})