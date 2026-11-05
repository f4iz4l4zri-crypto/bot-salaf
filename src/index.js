const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const { exec } = require('child_process');
const config = require('./config');
const { handleIncomingMessage } = require('./handlers/message');
const { initScheduler } = require('./handlers/scheduler');

let isPairingCodeRequested = false;

async function startBot() {
  console.log('\n===============================================');
  console.log(`🤖 Memulakan ${config.botName}...`);
  console.log('===============================================\n');

  // Menyediakan sesi log masuk (multi file auth state)
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

  // Dapatkan versi Baileys terkini
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[WhatsApp] Menggunakan WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);

  // Inisialisasi socket Baileys dengan browser Ubuntu/Chrome yang disokong penuh oleh WhatsApp
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
  });

  // Simpan kelayakan log masuk setiap kali dikemas kini
  sock.ev.on('creds.update', saveCreds);

  // Kendalikan status sambungan
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Simpan fail gambar QR sekiranya QR dijana
    if (qr) {
      const qrImagePath = path.resolve(__dirname, '../qr.png');
      try {
        await QRCode.toFile(qrImagePath, qr, {
          width: 400,
          margin: 2
        });
        console.log(`\n📸 Gambar QR telah disimpan di: ${qrImagePath}`);
      } catch (err) {
        // abaikan
      }

      if (!config.usePairingCode || !config.botPhoneNumber) {
        console.log('\n📱 [QR CODE LOG MASUK DI TERMINAL]');
        qrcode.generate(qr, { small: true });
        // Buka gambar QR secara automatik di Windows untuk memudahkan imbasan kamera
        exec(`start "" "${qrImagePath}"`);
      }
    }

    // Jika menggunakan Kaedah Pairing Code
    if (config.usePairingCode && config.botPhoneNumber && !sock.authState.creds.registered && !isPairingCodeRequested) {
      isPairingCodeRequested = true;
      setTimeout(async () => {
        try {
          console.log(`[WhatsApp] Menjana Pairing Code baharu untuk +${config.botPhoneNumber}...`);
          const code = await sock.requestPairingCode(config.botPhoneNumber);
          console.log('\n============================================================');
          console.log(`📱 [PAIRING CODE BAHARU UNTUK NOMBOR +${config.botPhoneNumber}]`);
          console.log(`👉 KOD ANDA: [  ${code}  ]`);
          console.log('============================================================');
          console.log(`PERHATIAN: Kod ini sah selama lebih kurang 60 saat.`);
          console.log(`Langkah di telefon (+${config.botPhoneNumber}):`);
          console.log('1. Buka WhatsApp > Tekan menu 3 titik / Settings > Linked Devices');
          console.log('2. Tekan "Link a Device"');
          console.log('3. Tekan pilihan di bawah: "Link with phone number instead"');
          console.log(`4. Masukkan kod 8-aksara ini SEGERA: ${code}`);
          console.log('============================================================\n');
        } catch (err) {
          console.error('[WhatsApp] Ralat menjana Pairing Code:', err.message);
        }
      }, 3000);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`\n❌ Sambungan terputus (Status: ${statusCode}). Cuba sambung semula: ${shouldReconnect}`);

      isPairingCodeRequested = false;
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log('⚠️ Sesi telah log keluar. Sila jana kod semula.');
      }
    } else if (connection === 'open') {
      console.log('\n===============================================================');
      console.log('✅ ALHAMDULILLAH, BOT BERJAYA DISAMBUNGKAN KE WHATSAPP!');
      console.log(`Nombor Bot: ${sock.user?.id?.split(':')[0]}`);
      console.log(`Nama Bot: ${config.botName}`);
      console.log(`Prefix Arahan: ${config.botPrefix}`);
      console.log('===============================================================\n');

      // Aktifkan penjadual faedah harian
      initScheduler(sock);
    }
  });

  // Kendalikan mesej masuk
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      await handleIncomingMessage(sock, msg);
    }
  });

  // Paparkan senarai grup
  sock.ev.on('groups.update', async (groups) => {
    for (const g of groups) {
      console.log(`[Info Grup] ID: ${g.id} | Nama: ${g.subject}`);
    }
  });
}

// Mulakan bot
startBot().catch((err) => {
  console.error('Ralat kritikal semasa memulakan bot:', err);
});
