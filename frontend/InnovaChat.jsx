import React, { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare } from 'lucide-react'

export default function InnovaChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [session, setSession] = useState({ step: 'welcome', data: {} })
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    sendWelcome()
  }, [])

  const addMessage = (text, type = 'bot', delay = 0) => {
    setTimeout(() => {
      setMessages((prev) => [...prev, { type, text, id: Date.now() + Math.random() }])
    }, delay)
  }

  const sendWelcome = () => {
    addMessage("Hey there! 👋 Welcome to INNOVA Education Consultant!\n\nI'm here to help you with your Study Abroad Journey! ✈")
    addMessage(
      "What would you like to explore Today?\nJust type the number, I'm thrilled to help you.\n\n⓵ Study Abroad Destination.\n⓶ English Test Preparation.\n⓷ Book Counselling Session.\n⓸ About INNOVA Education Consultant.",
      'bot',
      1000
    )
    setSession({ step: 'main_menu', data: {} })
  }

  const showStudyAbroadDestinations = () => {
    addMessage('Fantastic choice! Studying abroad is an incredible opportunity. Let me show you the countries we specialize in:')
    addMessage(
      'Select a destination to explore:\n\n⓵ 🇬🇧 United Kingdom\n⓶ 🇺🇸 United States\n⓷ 🇨🇾 South Cyprus\n⓸ 🇬🇪 Georgia\n⓹ 🇸🇪 Sweden\n⓺ 🇫🇮 Finland\n⓻ 🇰🇷 South Korea\n⓼ 🇨🇳 China\n⓽ 🌎 Other Destinations\n\nType the number!',
      'bot',
      1000
    )
    setSession((prev) => ({ ...prev, step: 'select_country' }))
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

  const showCountryForm = (countryKey) => {
    const country = countryData[countryKey]
    if (!country) return
    addMessage(`Great choice! ${country.name}`)
    addMessage(
      `Please share the details below for our record and Quick assessment.\n\nYour Name:\nWhatsApp Number:\nLast Qualification:\nLast Degree Completion Year:\nLast Degree %age/CGPA:\nLast Attended University:\nAny English Test:\nYour Current City:\nPreferred City in ${country.code}:\nAvailable Budget:\n\n📝 Please provide all details in order, one per line (except name can be first and last name on same line).`,
      'bot',
      1000
    )
    setSession((prev) => ({ ...prev, step: 'study_abroad_form', data: { country: country.name, countryCode: country.code } }))
  }

  const showEnglishTests = () => {
    addMessage(
      "Great choice! Let's prepare you for success! 📚\n\nJust type the number, I'm thrilled to help you.\n\n⓵ IELTS\n⓶ PTE\n⓷ Oxford ELLT\n⓸ Language Cert ESOL\n⓹ English Spoken Course"
    )
    setSession((prev) => ({ ...prev, step: 'select_test_type' }))
  }

  const showIELTSTypes = () => {
    addMessage(
      'Excellent! Which IELTS test are you preparing for?\n\nJust type the number:\n\n⓵ IELTS UKVI\n⓶ IELTS Academic\n⓷ IELTS General Training'
    )
    setSession((prev) => ({ ...prev, step: 'select_ielts_type', data: { testName: 'IELTS' } }))
  }

  const showPTETypes = () => {
    addMessage(
      'Excellent! Which PTE test are you preparing for?\n\nJust type the number:\n\n⓵ PTE UKVI\n⓶ PTE Academic'
    )
    setSession((prev) => ({ ...prev, step: 'select_pte_type', data: { testName: 'PTE' } }))
  }

  const showTestPackages = (testType, testName) => {
    const typeNames = {
      ielts_ukvi: 'IELTS UKVI',
      ielts_academic: 'IELTS Academic',
      ielts_general: 'IELTS General Training',
      pte_ukvi: 'PTE UKVI',
      pte_academic: 'PTE Academic',
      oxford: 'Oxford ELLT',
      language_cert: 'Language Cert ESOL'
    }
    addMessage(`Perfect! For ${typeNames[testType]}, we offer:\n\nJust type the number:\n\n⓵ Full Preparation Course\n⓶ Speaking Module Only`)
    setSession((prev) => ({ ...prev, step: 'select_package', data: { ...prev.data, testType, testName: typeNames[testType] } }))
  }

  const showEnrollmentForm = (packageType, cost, courseName) => {
    let offerMessage = ''
    if (packageType === 'Full Preparation Course') {
      offerMessage = '🎉 EXCLUSIVE LIMITED TIME OFFER! 🎉\n\n💰 Save PKR 7,000 Today!\n✨ Full Course: Only 25,000 PKR\n❌ Regular Price: 32,000 PKR\n\n✅ All Modules Covered\n✅ Expert Instructors\n✅ Mock Tests Included\n✅ Study Materials Provided'
    } else if (packageType === 'Speaking Module Only') {
      offerMessage = '🎯 Speaking Module Specialization\n\n💰 Price: 15,000 PKR\n\n✅ Focused Practice Sessions\n✅ Expert Feedback\n✅ Score Improvement Guaranteed'
    } else if (packageType === 'Spoken English Course') {
      offerMessage = '🎉 EXCLUSIVE LIMITED TIME OFFER! 🎉\n\n💰 Save PKR 5,000 Today!\n✨ Spoken English: Only 20,000 PKR\n❌ Regular Price: 25,000 PKR\n\n✅ Conversational English\n✅ Fluency Development\n✅ Confidence Building'
    }
    addMessage(offerMessage)
    addMessage(
      'Ready to get started? Please provide your details:\n\nFirst Name:\nLast Name:\nEmail Address:\nPhone Number:\nPreferred Start Date:\n\n📝 Please provide all details in order, one per line.',
      'bot',
      1500
    )
    setSession((prev) => ({ ...prev, step: 'enrollment_form', data: { ...prev.data, packageType, cost, courseName } }))
  }

  const showSpokenCourse = () => {
    showEnrollmentForm('Spoken English Course', 20000, 'English Spoken Course')
  }

  const showBookSession = () => {
    window.open('https://innovaconsultant.com/testing/study-in-united-kingdom/', '_blank')
    addMessage("📅 I've opened the booking page in a new tab!\n\nOur counselors are ready to help you schedule your free consultation! 🎓")
    addMessage(
      'What would you like to do next?\n\nType the number:\n⓵ Study Abroad Destination\n⓶ English Test Preparation\n⓷ Main Menu',
      'bot',
      1500
    )
    setSession((prev) => ({ ...prev, step: 'after_booking_link' }))
  }

  const showAboutUs = () => {
    window.open('https://www.innovaconsultant.com', '_blank')
    addMessage("I've opened our website in a new tab! 🌟\n\nExplore our services, success stories, and more!")
    addMessage(
      'What would you like to explore next?\n\nType the number:\n⓵ Study Abroad Destination\n⓶ English Test Preparation\n⓷ Book Counselling Session\n⓸ Main Menu',
      'bot',
      1500
    )
    setSession((prev) => ({ ...prev, step: 'after_about' }))
  }

  const handleStudyAbroadForm = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 10) {
      addMessage(
        'Please provide all 10 required details, one per line:\n\n1. Your Name\n2. WhatsApp Number\n3. Last Qualification\n4. Last Degree Completion Year\n5. Last Degree %age/CGPA\n6. Last Attended University\n7. Any English Test\n8. Your Current City\n9. Preferred City in ' +
          session.data.countryCode +
          '\n10. Available Budget'
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
    addMessage(
      `✅ Your application has been submitted successfully!\n\n📋 Application ID: ${appId}\n👤 Name: ${formData.name}\n🌍 Destination: ${formData.country}\n🎓 Qualification: ${formData.qualification}\n🏛️ University: ${formData.university}\n💰 Budget: ${formData.budget}`
    )
    addMessage(
      "What happens next?\n\n✓ Our counselors will review your profile\n✓ We'll contact you within 24 hours on WhatsApp\n✓ Discuss university options and admission process\n✓ Guide you through visa requirements\n\nWe're excited to help you achieve your study abroad dreams! 🎯",
      'bot',
      1000
    )
    addMessage(
      'Anything else I can help with?\n\nType the number:\n⓵ Explore Another Destination\n⓶ English Test Preparation\n⓷ Main Menu',
      'bot',
      2000
    )
    setSession({ step: 'after_study_abroad', data: {} })
  }

  const handleEnrollmentForm = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 5) {
      addMessage('Please provide all 5 required details, one per line:\n\n1. First Name\n2. Last Name\n3. Email Address\n4. Phone Number\n5. Preferred Start Date')
      return
    }
    if (!lines[2].includes('@')) {
      addMessage("The email address doesn't look valid. Please provide all details again with a valid email.")
      return
    }
    const formData = { firstName: lines[0], lastName: lines[1], email: lines[2], phone: lines[3], startDate: lines[4] }
    const appId = `ENR${Date.now()}`
    addMessage(
      `✅ Your enrollment has been confirmed!\n\n📋 Enrollment ID: ${appId}\n👤 Name: ${formData.firstName} ${formData.lastName}\n📚 Course: ${session.data.courseName || session.data.packageType}\n💰 Fee: PKR ${Number(session.data.cost || 0).toLocaleString()}\n📅 Preferred Start: ${formData.startDate}`
    )
    addMessage(
      "What happens next?\n\n✓ Our team will contact you within 24 hours\n✓ We'll schedule your first session\n✓ You'll receive study materials\n✓ Payment details via email\n\nWe're excited to help you succeed! 🎯",
      'bot',
      1000
    )
    addMessage(
      'Anything else I can help with?\n\nType the number:\n⓵ Study Abroad Destination\n⓶ Book Counselling Session\n⓷ Main Menu',
      'bot',
      2000
    )
    setSession({ step: 'after_enrollment', data: {} })
  }

  const parseCountryInput = (text) => {
    const map = { '1': 'uk', '2': 'usa', '3': 'cyprus', '4': 'georgia', '5': 'sweden', '6': 'finland', '7': 'south_korea', '8': 'china', '9': 'other' }
    return map[text] || null
  }

  const handleSend = () => {
    if (!input.trim()) return
    const text = input.trim()
    addMessage(text, 'user')
    setInput('')
    setTimeout(() => {
      const lower = text.toLowerCase()
      if (['hi', 'hello', 'start', 'menu', 'help'].includes(lower)) {
        setSession({ step: 'welcome', data: {} })
        sendWelcome()
        return
      }
      if (session.step === 'study_abroad_form') return handleStudyAbroadForm(text)
      if (session.step === 'enrollment_form') return handleEnrollmentForm(text)
      if (session.step === 'main_menu') {
        if (text === '1') return showStudyAbroadDestinations()
        if (text === '2') return showEnglishTests()
        if (text === '3') return showBookSession()
        if (text === '4') return showAboutUs()
        return addMessage('Please type a number between 1-4 to continue.')
      }
      if (session.step === 'select_country') {
        const key = parseCountryInput(text)
        if (key) return showCountryForm(key)
        return addMessage('Please type a number between 1-9.')
      }
      if (session.step === 'after_study_abroad') {
        if (text === '1') return showStudyAbroadDestinations()
        if (text === '2') return showEnglishTests()
        if (text === '3') return sendWelcome()
        return addMessage('Please type 1, 2, or 3.')
      }
      if (session.step === 'select_test_type') {
        if (text === '1') return showIELTSTypes()
        if (text === '2') return showPTETypes()
        if (text === '3') return showTestPackages('oxford', 'Oxford ELLT')
        if (text === '4') return showTestPackages('language_cert', 'Language Cert ESOL')
        if (text === '5') return showSpokenCourse()
        return addMessage('Please type a number between 1-5.')
      }
      if (session.step === 'select_ielts_type') {
        if (text === '1') return showTestPackages('ielts_ukvi', 'IELTS')
        if (text === '2') return showTestPackages('ielts_academic', 'IELTS')
        if (text === '3') return showTestPackages('ielts_general', 'IELTS')
        return addMessage('Please type 1, 2, or 3.')
      }
      if (session.step === 'select_pte_type') {
        if (text === '1') return showTestPackages('pte_ukvi', 'PTE')
        if (text === '2') return showTestPackages('pte_academic', 'PTE')
        return addMessage('Please type 1 or 2.')
      }
      if (session.step === 'select_package') {
        if (text === '1') return showEnrollmentForm('Full Preparation Course', 25000, session.data.testName)
        if (text === '2') return showEnrollmentForm('Speaking Module Only', 15000, session.data.testName + ' Speaking')
        return addMessage('Please type 1 or 2.')
      }
      if (session.step === 'after_enrollment') {
        if (text === '1') return showStudyAbroadDestinations()
        if (text === '2') return showBookSession()
        if (text === '3') return sendWelcome()
        return addMessage('Please type 1, 2, or 3.')
      }
      if (session.step === 'after_booking_link') {
        if (text === '1') return showStudyAbroadDestinations()
        if (text === '2') return showEnglishTests()
        if (text === '3') return sendWelcome()
        return addMessage('Please type 1, 2, or 3.')
      }
      if (session.step === 'after_about') {
        if (text === '1') return showStudyAbroadDestinations()
        if (text === '2') return showEnglishTests()
        if (text === '3') return showBookSession()
        if (text === '4') return sendWelcome()
        return addMessage('Please type a number between 1-4.')
      }
      addMessage("I didn't quite understand that. Type *menu* to see options!")
    }, 500)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg">
        <div className="flex items-center px-6 py-4">
          <div className="flex-shrink-0 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md mr-4">
            <span className="text-red-500 font-bold text-xs text-center leading-tight">INNOVA<br/>LOGO</span>
          </div>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold tracking-wide">INNOVA Assistant</h1>
            <p className="text-blue-100 text-sm">Online • Education Consultant</p>
          </div>
          <MessageSquare className="text-white w-6 h-6" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-lg shadow ${
                msg.type === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-line">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 border border-gray-300 rounded-2xl px-4 py-2 focus:outline-none focus:border-blue-500 resize-none max-h-32 overflow-y-auto"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 transition-colors flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
