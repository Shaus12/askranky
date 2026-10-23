// Turn scan results into 3 concrete, prioritized fixes (Hebrew copy for Hebrew businesses).
import { businessLang } from './questions.js';
import { isOpaqueHost } from './extract.js';
// Never recommend a redirector (e.g. Gemini's vertexaisearch.cloud.google.com grounding links; also covers scans stored before the fix).
const realSource = r => r.topCitedHosts.find(h => !h.isOwnSite && !isOpaqueHost(h.host));
export function buildFixes(scan, business) {
  if (businessLang(business) === 'he') return buildFixesHe(scan, business);
  const fixes = [];
  const r = scan.summary;
  if (r.mentionRate < 0.5) fixes.push({ title: 'Add a 60-word direct answer to your homepage', why: `AI engines mentioned you in only ${Math.round(r.mentionRate * 100)}% of answers. They lift short, self-contained answers.`,
    copy: `${business.name} is a ${business.category.toLowerCase()} in ${business.city} offering [top 3 services]. We are rated [X]/5 from [N] reviews, open [hours], and serve [neighborhoods]. Call [phone] for a free quote.` });
  const topSource = realSource(r);
  if (topSource) fixes.push({ title: `Get listed on ${topSource.host}`, why: `${topSource.host} was cited ${topSource.count}x in answers about your category. AI copies from pages like this.`,
    copy: `Hi, I run ${business.name}, a ${business.category.toLowerCase()} in ${business.city}. I'd love to be considered for your "${business.category} in ${business.city}" list. Happy to share reviews, licences and photos.` });
  const comp = r.topCompetitors[0];
  if (comp) fixes.push({ title: `Publish an honest "${business.name} vs ${comp.name}" page`, why: `${comp.name} was named ${comp.count}x. AI leans on comparison pages when choosing vendors.`,
    copy: `## ${business.name} vs ${comp.name}\n| | ${business.name} | ${comp.name} |\n|---|---|---|\n| Response time | | |\n| Price range | | |\n| Reviews | | |\n| Guarantee | | |` });
  if (!r.ownSiteCited) fixes.push({ title: 'Add an FAQ section with schema markup', why: 'Your own website was never cited as a source.', copy: `Q: How much does a ${business.category.toLowerCase()} cost in ${business.city}?\nA: [one-sentence price range answer].` });
  fixes.push({ title: 'Ask 5 happy customers for detailed Google reviews this week', why: 'Review volume and specific wording (service + city) are among the most-cited signals in local AI answers.', copy: `Hi [name], thanks for choosing ${business.name}! Would you mind leaving a quick Google review mentioning the service we did in ${business.city}? [review link]` });
  fixes.push({ title: 'Make your name, address and category identical everywhere', why: 'Inconsistent listings make AI less confident about who you are.', copy: `${business.name} · ${business.category} · ${business.city} · [phone] · [website]` });
  return fixes.slice(0, 3);
}

function buildFixesHe(scan, b) {
  const fixes = []; const r = scan.summary;
  if (r.mentionRate < 0.5) fixes.push({ title: 'הוסף לעמוד הבית תשובה ישירה של 60 מילה', why: `מנועי ה־AI הזכירו אותך רק ב־${Math.round(r.mentionRate * 100)}% מהתשובות. הם מעדיפים תשובות קצרות ועצמאיות.`,
    copy: `${b.name} הוא ${b.category} ב${b.city} שמציע [3 שירותים עיקריים]. דירוג [X]/5 מ־[N] ביקורות, פתוח [שעות], ומשרת את [שכונות]. התקשרו ל־[טלפון] להצעת מחיר חינם.` });
  const topSource = realSource(r);
  if (topSource) fixes.push({ title: `היכנס לרשימות ב־${topSource.host}`, why: `${topSource.host} צוטט ${topSource.count} פעמים בתשובות על התחום שלך. ה־AI מעתיק מעמודים כאלה.`,
    copy: `שלום, אני מ${b.name}, ${b.category} ב${b.city}. אשמח להיכלל ברשימת "${b.category} ב${b.city}" שלכם. אשמח לשלוח ביקורות, רישיונות ותמונות.` });
  const comp = r.topCompetitors[0];
  if (comp) fixes.push({ title: `פרסם עמוד השוואה כן: "${b.name} מול ${comp.name}"`, why: `${comp.name} הוזכר ${comp.count} פעמים. ה־AI נשען על עמודי השוואה כשהוא בוחר ספקים.`,
    copy: `## ${b.name} מול ${comp.name}\n| | ${b.name} | ${comp.name} |\n|---|---|---|\n| זמן תגובה | | |\n| טווח מחירים | | |\n| ביקורות | | |\n| אחריות | | |` });
  if (!r.ownSiteCited) fixes.push({ title: 'הוסף שאלות ותשובות עם סימון Schema', why: 'האתר שלך לא צוטט אף פעם כמקור.', copy: `ש: כמה עולה ${b.category} ב${b.city}?\nת: [טווח מחירים במשפט אחד]` });
  fixes.push({ title: 'בקש השבוע מ־5 לקוחות מרוצים ביקורת מפורטת בגוגל', why: 'כמות הביקורות והניסוח שלהן (שירות + עיר) הם מהאותות שהכי מצוטטים בתשובות AI מקומיות.', copy: `היי [שם], תודה שבחרת ב${b.name}! נשמח אם תכתוב ביקורת קצרה בגוגל ותציין את השירות ואת ${b.city}: [קישור]` });
  return fixes.slice(0, 3);
}
