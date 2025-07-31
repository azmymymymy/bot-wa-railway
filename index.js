const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

client.on('qr', (qr) => {
    console.log('QR CODE:', qr);
});

client.on('ready', () => {
    console.log('WhatsApp bot is ready!');
});

client.on('message', async msg => {
    if (msg.body === '!ping') {
        msg.reply('pong');
    }
});

client.initialize();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
