// Single place to change the brand. Everything else reads from here.
export const BRAND = {
  name: process.env.BRAND_NAME || 'Ranky',
  domain: process.env.BRAND_DOMAIN || 'askranky.com',
  tagline: 'Ask Ranky if AI recommends you.',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@askranky.com',
  legalEntity: process.env.LEGAL_ENTITY || '[Owner legal name / עוסק number]',
  color: '#0B1B3F',
};
