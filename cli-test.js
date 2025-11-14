#!/usr/bin/env node
require('dotenv').config();

if (!process.env.MOCK_WHATSAPP) {
    process.env.MOCK_WHATSAPP = 'true';
}

const readline = require('readline');
const {
    handleMessage,
    handleInteractive,
    resetSession,
    config
} = require('./test-bot');

const phone = process.env.CLI_PHONE || 'cli-test-user';

console.log('🧪 Innova WhatsApp Bot CLI Tester');
console.log('---------------------------------');
console.log('Type regular messages to simulate user chats.');
console.log("Use '/button <id>' to trigger a button reply, '/list <id>' for list selections.");
console.log("Commands: '/reset' (new session), '/exit' (quit)." );
console.log(`Mock mode: ${config.MOCK_MODE ? 'ON' : 'OFF'}\n`);

resetSession(phone);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'you> '
});

async function dispatch(line) {
    const input = line.trim();
    if (!input) {
        return;
    }

    if (input === '/exit') {
        rl.close();
        return;
    }

    if (input === '/reset') {
        resetSession(phone);
        console.log('🔄 Session reset. Type a message to start again.');
        return;
    }

    if (input.startsWith('/button ')) {
        const id = input.slice(8).trim();
        if (!id) {
            console.log('⚠️  Provide a button id after /button.');
            return;
        }
        await handleInteractive(phone, {
            type: 'button_reply',
            button_reply: { id }
        });
        return;
    }

    if (input.startsWith('/list ')) {
        const id = input.slice(6).trim();
        if (!id) {
            console.log('⚠️  Provide a list item id after /list.');
            return;
        }
        await handleInteractive(phone, {
            type: 'list_reply',
            list_reply: { id }
        });
        return;
    }

    await handleMessage(phone, input);
}

rl.on('line', async (line) => {
    try {
        await dispatch(line);
    } catch (error) {
        console.error('❌ Error handling input:', error);
    }
    rl.prompt();
}).on('close', () => {
    console.log('\n👋 Exiting CLI tester.');
    process.exit(0);
});

(async () => {
    try {
        await dispatch('menu');
    } catch (error) {
        console.error('❌ Error sending initial message:', error);
    }
    rl.prompt();
})();
