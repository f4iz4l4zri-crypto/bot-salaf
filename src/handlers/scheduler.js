const cron = require('node-cron');
const config = require('../config');
const { generateDailyFaedah } = require('../gemini');

// Senarai EKSKLUSIF 3 Grup Sasaran Sahaja untuk Faedah Harian:
// 1. "salaf"
// 2. "keluarga ummi habibi"
// 3. "papa❤mama = 👪"
const STRICT_TARGET_GROUPS = [
  '60197602500-1379154224@g.us',
  '60132068983-1425281869@g.us',
  '60129352664-1404370463@g.us'
];

/**
 * Menghantar Faedah Ilmiah KHAS untuk 3 grup terpilih sahaja (bukan semua grup)
 */
async function sendDailyFaedahToAllGroups(sock) {
  try {
    console.log('[Scheduler] Menjana faedah ilmiah harian pagi...');
    const faedah = await generateDailyFaedah();

    // Gunakan senarai dari .env jika ada, atau fallback kepada 3 grup rasmi di atas
    const targetJids = config.targetGroupJids && config.targetGroupJids.length > 0
      ? config.targetGroupJids
      : STRICT_TARGET_GROUPS;

    console.log(`[Scheduler] Menghantar faedah harian ke ${targetJids.length} grup terpilih sahaja:`);

    let count = 0;
    for (const jid of targetJids) {
      try {
        await sock.sendMessage(jid, { text: faedah });
        count++;
        console.log(`[Scheduler] Berjaya hantar ke grup terpilih: ${jid}`);
        // Tunggu 1.5 saat antara mesej
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
    console.log('[Scheduler] Waktu faedah pagi tiba (7:30 AM). Menghantar ke 3 grup terpilih...');
    await sendDailyFaedahToAllGroups(sock);
  }, {
    timezone: 'Asia/Kuala_Lumpur'
  });

  console.log('[Scheduler] Penjadualan faedah harian aktif (Setiap hari jam 7:30 pagi untuk 3 grup terpilih sahaja).');
}

module.exports = {
  initScheduler,
  sendDailyFaedahToAllGroups,
  STRICT_TARGET_GROUPS
};
