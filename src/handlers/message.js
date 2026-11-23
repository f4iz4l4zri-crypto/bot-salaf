const { decryptPollVote, sha256 } = require('@whiskeysockets/baileys');
const config = require('../config');
const { answerQuestionWithDalil, generateDailyFaedah, generateQuiz, clearChatMemory } = require('../gemini');
const { sendDailyFaedahToAllGroups } = require('./scheduler');

// Cache untuk menyimpan maklumat mesej poll bagi mendekripsi undian (vote)
const pollCache = new Map();

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

const POLL_OPTIONS = [
  '🌿 Mutiara Faedah Salaf',
  '🎯 Kuiz Agama Interaktif',
  '❓ Cara Bertanya Dalil'
];

/**
 * Menghantar mesej undian (Poll) sebagai butang interaktif di WhatsApp
 */
async function sendPollMenu(sock, from, quotedMsg) {
  try {
    const pollCreation = await sock.sendMessage(from, {
      poll: {
        name: '📖 PILIHAN PANTAS BOT SALAF\n(Sentuh pilihan undian atau reply nombor 1, 2, 3):',
        values: POLL_OPTIONS,
        selectableCount: 1
      }
    }, { quoted: quotedMsg });

    // Simpan kunci rahsia poll ke dalam cache untuk membolehkan dekripsi undian apabila ahli klik
    if (pollCreation?.key?.id) {
      const pollEncKey =
        pollCreation.message?.messageContextInfo?.messageSecret ||
        pollCreation.message?.pollCreationMessageV3?.messageSecret ||
        pollCreation.message?.pollCreationMessage?.messageSecret;

      const pollCreatorJid = sock.user?.id
        ? sock.user.id.split(':')[0] + '@s.whatsapp.net'
        : pollCreation.key.participant || from;

      pollCache.set(pollCreation.key.id, {
        from,
        pollCreatorJid,
        pollEncKey,
        pollValues: POLL_OPTIONS
      });

      console.log(`[Poll] Menu undian dihantar & didaftarkan ke cache (ID: ${pollCreation.key.id})`);
    }
  } catch (err) {
    console.error('Ralat menghantar Poll:', err.message);
  }
}

/**
 * Memproses tindakan apabila undian (vote) diklik oleh ahli grup
 */
async function handlePollVote(sock, msg) {
  const pollUpdate = msg.message?.pollUpdateMessage;
  if (!pollUpdate) return false;

  const pollKey = pollUpdate.pollCreationMessageKey;
  if (!pollKey || !pollKey.id) return false;

  const cached = pollCache.get(pollKey.id);
  if (!cached || !cached.pollEncKey) {
    // Jika tiada dalam cache (contoh: bot baru restart), abaikan dengan selamat
    return false;
  }

  const from = msg.key.remoteJid;
  const voterJid = msg.key.participant || from;

  try {
    const decryptedVote = decryptPollVote(pollUpdate.vote, {
      pollCreatorJid: cached.pollCreatorJid,
      pollMsgId: pollKey.id,
      pollEncKey: cached.pollEncKey,
      voterJid
    });

    if (decryptedVote?.selectedOptions?.length > 0) {
      console.log(`[Poll Vote] Pilihan undian dikesan dari: ${voterJid}`);

      for (const optHash of decryptedVote.selectedOptions) {
        const hashHex = Buffer.from(optHash).toString('hex');

        const opt1Hash = sha256(Buffer.from(cached.pollValues[0])).toString('hex');
        const opt2Hash = sha256(Buffer.from(cached.pollValues[1])).toString('hex');
        const opt3Hash = sha256(Buffer.from(cached.pollValues[2])).toString('hex');

        if (hashHex === opt1Hash) {
          console.log('[Poll Vote] Tindakan: Menjana Faedah Salaf');
          await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } });
          const faedah = await generateDailyFaedah();
          await sock.sendMessage(from, { text: faedah + FOOTER_SHORTCUTS });
          return true;
        } else if (hashHex === opt2Hash) {
          console.log('[Poll Vote] Tindakan: Menjana Kuiz Agama');
          await sock.sendMessage(from, { react: { text: '🎯', key: msg.key } });
          const quiz = await generateQuiz();
          await sock.sendMessage(from, { text: quiz + FOOTER_SHORTCUTS });
          return true;
        } else if (hashHex === opt3Hash) {
          console.log('[Poll Vote] Tindakan: Memaparkan Panduan Dalil');
          const helpMsg = `📖 *PANDUAN BERTANYA DALIL:*\n\n` +
            `Cukup mudah! Anda boleh bertanya apa-apa soalan agama dengan format:\n` +
            `👉 \`!tanya <soalan anda>\`\n` +
            `👉 \`!dalil <topik>\`\n\n` +
            `Contoh:\n` +
            `• \`!tanya apakah dalil keutamaan sedekah?\`\n` +
            `• \`!dalil adab menuntut ilmu\``;
          await sock.sendMessage(from, { text: helpMsg + FOOTER_SHORTCUTS });
          return true;
        }
      }
    }
  } catch (err) {
    console.error('[Poll Vote] Ralat mendekripsi undian poll:', err.message);
  }

  return false;
}

/**
 * Handler utama mesej masuk
 */
async function handleIncomingMessage(sock, msg) {
  try {
    if (!msg.message || msg.key.fromMe) return;

    // 1. Periksa sama ada ini adalah tindakan KLIK UNDIAN (Poll Vote Click)
    if (msg.message?.pollUpdateMessage) {
      const handled = await handlePollVote(sock, msg);
      if (handled) return;
    }

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || from;
    const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const botNumber = sock.user?.id?.split(':')[0] || '';

    // KAWALAN CHAT PERIBADI (PM/DM):
    // Jika mesej daripada chat peribadi (bukan grup) dan respondInPrivate=false,
    // ABAIKAN SEPENUHNYA supaya tidak mengganggu perbualan peribadi pemilik nombor.
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
      shouldReply = true;
      query = text.slice(prefix.length).trim();
    } else if (mentioned) {
      shouldReply = true;
      query = text.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
    } else if (replied) {
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

    // Arahan siaran segera ke semua grup sasaran (!siarfaedah)
    if (lowerText === 'siarfaedah' || lowerText === '!siarfaedah') {
      await sock.sendMessage(from, { text: '⏳ Sedang menghantar faedah ilmiah ke semua grup sasaran (Grup Salaf, Ummi Family, Mama Family)...' }, { quoted: msg });
      const sentCount = await sendDailyFaedahToAllGroups(sock);
      await sock.sendMessage(from, { text: `✅ Selesai! Faedah harian telah berjaya dihantar ke ${sentCount} grup.` }, { quoted: msg });
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

    // 1b. Arahan Reset Memori Perbualan (!reset / !baru)
    if (lowerQuery === 'reset' || lowerQuery === 'baru') {
      clearChatMemory(from);
      await sock.sendMessage(from, {
        text: `🔄 *Sesi Perbualan Baharu Dimulakan*\nMemori soalan-soalan terdahulu dalam grup ini telah dikosongkan. Sila ajukan topik atau soalan baharu.`
      }, { quoted: msg });
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
        `• Balas (reply) mana-mana mesej saya untuk soalan susulan (memori perbualan bersambung sehingga 10 soalan).\n` +
        `• \`${prefix}reset\` : Mulakan topik/sesi sembang baharu.\n\n` +
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

    // Dapatkan jawapan dari Gemini (dengan pautan memori perbualan mengikut grup 'from')
    const answer = await answerQuestionWithDalil(cleanQuestion, from);

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
