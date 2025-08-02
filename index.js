const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');
const path = require('path'); // Hanya ini untuk module
const { PDFDocument } = require('pdf-lib');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();


const usersPath = './users.json'; // Ganti nama variabel agar tidak konflik

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] },
    qrTimeout: 300000
});



let users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath)) : [];

// Fungsi delay 3 detik
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// Storage untuk foto sekali lihat
let viewOnceMedia = new Map();

// Storage untuk pesan yang dihapus
let deletedMessages = new Map();

// Storage untuk backup semua pesan
let messageBackup = new Map();

// Fungsi delay 3 detik

client.on('qr', (qr) => {
    console.log('⬇⬇⬇ QR CODE STRING ⬇⬇⬇');
    console.log(qr);
    console.log('⬆⬆⬆ COPY STRING QR DI ATAS ⬆⬆⬆');
});

client.on('ready', () => console.log('✅ Bot siap.'));

// Handler untuk pesan yang dihapus
// Handler untuk pesan yang dihapus
client.on('message_revoke_everyone', async (after, before) => {
    if (before) {
        const messageKey = `${before.from}_${before.id.id}`;
        const deletedData = {
            id: before.id.id,
            from: before.from,
            author: before.author || before.from,
            body: before.body,
            timestamp: before.timestamp,
            type: before.type,
            hasMedia: before.hasMedia,
            isViewOnce: before.isViewOnce,
            deletedAt: Date.now()
        };

        // Jika ada media, ambil dari backup
        if (before.hasMedia && messageBackup.has(messageKey)) {
            const backupData = messageBackup.get(messageKey);
            deletedData.media = backupData.media;
        }

        deletedMessages.set(messageKey, deletedData);
        
        console.log(`🗑️ Pesan dihapus dari ${before.from}: "${before.body || '[Media]'}"`);
        
        // Hapus dari backup setelah 7 hari untuk menghemat memory
        setTimeout(() => {
            deletedMessages.delete(messageKey);
        }, 7 * 24 * 60 * 60 * 1000);
    }
});

// Handler untuk backup semua pesan
client.on('message_create', async (msg) => {
    // Skip pesan dari bot sendiri
    if (msg.fromMe) return;
    
    const messageKey = `${msg.from}_${msg.id.id}`;
    const backupData = {
        id: msg.id.id,
        from: msg.from,
        author: msg.author || msg.from,
        body: msg.body,
        timestamp: msg.timestamp,
        type: msg.type,
        hasMedia: msg.hasMedia,
        isViewOnce: msg.isViewOnce
    };

    // Backup media kalau ada
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            backupData.media = {
                data: media.data,
                mimetype: media.mimetype,
                filename: media.filename
            };
        } catch (err) {
            console.error('❌ Error backing up media:', err.message);
        }
    }

    messageBackup.set(messageKey, backupData);
    
    // Hapus backup setelah 7 hari
    setTimeout(() => {
        messageBackup.delete(messageKey);
    }, 7 * 24 * 60 * 60 * 1000);
});

// Handler untuk backup semua pesan
client.on('message_create', async (msg) => {
    // Skip pesan dari bot sendiri
    if (msg.fromMe) return;
    
    const messageKey = `${msg.from}_${msg.id.id}`;
    const backupData = {
        id: msg.id.id,
        from: msg.from,
        author: msg.author || msg.from,
        body: msg.body,
        timestamp: msg.timestamp,
        type: msg.type,
        hasMedia: msg.hasMedia,
        isViewOnce: msg.isViewOnce
    };

    // Backup media kalau ada
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            backupData.media = {
                data: media.data,
                mimetype: media.mimetype,
                filename: media.filename
            };
        } catch (err) {
            console.error('❌ Error backing up media:', err.message);
        }
    }

    messageBackup.set(messageKey, backupData);
    
    // Hapus backup setelah 7 hari
    setTimeout(() => {
        messageBackup.delete(messageKey);
    }, 7 * 24 * 60 * 60 * 1000);
});

client.on('qr', (qr) => {
    console.log('⬇⬇⬇ QR CODE STRING ⬇⬇⬇');
    console.log(qr);
    console.log('⬆⬆⬆ COPY STRING QR DI ATAS ⬆⬆⬆');
});

client.on('ready', () => console.log('✅ Bot siap.'));



client.on('message', async (msg) => {
  console.log('📩 New message received!');
  console.log('Type:', msg.type);
  console.log('MIME:', msg.mimetype);
  console.log('From:', msg.from);
  console.log('Has Media:', msg.hasMedia);

  const sender = msg.from;
  const user = users.find(u => u.id === sender);
  const text = msg.body.trim().toLowerCase();

  // Debug log pesan masuk
  console.log('DEBUG message:', {
    from: sender,
    type: msg.type,
    isViewOnce: msg.isViewOnce,
    hasMedia: msg.hasMedia,
    body: msg.body,
    quotedMsg: msg.hasQuotedMsg
  });

  if (msg.hasMedia && msg.isViewOnce) {
        try {
            const media = await msg.downloadMedia();
            const mediaKey = `${msg.from}_${msg.id.id}`;
            
            // Simpan media sekali lihat
            viewOnceMedia.set(mediaKey, {
                data: media.data,
                mimetype: media.mimetype,
                filename: media.filename || 'viewonce_media',
                timestamp: Date.now(),
                messageId: msg.id.id,
                from: msg.from
            });
            
            console.log(`📸 Foto sekali lihat disimpan dari ${sender}`);
            
            // Hapus setelah 24 jam untuk menghemat memory
            setTimeout(() => {
                viewOnceMedia.delete(mediaKey);
            }, 24 * 60 * 60 * 1000);
            
        } catch (err) {
            console.error('❌ Error saving view once media:', err.message);
        }
    }

    // Delay 3 detik sebelum memproses pesan
    await delay(3000);

    if (text === '!arise' && msg.hasQuotedMsg) {
    try {
        const quoted = await msg.getQuotedMessage();
        const mediaKey = `${quoted.from}_${quoted.id.id}`;
        
        // Cek dari viewOnceMedia dulu
        if (viewOnceMedia.has(mediaKey)) {
            const savedMedia = viewOnceMedia.get(mediaKey);
            const media = new MessageMedia(
                savedMedia.mimetype,
                savedMedia.data,
                savedMedia.filename
            );
            
            await msg.reply('🔓 Foto sekali lihat berhasil diambil!');
            await client.sendMessage(msg.from, media);
            
            console.log(`🔓 Foto sekali lihat dikirim ulang ke ${sender}`);
        }
        // Kalau tidak ada, cek dari deleted messages
        else if (deletedMessages.has(mediaKey)) {
            const deletedMsg = deletedMessages.get(mediaKey);
            if (deletedMsg.isViewOnce && deletedMsg.media) {
                const media = new MessageMedia(
                    deletedMsg.media.mimetype,
                    deletedMsg.media.data,
                    deletedMsg.media.filename
                );
                
                await msg.reply('🔓 Foto sekali lihat dari pesan yang dihapus berhasil diambil!');
                await client.sendMessage(msg.from, media);
                
                console.log(`🔓 Foto sekali lihat (deleted) dikirim ulang ke ${sender}`);
            } else {
                return msg.reply('❌ Pesan yang di-reply bukan foto sekali lihat.');
            }
        } else {
            return msg.reply('❌ Foto sekali lihat tidak ditemukan atau sudah kedaluwarsa.');
        }
    } catch (err) {
        console.error('❌ Error arise:', err.message);
        return msg.reply('❌ Gagal mengambil foto sekali lihat.');
    }
}

// Tangkap foto sekali lihat (taruh di event message) - Improved detection
if (msg.hasMedia) {
    try {
        // Multiple ways to detect view once
        const isViewOnce = msg.isViewOnce || 
                          msg.type === 'image' && msg._data.isViewOnce ||
                          msg._data.type === 'image' && msg._data.isViewOnce ||
                          msg.body === '' && msg.hasMedia; // Sometimes view-once comes without body

        if (isViewOnce) {
            const media = await msg.downloadMedia();
            const mediaKey = `${msg.from}_${msg.id.id}`;
            
            // Simpan media sekali lihat
            viewOnceMedia.set(mediaKey, {
                data: media.data,
                mimetype: media.mimetype,
                filename: media.filename || 'viewonce_media',
                timestamp: Date.now(),
                messageId: msg.id.id,
                from: msg.from
            });
            
            console.log(`📸 Foto sekali lihat disimpan dari ${msg.from}`);
            console.log(`📸 Message type: ${msg.type}, isViewOnce: ${msg.isViewOnce}, hasMedia: ${msg.hasMedia}`);
            
            // Hapus setelah 24 jam untuk menghemat memory
            setTimeout(() => {
                viewOnceMedia.delete(mediaKey);
            }, 24 * 60 * 60 * 1000);
        } else {
            // Debug log untuk semua media messages
            console.log(`📷 Media biasa dari ${msg.from} - type: ${msg.type}, isViewOnce: ${msg.isViewOnce}`);
        }
        
    } catch (err) {
        console.error('❌ Error saving view once media:', err.message);
    }
}

  if (
  msg.hasMedia &&
  (msg.type === 'audio' || msg.mimetype?.includes('audio/ogg')) &&
  !msg.from.includes('@g.us')
) {
  console.log('✅ VN diterima dari chat pribadi, memproses...');

  try {
    const media = await msg.downloadMedia();
    if (!media || !media.data) {
      return msg.reply('❌ Gagal ambil data VN.');
    }

    const buffer = Buffer.from(media.data, 'base64');
    const filename = `vn_${Date.now()}.ogg`;
    const dir = './vn';

    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const filepath = `${dir}/${filename}`;
    fs.writeFileSync(filepath, buffer);

    // Kirim ke API siputzx.my.id
    const form = new FormData();
    form.append('file', fs.createReadStream(filepath));

    const response = await axios.post(
      'https://api.siputzx.my.id/api/cf/whisper',
      form,
      {
        headers: {
          ...form.getHeaders(),
        }
      }
    );

    const transcription = response.data?.text || null;

    if (transcription) {
      await msg.reply(`📢 Transkripsi VN:\n\n${transcription}`);
    } else {
      await msg.reply('❗ Tidak bisa mengenali isi voice note.');
    }

    fs.unlinkSync(filepath);

  } catch (err) {
    console.error('❌ Error transkrip VN:', err);
    await msg.reply('❌ Terjadi kesalahan saat memproses VN.');
  }

  return;
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


    if (text === '!arise' && msg.hasQuotedMsg) {
        try {
            const quoted = await msg.getQuotedMessage();
            const mediaKey = `${quoted.from}_${quoted.id.id}`;
            
            if (viewOnceMedia.has(mediaKey)) {
                const savedMedia = viewOnceMedia.get(mediaKey);
                const media = new MessageMedia(
                    savedMedia.mimetype,
                    savedMedia.data,
                    savedMedia.filename
                );
                
                await msg.reply('🔓 Foto sekali lihat berhasil diambil!');
                await client.sendMessage(msg.from, media);
                
                console.log(`🔓 Foto sekali lihat dikirim ulang ke ${sender}`);
            } else {
                return msg.reply('❌ Foto sekali lihat tidak ditemukan atau sudah kedaluwarsa.');
            }
        } catch (err) {
            console.error('❌ Error arise:', err.message);
            return msg.reply('❌ Gagal mengambil foto sekali lihat.');
        }
    }

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