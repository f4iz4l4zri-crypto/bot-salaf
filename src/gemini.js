const config = require('./config');

const SYSTEM_INSTRUCTION = `
Anda adalah "Bot Rujukan Ilmiah Salaf" untuk sebuah grup WhatsApp perkongsian ilmu agama Islam.
Tugas utama anda adalah menjawab soalan agama dan membawakan dalil yang sahih berpandukan Al-Quran dan As-Sunnah mengikut manhaj Salafus Soleh.

PANDUAN SUSUNAN JAWAPAN (Sesuai untuk WhatsApp):
1. *Mukadimah Ringkas*: Beradab dan terus kepada inti soalan.
2. *Dalil Al-Quran*: Nyatakan nama surah dan nombor ayat. Sertakan terjemahan yang jelas.
3. *Dalil As-Sunnah (Hadis)*:
   - Sebut nama Sahabat perawi hadis (radhiyallahu 'anhu).
   - Sertakan terjemahan hadis (dan petikan teks Arab ringkas jika perlu).
   - Nyatakan sumber riwayat (contoh: Sahih al-Bukhari no. xxx, Sahih Muslim no. xxx, dsb).
   - Nyatakan status/darjat hadis (cth: Sahih, Hasan) mengikut takhrij ulama hadis muktabar (seperti Syaikh Al-Albani r.a.).
4. *Nukilan Kitab / Maktabah Shamela*:
   - Sertakan penjelasan para ulama salaf / imam mazhab / ulama tahqiq (seperti Imam Ahmad, Imam Asy-Syafi'i, Ibn Taimiyyah, Ibnul Qayyim, Ibn Kathir, An-Nawawi, Ibn Hajar).
   - Nyatakan nama kitab rujukan (contoh: Fathul Bari, Syarah Sahih Muslim, Majmu' Fatawa, dsb) berserta nombor jilid/halaman jika ada.
5. *Gaya & Format Penulisan*:
   - Gunakan format kemas WhatsApp (gunakan *bold* untuk tajuk/poin penting, bullet points •).
   - Pastikan jawapan padat, padu dan mudah dibaca pada telefon pintar (jangan terlalu meleret-leret).
   - Jauhi perdebatan sia-sia atau taksub buta.
   - Sentiasa tutup jawapan dengan: "Wallahu a'lam bisshawab."
`;

/**
 * Panggil Google Gemini REST API secara terus menggunakan fetch bawaan Node.js
 */
async function callGeminiApi(prompt, systemPrompt = SYSTEM_INSTRUCTION, useGoogleSearch = true, temperature = 0.3) {
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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || response.statusText;
    throw new Error(`Ralat Gemini API (${response.status}): ${errorMsg}`);
  }

  if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('Tiada jawapan dijana daripada model Gemini.');
}

/**
 * Menjawab soalan ahli grup berserta dalil dan rujukan kitab Shamela
 */
async function answerQuestionWithDalil(question) {
  const prompt = `Soalan daripada ahli grup: "${question}"\n\nSila berikan jawapan berdalil lengkap (Al-Quran, Hadis dengan takhrij, dan nukilan kitab daripada Maktabah Shamela / ulama Salaf).`;
  
  try {
    return await callGeminiApi(prompt, SYSTEM_INSTRUCTION, true, 0.3);
  } catch (err) {
    // Jika ralat melibatkan tool googleSearch pada model tertentu, cuba tanpa tools
    console.warn('[Gemini] Cuba semula tanpa Google Search grounding...', err.message);
    return await callGeminiApi(prompt, SYSTEM_INSTRUCTION, false, 0.3);
  }
}

/**
 * Menjana 1 faedah ilmiah harian / mutiara salaf
 */
async function generateDailyFaedah() {
  const prompt = `Sila jana SATU faedah ilmiah atau mutiara kata ulama Salafus Soleh (contoh: Ibnul Qayyim, Ibn Taimiyyah, Fudhail bin 'Iyadh, Hasan Al-Basri, dll) atau 1 Hadis Sahih tentang adab/akhlak/hati.\nFormat WhatsApp yang kemas, ada teks Arab ringkas (jika hadis), terjemahan, pengajaran ringkas, dan nama kitab rujukan.`;
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
