const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const axios = require('axios');
const path = './users.json';
const FormData = require('form-data');


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] },
    qrTimeout: 300000 // 5 menit
});

let users = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : [];

client.on('qr', (qr) => {
    console.log('⬇⬇⬇ QR CODE STRING ⬇⬇⬇');
    console.log(qr);
    console.log('⬆⬆⬆ COPY STRING QR DI ATAS ⬆⬆⬆');
});

client.on('ready', () => console.log('Bot siap.'));

client.on('message', async msg => {
    const sender = msg.from;
    const user = users.find(u => u.id === sender);

    if (!user) {
        const alias = `client${users.length + 1}`;
        users.push({ id: sender, alias });
        fs.writeFileSync(path, JSON.stringify(users, null, 2));
        return;
    }

    const text = msg.body.trim();

    // Menu
    if (text === '!menu') {
        return setTimeout(() => {
            msg.reply('1. !ping\n2. !info\n3. !ask <pertanyaan>\n4. !brat <teks>');
        }, 5000);
    }

    if (text === '!ping') {
        return setTimeout(() => {
            msg.reply('pong');
        }, 5000);
    }

    if (text === '!info') {
        return setTimeout(() => {
            msg.reply(`Kamu: ${user.alias} (${user.id})`);
        }, 5000);
    }

    // AI
    if (text.startsWith('!ask')) {
        const prompt = text.slice(5).trim();
        if (!prompt) return setTimeout(() => msg.reply('❗ Masukkan pertanyaan setelah !ask'), 5000);

        try {
            const res = await axios.get(`https://api.siputzx.my.id/api/ai/deepseek-llm-67b-chat?content=${encodeURIComponent(prompt)}`);
            const jawaban = res.data?.data || '⚠️ Tidak ada jawaban dari AI.';
            return setTimeout(() => msg.reply(`🤖 ${jawaban}`), 5000);
        } catch (e) {
            console.error('❌ Error:', e.response?.data || e.message);
            return setTimeout(() => msg.reply('❌ Gagal menghubungi AI.'), 5000);
        }
    }

    // Grup !all
    if (text.startsWith('!all ') && msg.from.endsWith('@g.us')) {
        const chat = await msg.getChat();
        if (!chat.isGroup) return;

        const authorId = msg.author || msg.from;
        const participants = await chat.participants;
        const senderData = participants.find(p => p.id._serialized === authorId);

        if (!senderData || !senderData.isAdmin) {
            return setTimeout(() => msg.reply('❌ Hanya admin yang boleh menggunakan perintah ini.'), 5000);
        }

        const teks = text.slice(5).trim();
        return setTimeout(() => chat.sendMessage(teks), 5000); // tanpa mention
    }

    // BRAT
    if (text.startsWith('!brat ')) {
        const bratText = text.slice(6).trim();
        if (!bratText) return setTimeout(() => msg.reply('❗ Masukkan teksnya, contoh: !brat Aku lapar'), 5000);

        try {
            const res = await axios.post(
                'https://api.siputzx.my.id/api/m/brat',
                { text: bratText },
                {
                    headers: { 'Content-Type': 'application/json' },
                    responseType: 'arraybuffer'
                }
            );

            const base64 = Buffer.from(res.data, 'binary').toString('base64');
            const media = new MessageMedia('image/png', base64, 'brat.png');

            return setTimeout(() => {
                client.sendMessage(msg.from, media, { sendMediaAsSticker: true });
            }, 5000);
        } catch (err) {
            console.error('❌ ERROR:', err.message);
            return setTimeout(() => msg.reply('❌ Gagal membuat stiker BRAT.'), 5000);
        }
    }
        // Command !removebg (hanya berlaku jika reply/ada media)
    if (message.toLowerCase() === '!removebg' && msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            const buffer = Buffer.from(media.data, 'base64');

            const formData = new FormData();
            formData.append('image', buffer, {
                filename: 'image.jpg',
                contentType: media.mimetype
            });

            const response = await axios.post(
                'https://api.siputzx.my.id/api/iloveimg/removebg',
                formData,
                {
                    headers: {
                        ...formData.getHeaders()
                    },
                    responseType: 'arraybuffer'
                }
            );

            const output = new MessageMedia('image/png', Buffer.from(response.data).toString('base64'), 'nobg.png');
            await client.sendMessage(msg.from, output);

        } catch (err) {
            console.error('❌ Gagal hapus background:', err.message);
            msg.reply('❌ Gagal menghapus background.');
        }
    }

});

client.initialize();
