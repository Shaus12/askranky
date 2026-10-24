// Buyer-intent question templates. Hebrew templates are used when the business is Hebrew
// (lang:'he', or Hebrew letters in category/city).
import { localizeCity } from './cities.js';
// {cat} = category, {city} = city, {inCity} = city with the Hebrew "ב" prefix ("בתל אביב-יפו", "ב-Dubai").
// Category-specific question sets (5 per free scan, more for paid plans). Each set: 15 EN + 15 HE templates.
// The "generic" set is the original 15-question list. "health" and "services" start with the same first five generic
// templates on purpose: scripts/day1-scan.js checks the verbatim spec questions for "dentist"/"רופא שיניים" (health set).
const GENERIC_EN = [
  'What are the best businesses for {cat} in {city}?',
  'Recommend a reliable {cat} business in {city}.',
  'Who are the top-rated {cat} businesses near {city}?',
  'I need affordable {cat} in {city}, who should I call?',
  'Which {cat} businesses in {city} have the best reviews?',
  'Who offers emergency {cat} in {city} and is open now?',
  'What are the best {cat} businesses in {city} for families?',
  'Which {cat} business in {city} is most trusted according to reviews?',
  'Compare the top 3 {cat} businesses in {city}.',
  'Which {cat} business in {city} has the highest rating on Google?',
  'Is there a good {cat} business in {city} that offers free consultations?',
  'Which {cat} businesses in {city} do locals recommend?',
  'Which {cat} business in {city} offers the best value for money?',
  'What are the top {cat} businesses in {city} for first-time customers?',
  'Who should I hire for {cat} in {city}?',
];
const GENERIC_HE = [
  'מי העסקים הטובים ביותר בתחום {cat} {inCity}?',
  'תמליץ לי על עסק אמין בתחום {cat} {inCity}.',
  'אילו עסקים בתחום {cat} עם הדירוג הכי גבוה יש באזור {city}?',
  'אני מחפש עסק בתחום {cat} במחיר סביר {inCity}, למי כדאי להתקשר?',
  'לאילו עסקים בתחום {cat} {inCity} יש את הביקורות הכי טובות?',
  'איזה עסק בתחום {cat} {inCity} נותן שירות חירום ופתוח עכשיו?',
  'אילו עסקים בתחום {cat} {inCity} הכי מתאימים למשפחות?',
  'איזה עסק בתחום {cat} {inCity} הכי אמין לפי ביקורות?',
  'השווה בין שלושת העסקים המובילים בתחום {cat} {inCity}.',
  'איזה עסק בתחום {cat} {inCity} מקבל את הציון הכי גבוה בגוגל?',
  'יש עסק טוב בתחום {cat} {inCity} שמציע ייעוץ ראשוני חינם?',
  'אילו עסקים בתחום {cat} {inCity} התושבים ממליצים עליהם?',
  'איזה עסק בתחום {cat} {inCity} נותן את התמורה הכי טובה למחיר?',
  'אילו עסקים בתחום {cat} {inCity} מומלצים ללקוח חדש?',
  'את מי כדאי לשכור בתחום {cat} {inCity}?',
];
const FIRST5_EN = GENERIC_EN.slice(0, 5), FIRST5_HE = GENERIC_HE.slice(0, 5);
export const SETS = {
  hospitality: {
    en: ['What are the best hotels and places to stay in {city}?', 'Recommend a great {cat} in {city} for a weekend getaway.', 'Which hotels in {city} have the best guest reviews?', 'Where should I stay in {city} for a luxury vacation?', 'What are the best value-for-money places to stay in {city}?',
      'Which hotels in {city} are best for families with kids?', 'Which hotels in {city} are best for a romantic couple\'s trip?', 'Which {cat} in {city} has the best breakfast and facilities (pool, spa)?', 'Compare the top 3 hotels in {city}.', 'Which hotels in {city} are closest to the beach or main attractions?',
      'Which hotels in {city} are best for business travelers?', 'Which boutique hotels in {city} do travelers recommend?', 'Which hotels in {city} have the highest rating on Google and Booking?', 'Where do locals recommend visitors stay in {city}?', 'What is the most trusted hotel in {city} according to reviews?'],
    he: ['מהם המלונות ומקומות הלינה הטובים ביותר {inCity}?', 'תמליץ לי על מקום אירוח מעולה בתחום {cat} {inCity} לסוף שבוע.', 'לאילו מלונות {inCity} יש את חוות הדעת הכי טובות מאורחים?', 'איפה כדאי לי להתארח {inCity} לחופשת יוקרה?', 'מהם מקומות הלינה עם התמורה הכי טובה למחיר {inCity}?',
      'אילו מלונות {inCity} הכי מתאימים למשפחות עם ילדים?', 'אילו מלונות {inCity} הכי מתאימים לחופשה רומנטית לזוג?', 'לאיזה מלון {inCity} יש את ארוחת הבוקר והמתקנים הכי טובים (בריכה, ספא)?', 'השווה בין שלושת המלונות המובילים {inCity}.', 'אילו מלונות {inCity} הכי קרובים לחוף או לאטרקציות המרכזיות?',
      'אילו מלונות {inCity} הכי מתאימים לאנשי עסקים?', 'אילו מלונות בוטיק {inCity} מטיילים ממליצים עליהם?', 'לאילו מלונות {inCity} יש את הדירוג הכי גבוה בגוגל ובבוקינג?', 'איפה התושבים ממליצים לאורחים להתארח {inCity}?', 'איזה מלון {inCity} הכי אמין לפי ביקורות?'] },
  food: {
    en: ['What are the best places for {cat} in {city}?', 'Recommend a great {cat} in {city} for dinner tonight.', 'Which {cat} places in {city} have the best reviews?', 'Where can I find good, affordable {cat} in {city}?', 'Which {cat} in {city} do locals recommend?',
      'What is the best {cat} in {city} for a date night?', 'Which {cat} places in {city} are family-friendly?', 'Which {cat} in {city} has the highest rating on Google?', 'Compare the top 3 {cat} places in {city}.', 'Which {cat} in {city} offers delivery or takeaway?',
      'Which {cat} in {city} is best for a group or a celebration?', 'Which {cat} places in {city} have vegetarian or vegan options?', 'Which {cat} in {city} offers the best value for money?', 'What is a hidden-gem {cat} in {city}?', 'Which {cat} in {city} is open late?'],
    he: ['מהם המקומות הכי טובים בתחום {cat} {inCity}?', 'תמליץ לי על מקום מעולה בתחום {cat} {inCity} לארוחת ערב הערב.', 'לאילו מקומות בתחום {cat} {inCity} יש את הביקורות הכי טובות?', 'איפה אפשר למצוא {cat} טוב ובמחיר סביר {inCity}?', 'אילו מקומות בתחום {cat} {inCity} התושבים ממליצים עליהם?',
      'איזה מקום בתחום {cat} {inCity} הכי מתאים לדייט?', 'אילו מקומות בתחום {cat} {inCity} מתאימים למשפחות?', 'איזה מקום בתחום {cat} {inCity} מקבל את הציון הכי גבוה בגוגל?', 'השווה בין שלושת המקומות המובילים בתחום {cat} {inCity}.', 'איזה מקום בתחום {cat} {inCity} מציע משלוחים או טייק אוויי?',
      'איזה מקום בתחום {cat} {inCity} הכי מתאים לקבוצה או לחגיגה?', 'לאילו מקומות בתחום {cat} {inCity} יש אפשרויות צמחוניות או טבעוניות?', 'איזה מקום בתחום {cat} {inCity} נותן את התמורה הכי טובה למחיר?', 'מהו מקום פחות מוכר אבל מעולה בתחום {cat} {inCity}?', 'איזה מקום בתחום {cat} {inCity} פתוח עד מאוחר?'] },
  retail: {
    en: ['What are the best stores for {cat} in {city}?', 'Where should I buy {cat} in {city}?', 'Which {cat} stores in {city} have the best reviews?', 'Where can I find affordable {cat} in {city}?', 'Which {cat} store in {city} do locals recommend?',
      'Which {cat} store in {city} has the best selection?', 'Which {cat} store in {city} has the best customer service?', 'Which {cat} store in {city} has the highest rating on Google?', 'Compare the top 3 {cat} stores in {city}.', 'Which {cat} store in {city} is best for gifts?',
      'Which {cat} stores in {city} offer delivery or online ordering?', 'Which {cat} store in {city} offers the best value for money?', 'Which {cat} store in {city} is the most trusted?', 'What are the best high-end {cat} stores in {city}?', 'Which independent {cat} shops in {city} are worth visiting?'],
    he: ['מהן החנויות הטובות ביותר בתחום {cat} {inCity}?', 'איפה כדאי לקנות בתחום {cat} {inCity}?', 'לאילו חנויות בתחום {cat} {inCity} יש את הביקורות הכי טובות?', 'איפה אפשר למצוא {cat} במחיר סביר {inCity}?', 'איזו חנות בתחום {cat} {inCity} התושבים ממליצים עליה?',
      'לאיזו חנות בתחום {cat} {inCity} יש את המבחר הכי גדול?', 'לאיזו חנות בתחום {cat} {inCity} יש את השירות הכי טוב?', 'איזו חנות בתחום {cat} {inCity} מקבלת את הציון הכי גבוה בגוגל?', 'השווה בין שלוש החנויות המובילות בתחום {cat} {inCity}.', 'איזו חנות בתחום {cat} {inCity} הכי מתאימה לקניית מתנה?',
      'אילו חנויות בתחום {cat} {inCity} מציעות משלוח או הזמנה אונליין?', 'איזו חנות בתחום {cat} {inCity} נותנת את התמורה הכי טובה למחיר?', 'איזו חנות בתחום {cat} {inCity} הכי אמינה?', 'מהן חנויות היוקרה הטובות ביותר בתחום {cat} {inCity}?', 'אילו חנויות עצמאיות בתחום {cat} {inCity} שוות ביקור?'] },
  health: {
    en: [...FIRST5_EN, 'Which {cat} in {city} is accepting new patients or clients?', 'Which {cat} businesses in {city} do locals recommend?', 'Which {cat} business in {city} is most trusted according to reviews?', 'Compare the top 3 {cat} businesses in {city}.', 'Which {cat} business in {city} has the highest rating on Google?',
      'Which {cat} in {city} is best for children?', 'Which {cat} in {city} has the most experienced professionals?', 'Which {cat} business in {city} offers the best value for money?', 'Which {cat} in {city} can see me this week?', 'What are the top {cat} businesses in {city} for first-time customers?'],
    he: [...FIRST5_HE, 'איזה עסק בתחום {cat} {inCity} מקבל לקוחות חדשים?', 'אילו עסקים בתחום {cat} {inCity} התושבים ממליצים עליהם?', 'איזה עסק בתחום {cat} {inCity} הכי אמין לפי ביקורות?', 'השווה בין שלושת העסקים המובילים בתחום {cat} {inCity}.', 'איזה עסק בתחום {cat} {inCity} מקבל את הציון הכי גבוה בגוגל?',
      'איזה עסק בתחום {cat} {inCity} הכי מתאים לילדים?', 'לאיזה עסק בתחום {cat} {inCity} יש את אנשי המקצוע הכי מנוסים?', 'איזה עסק בתחום {cat} {inCity} נותן את התמורה הכי טובה למחיר?', 'איזה עסק בתחום {cat} {inCity} יכול לקבל אותי השבוע?', 'אילו עסקים בתחום {cat} {inCity} מומלצים ללקוח חדש?'] },
  services: { en: [...FIRST5_EN, ...GENERIC_EN.slice(5)], he: [...FIRST5_HE, ...GENERIC_HE.slice(5)] },
  generic: {
    en: [...FIRST5_EN, 'Which {cat} businesses in {city} do locals recommend?', 'Which {cat} business in {city} is most trusted according to reviews?', 'Compare the top 3 {cat} businesses in {city}.', 'Which {cat} business in {city} has the highest rating on Google?', 'Which {cat} business in {city} offers the best value for money?',
      'What are the top {cat} businesses in {city} for first-time customers?', 'What are the best {cat} businesses in {city} for families?', 'Which {cat} business in {city} has the best customer service?', 'Which {cat} business in {city} has been around the longest?', 'Which new {cat} businesses in {city} are getting good reviews?'],
    he: [...FIRST5_HE, 'אילו עסקים בתחום {cat} {inCity} התושבים ממליצים עליהם?', 'איזה עסק בתחום {cat} {inCity} הכי אמין לפי ביקורות?', 'השווה בין שלושת העסקים המובילים בתחום {cat} {inCity}.', 'איזה עסק בתחום {cat} {inCity} מקבל את הציון הכי גבוה בגוגל?', 'איזה עסק בתחום {cat} {inCity} נותן את התמורה הכי טובה למחיר?',
      'אילו עסקים בתחום {cat} {inCity} מומלצים ללקוח חדש?', 'אילו עסקים בתחום {cat} {inCity} הכי מתאימים למשפחות?', 'לאיזה עסק בתחום {cat} {inCity} יש את השירות הכי טוב?', 'איזה עסק בתחום {cat} {inCity} פועל הכי הרבה שנים?', 'אילו עסקים חדשים בתחום {cat} {inCity} מקבלים ביקורות טובות?'] },
};
// Category text (free text, he/en) -> set. Long keywords match as substrings, short ones (<= 3 letters) as whole words.
const KEYWORDS = {
  hospitality: ['hotel', 'hostel', 'motel', 'resort', 'guest house', 'guesthouse', 'b&b', 'bnb', 'bed and breakfast', 'lodging', 'accommodation', 'zimmer', 'inn', 'מלון', 'מלונאות', 'צימר', 'אכסני', 'הוסטל', 'לינה', 'אירוח', 'נופש', 'וילה', 'ריזורט'],
  food: ['restaurant', 'cafe', 'café', 'coffee', 'bakery', 'pizza', 'sushi', 'burger', 'bistro', 'catering', 'food', 'bar', 'pub', 'deli', 'patisserie', 'ice cream', 'falafel', 'hummus', 'shawarma', 'מסעד', 'קפה', 'בית קפה', 'מאפי', 'פיצ', 'סושי', 'המבורגר', 'ביסטרו', 'קייטרינג', 'אוכל', 'בר', 'פאב', 'גלידה', 'פלאפל', 'חומוס', 'שווארמה', 'קונדיטור', 'שף'],
  retail: ['store', 'shop', 'boutique', 'jewel', 'clothing', 'fashion', 'furniture', 'florist', 'flowers', 'electronics', 'books', 'toys', 'shoes', 'optic', 'eyewear', 'gift', 'חנות', 'חנויות', 'תכשיט', 'בגד', 'אופנה', 'רהיט', 'פרחים', 'אלקטרוניקה', 'ספרים', 'צעצוע', 'נעליים', 'אופטיק', 'משקפ', 'מתנות', 'בוטיק'],
  health: ['dentist', 'dental', 'doctor', 'clinic', 'physio', 'therap', 'psycholog', 'beauty', 'cosmetic', 'salon', 'hair', 'barber', 'nail', 'spa', 'massage', 'gym', 'fitness', 'pilates', 'yoga', 'vet', 'optometr', 'dermatolog', 'pharmacy', 'שיניים', 'רופא', 'מרפא', 'פיזיותרפ', 'טיפול', 'פסיכולוג', 'יופי', 'קוסמטי', 'מספרה', 'ספר', 'שיער', 'ציפורניים', 'ספא', 'עיסוי', 'כושר', 'פילאטיס', 'יוגה', 'וטרינר', 'דיאטנ', 'בית מרקחת', 'אסתטיק'],
  services: ['plumb', 'electric', 'lawyer', 'attorney', 'law firm', 'accountant', 'locksmith', 'moving', 'movers', 'cleaning', 'contractor', 'renovat', 'air condition', 'hvac', 'garage', 'mechanic', 'insurance', 'real estate', 'realtor', 'photograph', 'pest', 'roof', 'painter', 'handyman', 'consult', 'agency', 'marketing', 'אינסטלטור', 'אינסטלציה', 'חשמלאי', 'עורך דין', 'עורכי דין', 'עו"ד', 'רואה חשבון', 'רואי חשבון', 'הנהלת חשבונות', 'מנעולן', 'הובלות', 'ניקיון', 'קבלן', 'שיפוצ', 'מזגנ', 'מוסך', 'ביטוח', 'נדל', 'תיווך', 'צלם', 'הדברה', 'גגות', 'צבעי', 'הנדימן', 'ייעוץ', 'יועץ', 'סוכנות', 'שיווק'],
};
const ORDER = ['hospitality', 'food', 'health', 'services', 'retail'];
export function categorySet(category) {
  const c = ` ${String(category || '').toLowerCase().replace(/[׳״'"]/g, '"').replace(/[^\p{L}\p{N}&" ]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
  const words = c.trim().split(' ').map(w => [w, w.replace(/^[הובלמש](?=\p{L}{2,})/u, '')]).flat();
  for (const set of ORDER) if (KEYWORDS[set].some(k => k.length <= 3 ? words.includes(k) : c.includes(k))) return set;
  return 'generic';
}
// Back-compat: TEMPLATES is the generic set (the original list).
export const TEMPLATES = { en: SETS.generic.en, he: SETS.generic.he };
export const HEBREW = /[\u0590-\u05FF]/;
export const businessLang = b => (b.lang === 'he' || b.lang === 'en') ? b.lang : (HEBREW.test(`${b.category || ''}${b.city || ''}${b.name || ''}`) ? 'he' : 'en');
export function buildQuestions(business, limit) {
  const lang = businessLang(business);
  const cat = lang === 'he' ? business.category.trim() : business.category.toLowerCase();
  const city = localizeCity(business.city, lang);
  // Hebrew "ב" prefix is glued to Hebrew names ("בחיפה") and hyphenated to Latin/digit names ("ב-Haifa").
  const inCity = /^[\u0590-\u05FF]/.test(city) ? `ב${city}` : `ב-${city}`;
  return SETS[categorySet(business.category)][lang].slice(0, limit).map(t => t.replaceAll('{cat}', cat).replaceAll('{inCity}', inCity).replaceAll('{city}', city));
}
