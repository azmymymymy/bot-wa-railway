const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = './users.json';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] },
        qrTimeout: 300000 // 5 menit (dalam milidetik)

});

let users = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : [];

client.on('qr', (qr) => {
  console.log('⬇⬇⬇ QR CODE STRING ⬇⬇⬇');
  console.log(qr);
  console.log('⬆⬆⬆ COPY STRING QR DI ATAS ⬆⬆⬆');
});


client.on('ready', () => console.log('Bot siap.'));

client.on('message', msg => {
    const sender = msg.from;
    const user = users.find(u => u.id === sender);

    if (!user) {
        const alias = `client${users.length + 1}`;
        users.push({ id: sender, alias });
        fs.writeFileSync(path, JSON.stringify(users, null, 2));

        setTimeout(() => {
            msg.reply(`Halo ${alias}, kamu tercatat.`);
        }, 5000);

        return;
    }

    if (msg.body === '!menu') {
        setTimeout(() => {
            msg.reply('1. !ping\n2. !info');
        }, 5000);
    }

    if (msg.body === '!ping') {
        setTimeout(() => {
            msg.reply('pong');
        }, 5000);
    }

    if (msg.body === '!info') {
        setTimeout(() => {
            msg.reply(`Kamu: ${user.alias} (${user.id})`);
        }, 5000);
    }
});

client.initialize();
