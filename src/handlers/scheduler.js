const cron = require('node-cron');
const config = require('../config');
const { generateDailyFaedah } = require('../gemini');

/**
 * Menghantar Faedah Ilmiah ke semua grup sasaran:
 * - Grup yang ditetapkan dalam TARGET_GROUP_JID
 * - Grup yang dikesan secara automatik mengikut nama (contoh: "salaf", "ummi", "mama", "family")
 */
async function sendDailyFaedahToAllGroups(sock) {
  try {
    console.log('[Scheduler] Menjana faedah ilmiah harian pagi...');
    const faedah = await generateDailyFaedah();

    // 1. Kumpulkan JID dari .env (jika ada)
    const targetSet = new Set(config.targetGroupJids || []);

    // 2. Automatik cari SEMUA grup yang disertai oleh bot yang mempunyai nama sasaran
    try {
      const allGroups = await sock.groupFetchAllParticipating();
      for (const [jid, groupData] of Object.entries(allGroups)) {
        const subject = (groupData.subject || '').toLowerCase();

        // Senarai kata kunci nama grup yang ingin dihantar faedah harian
        const matchesTarget =
          subject.includes('salaf') ||
          subject.includes('ummi') ||
          subject.includes('mama') ||
          subject.includes('family') ||
          subject.includes('keluarga');

        if (matchesTarget) {
          targetSet.add(jid);
          console.log(`[Scheduler] Grup padanan dikesan: "${groupData.subject}" (${jid})`);
        }
      }
    } catch (e) {
      console.warn('[Scheduler] Amaran carian grup automatik:', e.message);
    }

    if (targetSet.size === 0) {
      console.log('[Scheduler] Tiada grup sasaran ditemui untuk penghantaran faedah harian.');
      return 0;
    }

    console.log(`[Scheduler] Menghantar faedah harian ke ${targetSet.size} grup...`);
    let count = 0;
    for (const jid of targetSet) {
      try {
        await sock.sendMessage(jid, { text: faedah });
        count++;
        console.log(`[Scheduler] Berjaya hantar ke grup: ${jid}`);
        // Tunggu 1.5 saat antara mesej untuk kestabilan
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`[Scheduler] Gagal hantar ke ${jid}:`, err.message);
      }
    }
    return count;
  } catch (err) {
    console.error('[Scheduler] Ralat penjadual:', err.message);
    return 0;
  }
}

/**
 * Inisialisasi jadual berkala (Setiap hari jam 7:30 pagi)
 */
function initScheduler(sock) {
  // Jam 07:30 pagi waktu Malaysia (Asia/Kuala_Lumpur)
  cron.schedule('30 7 * * *', async () => {
    console.log('[Scheduler] Waktu faedah pagi tiba (7:30 AM). Memulakan siaran...');
    await sendDailyFaedahToAllGroups(sock);
  }, {
    timezone: 'Asia/Kuala_Lumpur'
  });

  console.log('[Scheduler] Penjadualan faedah harian aktif (Setiap hari jam 7:30 pagi untuk semua grup terpilih).');
}

module.exports = {
  initScheduler,
  sendDailyFaedahToAllGroups
};
