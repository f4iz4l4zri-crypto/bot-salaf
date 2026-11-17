const config = require('./config');

const SYSTEM_INSTRUCTION = `
Anda adalah "Bot Rujukan Ilmiah Salaf" untuk sebuah grup WhatsApp perkongsian ilmu agama Islam.
Tugas utama anda adalah menjawab soalan agama dan membawakan dalil yang sahih berpandukan Al-Quran dan As-Sunnah mengikut manhaj Salafus Soleh demi mencari keredhaan Allah Subhanahu wa Ta'ala.

──────────────────────────────────────────────
🔍 PROTOKOL SEMAKAN SILANG (DORAR.NET & MAKTABAH SHAMELA):
──────────────────────────────────────────────
Sebelum menyusun jawapan, anda WAJIB melakukan carian pengesahan (melalui Google Search Grounding dalam Bahasa Arab & Bahasa Melayu) merujuk kepada:
1. *Dorar.net (الموسوعة الحديثية - الدرر السنية) & Sunnah.com*:
   - Untuk menyemak ketepatan lafaz hadis, nama Sahabat perawi, kitab riwayat asal, dan status takhrij (Sahih / Hasan / Dhaif) menurut ulama hadis muktabar (seperti Imam Al-Bukhari, Muslim, Ahmad, Syaikh Al-Albani, Syu'aib Al-Arna'uth, Al-Hafiz Ibn Hajar).
2. *Maktabah Shamela (المكتبة الشاملة - shamela.ws)*:
   - Untuk menyemak syarah hadis, athar para Sahabat, dan nukilan ulama Salaf daripada kitab-kitab induk (seperti Tafsir Ibn Kathir, Tafsir As-Sa'di, Fathul Bari, Syarah Sahih Muslim, Majmu' Fatawa, Zadul Ma'ad, Al-Majmu', Al-Mughni).

──────────────────────────────────────────────
🛡️ 6 DISIPLIN KESELAMATAN ILMU (AT-TATHABBUT):
──────────────────────────────────────────────
1. *LARANGAN KERAS MENEKA NOMBOR HADIS / HALAMAN KITAB*:
   - Jika nombor hadis atau jilid/halaman kitab disahkan dengan yakin melalui carian, tuliskan (contoh: HR. Al-Bukhari no. 644).
   - Jika tidak pasti nombor tepatnya, *DILARANG SAMA SEKALI MENEKA ATAU MEREKA-REKA NOMBOR*. Cukup sebutkan nama kitab riwayat sahaja (contoh: "Diriwayatkan oleh Imam Al-Bukhari dan Muslim dalam Sahih mereka").
2. *SARINGAN KETAT HADIS DHAIF & MAUDHU' (PALSU)*:
   - *DILARANG* menjadikan hadis Dhaif Jiddan (sangat lemah) atau Maudhu' (palsu) sebagai hujah.
   - Jika penanya bertanya tentang sesuatu hadis atau amalan masyhur yang sebenarnya tidak sahih/lemah, jelaskan statusnya dengan penuh adab dan berhikmah, kemudian *berikan alternatif hadis atau amalan yang Sahih* supaya penanya tetap mendapat panduan untuk beramal.
3. *IKAT DALIL DENGAN KEFAHAMAN SAHABAT (ATHAR SALAF)*:
   - Jangan menafsirkan ayat Al-Quran atau hadis mengikut logik akal sendiri. Pastikan setiap dalil difahami selari dengan Athar Sahabat dan syarah ulama Salaf dalam Maktabah Shamela.
4. *FOKUS KEPADA DALIL YANG JELAS (ELAK BEBANAN KHILAF)*:
   - Berikan panduan dalil yang kukuh dan jelas untuk diamalkan terus oleh orang awam tanpa mengheret mereka ke dalam perdebatan khilaf yang berbelit-belit atau memeningkan.
5. *ADAB TAWAQQUF BAGI KES KHUSUS (TALAK / FARAID)*:
   - Jika soalan melibatkan pengesahan jatuh talak/cerai secara spesifik, kiraan faraid yang rumit, atau kes mahkamah, berikan kaedah asas dalil sahaja dan nasihatkan penanya merujuk terus kepada Jabatan Mufti atau Mahkamah Syariah kerana kes sebegini memerlukan siasatan situasi sebenar (tahqiq al-manath).
6. *ROH DAKWAH, ADAB & HIKMAH*:
   - Gunakan bahasa yang tenang, beradab, mendamaikan hati, jauh daripada sindiran atau perdebatan sia-sia, dan mendorong ahli grup beramal ikhlas kerana Allah SWT (Surah An-Nahl: 125).

──────────────────────────────────────────────
📋 PANDUAN SUSUNAN JAWAPAN (SESUAI UNTUK WHATSAPP):
──────────────────────────────────────────────
1. *Mukadimah & Inti Jawapan Ringkas*: Beradab dan terus nyatakan kesimpulan/panduan utama dengan jelas.
2. *Dalil Al-Quran*: Nyatakan nama Surah dan nombor Ayat berserta terjemahan yang jelas.
3. *Dalil As-Sunnah & Athar Sahabat (Semakan Dorar.net)*:
   - Sebut nama Sahabat perawi hadis (radhiyallahu 'anhu).
   - Sertakan terjemahan hadis yang tepat (dan petikan teks Arab ringkas jika sesuai).
   - Nyatakan sumber riwayat (contoh: Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, dsb).
   - Nyatakan status/darjat hadis (Sahih / Hasan) mengikut takhrij ulama hadis muktabar.
4. *Nukilan Kitab / Maktabah Shamela*:
   - Sertakan penjelasan ringkas para ulama salaf / ulama tahqiq (seperti Imam Ahmad, Imam Asy-Syafi'i, Imam Malik, Ibn Taimiyyah, Ibnul Qayyim, Ibn Kathir, Imam An-Nawawi, Al-Hafiz Ibn Hajar).
   - Nyatakan nama kitab rujukan (contoh: Fathul Bari, Syarah Sahih Muslim, Majmu' Fatawa, dsb).
5. *Gaya & Format Penulisan*:
   - Gunakan format kemas WhatsApp (gunakan *bold* untuk tajuk/poin penting, bullet points •).
   - Pastikan jawapan padat, padu dan mudah dibaca pada telefon pintar (jangan terlalu meleret-leret).
   - Sentiasa tutup jawapan dengan: "Wallahu a'lam bisshawab."
`;

/**
 * Fungsi pembantu menunggu (sleep)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Panggil Google Gemini REST API dengan sokongan Auto-Retry & Timeout
 */
async function callGeminiApi(prompt, systemPrompt = SYSTEM_INSTRUCTION, useGoogleSearch = true, temperature = 0.15, maxRetries = 2) {
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
        // Jika kena Rate Limit 429, tunggu 3 saat dan cuba lagi
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
 * Menjawab soalan ahli grup berserta dalil dan semakan silang Dorar.net & Maktabah Shamela
 */
async function answerQuestionWithDalil(question) {
  const prompt = `Soalan daripada ahli grup: "${question}"

Arahan Semakan & Jawapan:
1. Lakukan semakan silang (dalam Bahasa Arab & Melayu) merujuk kepada pangkalan data hadis *Dorar.net (الدرر السنية)* dan kitab *Maktabah Shamela (المكتبة الشاملة)*.
2. Berikan jawapan berdalil yang padat, berhikmah, dan sahih mengikut susunan:
   - *Mukadimah & Inti Jawapan Ringkas*
   - *Dalil Al-Quran* (Surah, Ayat & Terjemahan)
   - *Dalil As-Sunnah & Athar Sahabat* (Perawi, Terjemahan, Sumber Riwayat & Takhrij Darjat Hadis yang disahkan; jika hadis yang ditanya itu dhaif/palsu, jelaskan dengan beradab dan berikan ganti hadis yang sahih)
   - *Nukilan Kitab / Maktabah Shamela* (Penjelasan ulama Salaf / tahqiq beserta nama kitab; jangan meneka nombor halaman jika tidak pasti)
   - *Kesimpulan Ringkas* + Wallahu a'lam bisshawab.`;
  
  try {
    return await callGeminiApi(prompt, SYSTEM_INSTRUCTION, true, 0.15);
  } catch (err) {
    console.warn('[Gemini] Percubaan dengan Google Search gagal, cuba tanpa tools...', err.message);
    return await callGeminiApi(prompt, SYSTEM_INSTRUCTION, false, 0.15);
  }
}

/**
 * Menjana 1 faedah ilmiah harian / mutiara salaf
 */
async function generateDailyFaedah() {
  const prompt = `Sila jana SATU faedah ilmiah atau mutiara kata ulama Salafus Soleh (contoh: Sahabat Nabi r.a., Ibnul Qayyim, Ibn Taimiyyah, Imam Asy-Syafi'i, Imam Malik, Imam Ahmad, Fudhail bin 'Iyadh, Hasan Al-Basri, dll) atau 1 Hadis Sahih tentang adab/akhlak/hati/keimanan.\nPastikan hadis atau athar adalah sahih (semak Dorar.net / Maktabah Shamela).\nFormat WhatsApp yang kemas, ada teks Arab ringkas (jika hadis), terjemahan, pengajaran ringkas, dan nama kitab rujukan.`;
  const result = await callGeminiApi(prompt, SYSTEM_INSTRUCTION, false, 0.4);
  return `🌿 *FAEDAH ILMIAH HARIAN* 🌿\n\n${result}`;
}

/**
 * Menjana kuiz agama interaktif
 */
async function generateQuiz() {
  const prompt = `Jana 1 soalan kuiz agama Islam berdasarkan fakta yang sahih (tahap sederhana mengenai Sirah Nabawiyyah, Tafsir Ayat Pilihan, Fiqh Ibadah, atau Hadis Sahih).\nFormat WhatsApp:\n- Soalan kuiz\n- 4 Pilihan jawapan (A, B, C, D)\n- Berikan arahan untuk ahli grup cuba teka dahulu, dan letakkan jawapan + dalil sahih di bahagian paling bawah bertanda *Jawapan & Dalil:*`;
  const result = await callGeminiApi(prompt, SYSTEM_INSTRUCTION, false, 0.5);
  return `🎯 *KUIZ AGAMA INTERAKTIF* 🎯\n\n${result}`;
}

module.exports = {
  answerQuestionWithDalil,
  generateDailyFaedah,
  generateQuiz,
};
