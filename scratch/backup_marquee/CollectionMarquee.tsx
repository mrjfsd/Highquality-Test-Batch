import React from "react";
import styles from "./CollectionMarquee.module.css";

const PROMO_MESSAGES = [
  "BUY ANY 4 GET Rs.200 OFF",
  "BUY ANY 2 GET Rs.100 OFF",
  "10% OFF ON FIRST ORDER",
];

// 4 repetitions per group (12 items total per group) ensure a wide continuous ribbon (>3000px)
const GROUP_ITEMS = [
  ...PROMO_MESSAGES,
  ...PROMO_MESSAGES,
  ...PROMO_MESSAGES,
  ...PROMO_MESSAGES,
];

export default function CollectionMarquee() {
  return (
    <div
      className={`${styles.marqueeContainer} collection-marquee`}
      role="region"
      aria-label="Promotional offers marquee"
      style={{
        backgroundColor: "#303030",
        color: "#ffffff",
        width: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        userSelect: "none",
        position: "relative",
        flex: "1 1 auto",
        minWidth: 0,
        margin: 0,
      }}
    >
      <div
        className={`${styles.marqueeTrack} collection-marquee-track`}
        style={{
          display: "flex",
          width: "max-content",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {/* Primary sequence */}
        <div
          className={`${styles.marqueeGroup} collection-marquee-group`}
          aria-hidden="false"
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {GROUP_ITEMS.map((msg, idx) => (
            <span
              key={`p1-${idx}`}
              className={`${styles.marqueeItem} collection-marquee-item`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                flexShrink: 0,
                color: "#ffffff",
              }}
            >
              {msg}
            </span>
          ))}
        </div>

        {/* Identical cloned sequence for seamless right-to-left infinite loop */}
        <div
          className={`${styles.marqueeGroup} collection-marquee-group`}
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {GROUP_ITEMS.map((msg, idx) => (
            <span
              key={`p2-${idx}`}
              className={`${styles.marqueeItem} collection-marquee-item`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                flexShrink: 0,
                color: "#ffffff",
              }}
            >
              {msg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
