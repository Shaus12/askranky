import type { Locale } from "@/lib/i18n";
import { founderFor, FOUNDER_PHOTO, FOUNDER_PHOTO_IS_PLACEHOLDER } from "@/lib/founder";
import WhatsAppLink from "./WhatsAppLink";
/** Home-page founder block: photo slot (placeholder until Shai adds one), neutral text, email + WhatsApp (hidden until WHATSAPP_NUMBER is set). */
export default function Founder({ lang }: { lang: Locale }) {
  const f = founderFor(lang);
  return (
    <div data-reveal data-founder className="card mx-auto mt-10 grid max-w-3xl items-center gap-6 p-6 sm:grid-cols-[120px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FOUNDER_PHOTO} alt={f.photoAlt} width={120} height={120} className="mx-auto h-[120px] w-[120px] rounded-full object-cover" data-placeholder={FOUNDER_PHOTO_IS_PLACEHOLDER ? "1" : undefined} />
      <div className="text-center sm:text-start">
        <p className="text-lg font-bold text-white">{f.name}</p><p className="text-sm text-slate-400">{f.role}</p>
        <p className="mt-3 text-slate-300">{f.body}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
          <a className="btn-outline" href="mailto:shaysho1111@gmail.com">{f.email}</a>
          <WhatsAppLink label={f.whatsapp} className="btn-cta" />
        </div>
      </div>
    </div>);
}
