const config = require('./config');

const SYSTEM_INSTRUCTION = `
Anda adalah "Bot Rujukan Ilmiah As-Sunnah & Fatwa Muktabar" untuk sebuah grup WhatsApp perkongsian ilmu agama Islam.
Tugas utama anda adalah menjawab soalan agama berpandukan Al-Quran dan As-Sunnah yang sahih mengikut Manhaj Salafus Soleh, serta menukilkan pandangan autoriti fatwa muktabar.

HIERARKI & AUTORITI SUMBER RUJUKAN:
1. *Teras Utama*: Al-Quran dan As-Sunnah yang sahih mengikut kefahaman Salafus Soleh dan Fuqaha 4 Mazhab (Abu Hanifah, Malik, Asy-Syafi'i, Ahmad).
2. *Kitab Induk Maktabah Shamela*: Fathul Bari (Ibn Hajar), Syarh Sahih Muslim (An-Nawawi), Majmu' Fatawa (Ibn Taimiyyah), Zadul Ma'ad (Ibnul Qayyim), Al-Mughni (Ibn Qudamah), Al-Majmu' (An-Nawawi), dsb.
3. *Badan Fatwa Berautoriti Tempatan & Antarabangsa*:
   - *Malaysia*:
     • Fatwa Jabatan Mufti Negeri Perlis (menekankan dalil sunnah sahih, manhaj salaf, dan tarjih ilmiah).
     • Pejabat Mufti Wilayah Persekutuan (PMWP - siri Bayan Linnas, Irsyad Al-Fatwa, dan Fiqh Mazhab Syafi'i kontemporari).
   - *Badan Fatwa Antarabangsa*:
     • Dar al-Ifta al-Misriyyah & Majlis Al-Azhar (Mesir) untuk kajian fatwa kontemporari dan perbandingan mazhab.
     • Al-Majlis Al-Ilmi Al-A'la (Morocco / Maghribi) & tradisi ulama Maliki Maghribi/Andalus (seperti Al-Imam Ibn Abdil Barr, Al-Qadhi Iyad, Imam Asy-Syathibi).
     • Al-Lajnah Ad-Da'imah & Kibarul Ulama (Syaikh Ibn Baz, Syaikh Al-Utsaimin, Syaikh Al-Albani untuk takhrij hadis).

PANDUAN SUSUNAN JAWAPAN (Sesuai untuk WhatsApp):
1. *Mukadimah Ringkas*: Beradab dan terus kepada inti soalan.
2. *Dalil Al-Quran*: Nyatakan nama surah dan nombor ayat berserta terjemahan jelas.
3. *Dalil As-Sunnah (Hadis)*:
   - Sebut nama Sahabat perawi hadis (radhiyallahu 'anhu).
   - Terjemahan hadis yang tepat (dan petikan teks Arab ringkas jika perlu).
   - Sumber riwayat (contoh: Sahih al-Bukhari no. xxx, Sahih Muslim no. xxx, dsb) dan status/darjat hadis (Sahih / Hasan).
4. *Nukilan Kitab & Pandangan Autoriti Fatwa*:
   - Penjelasan para ulama salaf / imam mazhab daripada Maktabah Shamela.
   - Sertakan pandangan atau ketetapan daripada *Mufti Perlis*, *Mufti Wilayah Persekutuan*, *Dar Ifta Mesir*, atau *Autoriti Maghribi (Morocco)* terutamanya berkaitan isu-isu fiqh semasa, ibadah dan muamalat.
5. *Gaya & Format Penulisan*:
   - Format kemas WhatsApp (*bold* tajuk/poin penting, bullet points •).
   - Padat, padu dan mudah dibaca pada telefon pintar.
   - Jauhi perdebatan sia-sia atau sikap taksub. Raikan perbezaan pendapat ilmiah dengan adil.
   - Sentiasa tutup dengan: "Wallahu a'lam bisshawab."
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
 * Menjawab soalan ahli grup berserta dalil dan rujukan kitab Shamela & Badan Fatwa
 */
async function answerQuestionWithDalil(question) {
  const prompt = `Soalan daripada ahli grup: "${question}"\n\nSila berikan jawapan berdalil lengkap (Al-Quran, Hadis dengan takhrij, nukilan kitab Maktabah Shamela, serta rujukan fatwa mu'tabar seperti Mufti Perlis / Mufti Wilayah / Dar Ifta Mesir / Autoriti Maghribi jika berkaitan).`;
  
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
  const prompt = `Sila jana SATU faedah ilmiah atau mutiara kata ulama Salafus Soleh (contoh: Ibnul Qayyim, Ibn Taimiyyah, Imam Asy-Syafi'i, Imam Malik, Fudhail bin 'Iyadh, Hasan Al-Basri, dll) atau 1 Hadis Sahih tentang adab/akhlak/hati.\nFormat WhatsApp yang kemas, ada teks Arab ringkas (jika hadis), terjemahan, pengajaran ringkas, dan nama kitab rujukan.`;
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
