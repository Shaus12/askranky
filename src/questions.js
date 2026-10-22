// Buyer-intent question templates. Hebrew templates are used when the business is Hebrew
// (lang:'he', or Hebrew letters in category/city). {cat} = category, {city} = city.
import { localizeCity } from './cities.js';
const EN = [
  'What is the best {cat} in {city}?',
  'Recommend a reliable {cat} in {city}.',
  'Who are the top-rated {cat}s near {city}?',
  'I need an affordable {cat} in {city}, who should I call?',
  'Which {cat} in {city} has the best reviews?',
  'Emergency {cat} in {city} open now?',
  'Best {cat} in {city} for families?',
  'Most trusted {cat} in {city} according to reviews?',
  'Compare the top 3 {cat}s in {city}.',
  'Who is the highest-rated {cat} in {city} on Google?',
  'Is there a good {cat} in {city} that offers free consultations?',
  'Which {cat} in {city} do locals recommend?',
  'Best value {cat} in {city}?',
  'Top {cat} in {city} for first-time customers?',
  'Who should I hire as a {cat} in {city}?',
];
// Phrased with "{cat}" as a noun in apposition (e.g. "המלצה על {cat}") so no Hebrew plural/construct forms are needed.
const HE = [
  'מי ה{cat} הכי טוב ב{city}?',
  'תמליץ לי על {cat} אמין ב{city}.',
  'מי ה{cat} עם הדירוג הכי גבוה באזור {city}?',
  'אני צריך {cat} במחיר סביר ב{city}, למי כדאי להתקשר?',
  'לאיזה {cat} ב{city} יש את הביקורות הכי טובות?',
  '{cat} חירום ב{city} שפתוח עכשיו?',
  'איזה {cat} ב{city} הכי מתאים למשפחות?',
  'מי ה{cat} הכי אמין ב{city} לפי ביקורות?',
  'השווה בין שלוש האפשרויות המובילות ל{cat} ב{city}.',
  'איזה {cat} ב{city} מקבל את הציון הכי גבוה בגוגל?',
  'יש {cat} טוב ב{city} שמציע ייעוץ ראשוני חינם?',
  'איזה {cat} ב{city} התושבים ממליצים עליו?',
  'איזה {cat} ב{city} נותן את התמורה הכי טובה למחיר?',
  'המלצה על {cat} ב{city} ללקוח חדש?',
  'את מי כדאי לשכור בתור {cat} ב{city}?',
];
export const TEMPLATES = { en: EN, he: HE };
export const HEBREW = /[\u0590-\u05FF]/;
export const businessLang = b => (b.lang === 'he' || b.lang === 'en') ? b.lang : (HEBREW.test(`${b.category || ''}${b.city || ''}${b.name || ''}`) ? 'he' : 'en');
export function buildQuestions(business, limit) {
  const lang = businessLang(business);
  const cat = lang === 'he' ? business.category.trim() : business.category.toLowerCase();
  const city = localizeCity(business.city, lang);
  return TEMPLATES[lang].slice(0, limit).map(t => t.replaceAll('{cat}', cat).replaceAll('{city}', city));
}
