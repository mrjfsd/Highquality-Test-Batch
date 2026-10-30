"use client";

/**
 * HeroMotion — GSAP entrance sequence for the hero heading, subtitle and buttons.
 * Renders null; all work is side-effect only.
 *
 * Targets (queried by stable selectors so we never touch HeroGarmentFan.tsx):
 *   .hero-motion-h1     — the h1 heading
 *   .hero-motion-sub    — the subtitle paragraph
 *   .hero-motion-btns   — the button wrapper div
 *
 * CSS classes hero-fade-{1,2,4} already supply an animation-fill-mode:both fallback
 * for the no-JS case.  When JS runs we disable those CSS animations via the
 * [data-hero-motion] attribute added to the <section> so GSAP owns the timing.
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function HeroMotion() {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    // React Strict Mode fires effects twice in dev; guard against double play.
    if (ctxRef.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Reduced-motion: show everything instantly, skip all animation
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          [".hero-motion-h1", ".hero-motion-sub", ".hero-motion-btns"],
          { clearProps: "all" }
        );
      });

      // Full animation
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const hero = document.querySelector<HTMLElement>(".hero");
        const h1   = document.querySelector<HTMLElement>(".hero-motion-h1");
        const sub  = document.querySelector<HTMLElement>(".hero-motion-sub");
        const btns = document.querySelector<HTMLElement>(".hero-motion-btns");

        if (!h1 || !sub || !btns) return;

        // Disable the CSS keyframe animations so GSAP has sole ownership.
        // The data-hero-motion attribute on the section suppresses them via CSS.
        if (hero) hero.setAttribute("data-hero-motion", "1");

        // Immediately hide targets before first paint.
        gsap.set([h1, sub, btns], { autoAlpha: 0 });

        // Single timeline, power3.out default ease.
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        // Heading: y 28 -> 0, opacity 0 -> 1, 0.9s
        tl.fromTo(h1,   { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0);
        // Subtitle: y 12 -> 0, opacity 0 -> 1, 0.7s, +0.15s
        tl.fromTo(sub,  { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7 }, 0.15);
        // Buttons: y 10 -> 0, opacity 0 -> 1, 0.6s, +0.25s
        tl.fromTo(btns, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, 0.25);
      });

      // Part 2: Magnetic CTA buttons — subtle tracking for fine pointer (desktop mouse/trackpad)
      mm.add(
        "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
        () => {
          const buttons = document.querySelectorAll<HTMLElement>(
            ".hero-motion-btns .hero-btn"
          );
          if (!buttons.length) return;

          const cleanups: Array<() => void> = [];

          buttons.forEach((btn) => {
            // Suppress CSS transition on transform so GSAP quickTo has smooth 60fps control
            // while preserving CSS transitions for background, border, and color.
            const originalTransitionProperty = btn.style.transitionProperty;
            btn.style.transitionProperty =
              "background-color, border-color, color, box-shadow, opacity";

            const xTo = gsap.quickTo(btn, "x", {
              duration: 0.35,
              ease: "power2.out",
            });
            const yTo = gsap.quickTo(btn, "y", {
              duration: 0.35,
              ease: "power2.out",
            });

            let initialCenterX = 0;
            let initialCenterY = 0;

            const onPointerEnter = () => {
              const rect = btn.getBoundingClientRect();
              const currentX = (gsap.getProperty(btn, "x") as number) || 0;
              const currentY = (gsap.getProperty(btn, "y") as number) || 0;
              // Derive the un-transformed center of the button to prevent jitter/feedback
              initialCenterX = rect.left - currentX + rect.width / 2;
              initialCenterY = rect.top - currentY + rect.height / 2;
            };

            const onPointerMove = (e: PointerEvent) => {
              const relX = e.clientX - initialCenterX;
              const relY = e.clientY - initialCenterY;

              // Subtle displacement: max +/-8px horizontally, max +/-5px vertically
              const maxDistX = 8;
              const maxDistY = 5;
              const strength = 0.24;

              const targetX = Math.max(-maxDistX, Math.min(maxDistX, relX * strength));
              const targetY = Math.max(-maxDistY, Math.min(maxDistY, relY * strength));

              xTo(targetX);
              yTo(targetY);
            };

            const onPointerLeave = () => {
              // Smooth return to resting center without bounce
              gsap.to(btn, {
                x: 0,
                y: 0,
                duration: 0.45,
                ease: "power2.out",
                overwrite: "auto",
              });
            };

            btn.addEventListener("pointerenter", onPointerEnter);
            btn.addEventListener("pointermove", onPointerMove);
            btn.addEventListener("pointerleave", onPointerLeave);

            cleanups.push(() => {
              btn.removeEventListener("pointerenter", onPointerEnter);
              btn.removeEventListener("pointermove", onPointerMove);
              btn.removeEventListener("pointerleave", onPointerLeave);
              btn.style.transitionProperty = originalTransitionProperty;
              gsap.set(btn, { clearProps: "x,y" });
            });
          });

          return () => {
            cleanups.forEach((cleanup) => cleanup());
          };
        }
      );
    });

    ctxRef.current = ctx;

    return () => {
      ctx.revert();
      ctxRef.current = null;
      const hero = document.querySelector<HTMLElement>(".hero");
      if (hero) hero.removeAttribute("data-hero-motion");
    };
  }, []);

  return null;
}
