// Not-found page for invalid department slugs (e.g. /shop/footwear)
// Rendered by Next.js when notFound() is called in the department page.

import Link from "next/link";

export default function DepartmentNotFound() {
  return (
    <main className="not-found-page">
      <span className="eyebrow">DEPARTMENT NOT FOUND</span>
      <h1>
        Nothing
        <br />
        here.
      </h1>
      <p>
        That department doesn&apos;t exist yet. Try browsing Women, Men, or
        Kids.
      </p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/shop/women" className="button button--dark">
          Shop Women
        </Link>
        <Link href="/shop/men" className="button button--dark">
          Shop Men
        </Link>
        <Link href="/shop/kids" className="button button--dark">
          Shop Kids
        </Link>
      </div>
    </main>
  );
}
