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

    // Activate animation stylesheet rules only once JS confirms support
    document.documentElement.classList.add("animations-ready");

    // 1. Intersection Observer for staggered entry reveals
    const revealElements = document.querySelectorAll<HTMLElement>(
      ".reveal-item, .reveal-heading"
    );
    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window && revealElements.length) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: "0px 0px -40px 0px",
          threshold: 0.1,
        }
      );

      revealElements.forEach((el) => {
        observer?.observe(el);
      });
    }

    // 2. Scroll-linked Hero scale & corner rounding + Editorial 2-pair transition
    const heroEl = document.querySelector<HTMLElement>(".hero");
    const editorialContainer = document.querySelector<HTMLElement>(
      ".editorial-scroll-container"
    );

    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset;
          const isMobile = window.innerWidth <= 768;

          // Hero Scroll Transition: Scale down slightly, move upward, round bottom corners
          if (heroEl) {
            const heroMaxScroll = isMobile ? 260 : 420;
            const heroProgress = Math.min(1, Math.max(0, scrollY / heroMaxScroll));
            const heroScale = 1 - heroProgress * (isMobile ? 0.018 : 0.045);
            const heroTranslateY = -heroProgress * (isMobile ? 12 : 26);
            const heroRadius = heroProgress * (isMobile ? 20 : 36);

            heroEl.style.setProperty("--hero-scale", heroScale.toFixed(4));
            heroEl.style.setProperty("--hero-translate-y", `${heroTranslateY.toFixed(1)}px`);
            heroEl.style.setProperty("--hero-border-radius", `${heroRadius.toFixed(1)}px`);
          }

          // Editorial 2-Pair Image Transition: Overlapping pair rises up as user scrolls
          if (editorialContainer) {
            const rect = editorialContainer.getBoundingClientRect();
            const totalDist = editorialContainer.offsetHeight - window.innerHeight;
            if (totalDist > 0) {
              const rawProgress = -rect.top / totalDist;
              // Smooth clamp between 0 and 1
              const progress = Math.min(1, Math.max(0, rawProgress));
              editorialContainer.style.setProperty(
                "--editorial-progress",
                progress.toFixed(4)
              );
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Initialize styles on mount
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  return null;
}
