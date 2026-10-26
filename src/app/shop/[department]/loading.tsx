export default function DepartmentLoading() {
  return (
    <main className="collection-page" aria-busy="true" aria-label="Loading collection">
      <h1 className="sr-only">Loading Collection</h1>
      <div className="collection-layout">
        {/* Top Toolbar Skeleton */}
        <div
          className="product-toolbar"
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            className="product-toolbar-left"
            style={{
              flexShrink: 0,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              className="skeleton-pulse"
              style={{
                width: 72,
                height: 18,
                borderRadius: 4,
                background: "var(--line, #e5e5e5)",
              }}
            />
          </div>

          <div
            className="product-toolbar-right"
            style={{
              flexShrink: 0,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <div
              className="skeleton-pulse"
              style={{
                width: 96,
                height: 34,
                borderRadius: 20,
                background: "var(--line, #e5e5e5)",
              }}
            />
          </div>
        </div>

        {/* 4-Column Product Grid Skeleton */}
        <section className="product-area" aria-label="Loading products">
          <div className="collection-product-grid collection-product-grid--4">
            {Array.from({ length: 8 }).map((_, index) => (
              <article key={index} className="product-card" aria-hidden="true">
                <div
                  className="product-image-wrap skeleton-pulse"
                  style={{
                    background: "var(--card-bg, #f4f3ef)",
                    aspectRatio: "320 / 416",
                    borderRadius: 8,
                  }}
                />
                <div className="product-meta" style={{ marginTop: 12 }}>
                  <div
                    className="skeleton-pulse"
                    style={{
                      width: "75%",
                      height: 16,
                      background: "var(--line, #e5e5e5)",
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  />
                  <div
                    className="skeleton-pulse"
                    style={{
                      width: "35%",
                      height: 14,
                      background: "var(--line, #e5e5e5)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
