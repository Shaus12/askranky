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
  ['קריית שמונה', 'Kiryat Shmona'], ['מעלה אדומים', "Ma'ale Adumim"], ['אריאל', 'Ariel'], ['קריית אונו', 'Kiryat Ono'], ['גבעת שמואל', 'Givat Shmuel'],
  ['יהוד-מונוסון', 'Yehud-Monosson'], ['אור עקיבא', 'Or Akiva'], ['בית שאן', "Beit She'an"], ['סח\'נין', 'Sakhnin'], ['אום אל-פחם', 'Umm al-Fahm'],
  ['טייבה', 'Tayibe'], ['רהט', 'Rahat'], ['נוף הגליל', 'Nof HaGalil'], ['מגדל העמק', 'Migdal HaEmek'], ['קריית ים', 'Kiryat Yam'],
  ['נשר', 'Nesher'], ['טירת כרמל', 'Tirat Carmel'], ['ערד', 'Arad'], ['אופקים', 'Ofakim'], ['נתיבות', 'Netivot'],
  ['שדרות', 'Sderot'], ['גדרה', 'Gedera'], ['קדימה-צורן', 'Kadima-Zoran'], ['אבן יהודה', 'Even Yehuda'], ['כפר יונה', 'Kfar Yona'],
  ['פרדס חנה-כרכור', 'Pardes Hanna-Karkur'], ['ראש פינה', 'Rosh Pina'], ['מצפה רמון', 'Mitzpe Ramon'], ['כפר שמריהו', 'Kfar Shmaryahu'], ['סביון', 'Savyon'],
  ['באר יעקב', "Be'er Ya'akov"], ['גן יבנה', 'Gan Yavne'], ['קריית מלאכי', 'Kiryat Malakhi'], ['מבשרת ציון', 'Mevaseret Zion'], ['עתלית', 'Atlit'],
].map(([he, en]) => ({ he, en, slug: en.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') }));
const key = s => String(s || '').toLowerCase().replace(/[\s\-'׳"]+/g, '');
const ALIASES = { [key('תל אביב')]: 'Tel Aviv-Yafo', [key('Tel Aviv')]: 'Tel Aviv-Yafo', [key('מודיעין')]: "Modi'in-Maccabim-Re'ut", [key('Modiin')]: "Modi'in-Maccabim-Re'ut", [key('באר-שבע')]: 'Beersheba', [key('Beer Sheva')]: 'Beersheba', [key('הרצליה פיתוח')]: 'Herzliya', [key('Herzliya Pituach')]: 'Herzliya', [key('Herzliya Pituah')]: 'Herzliya', [key('Herzelia')]: 'Herzliya', [key('Jaffa')]: 'Tel Aviv-Yafo', [key('יפו')]: 'Tel Aviv-Yafo', [key('TLV')]: 'Tel Aviv-Yafo', [key('Eilat')]: 'Eilat', [key('Akko')]: 'Acre', [key('Nazrat Illit')]: 'Nof HaGalil' };
export function findCity(name) {
  const k = key(name); const alias = ALIASES[k];
  return ISRAELI_CITIES.find(c => alias ? c.en === alias : key(c.he) === k || key(c.en) === k) || null;
}
// Returns the city's name in the requested language when it's a known Israeli city, else the input unchanged.
export const localizeCity = (name, lang) => { const c = findCity(name); return c ? c[lang] : String(name).trim(); };
export const citySlug = name => findCity(name)?.slug || String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'city';

// Spots a city named inside the business name or website (e.g. "The Ritz-Carlton Herzliya", ritzcarlton.com/herzliya).
// Returns the matched city object when it differs from the entered city, else null. Mirrored in web/lib/city-hint.ts.
const hintText = s => ' ' + String(s || '').toLowerCase().replace(/https?:\/\//g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
export function cityHint({ name = '', website = '', city = '' } = {}) {
  const text = hintText(`${name} ${website}`), entered = findCity(city);
  const forms = c => [c.he, c.en, c.slug.replace(/-/g, ' '), c.slug.replace(/-/g, '')].map(f => hintText(f).trim()).filter(f => f.length >= 3);
  const extra = { herzliya: ['herzlia', 'herzelia', 'pituach'], 'tel-aviv-yafo': ['tel aviv', 'telaviv', 'תל אביב', 'tlv', 'jaffa', 'יפו'] };
  for (const c of ISRAELI_CITIES) {
    const fs = [...forms(c), ...(extra[c.slug] || [])];
    // Hebrew one-letter prefixes ("בהרצליה") are allowed before a Hebrew city name.
    if (fs.some(f => text.includes(` ${f} `) || (/^[\u05D0-\u05EA]/.test(f) && new RegExp(` [הובלמש]${f} `).test(text))))
      return entered && entered.slug === c.slug ? null : (key(city) && (key(city) === key(c.he) || key(city) === key(c.en)) ? null : c);
  }
  return null;
}
