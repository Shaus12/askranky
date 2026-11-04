// free-3-actions: exactly 3 concrete steps a business owner can do today, for free, shown in the FREE result (no email, no payment).
// Deterministic and rule-based: every step is picked from this scan's own data (named or not, per engine, how many other businesses the
// answers named, whether the owner's site was cited, detail conflicts the answers showed, clarifying answers, website on file) and
// personalized with the business name, trade and city. No invented numbers, no promised outcome ("may help"), only ChatGPT and Gemini.
// Other businesses are never named here (only counted). The email unlock keeps the deeper plan (scan.fixes: ready-to-copy texts, sources).
import { businessLang } from './questions.js';
const ENG = { chatgpt: 'ChatGPT', gemini: 'Gemini' };
const T = {
  he: {
    effort: m => `בערך ${m} דקות`,
    conflict: (b, f) => ({ title: 'לתקן פרטים שמופיעים לא נכון', what: `עברו על פרופיל העסק בגוגל ועל האתר ובדקו את ${f.type === 'city' ? 'העיר' : f.type === 'phone' ? 'מספר הטלפון' : 'הפרטים'} של ${b.name}. תקנו כל מקום שבו כתוב משהו אחר ממה שנכון.`, why: `באחת התשובות בסריקה הופיע פרט על העסק שלא תואם למה שהזנתם${f.said ? ` ("${f.said}")` : ''}.` }),
    gbp: (b, s) => ({ title: 'להשלים את פרופיל העסק בגוגל', what: `ודאו שבפרופיל העסק בגוגל השם הוא "${b.name}", הקטגוריה היא ${b.category}, העיר היא ${b.city}, ויש טלפון, שעות פתיחה ורשימת שירותים.`, why: `בסריקה הזו ChatGPT ו-Gemini לא הזכירו את ${b.name} באף אחת מ-${s.checks} התשובות. פרופיל מלא וברור יכול לעזור להם לזהות את העסק.` }),
    oneEngine: (b, yes, no) => ({ title: `לחזק את הפרטים במקומות ש-${no} קורא`, what: `הוסיפו או עדכנו את ${b.name} באינדקסים עסקיים מקומיים ובפרופיל העסק בגוגל, עם אותו שם, אותו טלפון ו"${b.category} ב${b.city}".`, why: `${yes} הזכיר את העסק בסריקה הזו, אבל ${no} לא.` }),
    reviews: (b, s) => ({ title: 'לבקש היום 3 ביקורות מלקוחות', what: `שלחו ל-3 לקוחות מרוצים קישור לביקורת בגוגל, ובקשו שיכתבו במילים שלהם איזה שירות קיבלו ושזה היה ב${b.city}.`, why: !s.others ? `ביקורות עדכניות שמזכירות את השירות ואת ${b.city} נותנות ל-ChatGPT ול-Gemini מידע ברור יותר על העסק.` : s.named ? `ChatGPT ו-Gemini הזכירו את העסק רק בחלק מהתשובות, ולצדו ${s.others === 1 ? 'עסק אחר אחד' : `${s.others} עסקים אחרים`}.` : `בתשובות על ${b.category} ב${b.city} ${s.others === 1 ? 'נזכר עסק אחר אחד' : `נזכרו ${s.others} עסקים אחרים`} בשמם, והעסק שלכם לא נזכר.` }),
    site: (b) => ({ title: 'לפתוח עמוד אינטרנט פשוט לעסק', what: `צרו עמוד אחד (אפשר גם בכלי חינמי) שכתוב בו בבירור: ${b.name}, ${b.category} ב${b.city}, השירותים, הטלפון ושעות הפעילות.`, why: 'לא הזנתם אתר לעסק, ובתשובות של הסריקה לא צוטט אתר של העסק כמקור.' }),
    page: (b) => ({ title: `להוסיף לאתר עמוד "${b.category} ב${b.city}"`, what: `כתבו באתר עמוד קצר שעונה ישירות: מה ${b.name} עושה, באילו אזורים ב${b.city} והסביבה, מה המחיר בערך ואיך מתקשרים.`, why: 'האתר שלכם לא צוטט כמקור באף אחת מהתשובות בסריקה.' }),
    clarity: (b) => ({ title: 'לכתוב משפט אחד ברור על העסק', what: `נסחו משפט אחד: "${b.name} – ${b.category} ב${b.city}", ושימו אותו בראש האתר, בפרופיל בגוגל וברשתות החברתיות.`, why: 'בחלק מהתשובות המנוע ביקש הבהרה במקום לענות, סימן שלא היה לו ברור על מה מדובר.' }),
    consistent: (b) => ({ title: 'שם, טלפון ועיר זהים בכל מקום', what: `בדקו את ${b.name} בגוגל, בפייסבוק, באינדקסים ובאתר: השם, הטלפון והעיר צריכים להיות כתובים אותו דבר בדיוק.`, why: 'פרטים אחידים עוזרים ל-ChatGPT ול-Gemini להבין שמדובר באותו עסק.' }),
    keep: (b, s) => ({ title: 'לשמור על הפרופיל מעודכן', what: `עדכנו היום בפרופיל העסק בגוגל תמונה, שעות פתיחה ושירות אחד של ${b.name}, וענו לביקורות האחרונות.`, why: `${b.name} הוזכר ב-${s.mentions} מתוך ${s.checks} התשובות. מידע עדכני יכול לעזור לשמור על זה.` }),
  },
  en: {
    effort: m => `About ${m} minutes`,
    conflict: (b, f) => ({ title: 'Fix details that appear wrong', what: `Go over your Google Business Profile and website and make sure the ${f.type === 'city' ? 'city' : f.type === 'phone' ? 'phone number' : 'details'} for ${b.name} match yours exactly. Correct any place that says otherwise.`, why: `One of the answers in this scan showed a detail about the business that does not match what you entered${f.said ? ` ("${f.said}")` : ''}.` }),
    gbp: (b, s) => ({ title: 'Complete your Google Business Profile', what: `Make sure your Google Business Profile shows the name "${b.name}", the category ${b.category}, the city ${b.city}, plus phone, opening hours and a list of services.`, why: `In this scan ChatGPT and Gemini did not mention ${b.name} in any of the ${s.checks} answers. A complete, clear profile may help them recognize the business.` }),
    oneEngine: (b, yes, no) => ({ title: `Strengthen your details where ${no} looks`, what: `Add or update ${b.name} in local business directories and on your Google Business Profile, with the same name, the same phone and "${b.category} in ${b.city}".`, why: `${yes} mentioned the business in this scan, but ${no} did not.` }),
    reviews: (b, s) => ({ title: 'Ask 3 customers for a review today', what: `Send 3 happy customers your Google review link and ask them to say, in their own words, what service they got and that it was in ${b.city}.`, why: !s.others ? `Recent reviews that mention the service and ${b.city} give ChatGPT and Gemini clearer information about the business.` : s.named ? `ChatGPT and Gemini mentioned the business in only some answers, alongside ${s.others === 1 ? 'one other business' : `${s.others} other businesses`}.` : `Answers about ${b.category} in ${b.city} named ${s.others === 1 ? 'one other business' : `${s.others} other businesses`}, and ${b.name} was not named.` }),
    site: (b) => ({ title: 'Put up a simple web page for the business', what: `Create one page (a free tool is fine) that clearly says: ${b.name}, ${b.category} in ${b.city}, your services, phone and hours.`, why: 'You did not enter a website, and no site of the business was cited as a source in this scan.' }),
    page: (b) => ({ title: `Add a "${b.category} in ${b.city}" page to your site`, what: `Write a short page that answers directly: what ${b.name} does, which areas of ${b.city} you serve, a rough price and how to call.`, why: 'Your website was not cited as a source in any answer in this scan.' }),
    clarity: (b) => ({ title: 'Write one clear sentence about the business', what: `Write one sentence: "${b.name} – ${b.category} in ${b.city}" and put it at the top of your site, your Google profile and your social pages.`, why: 'In some answers the engine asked for clarification instead of answering, a sign it was not sure what you meant.' }),
    consistent: (b) => ({ title: 'Same name, phone and city everywhere', what: `Check ${b.name} on Google, Facebook, directories and your site: name, phone and city should be written exactly the same.`, why: 'Consistent details help ChatGPT and Gemini understand it is the same business.' }),
    keep: (b, s) => ({ title: 'Keep your profile fresh', what: `Today, add a photo, your hours and one service of ${b.name} to your Google Business Profile, and reply to recent reviews.`, why: `${b.name} was mentioned in ${s.mentions} of ${s.checks} answers. Up-to-date info may help keep it that way.` }),
  },
};
// scan: { summary, results? }  business: { name, city, category, website? }  -> exactly 3 { id, title, what, why, effort }
export function buildActions(scan, business, lang) {
  const L = lang === 'he' || lang === 'en' ? lang : businessLang(business) === 'he' ? 'he' : 'en'; const t = T[L];
  const b = { name: String(business?.name || '').trim(), city: String(business?.city || '').trim(), category: String(business?.category || '').trim() || (L === 'he' ? 'העסק' : 'business'), website: business?.website };
  const sum = scan?.summary || {}; const ok = (scan?.results || []).filter(r => r && !r.error);
  const checks = sum.checks ?? ok.length; const mentions = Math.round((sum.mentionRate || 0) * checks);
  const others = (sum.topCompetitors || []).length; const named = mentions > 0;
  const by = sum.byEngine || {}; const ran = (sum.engines?.ran || Object.keys(by)).filter(e => ENG[e] && by[e]?.checks > 0);
  const hit = ran.filter(e => by[e].mentions > 0), miss = ran.filter(e => by[e].mentions === 0);
  const conflict = (sum.facts?.conflicts || [])[0];
  const s = { checks, mentions, others, named };
  const cand = [];
  const add = (id, prio, mins, c) => cand.push({ id, prio, effort: t.effort(mins), ...c });
  if (conflict) add('fix-details', 100, 15, t.conflict(b, conflict));
  if (!named) add('google-profile', 90, 20, t.gbp(b, s));
  if (named && hit.length && miss.length) add('engine-gap', 85, 20, t.oneEngine(b, ENG[hit[0]], ENG[miss[0]]));
  add('reviews', others > 0 && (sum.mentionRate || 0) < 0.5 ? 80 : 30, 15, t.reviews(b, s));
  if (!b.website) add('web-page', 75, 45, t.site(b)); else if (!sum.ownSiteCited) add('city-page', 70, 40, t.page(b));
  if (sum.clarifyingAnswers) add('clarity', 65, 10, t.clarity(b));
  add('consistent', 50, 20, t.consistent(b));
  if (named) add('keep-fresh', 40, 15, t.keep(b, s));
  const seen = new Set(); return cand.sort((x, y) => y.prio - x.prio).filter(c => !seen.has(c.id) && seen.add(c.id)).slice(0, 3).map(({ prio, ...c }) => c);
}
