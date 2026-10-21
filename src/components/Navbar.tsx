"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path d="M5.5 8.5h13l1 12h-15l1-12Z" />
      <path d="M9 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function Logo() {
  return (
    <Link className="nav-wordmark" href="/" aria-label="Style Edit home">
      STYLE EDIT
    </Link>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);

  return (
    <header className="navbar">
      <Logo />

      {/* Desktop Navigation */}
      <nav className="desktop-nav" aria-label="Main navigation">
        <Link href="/shop/men">Men</Link>
        <Link href="/shop/women">Women</Link>
        <Link href="/shop/kids">Kids</Link>
      </nav>

      {/* Nav Actions */}
      <div className="nav-actions">
        {/* Instagram Icon Link */}
        <a
          href="https://www.instagram.com/style_edit_mysuru_?vrfl=dzBvYzFjbmk5ZTMw"
          target="_blank"
          rel="noopener noreferrer"
          className="icon-button instagram-button"
          aria-label="Visit our Instagram"
          title="Follow Style-Edit on Instagram"
        >
          <InstagramIcon />
        </a>

        {/* Mobile menu toggle button */}
        <button
          className="icon-button menu-button"
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        {/* Bag icon placeholder */}
        <button
          className="icon-button bag-button"
          type="button"
          aria-label="Shopping bag (0 items)"
          title="Shopping bag (0 items)"
        >
          <BagIcon />
          <span>0</span>
        </button>
      </div>

      {/* Functional Mobile Navigation Drawer */}
      {mobileOpen && (
        <>
          <div
            className="mobile-nav-backdrop"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <aside className="mobile-nav-drawer" aria-label="Mobile navigation">
            <div className="mobile-nav-header">
              <Logo />
              <button
                className="icon-button"
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mobile-nav-search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search styles, essentials..."
                aria-label="Search products"
                readOnly
              />
            </div>

            <nav className="mobile-nav-links">
              <Link href="/" onClick={closeMenu}>
                <span>Home</span>
                <ArrowRightIcon />
              </Link>
              <Link href="/shop/men" onClick={closeMenu}>
                <span>Men</span>
                <ArrowRightIcon />
              </Link>
              <Link href="/shop/women" onClick={closeMenu}>
                <span>Women</span>
                <ArrowRightIcon />
              </Link>
              <Link href="/shop/kids" onClick={closeMenu}>
                <span>Kids</span>
                <ArrowRightIcon />
              </Link>
            </nav>

            <div className="mobile-nav-footer">
              <a
                href="https://www.instagram.com/style_edit_mysuru_?vrfl=dzBvYzFjbmk5ZTMw"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-icon-link"
              >
                <InstagramIcon size={16} />
                <span>@style_edit_mysuru_</span>
              </a>
              <p>Mysuru, Karnataka · India</p>
              <a href="tel:7676105819">+91 76761 05819</a>
              <a href="mailto:styleditmys@gmail.com">styleditmys@gmail.com</a>
            </div>
          </aside>
        </>
      )}
    </header>
  );
}
