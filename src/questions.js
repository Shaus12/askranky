// Buyer-intent question templates. Hebrew templates are used when the business is Hebrew
// (lang:'he', or Hebrew letters in category/city).
import { localizeCity } from './cities.js';
// {cat} = category, {city} = city, {inCity} = city with the Hebrew "ב" prefix ("בתל אביב-יפו", "ב-Dubai").
const EN = [
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
// "{cat}" is always introduced by "בתחום" ("in the field of"), so it works for any noun, singular or plural
// (תכשיטים, אינסטלטור, מספרה, ...) without needing Hebrew plural/construct forms or gender agreement.
const HE = [
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
export const TEMPLATES = { en: EN, he: HE };
export const HEBREW = /[\u0590-\u05FF]/;
export const businessLang = b => (b.lang === 'he' || b.lang === 'en') ? b.lang : (HEBREW.test(`${b.category || ''}${b.city || ''}${b.name || ''}`) ? 'he' : 'en');
export function buildQuestions(business, limit) {
  const lang = businessLang(business);
  const cat = lang === 'he' ? business.category.trim() : business.category.toLowerCase();
  const city = localizeCity(business.city, lang);
  // Hebrew "ב" prefix is glued to Hebrew names ("בחיפה") and hyphenated to Latin/digit names ("ב-Haifa").
  const inCity = /^[\u0590-\u05FF]/.test(city) ? `ב${city}` : `ב-${city}`;
  return TEMPLATES[lang].slice(0, limit).map(t => t.replaceAll('{cat}', cat).replaceAll('{inCity}', inCity).replaceAll('{city}', city));
}
