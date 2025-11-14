// server.js - Updated Innova Education WhatsApp Bot
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const config = {
    PORT: process.env.PORT || 3000,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,
    VERIFY_TOKEN: process.env.VERIFY_TOKEN || 'innova_education_2024',
    VERSION: 'v18.0',
    MOCK_MODE: process.env.MOCK_WHATSAPP === 'true' || !process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID
};

if (config.MOCK_MODE) {
    console.log('🧪 WhatsApp mock mode enabled — outbound messages will be printed to the console.');
}

// Data Storage
const userSessions = new Map();
const applications = [];

// IELTS Pricing
const pricing = {
    academic_full: 32000,
    academic_speaking: 18000,
    general_full: 32000,
    general_speaking: 18000,
    ukvi_full: 32000,
    ukvi_speaking: 18000,
    other_full: 32000,
    other_speaking: 18000
};

// Countries Database
const countries = {
    uk: {
        name: "United Kingdom 🇬🇧",
        scholarships: ["Chevening Scholarships - Full funding", "Commonwealth Scholarships", "GREAT Scholarships - £10,000"],
        universities: ["Oxford", "Cambridge", "Imperial College", "LSE"]
    },
    usa: {
        name: "United States 🇺🇸",
        scholarships: ["Fulbright Scholarships - Full funding", "Humphrey Fellowship", "University scholarships"],
        universities: ["Harvard", "Stanford", "MIT", "Yale"]
    },
    sweden: {
        name: "Sweden 🇸🇪",
        scholarships: ["Swedish Institute Scholarships", "University scholarships for non-EU"],
        universities: ["Lund University", "Uppsala", "KTH"]
    },
    finland: {
        name: "Finland 🇫🇮",
        scholarships: ["Finnish Government Scholarship Pool", "University of Helsinki Scholarships"],
        universities: ["University of Helsinki", "Aalto University"]
    },
    china: {
        name: "China 🇨🇳",
        scholarships: ["Chinese Government Scholarship", "Confucius Institute Scholarships"],
        universities: ["Tsinghua", "Peking University"]
    },
    south_korea: {
        name: "South Korea 🇰🇷",
        scholarships: ["Korean Government Scholarship (KGSP)", "University scholarships"],
        universities: ["Seoul National", "KAIST", "Yonsei"]
    },
    other: {
        name: "Other Countries 🌍",
        info: "We also assist with Canada, Australia, Germany, Japan & more!"
    }
};

// WhatsApp API Functions
async function sendWhatsAppMessage(to, messageData) {
    if (config.MOCK_MODE) {
        console.log(`\n💬 [MOCK] Message to ${to}`);
        console.dir({
            type: messageData.type,
            payload: messageData
        }, { depth: null });
        return;
    }

    try {
        const url = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/messages`;
        await axios.post(url, {
            messaging_product: "whatsapp",
            to: to,
            ...messageData
        }, {
            headers: {
                'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Message sent to ${to}`);
    } catch (error) {
        console.error('❌ Send error:', error.response?.data || error.message);
    }
}

async function sendText(to, text) {
    return sendWhatsAppMessage(to, { type: "text", text: { body: text } });
}

async function sendButtons(to, text, buttons) {
    return sendWhatsAppMessage(to, {
        type: "interactive",
        interactive: {
            type: "button",
            body: { text },
            action: {
                buttons: buttons.slice(0, 3).map(btn => ({
                    type: "reply",
                    reply: { id: btn.id, title: btn.title.substring(0, 20) }
                }))
            }
        }
    });
}

async function sendList(to, text, buttonText, sections) {
    return sendWhatsAppMessage(to, {
        type: "interactive",
        interactive: {
            type: "list",
            body: { text },
            action: {
                button: buttonText,
                sections: sections.map(section => ({
                    title: section.title,
                    rows: section.rows.map(row => ({
                        id: row.id,
                        title: row.title.substring(0, 24),
                        description: row.description?.substring(0, 72)
                    }))
                }))
            }
        }
    });
}

// Session Management
function getSession(phone) {
    if (!userSessions.has(phone)) {
        userSessions.set(phone, { step: 'welcome', data: {}, lastActivity: Date.now() });
    }
    const session = userSessions.get(phone);
    session.lastActivity = Date.now();
    return session;
}

function resetSession(phone) {
    if (phone) {
        userSessions.delete(phone);
    } else {
        userSessions.clear();
    }
}

// Bot Flows
async function sendWelcome(phone) {
    await sendText(phone,
        "Hello there! 👋 I'm thrilled to help you with your educational journey!\n\n" +
        "Whether you're dreaming of studying abroad, preparing for IELTS, or just want to learn more about us, I'm here to guide you every step of the way."
    );
    
    await sendButtons(phone,
        "What would you like to explore today?",
        [
            { id: "study_abroad", title: "🌍 Study Abroad" },
            { id: "ielts_prep", title: "📚 IELTS Prep" },
            { id: "book_session", title: "📅 Book Session" }
        ]
    );
    
    // Send About Us as separate message with button
    setTimeout(async () => {
        await sendButtons(phone,
            "Or learn more about us:",
            [{ id: "about_us", title: "ℹ️ About Innova" }]
        );
    }, 1000);
    
    getSession(phone).step = 'main_menu';
}

async function showStudyAbroad(phone) {
    await sendText(phone,
        "Fantastic choice! Studying abroad is an incredible opportunity.\n\n" +
        "Let me show you the countries we specialize in, along with amazing scholarship opportunities:"
    );
    
    await sendList(phone,
        "Select a destination to explore:",
        "Choose Country",
        [{
            title: "Study Destinations",
            rows: [
                { id: "country_uk", title: "🇬🇧 United Kingdom", description: "Chevening, Commonwealth" },
                { id: "country_usa", title: "🇺🇸 United States", description: "Fulbright scholarships" },
                { id: "country_sweden", title: "🇸🇪 Sweden", description: "Swedish Institute funding" },
                { id: "country_finland", title: "🇫🇮 Finland", description: "Government scholarships" },
                { id: "country_china", title: "🇨🇳 China", description: "Full government funding" },
                { id: "country_south_korea", title: "🇰🇷 South Korea", description: "KGSP scholarships" },
                { id: "country_other", title: "🌍 Other Countries", description: "Canada, Australia & more" }
            ]
        }]
    );
    
    getSession(phone).step = 'select_country';
}

async function showCountryDetails(phone, countryKey) {
    const country = countries[countryKey];
    if (!country) return;
    
    if (countryKey === 'other') {
        await sendText(phone,
            `${country.name}\n\n` +
            `We also assist with many other destinations!\n\n` +
            `Popular options:\n` +
            `• Canada - Great immigration pathways\n` +
            `• Australia - High quality of life\n` +
            `• Germany - Tuition-free programs\n` +
            `• Japan - Unique cultural experience`
        );
    } else {
        await sendText(phone,
            `${country.name}\n\n` +
            `📚 Available Scholarships:\n` +
            country.scholarships.map((s, i) => `${i + 1}. ${s}`).join('\n') +
            `\n\n🎓 Top Universities:\n` +
            country.universities.map((u, i) => `${i + 1}. ${u}`).join('\n')
        );
    }
    
    await sendButtons(phone,
        "Interested in applying? Let's get started!",
        [
            { id: "book_session", title: "📅 Book Session" },
            { id: "explore_more", title: "🔙 More Countries" },
            { id: "main_menu", title: "🏠 Main Menu" }
        ]
    );
    
    getSession(phone).step = 'after_country';
}

async function showIELTS(phone) {
    await sendText(phone,
        "Great! Let's get you prepared for your language exam.\n\n" +
        "First, which type of preparation do you need?"
    );
    
    await sendList(phone,
        "Choose your exam type:",
        "Select Exam",
        [{
            title: "IELTS/Language Tests",
            rows: [
                { id: "ielts_academic", title: "IELTS Academic", description: "For university admissions" },
                { id: "ielts_general", title: "IELTS General Training", description: "For immigration/work" },
                { id: "ielts_ukvi", title: "IELTS UKVI", description: "For UK visa applications" },
                { id: "ielts_other", title: "Other Tests", description: "PTE, TOEFL, etc." }
            ]
        }]
    );
    
    getSession(phone).step = 'select_ielts_type';
}

async function showIELTSPackages(phone, examType) {
    const session = getSession(phone);
    session.data.examType = examType;
    
    const examNames = {
        academic: "IELTS Academic",
        general: "IELTS General Training",
        ukvi: "IELTS UKVI",
        other: "Other Language Tests"
    };
    
    await sendText(phone,
        `Perfect! For ${examNames[examType]}, we offer two comprehensive packages.`
    );
    
    await sendList(phone,
        "Choose the package that fits your needs:",
        "Select Package",
        [{
            title: "Preparation Packages",
            rows: [
                { 
                    id: "package_full", 
                    title: "Full Prep - PKR 32,000",
                    description: "All 4 modules + 24 sessions"
                },
                { 
                    id: "package_speaking", 
                    title: "Speaking - PKR 18,000",
                    description: "Speaking only + 12 sessions"
                }
            ]
        }]
    );
    
    session.step = 'select_ielts_package';
}

async function handleIELTSPackage(phone, isFull) {
    const session = getSession(phone);
    const cost = isFull ? 32000 : 18000;
    const packageName = isFull ? "Full Preparation Course" : "Speaking Only Module";
    
    session.data.packageType = packageName;
    session.data.cost = cost;
    
    await sendText(phone,
        `Excellent choice! The ${packageName} for PKR ${cost.toLocaleString()}.\n\n` +
        `Now, let me collect some details so we can get you started on the right track.\n\n` +
        `First, what's your first name?`
    );
    
    session.step = 'ielts_first_name';
}

async function showBookSession(phone) {
    await sendText(phone,
        "Wonderful! Let's schedule a personalized consultation session.\n\n" +
        "This will help us understand your goals and create a tailored plan for your future.\n\n" +
        "I'll need some information from you. Ready? Let's start!\n\n" +
        "What's your first name?"
    );
    
    getSession(phone).step = 'booking_first_name';
}

async function showAboutUs(phone) {
    await sendText(phone,
        "Thank you for your interest in Innova Education Consultant!\n\n" +
        "🏢 WHO WE ARE:\n" +
        "A team of passionate education consultants dedicated to making study abroad dreams come true.\n\n" +
        "⭐ OUR EXPERTISE:\n" +
        "• 15+ years of experience\n" +
        "• 95% visa success rate\n" +
        "• 500+ university partnerships\n" +
        "• Expert IELTS trainers"
    );
    
    await sendText(phone,
        "📋 WHAT WE OFFER:\n" +
        "• University selection & admissions\n" +
        "• Scholarship assistance\n" +
        "• IELTS/Language prep\n" +
        "• Visa application support\n" +
        "• Pre-departure briefings\n" +
        "• Post-arrival assistance\n\n" +
        "🎯 MISSION:\n" +
        "To provide personalized, honest guidance that transforms educational aspirations into reality."
    );
    
    await sendButtons(phone,
        "Ready to start your journey with us?",
        [
            { id: "book_session", title: "📅 Book Session" },
            { id: "study_abroad", title: "🌍 Study Abroad" },
            { id: "ielts_prep", title: "📚 IELTS Prep" }
        ]
    );
    
    getSession(phone).step = 'after_about';
}

async function handleApplicationStep(phone, message) {
    const session = getSession(phone);
    const text = message.trim();
    
    switch (session.step) {
        // IELTS Booking Flow
        case 'ielts_first_name':
            session.data.firstName = text;
            await sendText(phone, `Nice to meet you, ${text}! What's your last name?`);
            session.step = 'ielts_last_name';
            break;
            
        case 'ielts_last_name':
            session.data.lastName = text;
            await sendText(phone, `Great! ${session.data.firstName} ${text}, what's your email address?`);
            session.step = 'ielts_email';
            break;
            
        case 'ielts_email':
            if (!text.includes('@')) {
                await sendText(phone, "That doesn't look like a valid email. Could you try again?");
                break;
            }
            session.data.email = text;
            await sendText(phone, "Perfect! And your phone number?\n(Include country code, e.g., +92 300 1234567)");
            session.step = 'ielts_phone';
            break;
            
        case 'ielts_phone':
            session.data.phone = text;
            await sendText(phone, "Excellent! When would you prefer to start your classes?\n(e.g., 'Next week', 'From 1st December', 'ASAP')");
            session.step = 'ielts_start_date';
            break;
            
        case 'ielts_start_date':
            session.data.preferredStartDate = text;
            await completeIELTSBooking(phone);
            break;
            
        // Consultation Booking Flow
        case 'booking_first_name':
            session.data.firstName = text;
            await sendText(phone, `Wonderful, ${text}! And your last name?`);
            session.step = 'booking_last_name';
            break;
            
        case 'booking_last_name':
            session.data.lastName = text;
            await sendText(phone, "Great! What's your current degree/education level?\n(e.g., 'Bachelor's in Computer Science', 'Intermediate')");
            session.step = 'booking_degree';
            break;
            
        case 'booking_degree':
            session.data.degree = text;
            await sendText(phone, "Got it! What's your GPA or percentage?");
            session.step = 'booking_gpa';
            break;
            
        case 'booking_gpa':
            session.data.gpa = text;
            await sendText(phone, "Thanks! What's your estimated budget range for studies?\n(e.g., '$20,000-$30,000', '25-35 lakh PKR', 'Need scholarship')");
            session.step = 'booking_budget';
            break;
            
        case 'booking_budget':
            session.data.budget = text;
            await sendText(phone, "Which country are you most interested in?\n(e.g., 'UK', 'USA', 'Canada', 'Multiple options')");
            session.step = 'booking_country';
            break;
            
        case 'booking_country':
            session.data.preferredCountry = text;
            await sendText(phone, "What's your email address?");
            session.step = 'booking_email';
            break;
            
        case 'booking_email':
            if (!text.includes('@')) {
                await sendText(phone, "That doesn't look like a valid email. Please try again.");
                break;
            }
            session.data.email = text;
            await sendText(phone, "And finally, your phone number?\n(Include country code)");
            session.step = 'booking_phone';
            break;
            
        case 'booking_phone':
            session.data.phone = text;
            await sendText(phone, "Would you like to share any specific questions or concerns?\n(Type 'none' if you don't have any right now)");
            session.step = 'booking_notes';
            break;
            
        case 'booking_notes':
            session.data.additionalNotes = text.toLowerCase() === 'none' ? '' : text;
            await completeBooking(phone);
            break;
    }
}

async function completeIELTSBooking(phone) {
    const session = getSession(phone);
    const appId = `IELTS${Date.now()}`;
    
    applications.push({
        type: 'IELTS Preparation',
        id: appId,
        ...session.data,
        submittedAt: new Date().toISOString()
    });
    
    await sendText(phone,
        `✅ Your IELTS preparation booking has been confirmed!\n\n` +
        `📋 Booking ID: ${appId}\n` +
        `👤 Name: ${session.data.firstName} ${session.data.lastName}\n` +
        `📚 Package: ${session.data.packageType}\n` +
        `💰 Cost: PKR ${session.data.cost.toLocaleString()}\n` +
        `📅 Preferred Start: ${session.data.preferredStartDate}`
    );
    
    await sendText(phone,
        "What happens next?\n\n" +
        "✓ Our team will contact you within 24 hours\n" +
        "✓ We'll schedule your first session\n" +
        "✓ You'll receive study materials\n" +
        "✓ Payment details via email\n\n" +
        "We're excited to help you ace your exam!"
    );
    
    await sendButtons(phone,
        "Anything else I can help with?",
        [
            { id: "study_abroad", title: "🌍 Study Abroad" },
            { id: "book_session", title: "📅 Book Another" },
            { id: "main_menu", title: "🏠 Main Menu" }
        ]
    );
    
    session.step = 'main_menu';
    session.data = {};
    
    console.log('📋 IELTS Booking:', applications[applications.length - 1]);
}

async function completeBooking(phone) {
    const session = getSession(phone);
    const appId = `APP${Date.now()}`;
    
    applications.push({
        type: 'Consultation Session',
        id: appId,
        ...session.data,
        submittedAt: new Date().toISOString()
    });
    
    await sendText(phone,
        `✅ Your consultation session has been booked!\n\n` +
        `📋 Application ID: ${appId}\n` +
        `👤 Name: ${session.data.firstName} ${session.data.lastName}\n` +
        `🎓 Education: ${session.data.degree}\n` +
        `📊 GPA: ${session.data.gpa}\n` +
        `💰 Budget: ${session.data.budget}\n` +
        `🌍 Country: ${session.data.preferredCountry}`
    );
    
    await sendText(phone,
        "What's next?\n\n" +
        "✓ Our counselor will review your profile\n" +
        "✓ We'll contact you within 24-48 hours\n" +
        "✓ Schedule detailed consultation\n" +
        "✓ Receive tailored university recommendations\n\n" +
        "We're thrilled to be part of your journey!"
    );
    
    await sendButtons(phone,
        "What would you like to explore?",
        [
            { id: "study_abroad", title: "🌍 Study Abroad" },
            { id: "ielts_prep", title: "📚 IELTS Prep" },
            { id: "main_menu", title: "🏠 Main Menu" }
        ]
    );
    
    session.step = 'main_menu';
    session.data = {};
    
    console.log('📋 Consultation Booking:', applications[applications.length - 1]);
}

async function handleMessage(phone, message) {
    const session = getSession(phone);
    const text = message.toLowerCase().trim();
    
    console.log(`📱 ${phone}: ${text}`);
    
    if (['hi', 'hello', 'start', 'menu', 'help'].includes(text)) {
        session.step = 'welcome';
        await sendWelcome(phone);
        return;
    }
    
    if (session.step && session.step.startsWith('ielts_') || session.step.startsWith('booking_')) {
        await handleApplicationStep(phone, message);
        return;
    }
    
    await sendText(phone, "I didn't quite understand that. Type *menu* to see options!");
}

async function handleInteractive(phone, interactive) {
    const session = getSession(phone);
    
    if (interactive.type === 'button_reply') {
        const btnId = interactive.button_reply.id;
        console.log(`🔘 ${phone} clicked: ${btnId}`);
        
        switch (btnId) {
            case 'study_abroad':
                await showStudyAbroad(phone);
                break;
            case 'ielts_prep':
                await showIELTS(phone);
                break;
            case 'book_session':
                await showBookSession(phone);
                break;
            case 'about_us':
                await showAboutUs(phone);
                break;
            case 'explore_more':
                await showStudyAbroad(phone);
                break;
            case 'main_menu':
                await sendWelcome(phone);
                break;
        }
    }
    else if (interactive.type === 'list_reply') {
        const listId = interactive.list_reply.id;
        console.log(`📋 ${phone} selected: ${listId}`);
        
        if (listId.startsWith('country_')) {
            const country = listId.replace('country_', '');
            await showCountryDetails(phone, country);
        }
        else if (listId.startsWith('ielts_')) {
            const examType = listId.replace('ielts_', '');
            await showIELTSPackages(phone, examType);
        }
        else if (listId === 'package_full') {
            await handleIELTSPackage(phone, true);
        }
        else if (listId === 'package_speaking') {
            await handleIELTSPackage(phone, false);
        }
    }
}

// Webhook Endpoints
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        res.status(200).send(challenge);
    } else {
        res.status(403).send('Verification failed');
    }
});

app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages' && change.value.messages) {
                        for (const msg of change.value.messages) {
                            const phone = msg.from;
                            
                            if (msg.type === 'text') {
                                await handleMessage(phone, msg.text.body);
                            } else if (msg.type === 'interactive') {
                                await handleInteractive(phone, msg.interactive);
                            }
                        }
                    }
                }
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).send('Error');
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        activeSessions: userSessions.size,
        totalApplications: applications.length
    });
});

app.get('/admin/applications', (req, res) => {
    res.json({ total: applications.length, applications });
});

// Cleanup old sessions
setInterval(() => {
    const oneHour = 60 * 60 * 1000;
    for (const [phone, session] of userSessions.entries()) {
        if (Date.now() - session.lastActivity > oneHour) {
            userSessions.delete(phone);
        }
    }
}, 60 * 60 * 1000);

if (require.main === module) {
    app.listen(config.PORT, () => {
        console.log(`\n🚀 Innova WhatsApp Bot running on port ${config.PORT}`);
        console.log(`📱 Webhook: /webhook`);
        console.log(`🔧 Health: /health\n`);
    });
}

module.exports = {
    app,
    config,
    handleMessage,
    handleInteractive,
    getSession,
    resetSession,
    sendWelcome,
    showStudyAbroad,
    showCountryDetails,
    showIELTS,
    showIELTSPackages,
    showBookSession,
    showAboutUs,
    handleApplicationStep,
    completeIELTSBooking,
    completeBooking
};