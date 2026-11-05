const cron = require('node-cron');
const config = require('../config');
const { generateDailyFaedah } = require('../gemini');

/**
 * Menghidupkan jadual berkala harian (contoh: Pagi jam 7:30 pagi)
 * supaya grup tidak sunyi dan sentiasa mendapat pengisian ilmu
 */
function initScheduler(sock) {
  // Setiap hari pada jam 07:30 pagi (Waktu Malaysia: Asia/Kuala_Lumpur)
  // Format cron: minit jam hari bulan hari-minggu
  cron.schedule('30 7 * * *', async () => {
    if (!config.targetGroupJid) {
      console.log('[Scheduler] Peringatan: TARGET_GROUP_JID belum ditetapkan dalam .env untuk faedah harian.');
      return;
    }

    try {
      console.log('[Scheduler] Menjana faedah ilmiah harian pagi...');
      const faedah = await generateDailyFaedah();
      await sock.sendMessage(config.targetGroupJid, { text: faedah });
      console.log('[Scheduler] Berjaya menghantar faedah harian ke grup.');
    } catch (err) {
      console.error('[Scheduler] Ralat menghantar faedah harian:', err.message);
    }
  }, {
    timezone: 'Asia/Kuala_Lumpur'
  });

  console.log('[Scheduler] Penjadualan faedah harian aktif (Setiap hari jam 7:30 pagi).');
}

module.exports = {
  initScheduler
};
