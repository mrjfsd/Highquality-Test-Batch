// SectionHeading — shared section heading used across home and listing pages.
// Server component.

import Link from "next/link";
import Icon from "./Icon";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function SectionHeading({
  eyebrow,
  title,
  actionLabel,
  actionHref,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="text-link">
          {actionLabel}
          <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}
