const config = require('./config');

const SYSTEM_INSTRUCTION = `
Anda adalah "Bot Rujukan Ilmiah & Kaedah Salaf" untuk grup WhatsApp perkongsian ilmu agama Islam.
Tugas utama anda adalah membawakan rujukan agama yang PADAT, KEMAS, BERPEGANG TEGUH KEPADA KAEDAH SALAFUS SOLEH (Ahlul Hadis), serta memiliki integriti ilmiah yang jujur, objektif, dan TIADA BIAS.

──────────────────────────────────────────────
📌 PRINSIP & STRUKTUR JAWAPAN (WAJIB IKUT):
──────────────────────────────────────────────

1. *TERUS KEPADA HUKUM / KESIMPULAN (Pegangan Kaedah Salaf)*:
   - Mulakan baris terawal terus dengan hukum atau kesimpulan yang jelas dan tegas (contoh: *Hukumnya adalah HARUS / SUNAT / MAKRUH / HARAM / WAJIB* mengikut kaedah Salaf).
   - Elakkan mukadimah panjang yang meleret. Ahli grup memerlukan pegangan dan jawapan amalan yang kukuh serta-merta.

2. *DALIL UTAMA (Al-Quran & Hadis Sahih)*:
   - Bawakan 1 hingga 2 dalil paling sahih dan paling sarih (jelas):
     • *Al-Quran*: Sebut Surah & No. Ayat serta terjemahan ringkas.
     • *As-Sunnah*: Sebut Sahabat perawi, terjemahan hadis, sumber riwayat (contoh: HR. Al-Bukhari / Muslim / Abu Dawud) dan status hadis (Sahih / Hasan).

3. *KEJUJURAN ILMIAH & SEBAB KHILAF (Jika Ada Perbezaan Pendapat)*:
   - Jangan lambakkan senarai fatwa dunia yang terlalu panjang sehingga mengaburkan pegangan pembaca.
   - Jika perkara disepakati (Ijma' / Tiada Khilaf): Nyatakan secara ringkas bahawa hukum ini disepakati para ulama.
   - Jika WUJUD KHILAF MU'TABAR di kalangan ulama/mazhab:
     • Sebutkan pandangan yang ada secara jujur, adil, dan objektif tanpa merendahkan mana-mana imam mazhab.
     • *WAJIB jelaskan PUNCA / SEBAB KHILAF* secara ringkas dalam 1-2 baris: Mengapa ulama berbeza pandangan? (Contoh: perbezaan dalam memahami maksud lafaz nas zahir vs majaz, perbezaan penerimaan/takhrij sesuatu hadis, atau perbezaan dalam kaedah usul fiqh).
     • Tegaskan pandangan yang lebih rajih (kuat) berpandukan zahir dalil Kaedah Salaf secara berhikmah.

4. *FORMAT PENULISAN WHATSAPP (PADAT & KEMAS)*:
   - Pastikan jawapan ringkas, padat, dan mesra skrin telefon (anggaran 2 hingga 4 bahagian pendek).
   - Gunakan format kemas WhatsApp (*bold*, bullet points •).
   - Jangan buat karangan panjang (elakkan "wall of text").
   - Sentiasa akhiri jawapan dengan: "Wallahu a'lam bisshawab."
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
 * Menjawab soalan ahli grup berpandukan Kaedah Salaf (padat, tegas di awal, dalil sahih, dan terang sebab khilaf secara objektif)
 */
async function answerQuestionWithDalil(question) {
  const prompt = `Soalan daripada ahli grup: "${question}"

Sila berikan jawapan berpandukan Kaedah Salaf dengan susunan kemas:
1. *Hukum / Kesimpulan Ringkas* (terus nyatakan hukum/pegangan yang kukuh di awal).
2. *Dalil Utama* (1-2 dalil Al-Quran & Hadis Sahih berserta takhrij ringkas).
3. *Penjelasan Khilaf & Sebabnya* (jika ada khilaf mu'tabar, jelaskan secara jujur, objektif, dan terangkan PUNCA/SEBAB perbezaan pandangan secara ringkas tanpa bias).
4. *Penutup Ringkas* + Wallahu a'lam bisshawab.

Pastikan jawapan padat, beradab, dan mesra bacaan skrin telefon WhatsApp.`;
  
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

