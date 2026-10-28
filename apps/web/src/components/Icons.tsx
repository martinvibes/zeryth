/** Small line icons, drawn on a 20-unit grid and coloured by `currentColor`. */

type IconName = "warn" | "clock" | "swap" | "spark" | "check" | "x" | "key" | "info" | "flame" | "list";

const PATHS: Record<IconName, React.ReactNode> = {
  warn: (
    <>
      <path d="M10 3.2 17.6 16.4H2.4L10 3.2Z" />
      <path d="M10 8.2v3.6M10 14.1v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 6v4.3l2.8 1.7" />
    </>
  ),
  swap: (
    <>
      <path d="M4 7.5h11l-3-3M16 12.5H5l3 3" />
    </>
  ),
  spark: (
    <>
      <path d="M10 2.8v3.4M10 13.8v3.4M2.8 10h3.4M13.8 10h3.4M4.9 4.9l2.4 2.4M12.7 12.7l2.4 2.4M4.9 15.1l2.4-2.4M12.7 7.3l2.4-2.4" />
    </>
  ),
  check: <path d="M4.2 10.4 8.2 14.2 15.8 6" />,
  x: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />,
  key: (
    <>
      <circle cx="7" cy="10" r="3.6" />
      <path d="M10.6 10h6.6M15 10v2.6M17.2 10v1.8" />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 9v4.6M10 6.3v.1" />
    </>
  ),
  flame: (
    <path d="M10 17.4c-3 0-5.2-2.1-5.2-5 0-3.3 3-4.6 3.4-8.4 2.6 1.6 4 3.6 4.2 5.8.6-.7.9-1.6 1-2.6 1.4 1.4 1.8 3.1 1.8 4.9 0 3-2.2 5.3-5.2 5.3Z" />
  ),
  list: <path d="M4 5.5h12M4 10h12M4 14.5h8" />,
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };
