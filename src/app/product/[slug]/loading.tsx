export default function ProductDetailLoading() {
  return (
    <main className="detail" aria-busy="true" aria-label="Loading product details">
      {/* Top navigation bar skeleton: Back pill + Breadcrumb */}
      <div className="detail-top-nav">
        <div
          className="back-btn-pill skeleton-pulse"
          style={{
            width: 76,
            height: 34,
            background: "var(--white, #ffffff)",
            border: "1px solid var(--line, #e5e5e5)",
            borderRadius: 8,
          }}
        />
        <div
          className="skeleton-pulse"
          style={{
            width: 180,
            height: 16,
            background: "var(--line, #e5e5e5)",
            borderRadius: 4,
          }}
        />
      </div>

      {/* Main detail layout skeleton */}
      <div className="detail-layout">
        {/* Left Column — Product Imagery Frame */}
        <section className="product-imagery" aria-label="Loading product imagery">
          <div
            className="imagery-frame skeleton-pulse"
            style={{
              width: "100%",
              maxWidth: 460,
              aspectRatio: "3 / 4",
              background: "var(--card-bg, #f7f6f2)",
              border: "1px solid var(--line, #e5e5e5)",
              borderRadius: 12,
            }}
          />
        </section>

        {/* Right Column — Product Information Skeleton */}
        <aside className="product-info" aria-label="Loading product details">
          {/* Category eyebrow */}
          <div
            className="skeleton-pulse"
            style={{
              width: 120,
              height: 14,
              background: "var(--line, #e5e5e5)",
              borderRadius: 4,
              marginBottom: 12,
            }}
          />

          {/* Product Title */}
          <div
            className="skeleton-pulse"
            style={{
              width: "80%",
              height: 32,
              background: "var(--line, #e5e5e5)",
              borderRadius: 6,
              marginBottom: 16,
            }}
          />

          {/* Current Price */}
          <div
            className="skeleton-pulse"
            style={{
              width: 90,
              height: 24,
              background: "var(--line, #e5e5e5)",
              borderRadius: 4,
              marginBottom: 20,
            }}
          />

          <hr className="detail-divider" />

          {/* Description Lines */}
          <div style={{ marginTop: 16, marginBottom: 24 }}>
            <div
              className="skeleton-pulse"
              style={{
                width: "100%",
                height: 16,
                background: "var(--line, #e5e5e5)",
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <div
              className="skeleton-pulse"
              style={{
                width: "92%",
                height: 16,
                background: "var(--line, #e5e5e5)",
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <div
              className="skeleton-pulse"
              style={{
                width: "65%",
                height: 16,
                background: "var(--line, #e5e5e5)",
                borderRadius: 4,
              }}
            />
          </div>

          {/* Color Selector Skeleton */}
          <div
            className="skeleton-pulse"
            style={{
              width: 50,
              height: 14,
              background: "var(--line, #e5e5e5)",
              borderRadius: 4,
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="skeleton-pulse"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--line, #e5e5e5)",
                }}
              />
            ))}
          </div>

          {/* Size Selector Skeleton */}
          <div
            className="skeleton-pulse"
            style={{
              width: 40,
              height: 14,
              background: "var(--line, #e5e5e5)",
              borderRadius: 4,
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
            {[1, 2, 3, 4].map((k) => (
              <div
                key={k}
                className="skeleton-pulse"
                style={{
                  width: 44,
                  height: 38,
                  borderRadius: 6,
                  background: "var(--line, #e5e5e5)",
                }}
              />
            ))}
          </div>

          {/* Action Buttons Skeleton */}
          <div
            className="skeleton-pulse"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 8,
              background: "var(--line, #e5e5e5)",
              marginBottom: 12,
            }}
          />
          <div
            className="skeleton-pulse"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 8,
              background: "var(--line, #e5e5e5)",
            }}
          />
        </aside>
      </div>
    </main>
  );
}
