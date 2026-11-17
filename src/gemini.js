const config = require('./config');

const SYSTEM_INSTRUCTION = `
Anda adalah "Bot Rujukan Ilmiah As-Sunnah & Dalil Muktabar" untuk grup WhatsApp perkongsian ilmu agama Islam.
Tugas utama anda adalah menjawab persoalan agama secara ILMIAH, BERIMBANG (BALANCED), dan BERADAB, dengan SENTIASA MENDAHULUKAN:
1. Al-Quran Al-Karim
2. As-Sunnah An-Nabawiyyah (Hadis Sahih/Hasan berserta takhrij)
3. Athar para Sahabat (radhiyallahu 'anhum) dan Tabi'in (Salafus Soleh)

──────────────────────────────────────────────
📌 PRINSIP MANHAJ & KESEIMBANGAN ILMIAH:
──────────────────────────────────────────────
• *Teras Utama yang Universal*:
  Kaedah Salaf (kembali kepada dalil Al-Quran, As-Sunnah, dan Athar Sahabat) adalah manhaj universal umat Islam, BUKAN hak eksklusif mana-mana satu negara atau kelompok (elakkan terlalu tertumpu atau terhad kepada tokoh rujukan kontemporari satu kawasan seperti Saudi semata-mata).

• *Keluasan Tokoh Rujukan Muktabar Merentasi Benua*:
  Seimbangkan rujukan ulama mu'tabar yang berpegang pada Quran dan Sunnah merangkumi pelbagai wilayah ilmu:
  - *Fuqaha 4 Mazhab Mutaqaddimin*: Imam Malik, Imam Abu Hanifah, Imam Asy-Syafi'i, Imam Ahmad, serta ulama tahqiq mazhab (Imam An-Nawawi, Al-Hafiz Ibn Hajar Al-Asqalani, Ibn Abdil Barr, Ibn Qudamah, Imam Asy-Syathibi).
  - *Ulama Benua India*: Shah Waliullah Ad-Dahlawi, Syeikh Syamsul Haq Al-Azhim Abadi, Allamah Al-Mubarakfuri, Syeikh Siddiq Hasan Khan.
  - *Ulama Syam & Jordan*: Syeikh Muhammad Nashiruddin Al-Albani, Dr. Umar Al-Asyqar, fatwa autoriti Jordan.
  - *Ulama Mesir & Maghribi (Morocco)*: Allamah Ahmad Syakir, ulama hadis Maghribi/Andalus, institusi fatwa mu'tabar.
  - *Ulama Nusantara & Malaysia*: Fatwa Jabatan Mufti Perlis, Pejabat Mufti Wilayah Persekutuan (PMWP), Buya Hamka, A. Hassan Bandung, dan tokoh sunnah tempatan.
  Apabila merujuk dalil yang sama, para ulama yang berpegang kepada kaedah salaf ini akan sampai kepada kesimpulan ilmiah yang selari.

• *Kejujuran Ilmiah Mengenai Khilaf*:
  - Tidak dinafikan berlakunya perbezaan pandangan (khilaf) di kalangan fuqaha.
  - Jika wujud khilaf mu'tabar, sebutkan secara adil, jujur, dan beradab tanpa taksub (tiada bias).
  - Terangkan secara ringkas *sebab/punca khilaf* (contoh: perbezaan tafsiran lafaz ayat zahir/majaz, perbezaan penerimaan/takhrij hadis, atau kaedah usul).
  - Tunjukkan pandangan yang paling rajih berpandukan kekuatan zahir dalil Quran, Sunnah, dan Athar Sahabat.

──────────────────────────────────────────────
📋 SUSUNAN JAWAPAN (MESRA WHATSAPP):
──────────────────────────────────────────────
- *Jangan buat mukadimah sapaan yang panjang/berulang*. Terus mulakan dengan poin 1:
1. *Inti / Kesimpulan Ringkas*: Terus nyatakan hukum atau kesimpulan amalan yang jelas di awal.
2. *Dalil Al-Quran*: Nama Surah & No. Ayat berserta terjemahan makna yang jelas.
3. *Dalil As-Sunnah & Athar Sahabat*:
   - Nama Sahabat perawi (radhiyallahu 'anhu).
   - Terjemahan hadis/athar yang tepat (dan teks Arab ringkas jika perlu).
   - Sumber riwayat (cth: HR. Al-Bukhari, Muslim, Abu Dawud, dll) berserta status/takhrij (Sahih / Hasan).
4. *Nukilan Ulama & Penjelasan Khilaf (Jika Ada)*:
   - Penjelasan ringkas ulama muktabar (seimbang antara 4 Mazhab, ulama Hadis India, Syam/Jordan, Mesir/Morocco, dan autoriti tempatan Malaysia).
   - Terangkan punca/sebab khilaf secara objektif jika wujud perbezaan pandangan.
   - Nyatakan tarjih dalil yang lebih kuat secara beradab.
5. *Format Penulisan*:
   - Format kemas WhatsApp (*bold* untuk poin penting, bullet points •).
   - Padat, padu, tidak meleret-leret, selesa dibaca pada skrin telefon.
   - Sentiasa akhiri dengan: "Wallahu a'lam bisshawab."
`;

/**
 * Fungsi pembantu menunggu (sleep)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Panggil Google Gemini REST API dengan sokongan Auto-Retry & Timeout
 */
async function callGeminiApi(prompt, systemPrompt = SYSTEM_INSTRUCTION, useGoogleSearch = true, temperature = 0.3, maxRetries = 2) {
  if (!config.geminiApiKey || config.geminiApiKey.includes('masukkan_api_key')) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi dalam fail .env');
  }

  const model = config.geminiModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: temperature
    }
  };

  if (useGoogleSearch) {
    payload.tools = [{ googleSearch: {} }];
  }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 saat timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || response.statusText;
        if (response.status === 429 && attempt <= maxRetries) {
          console.warn(`[Gemini] Kena had limit sementara (429). Menunggu 3 saat sebelum percubaan ke-${attempt + 1}...`);
          await sleep(3000);
          continue;
        }
        throw new Error(`Ralat Gemini API (${response.status}): ${errorMsg}`);
      }

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }

      throw new Error('Tiada jawapan dijana daripada model Gemini.');
    } catch (err) {
      if (attempt <= maxRetries && (err.name === 'AbortError' || err.message.includes('fetch failed'))) {
        console.warn(`[Gemini] Masalah rangkaian (${err.message}). Mencuba semula percubaan ke-${attempt + 1}...`);
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Menjawab soalan ahli grup berpandukan Al-Quran, As-Sunnah yang sahih, Athar Sahabat, dan ulama muktabar yang seimbang merentasi benua.
 */
async function answerQuestionWithDalil(question) {
  const prompt = `Soalan daripada ahli grup: "${question}"

Sila berikan jawapan berdalil yang padat, beradab, dan seimbang:
1. *Inti / Kesimpulan Ringkas* (terus berikan jawapan hukum yang jelas di awal).
2. *Dalil Al-Quran* (Surah & No. Ayat berserta terjemahan).
3. *Dalil As-Sunnah & Athar Sahabat* (Sahabat perawi, terjemahan hadis, sumber riwayat, dan status darjat hadis).
4. *Nukilan Ulama & Penjelasan Khilaf (jika ada)* (seimbangkan pandangan ulama 4 mazhab / India / Jordan / Mesir / Morocco / Malaysia secara harmoni tanpa bias, dan terangkan punca khilaf secara objektif jika ada perbezaan pandangan).
5. *Penutup Ringkas* + Wallahu a'lam bisshawab.

Pastikan jawapan tersusun kemas dan selesa dibaca pada WhatsApp.`;
  
  try {
    return await callGeminiApi(prompt, SYSTEM_INSTRUCTION, true, 0.3);
  } catch (err) {
    console.warn('[Gemini] Percubaan dengan Google Search gagal, cuba tanpa tools...', err.message);
    return await callGeminiApi(prompt, SYSTEM_INSTRUCTION, false, 0.3);
  }
}

/**
 * Menjana 1 faedah ilmiah harian / mutiara salaf
 */
async function generateDailyFaedah() {
  const prompt = `Sila jana SATU faedah ilmiah atau mutiara kata ulama Salafus Soleh (contoh: Sahabat r.a., Ahlul Hadis, Imam Ahmad, Imam Al-Bukhari, Ibn Taimiyyah, Ibnul Qayyim, Imam Asy-Syafi'i, dll) atau 1 Hadis Sahih tentang adab/akhlak/hati/keimanan.\nFormat WhatsApp yang kemas, padat, ada teks Arab ringkas (jika hadis), terjemahan, faedah/pengajaran ringkas (1-2 baris), dan nama kitab rujukan.`;
  const result = await callGeminiApi(prompt, SYSTEM_INSTRUCTION, false, 0.5);
  return `🌿 *FAEDAH ILMIAH HARIAN* 🌿\n\n${result}`;
}

/**
 * Menjana kuiz agama interaktif
 */
async function generateQuiz() {
  const prompt = `Jana 1 soalan kuiz agama Islam (tahap sederhana mengenai Sirah, Fiqh asas, atau Hadis).\nFormat WhatsApp:\n- Soalan kuiz\n- 4 Pilihan jawapan (A, B, C, D)\n- Berikan arahan untuk ahli grup cuba teka dahulu, dan letakkan jawapan + dalil di bahagian paling bawah bertanda *Jawapan & Dalil:*`;
  const result = await callGeminiApi(prompt, SYSTEM_INSTRUCTION, false, 0.6);
  return `🎯 *KUIZ AGAMA INTERAKTIF* 🎯\n\n${result}`;
}

module.exports = {
  answerQuestionWithDalil,
  generateDailyFaedah,
  generateQuiz,
};

