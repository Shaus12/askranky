import MaskHeading from "./MaskHeading";
/** Eyebrow + hairline + masked heading + lede: the shared section header. Put inside a <Reveal>. */
export default function SectionHead({ eyebrow, title, sub, grad = false }: { eyebrow?: string; title: string; sub?: string; grad?: boolean }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow && <p data-reveal className="vx-eyebrow justify-center">{eyebrow}</p>}
      <div className="mt-4"><MaskHeading text={title} grad={grad} /></div>
      <span data-hair className="hairline mx-auto mt-6 block w-[min(70vw,calc(var(--u)*360))]" />
      {sub && <p data-reveal className="vx-lede mx-auto mt-6 max-w-2xl">{sub}</p>}
    </div>
  );
}
