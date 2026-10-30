import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderSnapshotFromR2, isValidOrderToken } from "@/lib/orders/r2-orders";
import { formatCartCurrency } from "@/lib/cart/cart-utils";
import { getOptimizedImageUrl } from "@/lib/images/responsive";

export const metadata: Metadata = {
  title: "Order Request | Style Edit",
  description: "View your verified Style Edit order details and download the official invoice.",
  robots: {
    index: false,
    follow: false,
  },
};

interface OrderPageProps {
  params: Promise<{ token: string }>;
}

async function OrderDetailContent({ params }: OrderPageProps) {
  const { token } = await params;

  if (!isValidOrderToken(token)) {
    notFound();
  }

  const order = await getOrderSnapshotFromR2(token);

  if (!order) {
    return (
      <main className="order-page">
        <div className="order-container">
          <div className="order-not-found-card">
            <h1 className="order-not-found-title">Order Not Found</h1>
            <p className="order-not-found-desc">
              The order link you followed does not exist, has expired, or the order reference is invalid.
            </p>
            <div className="order-not-found-action">
              <Link href="/" className="button button-primary">
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="order-page">
      <div className="order-container">
        {/* Navigation Breadcrumb */}
        <nav className="breadcrumb order-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Order {order.orderRef}</span>
        </nav>

        {/* Top Order Card Header */}
        <header className="order-header-card">
          <div className="order-header-top">
            <div>
              <span className="order-brand-label">STYLE · EDIT</span>
              <h1 className="order-title">Order Request</h1>
              <p className="order-ref-code">Reference: <strong>{order.orderRef}</strong></p>
            </div>

            <div className="order-status-group">
              <span className="order-status-badge order-status-badge--pending">
                {order.status}
              </span>
              <span className="order-date-label">Created on {formattedDate}</span>
            </div>
          </div>

          <p className="order-provisional-note">
            Provisional order request submitted via Style Edit Mysuru. Final confirmation and availability are verified with our store team.
          </p>

          {/* Download PDF Action Bar */}
          <div className="order-invoice-bar">
            <div className="order-invoice-info">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div>
                <span className="order-invoice-name">{order.invoice.filename}</span>
                <span className="order-invoice-sub">Official Order Request Document</span>
              </div>
            </div>

            <div className="order-invoice-actions">
              <a
                href={`/api/orders/${token}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                className="order-btn order-btn--view"
              >
                View PDF
              </a>
              <a
                href={`/api/orders/${token}/invoice?download=1`}
                className="order-btn order-btn--download"
                download={order.invoice.filename}
              >
                Download Invoice PDF
              </a>
            </div>
          </div>
        </header>

        {/* Order Layout Grid */}
        <div className="order-layout">
          {/* Ordered Line Items Column */}
          <section className="order-items-section" aria-label="Ordered items">
            <div className="order-section-header">
              <h2 className="order-section-title">Selected Items</h2>
              <span className="order-item-count-badge">
                {order.selectedCount} {order.selectedCount === 1 ? "item" : "items"} ({order.selectedTotalUnits} {order.selectedTotalUnits === 1 ? "unit" : "units"})
              </span>
            </div>

            <ul className="order-items-list" role="list">
              {order.items.map((item, idx) => (
                <li key={item.id || idx} className="order-item-card">
                  {/* Thumbnail with color-specific product image */}
                  <div className="order-item-image-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getOptimizedImageUrl(item.image, 240, 80)}
                      alt={item.name}
                      width={96}
                      height={124}
                      className="order-item-image"
                      loading="lazy"
                    />
                  </div>

                  {/* Item Description */}
                  <div className="order-item-content">
                    <div className="order-item-info">
                      <h3 className="order-item-name">{item.name}</h3>

                      {/* Variant Badges */}
                      <div className="order-item-badges">
                        {item.size && (
                          <span className="order-attr-chip">
                            Size: <strong>{item.size}</strong>
                          </span>
                        )}
                        {item.color && (
                          <span className="order-attr-chip">
                            Colour: <strong>{item.color}</strong>
                          </span>
                        )}
                        <span className="order-attr-chip">
                          Qty: <strong>{item.quantity}</strong>
                        </span>
                      </div>

                      {/* Offer details if applied */}
                      {item.appliedOffer && (
                        <div className="order-item-offer-pill">
                          <span>{item.appliedOffer.label}</span>
                          {item.discountAmount > 0 && (
                            <span className="order-offer-savings">
                              Saved {formatCartCurrency(item.discountAmount)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="order-item-pricing">
                      <div className="order-price-line">
                        <span className="order-price-label">Unit price:</span>
                        <span className="order-price-val">
                          {formatCartCurrency(item.regularUnitPrice)}
                        </span>
                      </div>

                      {item.discountAmount > 0 && (
                        <div className="order-price-line order-price-line--strike">
                          <span className="order-price-label">Regular subtotal:</span>
                          <span className="order-price-val">
                            {formatCartCurrency(item.regularSubtotal)}
                          </span>
                        </div>
                      )}

                      <div className="order-price-line order-price-line--final">
                        <span className="order-price-label">Item Total:</span>
                        <span className="order-price-val order-price-val--highlight">
                          {formatCartCurrency(item.finalTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Order Summary Column */}
          <aside className="order-summary-sidebar" aria-label="Order summary">
            <div className="order-summary-box">
              <h2 className="order-summary-title">Summary Breakdown</h2>

              <div className="order-summary-rows">
                <div className="order-summary-row">
                  <span>Selected Items</span>
                  <span>{order.selectedCount} {order.selectedCount === 1 ? "item" : "items"}</span>
                </div>

                <div className="order-summary-row">
                  <span>Total Units</span>
                  <span>{order.selectedTotalUnits} {order.selectedTotalUnits === 1 ? "unit" : "units"}</span>
                </div>

                <div className="order-summary-row">
                  <span>Regular Subtotal</span>
                  <span>{formatCartCurrency(order.totals.regularSubtotal)}</span>
                </div>

                {order.totals.totalSavings > 0 && (
                  <div className="order-summary-row order-summary-row--savings">
                    <span>Offer Savings</span>
                    <span>-{formatCartCurrency(order.totals.totalSavings)}</span>
                  </div>
                )}

                <div className="order-summary-row order-summary-row--total">
                  <span>Final Order Total</span>
                  <span className="order-total-number">
                    {formatCartCurrency(order.totals.finalTotal)}
                  </span>
                </div>
              </div>

              <div className="order-summary-notice">
                <p>
                  * All amounts are in Indian Rupees (INR) inclusive of applicable taxes.
                </p>
                <p>
                  * Delivery, payment details, and sizing confirmation are finalized directly via WhatsApp with Style Edit Mysuru.
                </p>
              </div>

              <div className="order-summary-actions">
                <a
                  href={`/api/orders/${token}/invoice?download=1`}
                  className="order-download-full-btn"
                  download={order.invoice.filename}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download Invoice PDF</span>
                </a>

                <Link href="/" className="order-back-home-link">
                  ← Back to Storefront
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function OrderDetailPage(props: OrderPageProps) {
  return (
    <Suspense
      fallback={
        <main className="order-page">
          <div className="order-container">
            <div className="order-header-card" style={{ opacity: 0.7 }}>
              <span className="order-brand-label">STYLE · EDIT</span>
              <h1 className="order-title">Loading Order Request...</h1>
              <p className="order-ref-code">Retrieving order details from cloud storage...</p>
            </div>
          </div>
        </main>
      }
    >
      <OrderDetailContent {...props} />
    </Suspense>
  );
}
