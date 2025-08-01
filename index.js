const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = './users.json';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] },
    qrTimeout: 300000
});

let users = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : [];

client.on('qr', (qr) => {
    console.log('⬇⬇⬇ QR CODE STRING ⬇⬇⬇');
    console.log(qr);
    console.log('⬆⬆⬆ COPY STRING QR DI ATAS ⬆⬆⬆');
});

client.on('ready', () => console.log('✅ Bot siap.'));

client.on('message', async (msg) => {
    const sender = msg.from;
    const user = users.find(u => u.id === sender);

    // Catat user baru
    if (!user) {
        const alias = `client${users.length + 1}`;
        users.push({ id: sender, alias });
        fs.writeFileSync(path, JSON.stringify(users, null, 2));
        return; // tidak perlu membalas
    }

    const text = msg.body.trim().toLowerCase();

    if (msg.body === '!hd' && msg.hasMedia) {
    const media = await msg.downloadMedia();

    // Upload ke API
    const form = new FormData();
    form.append('image', Buffer.from(media.data, 'base64'), {
      filename: 'image.jpg',
      contentType: media.mimetype
    });

    try {
      const res = await axios.post('https://api.siputzx.my.id/api/iloveimg/upscale', form, {
        headers: form.getHeaders()
      });

      // Kirim hasil upscale
      const file = await axios.get(res.data.url, { responseType: 'arraybuffer' });
      const doc = new MessageMedia('image/jpeg', file.data.toString('base64'), 'hd.jpg');

      msg.reply(doc, undefined, { sendMediaAsDocument: true });
    } catch (err) {
      msg.reply('❌ Terjadi kesalahan saat memproses gambar.');
    }
  }


    // !menu
    if (text === '!menu') {
        return msg.reply('📋 Menu:\n1. !ping\n2. !info\n3. !ask <pertanyaan>\n4. !brat <teks>\n5. !removebg (dengan gambar)');
    }

    // !ping
    if (text === '!ping') {
        return msg.reply('🏓 pong');
    }

    // !info
    if (text === '!info') {
        return msg.reply(`📌 Kamu: ${user.alias} (${user.id})`);
    }

    // !ask
    if (text.startsWith('!ask')) {
        const prompt = msg.body.slice(5).trim();
        if (!prompt) return msg.reply('❗ Masukkan pertanyaan setelah `!ask`');

        try {
            const res = await axios.get(`https://api.siputzx.my.id/api/ai/deepseek-llm-67b-chat?content=${encodeURIComponent(prompt)}`);
            const jawaban = res.data?.data || '⚠️ Tidak ada jawaban dari AI.';
            return msg.reply(`🤖 ${jawaban}`);
        } catch (err) {
            console.error('❌ Error AI:', err.response?.data || err.message);
            return msg.reply('❌ Gagal menghubungi AI.');
        }
    }

    // !all (hanya di grup)
    if (text.startsWith('!all ') && msg.from.endsWith('@g.us')) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const authorId = msg.author || msg.from;
    const participants = await chat.participants;
    const senderData = participants.find(p => p.id._serialized === authorId);

    if (!senderData?.isAdmin) {
        return msg.reply('❌ Hanya admin yang boleh menggunakan perintah ini.');
    }

    const teks = msg.body.slice(5).trim();
    if (!teks) {
        return msg.reply('❌ Format: !all [pesan]');
    }

    try {
        const mentions = participants.map(participant => participant.id._serialized);
        
        await chat.sendMessage(teks, {
            mentions: mentions
        });

        await msg.delete(true);
    } catch (error) {
        console.error('Hidetag error:', error);
        msg.reply('❌ Gagal mengirim hidetag.');
    }
}

    // !brat
    if (text.startsWith('!brat ')) {
        const bratText = msg.body.slice(6).trim();
        if (!bratText) return msg.reply('❗ Contoh: `!brat Aku lapar`');

        try {
            const res = await axios.post(
                'https://api.siputzx.my.id/api/m/brat',
                { text: bratText },
                {
                    headers: { 'Content-Type': 'application/json' },
                    responseType: 'arraybuffer'
                }
            );

            const base64 = Buffer.from(res.data).toString('base64');
            const media = new MessageMedia('image/png', base64, 'brat.png');
            return client.sendMessage(msg.from, media, { sendMediaAsSticker: true });

        } catch (err) {
            console.error('❌ Gagal membuat BRAT:', err.message);
            return msg.reply('❌ Gagal membuat stiker BRAT.');
        }
    }

    // !removebg
    if (text === '!removebg' && msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (!media || !media.mimetype) return msg.reply('⚠️ Gagal membaca media.');

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
return client.sendMessage(msg.from, output, { sendMediaAsDocument: true });

        } catch (err) {
            console.error('❌ Gagal hapus background:', err.message);
            return msg.reply('❌ Gagal menghapus background.');
        }
    }

});

client.initialize();
