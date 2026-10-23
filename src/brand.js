// Single place to change the brand. Everything else reads from here.
export const BRAND = {
  name: process.env.BRAND_NAME || 'Ranky',
  domain: process.env.BRAND_DOMAIN || 'askranky.com',
  tagline: 'Ask Ranky if AI recommends you.',
  supportEmail: process.env.SUPPORT_EMAIL || 'shaysho1111@gmail.com',
  legalEntity: process.env.LEGAL_ENTITY || 'Shai Shotashvili',
  legalEntityHe: process.env.LEGAL_ENTITY_HE || 'שי שוטשוילי',
  entityId: process.env.LEGAL_ENTITY_ID || '322713082',            // עוסק פטור / Exempt Dealer
  entityType: 'Exempt Dealer (Osek Patur)', entityTypeHe: 'עוסק פטור',
  address: process.env.LEGAL_ADDRESS || 'Etzel 8, Bat Yam, Israel',
  addressHe: process.env.LEGAL_ADDRESS_HE || 'אצ"ל 8, בת ים, ישראל',
  privacyEmail: process.env.PRIVACY_EMAIL || 'shaysho1111@gmail.com',
  accessibilityEmail: process.env.ACCESSIBILITY_EMAIL || 'shaysho1111@gmail.com',
  color: '#0B1B3F',
};
