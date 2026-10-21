"use client";

// Navbar — sticky at top of viewport. Uses client component for mobile menu toggle.
// The announcement banner above is NOT sticky — only this header element is.

import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

const departments = ["Women", "Men", "Kids"] as const;

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="header">
      {/* Mobile hamburger — visible below 900px breakpoint */}
      <button
        className="mobile-menu"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        <Icon name={mobileOpen ? "close" : "menu"} />
      </button>

      {/* Brand wordmark */}
      <Link href="/" className="wordmark" aria-label="Style-Edit home">
        STYLE—EDIT
      </Link>

      {/* Primary navigation — collapses on mobile */}
      <nav
        className={mobileOpen ? "nav nav--open" : "nav"}
        aria-label="Main navigation"
      >
        {departments.map((dept) => (
          <Link
            key={dept}
            href={`/shop/${dept.toLowerCase()}`}
            onClick={() => setMobileOpen(false)}
          >
            {dept}
          </Link>
        ))}
        {/* Mobile-only home link */}
        <Link
          href="/"
          className="mobile-nav-home"
          onClick={() => setMobileOpen(false)}
        >
          Home
        </Link>
      </nav>

      {/* Cart placeholder — functional cart to be implemented in a future phase */}
      <button
        id="cart-button"
        className="cart-button"
        aria-label="Open cart (0 items)"
        aria-disabled="true"
      >
        <Icon name="bag" />
        <span>Bag</span>
        <span className="cart-count">0</span>
      </button>
    </header>
  );
}
