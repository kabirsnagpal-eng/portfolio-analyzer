import { useCountUp } from "../hooks/useCountUp";

interface Props {
  value: number;
  format: (v: number) => string;
  className?: string;
  duration?: number;
}

/** A number that counts up when it scrolls into view. Screen readers get the final value. */
export function AnimatedNumber({ value, format, className, duration }: Props) {
  const [ref, display] = useCountUp<HTMLSpanElement>(value, duration);
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
