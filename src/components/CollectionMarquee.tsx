"use client";

import React, { useEffect, useState } from "react";
import styles from "./CollectionMarquee.module.css";

export const DEFAULT_PROMO_MESSAGES = [
  "BUY ANY 4 GET Rs.200 OFF",
  "BUY ANY 2 GET Rs.100 OFF",
  "10% OFF ON FIRST ORDER",
];

interface CollectionMarqueeProps {
  initialMessages?: string[];
}

export default function CollectionMarquee({ initialMessages }: CollectionMarqueeProps) {
  const [messages, setMessages] = useState<string[]>(initialMessages || []);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.catalogueMarquee?.ads) {
            setMessages(data.catalogueMarquee.ads);
          }
        }
      } catch (err) {
        console.warn("[CollectionMarquee] Failed to fetch marquee settings:", err);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter out empty or whitespace-only messages
  const activeMessages = (messages.length > 0 ? messages : DEFAULT_PROMO_MESSAGES)
    .map((msg) => (typeof msg === "string" ? msg.trim() : ""))
    .filter((msg) => msg.length > 0);

  const effectiveMessages = activeMessages.length > 0 ? activeMessages : DEFAULT_PROMO_MESSAGES;

  // Compute number of repetitions per sequence to reach at least 12 items for seamless scrolling
  const minItems = 12;
  const repeatCount = Math.max(1, Math.ceil(minItems / effectiveMessages.length));

  const groupItems: string[] = [];
  for (let i = 0; i < repeatCount; i++) {
    groupItems.push(...effectiveMessages);
  }

  return (
    <div
      className={`${styles.marqueeContainer} collection-marquee`}
      role="region"
      aria-label="Promotional offers marquee"
      style={{
        backgroundColor: "var(--burgundy, #702b38)",
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
          {groupItems.map((msg, idx) => (
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
              <span>{msg}</span>
              <span className={`${styles.marqueeSeparator} collection-marquee-separator`} aria-hidden="true">
                •
              </span>
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
          {groupItems.map((msg, idx) => (
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
              <span>{msg}</span>
              <span className={`${styles.marqueeSeparator} collection-marquee-separator`} aria-hidden="true">
                •
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
