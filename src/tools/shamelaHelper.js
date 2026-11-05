/**
 * Helper untuk rujukan carian Shamela dan Hadith Dorar
 */
const axios = require('axios');

/**
 * Carian terus ke API hadith atau endpoint carian
 * @param {string} keyword
 */
async function searchHadithDorar(keyword) {
  try {
    // Menggunakan API umum untuk semakan hadis
    const response = await axios.get(`https://dorar-hadith-api.cyclic.app/api/search?value=${encodeURIComponent(keyword)}&page=1`, {
      timeout: 5000
    });
    if (response.data && response.data.length > 0) {
      return response.data.slice(0, 3).map(h => ({
        hadith: h.hadith,
        el_rawi: h.rawi,
        el_mohedith: h.mohedith,
        book: h.book,
        number_or_page: h.numberOrPage,
        grade: h.grade
      }));
    }
  } catch (err) {
    // Jika endpoint offline / timeout, abaikan dengan selamat
  }
  return null;
}

module.exports = {
  searchHadithDorar
};
