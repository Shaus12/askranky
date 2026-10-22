// Israeli cities (Hebrew + English). Used for the city picker, question localization and mock data.
export const ISRAELI_CITIES = [
  ['ירושלים', 'Jerusalem'], ['תל אביב-יפו', 'Tel Aviv-Yafo'], ['חיפה', 'Haifa'], ['ראשון לציון', 'Rishon LeZion'], ['פתח תקווה', 'Petah Tikva'],
  ['אשדוד', 'Ashdod'], ['נתניה', 'Netanya'], ['באר שבע', 'Beersheba'], ['בני ברק', 'Bnei Brak'], ['חולון', 'Holon'],
  ['רמת גן', 'Ramat Gan'], ['רחובות', 'Rehovot'], ['אשקלון', 'Ashkelon'], ['בת ים', 'Bat Yam'], ['בית שמש', 'Beit Shemesh'],
  ['כפר סבא', 'Kfar Saba'], ['הרצליה', 'Herzliya'], ['חדרה', 'Hadera'], ['מודיעין-מכבים-רעות', "Modi'in-Maccabim-Re'ut"], ['רעננה', "Ra'anana"],
  ['לוד', 'Lod'], ['רמלה', 'Ramla'], ['נצרת', 'Nazareth'], ['ראש העין', "Rosh HaAyin"], ['הוד השרון', 'Hod HaSharon'],
  ['גבעתיים', 'Givatayim'], ['קריית אתא', 'Kiryat Ata'], ['נהריה', 'Nahariya'], ['עפולה', 'Afula'], ['אילת', 'Eilat'],
  ['קריית גת', 'Kiryat Gat'], ['עכו', 'Acre'], ['כרמיאל', 'Karmiel'], ['טבריה', 'Tiberias'], ['רמת השרון', 'Ramat HaSharon'],
  ['יבנה', 'Yavne'], ['אור יהודה', 'Or Yehuda'], ['קריית מוצקין', 'Kiryat Motzkin'], ['קריית ביאליק', 'Kiryat Bialik'], ['נס ציונה', 'Ness Ziona'],
  ['צפת', 'Safed'], ['דימונה', 'Dimona'], ['זכרון יעקב', "Zikhron Ya'akov"], ['קיסריה', 'Caesarea'], ['שוהם', 'Shoham'],
].map(([he, en]) => ({ he, en, slug: en.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') }));
const key = s => String(s || '').toLowerCase().replace(/[\s\-'׳"]+/g, '');
const ALIASES = { [key('תל אביב')]: 'Tel Aviv-Yafo', [key('Tel Aviv')]: 'Tel Aviv-Yafo', [key('מודיעין')]: "Modi'in-Maccabim-Re'ut", [key('Modiin')]: "Modi'in-Maccabim-Re'ut", [key('באר-שבע')]: 'Beersheba', [key('Beer Sheva')]: 'Beersheba' };
export function findCity(name) {
  const k = key(name); const alias = ALIASES[k];
  return ISRAELI_CITIES.find(c => alias ? c.en === alias : key(c.he) === k || key(c.en) === k) || null;
}
// Returns the city's name in the requested language when it's a known Israeli city, else the input unchanged.
export const localizeCity = (name, lang) => { const c = findCity(name); return c ? c[lang] : String(name).trim(); };
export const citySlug = name => findCity(name)?.slug || String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'city';
