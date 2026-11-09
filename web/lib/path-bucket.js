// First page of the tab, reduced to a bucket before it is sent. Report ids and query strings never leave the browser.
export const BUCKETS = ["he", "en", "blog", "report", "agencies", "other"];
export function pathBucket(pathname) {
  const parts = String(pathname || "").split("?")[0].split("#")[0].split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s).toLowerCase(); } catch { return String(s).toLowerCase(); } });
  const lang = parts[0] === "he" || parts[0] === "en" ? parts[0] : null;
  const rest = lang ? parts.slice(1) : parts;
  if (rest[0] === "blog") return "blog";
  if (rest[0] === "r") return "report";
  if (rest[0] === "agencies") return "agencies";
  if (lang && rest.length === 0) return lang;
  return "other";
}
