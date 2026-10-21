"use client";

import Link from "next/link";

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="15"
      height="15"
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

function InstagramIcon({ size = 16 }: { size?: number }) {
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

function EmailIcon({ size = 16 }: { size?: number }) {
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon({ size = 16 }: { size?: number }) {
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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default function Footer() {
  const currentYear = 2026;

  return (
    <footer className="footer" id="footer">
      <div className="footer-top">
        {/* Brand Column */}
        <div className="footer-brand">
          <Link className="logo footer-logo" href="/" aria-label="Style-Edit home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Brandlogo.svg"
              alt="Style-Edit Logo"
              className="logo-badge footer-logo-badge"
              width={52}
              height={52}
            />
            <span className="logo-name">
              <strong>STYLE</strong>
              <em>EDIT</em>
            </span>
          </Link>
          <p className="footer-tagline">
            Curated everyday fashion, chosen in Mysuru.
          </p>
        </div>

        {/* Shop Navigation */}
        <div className="footer-col">
          <p className="footer-label">Shop</p>
          <Link href="/shop/women" className="footer-nav-link">
            Women
          </Link>
          <Link href="/shop/men" className="footer-nav-link">
            Men
          </Link>
          <Link href="/shop/kids" className="footer-nav-link">
            Kids
          </Link>
        </div>

        {/* Connect & Contact */}
        <div className="footer-col">
          <p className="footer-label">Connect</p>
          <a href="tel:7676105819" className="footer-icon-link">
            <PhoneIcon size={15} />
            <span>+91 76761 05819</span>
          </a>
          <a href="mailto:styleditmys@gmail.com" className="footer-icon-link">
            <EmailIcon size={15} />
            <span>styleditmys@gmail.com</span>
          </a>
          <a
            href="https://www.instagram.com/style_edit_mysuru_?vrfl=dzBvYzFjbmk5ZTMw"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon-link"
          >
            <InstagramIcon size={15} />
            <span>@style_edit_mysuru_</span>
          </a>
        </div>

        {/* Store Location */}
        <div className="footer-col store-location-card">
          <p className="footer-label">Our Store</p>
          <p className="store-address">Mysuru, Karnataka · India</p>
          <a
            href="https://maps.app.goo.gl/8omA7ByNdSmCNxbm7?g_st=ac"
            target="_blank"
            rel="noopener noreferrer"
            className="store-cta-btn"
            aria-label="Visit Our Store in Google Maps"
          >
            <span>Visit Our Store</span>
            <ArrowRightIcon />
          </a>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <p>© {currentYear} Style-Edit. All rights reserved.</p>
        <a href="#top" className="back-to-top">
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
