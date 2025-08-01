const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');
const path = require('path'); // Hanya ini untuk module
const { PDFDocument } = require('pdf-lib');
const ffmpeg = require('fluent-ffmpeg');
const speech = require('@google-cloud/speech');

const usersPath = './users.json'; // Ganti nama variabel agar tidak konflik

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] },
    qrTimeout: 300000
});

let users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath)) : [];

// Fungsi delay 3 detik
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on('qr', (qr) => {
    console.log('⬇⬇⬇ QR CODE STRING ⬇⬇⬇');
    console.log(qr);
    console.log('⬆⬆⬆ COPY STRING QR DI ATAS ⬆⬆⬆');
});

client.on('ready', () => console.log('✅ Bot siap.'));

client.on('message', async (msg) => {
    const sender = msg.from;
    const user = users.find(u => u.id === sender);

    // Cek jika ada media
  // VN hanya untuk chat pribadi
if (
    msg.hasMedia &&
    (msg._data.mimetype === 'audio/ogg' || msg._data.mimetype === 'audio/opus') &&
    !msg.from.includes('@g.us')
) {
    console.log('VN diterima dari chat pribadi, memproses...');

    const buffer = Buffer.from(msg._data.body, 'base64');
    const filename = `vn_${Date.now()}.ogg`;
    const filepath = `./vn/${filename}`;

    fs.writeFileSync(filepath, buffer);

    const wavPath = filepath.replace('.ogg', '.wav');
    ffmpeg(filepath)
        .toFormat('wav')
        .on('end', async () => {
            console.log('Konversi selesai, mengirim ke Google Speech...');

            const audioBytes = fs.readFileSync(wavPath).toString('base64');
            const request = {
                audio: { content: audioBytes },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 48000,
                    languageCode: 'id-ID',
                },
            };

            try {
                const [response] = await speechClient.recognize(request);
                const transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join('\n');

                if (transcription) {
                    await msg.reply(`📢 Transkripsi VN:\n\n${transcription}`);
                } else {
                    await msg.reply('Maaf, tidak bisa mengenali isi voice note.');
                }
            } catch (err) {
                console.error(err);
                await msg.reply('❌ Terjadi kesalahan saat memproses voice note.');
            }

            fs.unlinkSync(filepath);
            fs.unlinkSync(wavPath);
        })
        .on('error', (err) => {
            console.error('Gagal konversi:', err);
            msg.reply('❌ Gagal konversi VN ke teks.');
        })
        .save(wavPath);

    return; // berhenti di sini untuk VN
}

    
    if (msg.body.toLowerCase() === '!topdf' && msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        if (!quoted.hasMedia) return msg.reply('❌ Media tidak ditemukan di pesan yang dibalas.');

        const media = await quoted.downloadMedia();
        const ext = mime.extension(media.mimetype);
        const fileName = `./temp/input.${ext}`;
        const outputPdf = `./temp/output.pdf`;

        fs.writeFileSync(fileName, Buffer.from(media.data, 'base64'));

        const pdfDoc = await PDFDocument.create();
        const imageBytes = fs.readFileSync(fileName);
        let image;

        if (ext === 'jpg' || ext === 'jpeg') {
            image = await pdfDoc.embedJpg(imageBytes);
        } else if (ext === 'png') {
            image = await pdfDoc.embedPng(imageBytes);
        } else {
            return msg.reply('❌ Hanya gambar (JPG/PNG) yang didukung untuk sekarang.');
        }

        const { width, height } = image.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPdf, pdfBytes);

        const mediaDoc = MessageMedia.fromFilePath(outputPdf);
        await msg.reply('✅ File berhasil dikonversi ke PDF. Mengirim...');
        await client.sendMessage(msg.from, mediaDoc, { sendMediaAsDocument: true });

        fs.unlinkSync(fileName);
        fs.unlinkSync(outputPdf);
    }

    // !hd
    if (msg.body === '!hd' && msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            const buffer = Buffer.from(media.data, 'base64');
            const extension = mime.extension(media.mimetype);
            const tempPath = `./temp/temp_${Date.now()}.${extension}`;
            const outputPath = `./temp/HD_${Date.now()}.jpg`;

            fs.writeFileSync(tempPath, buffer);

            const formData = new FormData();
            formData.append('image', fs.createReadStream(tempPath));

            const res = await axios.post('https://api.siputzx.my.id/api/iloveimg/upscale', formData, {
                headers: { ...formData.getHeaders() },
                responseType: 'arraybuffer'
            });

            fs.writeFileSync(outputPath, res.data);

            const hdMedia = MessageMedia.fromFilePath(outputPath);
            await client.sendMessage(msg.from, hdMedia, { sendMediaAsDocument: true });

            fs.unlinkSync(tempPath);
            fs.unlinkSync(outputPath);
        } catch (err) {
            console.error('❌ HD error:', err.message);
            await msg.reply('❌ Gagal meningkatkan kualitas gambar.');
        }
    }

    // Catat user baru
    if (!user) {
        const alias = `client${users.length + 1}`;
        users.push({ id: sender, alias });
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        return;
    }

    const text = msg.body.trim().toLowerCase();

    if (text === '!menu') {
        return msg.reply('📋 Menu:\n1. !ping\n2. !info\n3. !ask <pertanyaan>\n4. !brat <teks>\n5. !removebg (dengan gambar)\n6. !hd\n7. !topdf (reply gambar)');
    }

    if (text === '!ping') {
        return msg.reply('🏓 pong');
    }

    if (text === '!info') {
        return msg.reply(`📌 Kamu: ${user.alias} (${user.id})`);
    }

    if (text.startsWith('!ask')) {
        const prompt = msg.body.slice(5).trim();
        if (!prompt) return msg.reply('❗ Masukkan pertanyaan setelah `!ask`');

        try {
            const res = await axios.get(`https://api.siputzx.my.id/api/ai/deepseek-llm-67b-chat?content=${encodeURIComponent(prompt)}`);
            const jawaban = res.data?.data || '⚠️ Tidak ada jawaban dari AI.';
            return msg.reply(`🤖 ${jawaban}`);
        } catch (err) {
            console.error('❌ Error AI:', err.message);
            return msg.reply('❌ Gagal menghubungi AI.');
        }
    }

    if (text.startsWith('!all ') && msg.from.endsWith('@g.us')) {
        const chat = await msg.getChat();
        const authorId = msg.author || msg.from;
        const participants = await chat.participants;
        const senderData = participants.find(p => p.id._serialized === authorId);
        if (!senderData?.isAdmin) return msg.reply('❌ Hanya admin yang boleh pakai ini.');

        const teks = msg.body.slice(5).trim();
        const mentions = participants.map(p => p.id._serialized);
        await chat.sendMessage(teks, { mentions });
        await msg.delete(true);
    }

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
            console.error('❌ Gagal BRAT:', err.message);
            return msg.reply('❌ Gagal membuat stiker BRAT.');
        }
    }

    if (text === '!removebg' && msg.hasMedia) {
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
                    headers: { ...formData.getHeaders() },
                    responseType: 'arraybuffer'
                }
            );

            const output = new MessageMedia('image/png', Buffer.from(response.data).toString('base64'), 'nobg.png');
            return client.sendMessage(msg.from, output, { sendMediaAsDocument: true });

        } catch (err) {
            console.error('❌ Gagal removebg:', err.message);
            return msg.reply('❌ Gagal menghapus background.');
        }
    }
});

client.initialize();