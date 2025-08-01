const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = './users.json';
const mime = require('mime-types');
const path = require('path');
const { PDFDocument } = require('pdf-lib');


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

if (msg.body.toLowerCase() === '!topdf' && msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        if (!quoted.hasMedia) return msg.reply('❌ Media tidak ditemukan di pesan yang dibalas.');

        const media = await quoted.downloadMedia();
        const ext = mime.extension(media.mimetype);
        const fileName = `./temp/input.${ext}`;
        const outputPdf = `./temp/output.pdf`;

        // Simpan file asli
        fs.writeFileSync(fileName, Buffer.from(media.data, 'base64'));

        // Buat PDF dari gambar
        const pdfDoc = await PDFDocument.create();
        const imageBytes = fs.readFileSync(fileName);
        let image, page;

        if (ext === 'jpg' || ext === 'jpeg') {
            image = await pdfDoc.embedJpg(imageBytes);
        } else if (ext === 'png') {
            image = await pdfDoc.embedPng(imageBytes);
        } else {
            return msg.reply('❌ Hanya gambar (JPG/PNG) yang didukung untuk sekarang.');
        }

        const { width, height } = image.scale(1);
        page = pdfDoc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPdf, pdfBytes);

        // Kirim ulang sebagai dokumen PDF
        const mediaDoc = MessageMedia.fromFilePath(outputPdf);
        await msg.reply('✅ File berhasil dikonversi ke PDF. Mengirim...');
        await msg.reply(mediaDoc, msg.from, { sendMediaAsDocument: true });

        // Hapus file temp
        fs.unlinkSync(fileName);
        fs.unlinkSync(outputPdf);
    }

    // Catat user baru
    if (!user) {
        const alias = `client${users.length + 1}`;
        users.push({ id: sender, alias });
        fs.writeFileSync(path, JSON.stringify(users, null, 2));
        return; // tidak perlu membalas
    }

    const text = msg.body.trim().toLowerCase();

    if (message.body === '!hd' && message.hasMedia) {
        try {
            const media = await message.downloadMedia();
            const buffer = Buffer.from(media.data, 'base64');
            const extension = mime.extension(media.mimetype);
            const tempPath = `temp_${Date.now()}.${extension}`;
            fs.writeFileSync(tempPath, buffer);

            // Kirim ke API iloveimg
            const formData = new FormData();
            formData.append('image', fs.createReadStream(tempPath));

            const res = await axios.post('https://api.siputzx.my.id/api/iloveimg/upscale', formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                responseType: 'arraybuffer'
            });

            const outputPath = `HD_${Date.now()}.jpg`;
            fs.writeFileSync(outputPath, res.data);

            // Kirim ulang sebagai dokumen
            const hdMedia = MessageMedia.fromFilePath(outputPath);
            await message.reply(hdMedia, message.from, {
                sendMediaAsDocument: true
            });

            // Bersihkan file sementara
            fs.unlinkSync(tempPath);
            fs.unlinkSync(outputPath);

        } catch (err) {
            console.error('Gagal proses HD:', err.message);
            await message.reply('Gagal meningkatkan kualitas gambar.');
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
