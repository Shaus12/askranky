/** Ranky mark (magnifier with a sparkle, blue tile) + wordmark. The SVG is a same-origin file, so it is allowed by every page's CSP (img-src 'self'). */
export default function Logo({ brand, size = 26 }: { brand: string; size?: number }) {
  return (<span className="rk-logo" dir="ltr"><img src="/brand/ranky-symbol.svg" alt="" width={size} height={size} aria-hidden="true" /><span>{brand}</span></span>);
}
