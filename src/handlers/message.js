const config = require('../config');
const { answerQuestionWithDalil, generateDailyFaedah, generateQuiz } = require('../gemini');

/**
 * Mendapatkan teks daripada objek mesej Baileys
 */
function getMessageText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  );
}

/**
 * Menyemak sama ada bot ditag / di-mention dalam mesej
 */
function isBotMentioned(message, botNumber) {
  const context = message.extendedTextMessage?.contextInfo;
  if (!context) return false;
  const mentionedJid = context.mentionedJid || [];
  return mentionedJid.some(jid => jid.includes(botNumber));
}

/**
 * Menyemak sama ada mesej adalah reply kepada mesej bot
 */
function isReplyingToBot(message, botJid) {
  const context = message.extendedTextMessage?.contextInfo;
  if (!context || !context.participant) return false;
  return context.participant.split('@')[0] === botJid.split('@')[0];
}

/**
 * Footer pintasan yang disertakan di bawah setiap jawapan bot
 */
const FOOTER_SHORTCUTS = `\n\n───────────────────────────\n💡 *Pintasan Pantas (Sentuh untuk salin):*\n• \`!faedah\` (Mutiara Kata Salaf)\n• \`!kuiz\` (Kuiz Agama Santai)\n• \`!menu\` (Buka Butang Pilihan)`;

/**
 * Menghantar mesej undian (Poll) sebagai butang interaktif di WhatsApp
 */
async function sendPollMenu(sock, from, quotedMsg) {
  try {
    await sock.sendMessage(from, {
      poll: {
        name: '📖 PILIHAN PANTAS BOT SALAF\n(Sila sentuh / undi salah satu pilihan di bawah):',
        values: [
          '🌿 Mutiara Faedah Salaf',
          '🎯 Kuiz Agama Interaktif',
          '❓ Cara Bertanya Dalil'
        ],
        selectableCount: 1
      }
    }, { quoted: quotedMsg });
  } catch (err) {
    console.error('Ralat menghantar Poll:', err.message);
  }
}

/**
 * Handler utama mesej masuk
 */
async function handleIncomingMessage(sock, msg) {
  try {
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || from;
    const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const botNumber = sock.user?.id?.split(':')[0] || '';

    // KAWALAN CHAT PERIBADI (PM/DM):
    // Jika mesej daripada chat peribadi (bukan grup) dan respondInPrivate=false,
    // ABAIKAN SEPENUHNYA supaya tidak mengganggu urusan peribadi pemilik nombor.
    if (!isGroup && !config.respondInPrivate) {
      return;
    }

    const text = getMessageText(msg.message).trim();
    if (!text) return;

    const prefix = config.botPrefix;
    const isCommand = text.startsWith(prefix);
    const mentioned = isGroup && isBotMentioned(msg.message, botNumber);
    const replied = isReplyingToBot(msg.message, botJid);

    // Tentukan sama ada bot patut membalas
    let shouldReply = false;
    let query = '';

    if (isCommand) {
      // Arahan bermula dengan prefix '!' (cth: !tanya, !dalil, !faedah)
      shouldReply = true;
      query = text.slice(prefix.length).trim();
    } else if (mentioned) {
      // Tag @Bot dalam grup
      shouldReply = true;
      query = text.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
    } else if (replied) {
      // Reply kepada mesej bot
      shouldReply = true;
      query = text;
    }

    // Sokongan Pintasan Angka Mudah (Hanya jika reply mesej bot secara spesifik)
    const lowerText = text.toLowerCase();
    if (replied) {
      if (lowerText === '1') {
        query = 'faedah';
        shouldReply = true;
      } else if (lowerText === '2') {
        query = 'kuiz';
        shouldReply = true;
      } else if (lowerText === '3') {
        query = 'help';
        shouldReply = true;
      }
    }

    // Periksa arahan !menu
    if (lowerText === '!menu' || (lowerText === 'menu' && (mentioned || replied))) {
      await sendPollMenu(sock, from, msg);
      return;
    }

    // Jika tiada arahan berkaitan bot, ABAIKAN serta-merta
    if (!shouldReply || !query) return;

    console.log(`[Mesej Masuk] Dari: ${sender} | Lokasi: ${isGroup ? from : 'PM/DM'} | Teks: "${query}"`);

    const lowerQuery = query.toLowerCase();

    // 1. Arahan Menu / Butang Poll (!menu)
    if (lowerQuery === 'menu') {
      await sendPollMenu(sock, from, msg);
      return;
    }

    // 2. Arahan Bantuan (!help / !bantuan)
    if (lowerQuery === 'help' || lowerQuery === 'bantuan') {
      const helpMessage = `📖 *${config.botName}* 📖\n` +
        `_Pembantu Rujukan Agama & Dalil Sunnah_\n\n` +
        `*Cara Bertanya Soalan:*\n` +
        `• \`${prefix}tanya <soalan anda>\`\n` +
        `• \`${prefix}dalil <topik>\`\n` +
        `• Tag saya: @${botNumber} <soalan>\n` +
        `• Balas (reply) mana-mana mesej saya.\n\n` +
        `*Pilihan Nombor Pantas (Reply mesej bot sahaja):*\n` +
        `1️⃣ : Dapatkan Mutiara Faedah Salaf\n` +
        `2️⃣ : Jana Kuiz Agama Interaktif\n` +
        `3️⃣ : Buka Menu Bantuan Ini\n\n` +
        `*Atau buka butang pilihan:*\n` +
        `• Taip \`${prefix}menu\` untuk paparkan butang undian interaktif!`;

      await sock.sendMessage(from, { text: helpMessage }, { quoted: msg });
      await sendPollMenu(sock, from, msg);
      return;
    }

    // 3. Arahan Faedah Harian (!faedah / angka 1)
    if (lowerQuery === 'faedah' || lowerQuery.startsWith('faedah ') || lowerQuery === '1') {
      await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } });
      const faedah = await generateDailyFaedah();
      await sock.sendMessage(from, { text: faedah + FOOTER_SHORTCUTS }, { quoted: msg });
      return;
    }

    // 4. Arahan Kuiz Interaktif (!kuiz / angka 2)
    if (lowerQuery === 'kuiz' || lowerQuery.startsWith('kuiz ') || lowerQuery === '2') {
      await sock.sendMessage(from, { react: { text: '🎯', key: msg.key } });
      const quiz = await generateQuiz();
      await sock.sendMessage(from, { text: quiz + FOOTER_SHORTCUTS }, { quoted: msg });
      return;
    }

    // 5. Bersihkan kata kunci jika menggunakan !tanya atau !dalil
    let cleanQuestion = query;
    if (cleanQuestion.toLowerCase().startsWith('tanya ')) {
      cleanQuestion = cleanQuestion.slice(6).trim();
    } else if (cleanQuestion.toLowerCase().startsWith('dalil ')) {
      cleanQuestion = cleanQuestion.slice(6).trim();
    } else if (cleanQuestion.toLowerCase().startsWith('soalan ')) {
      cleanQuestion = cleanQuestion.slice(7).trim();
    }

    if (!cleanQuestion) {
      await sock.sendMessage(from, {
        text: `Sila masukkan soalan anda selepas \`${prefix}tanya\`. Contoh:\n\`${prefix}tanya apakah dalil kewajipan solat berjemaah bagi lelaki?\``
      }, { quoted: msg });
      return;
    }

    // Tunjukkan reaksi sedang memproses
    await sock.sendMessage(from, { react: { text: '📖', key: msg.key } });
    await sock.sendPresenceUpdate('composing', from);

    // Dapatkan jawapan dari Gemini
    const answer = await answerQuestionWithDalil(cleanQuestion);

    // Hantar jawapan dengan footer pintasan kemas
    await sock.sendMessage(from, { text: answer + FOOTER_SHORTCUTS }, { quoted: msg });

    // Reaksi selesai
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

  } catch (error) {
    console.error('Ralat mengendalikan mesej:', error);
    try {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `⚠️ Maaf, berlaku masalah semasa mencari rujukan:\n_${error.message}_\n\nSila pastikan Kunci API Gemini telah dimasukkan dengan betul dalam fail \`.env\`.`
      }, { quoted: msg });
    } catch (e) {
      // ignore
    }
  }
}

module.exports = {
  handleIncomingMessage,
  sendPollMenu
};
