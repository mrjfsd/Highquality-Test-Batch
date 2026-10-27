"use client";

import Link from "next/link";
import {
  PhoneIcon,
  MailIcon,
  InstagramIcon,
  WhatsAppIcon,
  MapsIcon,
  ArrowRightIcon,
} from "@/components/Icons";

export default function Footer() {
  const currentYear = 2026;

  return (
    <footer className="footer" id="footer">
      <div className="footer-top">
        {/* Brand Column */}
        <div className="footer-brand">
          <Link className="footer-brand-lockup" href="/" aria-label="Style-Edit home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <picture>
              <source srcSet="/Brandlogo.webp" type="image/webp" />
              <img
                src="/Brandlogo.svg"
                alt="Style-Edit Logo"
                className="footer-brand-logo"
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
              />
            </picture>
            <span className="footer-brand-text">STYLE EDIT</span>
          </Link>
          <p className="footer-tagline">
            Curated everyday fashion, chosen in Mysuru.
          </p>
        </div>

        {/* Shop Navigation */}
        <div className="footer-col">
          <p className="footer-label">Shop</p>
          <Link href="/shop/women" className="footer-nav-link" prefetch={true}>
            Women
          </Link>
          <Link href="/shop/men" className="footer-nav-link" prefetch={true}>
            Men
          </Link>
          <Link href="/shop/kids" className="footer-nav-link" prefetch={true}>
            Kids
          </Link>
        </div>

        {/* Connect & Contact */}
        <div className="footer-col">
          <p className="footer-label">Connect</p>
          <a
            href="tel:7676105819"
            className="footer-icon-link"
            aria-label="Call Style-Edit customer care at +91 76761 05819"
          >
            <PhoneIcon size={16} />
            <span>+91 76761 05819</span>
          </a>
          <a
            href="mailto:styleditmys@gmail.com"
            className="footer-icon-link"
            aria-label="Email Style-Edit at styleditmys@gmail.com"
          >
            <MailIcon size={16} />
            <span>styleditmys@gmail.com</span>
          </a>
          <a
            href="https://wa.me/917676105819"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon-link"
            aria-label="Chat with Style-Edit on WhatsApp"
          >
            <WhatsAppIcon size={16} />
            <span>WhatsApp (+91 76761 05819)</span>
          </a>
          <a
            href="https://www.instagram.com/style_edit_mysuru_?vrfl=dzBvYzFjbmk5ZTMw"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon-link"
            aria-label="Follow Style-Edit on Instagram"
          >
            <InstagramIcon size={16} />
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
            aria-label="Visit Our Store on Google Maps"
          >
            <MapsIcon size={16} />
            <span>Visit Our Store</span>
            <ArrowRightIcon size={14} />
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
