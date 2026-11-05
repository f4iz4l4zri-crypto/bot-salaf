const fs = require('fs');
const path = require('path');

// Cuba gunakan dotenv, atau fallback ke parser fail .env terbina
try {
  require('dotenv').config();
} catch (e) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

module.exports = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  botName: process.env.BOT_NAME || 'Bot Rujukan Salaf',
  botPrefix: process.env.BOT_PREFIX || '!',
  botMode: process.env.BOT_MODE || 'mention_or_prefix',
  targetGroupJid: process.env.TARGET_GROUP_JID || '',
  usePairingCode: process.env.USE_PAIRING_CODE === 'true',
  botPhoneNumber: (process.env.BOT_PHONE_NUMBER || '').replace(/[^0-9]/g, ''),
  respondInPrivate: process.env.RESPOND_IN_PRIVATE === 'true', // Default false: abaikan semua chat peribadi (PM/DM)
  authDir: path.resolve(__dirname, '../auth_info_baileys'),
};
