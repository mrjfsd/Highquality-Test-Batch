export default function SaleLoading() {
  return (
    <main
      className="collection-page sale-page"
      aria-busy="true"
      aria-label="Loading sale collection"
    >
      <h1 className="sr-only">Loading The Sale Edit</h1>
      <div className="collection-layout sale-collection-layout">
        <section className="product-area" aria-label="Loading sale products">
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
