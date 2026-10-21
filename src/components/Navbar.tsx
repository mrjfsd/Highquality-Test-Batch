"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  InstagramIcon,
  WhatsAppIcon,
  MapsIcon,
  CartIcon,
  MenuIcon,
  CloseIcon,
  ArrowRightIcon,
} from "@/components/Icons";

function BrandLockup() {
  return (
    <Link className="nav-brand-lockup" href="/" aria-label="Style-Edit home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Brandlogo.svg"
        alt="Style-Edit Logo"
        className="nav-brand-logo"
        width={40}
        height={40}
      />
      <span className="nav-brand-text">STYLE EDIT</span>
    </Link>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

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
    <>
      <header className={`navbar ${isHome ? "home-navbar" : ""}`}>
        <BrandLockup />

        {/* Desktop Navigation */}
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/shop/men">Men</Link>
          <Link href="/shop/women">Women</Link>
          <Link href="/shop/kids">Kids</Link>
        </nav>

        {/* Nav Actions: Exact order Instagram → WhatsApp → Google Maps → Cart → Mobile menu toggle */}
        <div className="nav-actions">
          {/* 1. Instagram */}
          <a
            href="https://www.instagram.com/style_edit_mysuru_?vrfl=dzBvYzFjbmk5ZTMw"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button"
            aria-label="Instagram"
            title="Follow Style-Edit on Instagram"
          >
            <InstagramIcon size={20} />
          </a>

          {/* 2. WhatsApp */}
          <a
            href="https://wa.me/917676105819"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button"
            aria-label="WhatsApp"
            title="Chat with Style-Edit on WhatsApp"
          >
            <WhatsAppIcon size={20} />
          </a>

          {/* 3. Google Maps */}
          <a
            href="https://maps.app.goo.gl/8omA7ByNdSmCNxbm7?g_st=ac"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button"
            aria-label="Google Maps"
            title="Visit Style-Edit on Google Maps"
          >
            <MapsIcon size={20} />
          </a>

          {/* 4. Cart */}
          <button
            className="icon-button bag-button"
            type="button"
            aria-label="Shopping bag (0 items)"
            title="Shopping bag (0 items)"
          >
            <CartIcon size={20} />
            <span>0</span>
          </button>

          {/* 5. Mobile menu toggle button */}
          <button
            className="icon-button menu-button"
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer: rendered outside <header> so position: fixed spans full viewport */}
      {mobileOpen && (
        <div className="mobile-nav-overlay-portal">
          <div
            className="mobile-nav-backdrop"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <aside className="mobile-nav-drawer" aria-label="Mobile navigation">
            <div className="mobile-nav-header">
              <BrandLockup />
              <button
                className="icon-button close-menu-btn"
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <nav className="mobile-nav-links">
              <Link href="/" onClick={closeMenu}>
                <span>Home</span>
                <ArrowRightIcon size={16} />
              </Link>
              <Link href="/shop/men" onClick={closeMenu}>
                <span>Men</span>
                <ArrowRightIcon size={16} />
              </Link>
              <Link href="/shop/women" onClick={closeMenu}>
                <span>Women</span>
                <ArrowRightIcon size={16} />
              </Link>
              <Link href="/shop/kids" onClick={closeMenu}>
                <span>Kids</span>
                <ArrowRightIcon size={16} />
              </Link>
            </nav>

            <div className="mobile-nav-footer">
              <p className="mobile-nav-footer-brand">STYLE-EDIT MYSURU</p>
              <p className="mobile-nav-footer-tagline">Curated everyday fashion</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
