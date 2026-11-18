import type { ReactNode } from "react";

interface Props {
  index: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}

/** Consistent editorial frame for each dashboard section: numbered label, headline, then content. */
export function DashSection({ index, eyebrow, title, description, children, id }: Props) {
  return (
    <section id={id} className="scroll-mt-16 border-t border-line py-20 sm:py-28">
      <div className="mb-12 grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-end" data-reveal>
        <div>
          <p className="eyebrow mb-4">
            <span className="num mr-3 text-ink-mute">{index}</span>
            {eyebrow}
          </p>
          <h3 className="text-title font-semibold">{title}</h3>
        </div>
        {description && <p className="max-w-md text-[15px] leading-relaxed text-ink-3 md:justify-self-end">{description}</p>}
      </div>
      <div data-reveal data-reveal-delay="0.08">
        {children}
      </div>
    </section>
  );
}
