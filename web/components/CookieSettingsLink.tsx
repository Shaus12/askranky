"use client";
import { consentText } from "@/lib/i18n-consent";
import { openConsent } from "@/lib/consent";
import type { Locale } from "@/lib/i18n";
// Footer link that reopens the cookie notice (the site has no optional cookies; it shows what is stored and links to the policy).
export default function CookieSettingsLink({ lang }: { lang: Locale }) {
  return <button type="button" className="vx-link hover:text-white text-start" onClick={openConsent} data-testid="cookie-settings">{consentText[lang].settings}</button>;
}
