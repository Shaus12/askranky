/** Large confident heading with a masked rise-in (animated by a parent <Reveal>). Lines are split on "\n". */
export default function MaskHeading({ text, as: Tag = "h2", className = "vx-h2", grad = false, center = true }: { text: string; as?: "h1" | "h2" | "h3"; className?: string; grad?: boolean; center?: boolean }) {
  const lines = text.split("\n");
  return (
    <Tag className={`font-head ${className} ${center ? "text-center" : ""}`} aria-label={lines.join(" ")}>
      {lines.map((l, i) => <span key={i} className="mline" aria-hidden><span className={grad && i === lines.length - 1 ? "vx-grad" : undefined}>{l}</span></span>)}
    </Tag>
  );
}
