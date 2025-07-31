const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const axios = require('axios');
const path = './users.json';

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

    // Cek & simpan user baru
    if (!user) {
        const alias = `client${users.length + 1}`;
        users.push({ id: sender, alias });
        fs.writeFileSync(path, JSON.stringify(users, null, 2));
        setTimeout(() => {
            //msg.reply(`Halo ${alias}, kamu tercatat.`);
        }, 5000);
        return;
    }

    const text = msg.body.trim();

    // Menu
    if (text === '!menu') {
        setTimeout(() => {
            msg.reply('1. !ping\n2. !info\n3. !ai <pertanyaan>');
        }, 5000);
    }

    if (text === '!ping') {
        setTimeout(() => {
            msg.reply('pong');
        }, 5000);
    }

    if (text === '!info') {
        setTimeout(() => {
            msg.reply(`Kamu: ${user.alias} (${user.id})`);
        }, 5000);
    }

    // AI Command (!ai <prompt>)
     if (msg.body.startsWith('!ask')) {
  const prompt = msg.body.slice(5).trim();
  if (!prompt) return msg.reply('❗ Masukkan pertanyaan setelah !ask');

  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/ai/deepseek-llm-67b-chat?content=${encodeURIComponent(prompt)}`);
    
    const jawaban = res.data?.data || '⚠️ Tidak ada jawaban dari AI.';
    msg.reply(`🤖 ${jawaban}`);
  } catch (e) {
    console.error('❌ Error:', e.response?.data || e.message);
    msg.reply('❌ Gagal menghubungi AI.');
  }
}



    // Fitur !all (khusus admin grup) tanpa mention
    if (text.startsWith('!all ') && msg.from.endsWith('@g.us')) {
        const chat = await msg.getChat();

        if (!chat.isGroup) return;

        const authorId = msg.author || msg.from;
        const participants = await chat.participants;
        const senderData = participants.find(p => p.id._serialized === authorId);

        if (!senderData || !senderData.isAdmin) {
            msg.reply('❌ Hanya admin yang boleh menggunakan perintah ini.');
            return;
        }

        const teks = text.slice(5).trim();
        chat.sendMessage(teks); // Tanpa mention
    }
    if (msg.body.startsWith('!brat ')) {
        const text = msg.body.slice(6).trim();
        if (!text) return msg.reply('❌ Masukkan teksnya, contoh: !brat Aku lapar');

        msg.reply('⏳ Membuat BRAT...');

        try {
            const res = await axios.post('https://api.siputzx.my.id/api/m/brat', {
                text: text
            });

            if (!res.data.status) {
                return msg.reply('❌ Gagal membuat BRAT.');
            }

            // Ambil base64 dan ubah ke media
            const base64 = res.data.image; // tanpa prefix data:image/png;base64,
            const buffer = Buffer.from(base64, 'base64');
            const media = new MessageMedia('image/png', base64, 'brat.png');

            // Kirim sebagai stiker
            await client.sendMessage(msg.from, media, { sendMediaAsSticker: true });
        } catch (err) {
            console.error(err.message);
            msg.reply('❌ Terjadi kesalahan saat membuat stiker BRAT.');
        }
    }
});

client.initialize();
