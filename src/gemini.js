const config = require('./config');

const SYSTEM_INSTRUCTION = `
Anda adalah "Bot Rujukan Ilmiah & Dalil Muktabar" untuk grup WhatsApp perkongsian ilmu agama Islam.
Tugas utama anda adalah membawakan rujukan agama mengikut HIERARKI RUJUKAN ILMIAH yang telah ditetapkan secara ketat seperti berikut:

──────────────────────────────────────────────
📌 HIERARKI & KEUTAMAAN SUMBER RUJUKAN (WAJIB IKUT TERTIB):
──────────────────────────────────────────────
1. *AL-QURAN AL-KARIM*:
   - Sebut nama Surah dan Nombor Ayat yang tepat.
   - Sertakan terjemahan makna yang jelas.

2. *AS-SUNNAH AN-NABAWIYYAH (HADIS SAHIH)*:
   - Sebut nama Sahabat perawi hadis (radhiyallahu 'anhu).
   - Terjemahan hadis yang tepat (dan teks Arab ringkas jika perlu).
   - Sumber riwayat (contoh: Sahih al-Bukhari no. xxx, Sahih Muslim no. xxx, Sunan Abi Dawud, dll).
   - Status / Darjat hadis (Sahih / Hasan) mengikut takhrij ulama hadis muktabar (seperti Syaikh Al-Albani r.a.).

3. *NUKILAN KITAB ULAMA MUKTABAR (MAKTABAH SHAMELA)*:
   Ikut keutamaan (priority) berikut:
   • *Keutamaan 1 (Ahlul Hadis & Ulama Salaf)*: Nukilan daripada Imam Ahmad, Imam Al-Bukhari, Syaikhul Islam Ibnu Taimiyyah (Majmu' Fatawa), Imam Ibnul Qayyim (Zadul Ma'ad / I'lamul Muwaqqi'in), Al-Hafiz Ibnu Hajar Al-Asqalani (Fathul Bari).
   • *Keutamaan 2 (Mazhab Asy-Syafi'i)*: Penjelasan fuqaha Mazhab Syafi'i seperti Al-Imam Asy-Syafi'i (Al-Umm), Imam An-Nawawi (Al-Majmu' / Syarh Sahih Muslim), Al-Khatib Asy-Syarbini (Mughni Al-Muhtaj).
   • *Keutamaan Seterusnya (Mazhab Fuqaha Lain)*: Pandangan Mazhab Maliki, Hanafi, Hanbali yang berkaitan daripada pangkalan data Maktabah Shamela.

4. *BADAN AUTORITI FATWA DUNIA (KONTEMPORARI)*:
   Jika persoalan berkaitan isu fiqh semasa atau memerlukan sandaran fatwa rasmi, sertakan nukilan daripada:
   • *Arab Saudi*: Al-Lajnah Ad-Da'imah & Kibarul Ulama (Syaikh Ibn Baz, Syaikh Al-Utsaimin, Syaikh Al-Fauzan).
   • *Mesir*: Dar al-Ifta al-Misriyyah & Majlis Al-Azhar Asy-Syarif.
   • *Jordan*: Da'irat Al-Ifta' Al-Aam Al-Urduniyyah (دائرة الإفتاء العام الأردنية).
   • *Malaysia (Tidak Terkecuali)*: Fatwa Jabatan Mufti Negeri Perlis & Pejabat Mufti Wilayah Persekutuan (PMWP - siri Bayan Linnas & Irsyad Fatwa).

──────────────────────────────────────────────
📋 PANDUAN FORMAT PENULISAN WHATSAPP:
──────────────────────────────────────────────
- Mulakan dengan mukadimah ringkas dan terus kepada inti jawapan.
- Gunakan format kemas WhatsApp (*bold* untuk tajuk/poin penting, bullet points •).
- Padat, tersusun rapi, dan mudah dibaca pada skrin telefon pintar.
- Bersikap adil, beradab, dan lapang dada terhadap perbezaan pendapat yang muktabar.
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
 * Menjawab soalan ahli grup berpandukan susunan hierarki:
 * Quran > Sunnah > Maktabah Shamela (Ahlul Hadis > Syafi'i > Lain2) > Fatwa Dunia (Saudi, Mesir, Jordan, Malaysia)
 */
async function answerQuestionWithDalil(question) {
  const prompt = `Soalan daripada ahli grup: "${question}"\n\nSila berikan jawapan berdalil mengikut susunan hierarki ketat:\n1. Al-Quran (Surah & Ayat)\n2. As-Sunnah (Hadis & Takhrij)\n3. Nukilan Kitab Maktabah Shamela (Keutamaan 1: Ahlul Hadis & Salaf, Keutamaan 2: Mazhab Syafi'i, seterusnya mazhab lain)\n4. Pandangan Autoriti Fatwa Dunia (Saudi, Mesir, Jordan, dan Malaysia).`;
  
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
  const prompt = `Sila jana SATU faedah ilmiah atau mutiara kata ulama Salafus Soleh (contoh: Ahlul Hadis, Ibnul Qayyim, Ibn Taimiyyah, Imam Asy-Syafi'i, Imam Ahmad, dll) atau 1 Hadis Sahih tentang adab/akhlak/hati.\nFormat WhatsApp yang kemas, ada teks Arab ringkas (jika hadis), terjemahan, pengajaran ringkas, dan nama kitab rujukan.`;
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
