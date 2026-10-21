// Inline SVG icon component matching the reference design's icon set.
// This is a server-compatible component — no client directives needed.

type IconName =
  | "bag"
  | "arrow"
  | "menu"
  | "close"
  | "minus"
  | "plus"
  | "chevron";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 20, className }: IconProps) {
  const paths: Record<IconName, React.ReactNode> = {
    bag: (
      <>
        <path d="M5 8h14l-1 13H6L5 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    menu: (
      <>
        <path d="M4 8h16M4 16h16" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    minus: <path d="M6 12h12" />,
    plus: (
      <>
        <path d="M6 12h12M12 6v12" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
