// Footer — shared across home, department listing, and product detail pages.
// Server component — no interactivity needed.

import Link from "next/link";
import Icon from "./Icon";

export default function Footer() {
  return (
    <footer className="footer">
      {/* Brand column */}
      <div className="footer-brand">
        <div className="wordmark wordmark--footer">STYLE—EDIT</div>
        <p>Considered clothing for everyday life.</p>
      </div>

      {/* Shop links */}
      <div>
        <span className="footer-title">Shop</span>
        <Link href="/shop/women">Women</Link>
        <Link href="/shop/men">Men</Link>
        <Link href="/shop/kids">Kids</Link>
      </div>

      {/* Help links */}
      <div>
        <span className="footer-title">Help</span>
        <span>Delivery &amp; returns</span>
        <span>Size guide</span>
        <span>Contact</span>
      </div>

      {/* Newsletter */}
      <div>
        <span className="footer-title">Stay in the edit</span>
        <p>Monthly notes on new pieces and considered style.</p>
        <div className="email-field">
          <span>Email address</span>
          <Icon name="arrow" />
        </div>
      </div>

      {/* Bottom bar — spans full width */}
      <div className="footer-bottom">
        <span>© 2025 Style—Edit</span>
        <span>Considered clothing · Customer experience</span>
      </div>
    </footer>
  );
}
