"use client";
import { useEffect, useState } from "react";
import { getConfig } from "@/lib/api";
// WhatsApp contact button: hidden until the server has a valid WHATSAPP_NUMBER (digits only, via /api/config). Plain wa.me link:
// no third-party script, nothing stored, works under the strict CSP pages too.
export default function WhatsAppLink({ label, text, className = "btn-outline" }: { label: string; text?: string; className?: string }) {
  const [n, setN] = useState<string | null>(null);
  useEffect(() => { getConfig().then((c) => setN(c.whatsapp && /^[1-9]\d{7,14}$/.test(c.whatsapp) ? c.whatsapp : null)).catch(() => {}); }, []);
  if (!n) return null;
  return <a className={className} data-whatsapp href={`https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`} target="_blank" rel="noopener noreferrer">{label}</a>;
}
