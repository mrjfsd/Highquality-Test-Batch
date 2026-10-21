"use client";

import { useEffect } from "react";

/**
 * Lightweight, accessible scroll & typography animator for the homepage.
 * Inspired by luxury fashion websites (e.g. Rare Rabbit) with restrained,
 * smooth fade-up transitions and gentle staggered reveals.
 *
 * Progressive Enhancement:
 * - If JavaScript is disabled or fails to run, `animations-ready` is never added,
 *   ensuring all content remains 100% visible and accessible immediately.
 * - Respects `prefers-reduced-motion` and disables all scroll-driven animation.
 */
export default function HomeScrollAnimator() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    if (!("IntersectionObserver" in window)) return;

    const revealElements = document.querySelectorAll<HTMLElement>(
      ".reveal-item, .reveal-heading"
    );
    if (!revealElements.length) return;

    // Activate animation stylesheet rules only once JS confirms support
    document.documentElement.classList.add("animations-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "0px 0px -40px 0px",
        threshold: 0.1,
      }
    );

    revealElements.forEach((el) => {
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
