"use client";
/* eslint-disable react-hooks/refs */

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type GarmentCardItem = {
  id: number | string;
  title: string;
  category: string;
  image: string;
  alt: string;
};

// Exactly 7 authentic, distinct garment product cards matching repository & admin defaults
export const HERO_GARMENTS: GarmentCardItem[] = [
  {
    id: 0,
    title: "Fleece Zip Jacket",
    category: "Style Edit Capsule",
    image: "/assets/floating-garment-mobile.webp",
    alt: "Style Edit floating fleece zip jacket showcase",
  },
  {
    id: 1,
    title: "Graphic Camera Tee",
    category: "Everyday Edit",
    image: "/assets/floating-tshirt-mobile.webp",
    alt: "Floating charcoal graphic camera t-shirt",
  },
  {
    id: 2,
    title: "Textured Knitwear",
    category: "Men's Edit",
    image: "/assets/dummy-products/men/men-knit-front.jpg",
    alt: "Textured charcoal everyday knitwear",
  },
  {
    id: 3,
    title: "Casual Outerwear",
    category: "Outerwear Capsule",
    image: "/assets/dummy-products/kids/kids-jacket-front.jpg",
    alt: "Casual structured mustard outerwear jacket",
  },
  {
    id: 4,
    title: "Tailored Linen Blazer",
    category: "Women's Edit",
    image: "/assets/dummy-products/women/women-blazer-front.jpg",
    alt: "Tailored relaxed linen blazer in stone",
  },
  {
    id: 5,
    title: "Minimalist Ribbed Knit",
    category: "Men's Edit",
    image: "/assets/dummy-products/men/men-knit-side.jpg",
    alt: "Minimalist ribbed knitwear profile view",
  },
  {
    id: 6,
    title: "Quilted Jacket",
    category: "Outerwear Capsule",
    image: "/assets/dummy-products/kids/kids-jacket-side.jpg",
    alt: "Quilted mustard jacket profile view",
  },
];

export default function HeroGarmentFan({
  isBannerActive = true,
  cards,
  scrollContainerId,
}: {
  isBannerActive?: boolean;
  cards?: GarmentCardItem[];
  scrollContainerId?: string;
}) {
  const activeCards = (cards && cards.length > 0 ? cards : HERO_GARMENTS).slice(0, 7);
  const N = activeCards.length;

  // Continuous rotation progress (in card units: 0.0, 1.0, 2.5, etc.)
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Animation and physics refs for continuous, fluid interpolation
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragTiltRef = useRef(0);
  const dragTiltTargetRef = useRef(0);
  const rafId = useRef<number | null>(null);

  // Deck deal intro tracking: starts at 0 (stacked pile) on server and first client render
  const introRef = useRef(0);
  const introDoneRef = useRef(false);

  // Pointer tracking refs
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const dragStartProgress = useRef(0);
  const gestureLocked = useRef<"horizontal" | "vertical" | null>(null);
  const hasDragged = useRef(false);
  const lastPointerX = useRef(0);
  const lastPointerTime = useRef(0);
  const velocityX = useRef(0);
  const wheelTimer = useRef<NodeJS.Timeout | null>(null);

  // Responsive breakpoint detection
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 640);
      setIsTablet(width > 640 && width <= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Continuous animation loop using critically damped lerp with 3D tilt
  const startAnimation = useCallback(() => {
    if (rafId.current !== null) return;

    const tick = () => {
      const target = targetProgressRef.current;
      const current = progressRef.current;
      const diff = target - current;

      // Higher tracking responsiveness during active drag (0.34), silky smooth damping on release (0.09)
      const isDragging = isDraggingRef.current;
      const lerpFactor = isDragging ? 0.34 : 0.09;

      // Direction-aware 3D tilt while dragging (one way pulling right, the other pulling left)
      const tiltTarget = isDragging
        ? Math.max(-10, Math.min(10, -velocityX.current * 14))
        : 0;
      dragTiltTargetRef.current = tiltTarget;
      dragTiltRef.current +=
        (dragTiltTargetRef.current - dragTiltRef.current) * (isDragging ? 0.25 : 0.12);

      if (
        !isDragging &&
        Math.abs(diff) < 0.0008 &&
        Math.abs(dragTiltRef.current) < 0.04
      ) {
        progressRef.current = target;
        dragTiltRef.current = 0;
        setProgress(target);
        rafId.current = null;
        return;
      }

      const next = current + diff * lerpFactor;
      progressRef.current = next;
      setProgress(next);

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
      if (wheelTimer.current) {
        clearTimeout(wheelTimer.current);
      }
    };
  }, []);

  // Deck deal intro animation: runs synchronously before paint on mount via useIsomorphicLayoutEffect
  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    // If page is already scrolled down or user prefers reduced motion, skip intro and show fan immediately
    if (
      (window.scrollY || window.pageYOffset || 0) > 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      introRef.current = 1;
      introDoneRef.current = true;

      // Distribute card transforms immediately in DOM before first paint
      const container = containerRef.current;
      if (container) {
        const cardEls = container.querySelectorAll<HTMLElement>(".hero-fan-card");
        const totalCards = cardEls.length;
        const maxVisibleRadius = 3.5;
        const width = window.innerWidth;
        const mobile = width <= 640;
        const tablet = width > 640 && width <= 1024;

        for (let i = 0; i < totalCards; i++) {
          const el = cardEls[i];
          if (!el) continue;

          let diff = (i - progressRef.current) % totalCards;
          while (diff > totalCards / 2) diff -= totalCards;
          while (diff < -totalCards / 2) diff += totalCards;

          const absDiff = Math.abs(diff);

          if (!mobile && !tablet) {
            const a = absDiff;
            const fanTx = Math.sign(diff) * (1.245 * a - 0.025 * Math.pow(a, 3));
            const fanTy = 0.2 * Math.pow(a, 2) - 0.0067 * Math.pow(a, 4);
            const fanRotateZ = diff * 8.8;
            const baseRotateY = -diff * 2.6;
            const scale = Math.max(0.64, 1.04 - absDiff * 0.03);

            let normalOpacity = 0;
            if (absDiff < maxVisibleRadius) {
              const normalizedDist = absDiff / maxVisibleRadius;
              normalOpacity = Math.pow(Math.cos((normalizedDist * Math.PI) / 2), 0.45);
            }

            el.style.transform = `translateX(calc(-50% + ${fanTx.toFixed(4)} * var(--fan-card-w))) translateY(calc(${fanTy.toFixed(4)} * var(--fan-card-w))) rotateZ(${fanRotateZ.toFixed(2)}deg) rotateY(${baseRotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
            el.style.opacity = normalOpacity.toFixed(3);
          } else {
            const R = mobile ? 540 : 820;
            const angleStepDeg = mobile ? 7.6 : 8.2;
            const thetaDeg = diff * angleStepDeg;
            const thetaRad = (thetaDeg * Math.PI) / 180;

            const fanTx = R * Math.sin(thetaRad);
            const fanTy = R * (1 - Math.cos(thetaRad));
            const fanRotateZ = thetaDeg;
            const baseRotateY = -diff * (mobile ? 2.0 : 2.6);
            const scale = Math.max(0.64, (mobile ? 1.04 : 1.08) - absDiff * (mobile ? 0.065 : 0.075));

            let normalOpacity = 0;
            if (absDiff < maxVisibleRadius) {
              const normalizedDist = absDiff / maxVisibleRadius;
              normalOpacity = Math.pow(Math.cos((normalizedDist * Math.PI) / 2), 0.78);
            }

            el.style.transform = `translateX(calc(-50% + ${fanTx.toFixed(2)}px)) translateY(${fanTy.toFixed(2)}px) rotateZ(${fanRotateZ.toFixed(2)}deg) rotateY(${baseRotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
            el.style.opacity = normalOpacity.toFixed(3);
          }
        }
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    introRef.current = 0;
    introDoneRef.current = false;

    // Failsafe 1: timeout ~2200ms guarantees introDoneRef is set
    const failsafeTimer = setTimeout(() => {
      introDoneRef.current = true;
    }, 2200);

    // Failsafe 2: tab visibilitychange to hidden also sets introDone
    const onVisibilityChange = () => {
      if (document.hidden) {
        introDoneRef.current = true;
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Cache card elements once on mount to avoid allocating NodeLists or arrays per frame
    const cardEls = Array.from(container.querySelectorAll<HTMLElement>(".hero-fan-card"));
    const totalCards = cardEls.length;
    const maxVisibleRadius = 3.5;

    const proxy = { val: 0 };
    const tween = gsap.to(proxy, {
      val: 1,
      duration: 1.4,
      delay: 0.25,
      ease: "power3.inOut",
      onUpdate() {
        const intro = proxy.val;
        introRef.current = intro;

        // Direct DOM arithmetic update: no React state or new objects per frame
        const width = window.innerWidth;
        const mobile = width <= 640;
        const tablet = width > 640 && width <= 1024;

        for (let i = 0; i < totalCards; i++) {
          const el = cardEls[i];
          if (!el) continue;

          let diff = (i - progressRef.current) % totalCards;
          while (diff > totalCards / 2) diff -= totalCards;
          while (diff < -totalCards / 2) diff += totalCards;

          const absDiff = Math.abs(diff);
          const cardProgress = Math.max(0, Math.min(1, (intro - 0.05 * absDiff) / 0.85));
          const stackRotateZ = diff * 1.5;

          if (!mobile && !tablet) {
            // Desktop polynomial curves matching approved resting fan
            const a = absDiff;
            const fanTx = Math.sign(diff) * (1.245 * a - 0.025 * Math.pow(a, 3));
            const fanTy = 0.2 * Math.pow(a, 2) - 0.0067 * Math.pow(a, 4);
            const fanRotateZ = diff * 8.8;
            const baseRotateY = -diff * 2.6;
            const scale = Math.max(0.64, 1.04 - absDiff * 0.03);

            const tx = fanTx * cardProgress;
            const ty = fanTy * cardProgress;
            const rotZ = stackRotateZ + (fanRotateZ - stackRotateZ) * cardProgress;

            let normalOpacity = 0;
            if (absDiff < maxVisibleRadius) {
              const normalizedDist = absDiff / maxVisibleRadius;
              normalOpacity = Math.pow(Math.cos((normalizedDist * Math.PI) / 2), 0.45);
            }
            const opacity = 1 + (normalOpacity - 1) * cardProgress;

            el.style.transform = `translateX(calc(-50% + ${tx.toFixed(4)} * var(--fan-card-w))) translateY(calc(${ty.toFixed(4)} * var(--fan-card-w))) rotateZ(${rotZ.toFixed(2)}deg) rotateY(${baseRotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
            el.style.opacity = opacity.toFixed(3);
          } else {
            // Tablet and Mobile
            const R = mobile ? 540 : 820;
            const angleStepDeg = mobile ? 7.6 : 8.2;
            const thetaDeg = diff * angleStepDeg;
            const thetaRad = (thetaDeg * Math.PI) / 180;

            const fanTx = R * Math.sin(thetaRad);
            const fanTy = R * (1 - Math.cos(thetaRad));
            const fanRotateZ = thetaDeg;
            const baseRotateY = -diff * (mobile ? 2.0 : 2.6);
            const scale = Math.max(0.64, (mobile ? 1.04 : 1.08) - absDiff * (mobile ? 0.065 : 0.075));

            const tx = fanTx * cardProgress;
            const ty = fanTy * cardProgress;
            const rotZ = stackRotateZ + (fanRotateZ - stackRotateZ) * cardProgress;

            let normalOpacity = 0;
            if (absDiff < maxVisibleRadius) {
              const normalizedDist = absDiff / maxVisibleRadius;
              normalOpacity = Math.pow(Math.cos((normalizedDist * Math.PI) / 2), 0.78);
            }
            const opacity = 1 + (normalOpacity - 1) * cardProgress;

            el.style.transform = `translateX(calc(-50% + ${tx.toFixed(2)}px)) translateY(${ty.toFixed(2)}px) rotateZ(${rotZ.toFixed(2)}deg) rotateY(${baseRotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
            el.style.opacity = opacity.toFixed(3);
          }
        }
      },
      onComplete() {
        introDoneRef.current = true;
        // Align React state with the finished intro
        startAnimation();
      },
    });

    return () => {
      tween.kill();
      clearTimeout(failsafeTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [startAnimation]);

  // GSAP ScrollTrigger scroll-driven rotation:
  // Scrolling down advances the carousel forward through the cards,
  // scrolling up reverses rotation, stopping mid-scroll halts the movement.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const triggerEl = scrollContainerId
      ? document.getElementById(scrollContainerId)
      : containerRef.current;

    if (!triggerEl) return;

    const isMobileViewport = window.innerWidth <= 768;

    const st = ScrollTrigger.create({
      trigger: triggerEl,
      start: "top top",
      end: isMobileViewport ? "bottom top" : "bottom bottom",
      scrub: 0.6,
      onUpdate: (self) => {
        if (!introDoneRef.current || isDraggingRef.current) return;
        targetProgressRef.current = self.progress * N;
        startAnimation();
      },
    });

    return () => {
      st.kill();
    };
  }, [scrollContainerId, N, startAnimation]);

  // Step rotation controls for arrow buttons and keyboard
  const handlePrev = useCallback(() => {
    targetProgressRef.current = Math.round(targetProgressRef.current) - 1;
    startAnimation();
  }, [startAnimation]);

  const handleNext = useCallback(() => {
    targetProgressRef.current = Math.round(targetProgressRef.current) + 1;
    startAnimation();
  }, [startAnimation]);

  // Horizontal wheel / trackpad continuous rotation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!introDoneRef.current) return;
      // Only intercept if the gesture is predominantly horizontal
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 8) {
        e.preventDefault();

        const step = isMobile ? 160 : 240;
        targetProgressRef.current += e.deltaX / step;
        startAnimation();

        // Smoothly settle to nearest whole card when user pauses trackpad gesture
        if (wheelTimer.current) clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          targetProgressRef.current = Math.round(targetProgressRef.current);
          startAnimation();
        }, 160);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isMobile, startAnimation]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!introDoneRef.current) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    },
    [handlePrev, handleNext]
  );

  // Pointer event handlers for unified smooth mouse drag and touch swipe
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!introDoneRef.current) return;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    lastPointerX.current = e.clientX;
    lastPointerTime.current = performance.now();
    velocityX.current = 0;
    gestureLocked.current = null;
    hasDragged.current = false;
    isDraggingRef.current = false;
    dragStartProgress.current = targetProgressRef.current;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartX.current === null || pointerStartY.current === null) return;

    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;

    // Directional lock: decide between horizontal carousel rotation and vertical page scroll
    if (gestureLocked.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          gestureLocked.current = "horizontal";
          hasDragged.current = true;
          isDraggingRef.current = true;
          try {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          } catch {
            // Ignore capture error if unsupported
          }
        } else {
          gestureLocked.current = "vertical";
          return;
        }
      }
    }

    if (gestureLocked.current === "horizontal") {
      const now = performance.now();
      const dt = now - lastPointerTime.current;
      if (dt > 0) {
        const vx = (e.clientX - lastPointerX.current) / dt;
        velocityX.current = vx * 0.65 + velocityX.current * 0.35; // Exponential moving average
      }
      lastPointerX.current = e.clientX;
      lastPointerTime.current = now;

      // Update target progress continuously based on pixel drag distance
      const dragStep = isMobile ? 95 : 155;
      const floatDelta = -dx / dragStep;
      targetProgressRef.current = dragStartProgress.current + floatDelta;
      startAnimation();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (gestureLocked.current === "horizontal") {
      isDraggingRef.current = false;

      // Natural, measured momentum flick on release, settling calmly into the nearest card
      const momentumFactor = isMobile ? 0.11 : 0.15;
      const momentum = -velocityX.current * momentumFactor;
      const targetWithMomentum = targetProgressRef.current + momentum;
      targetProgressRef.current = Math.round(targetWithMomentum);
      startAnimation();

      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Ignore
      }
    }

    pointerStartX.current = null;
    pointerStartY.current = null;
    gestureLocked.current = null;
    isDraggingRef.current = false;

    // Retain hasDragged briefly to prevent accidental click handler activation on release
    setTimeout(() => {
      hasDragged.current = false;
    }, 60);
  };

  const handleCardClick = (cardIndex: number) => {
    // Prevent accidental click if user was dragging or intro is playing
    if (!introDoneRef.current || hasDragged.current) return;

    // Find the shortest circular path from current progress to cardIndex
    const cur = targetProgressRef.current;
    const curMod = ((cur % N) + N) % N;
    let delta = cardIndex - curMod;
    if (delta > N / 2) delta -= N;
    if (delta < -N / 2) delta += N;

    targetProgressRef.current = cur + delta;
    startAnimation();
  };

  // Compute smooth geometric transform for card `i` along the circular tangent arc
  const getCardStyle = (i: number) => {
    // Relative continuous circular distance from current progress (-5 to +5)
    let diff = (i - progress) % N;
    while (diff > N / 2) diff -= N;
    while (diff < -N / 2) diff += N;

    const absDiff = Math.abs(diff);

    // 3D Perspective Rotation (Y-axis tilt):
    // Inward facing curvature + direction-aware drag tilt
    const baseRotateY = -diff * (isMobile ? 2.0 : 2.6);
    const dynamicTilt = dragTiltRef.current * Math.max(0.3, 1 - absDiff * 0.18);
    const totalRotateY = baseRotateY + dynamicTilt;

    let transformString = "";
    let scale = 1;
    let opacity = 0;

    const maxVisibleRadius = 3.5;

    if (!isMobile && !isTablet) {
      // Desktop polynomial curves expressed in card-widths matching NOVA reference
      const a = absDiff;
      const tx = Math.sign(diff) * (1.245 * a - 0.025 * Math.pow(a, 3));
      const ty = 0.2 * Math.pow(a, 2) - 0.0067 * Math.pow(a, 4);
      const rotateZ = diff * 8.8;

      const scaleStep = 0.03;
      scale = Math.max(0.64, 1.04 - absDiff * scaleStep);

      // Deck deal intro interpolation per card
      const intro = introRef.current;
      const cardProgress = Math.max(0, Math.min(1, (intro - 0.05 * absDiff) / 0.85));
      const stackRotateZ = diff * 1.5;

      const txCurrent = tx * cardProgress;
      const tyCurrent = ty * cardProgress;
      const rotateZCurrent = stackRotateZ + (rotateZ - stackRotateZ) * cardProgress;

      let normalOpacity = 0;
      if (absDiff < maxVisibleRadius) {
        const normalizedDist = absDiff / maxVisibleRadius;
        normalOpacity = Math.pow(Math.cos((normalizedDist * Math.PI) / 2), 0.45);
      }
      opacity = 1 + (normalOpacity - 1) * cardProgress;

      transformString = `translateX(calc(-50% + ${txCurrent.toFixed(4)} * var(--fan-card-w))) translateY(calc(${tyCurrent.toFixed(4)} * var(--fan-card-w))) rotateZ(${rotateZCurrent.toFixed(2)}deg) rotateY(${totalRotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    } else {
      // Tablet and Mobile circular-arc calculation (unchanged)
      const R = isMobile ? 540 : 820;
      const angleStepDeg = isMobile ? 7.6 : 8.2;
      const thetaDeg = diff * angleStepDeg;
      const thetaRad = (thetaDeg * Math.PI) / 180;

      const translateX = R * Math.sin(thetaRad);
      const translateY = R * (1 - Math.cos(thetaRad));
      const rotateZ = thetaDeg;

      const scaleStep = isMobile ? 0.065 : 0.075;
      scale = Math.max(0.64, (isMobile ? 1.04 : 1.08) - absDiff * scaleStep);

      // Deck deal intro interpolation per card (tablet/mobile reuse)
      const intro = introRef.current;
      const cardProgress = Math.max(0, Math.min(1, (intro - 0.05 * absDiff) / 0.85));
      const stackRotateZ = diff * 1.5;

      const txCurrent = translateX * cardProgress;
      const tyCurrent = translateY * cardProgress;
      const rotateZCurrent = stackRotateZ + (rotateZ - stackRotateZ) * cardProgress;

      let normalOpacity = 0;
      if (absDiff < maxVisibleRadius) {
        const normalizedDist = absDiff / maxVisibleRadius;
        normalOpacity = Math.pow(Math.cos((normalizedDist * Math.PI) / 2), 0.78);
      }
      opacity = 1 + (normalOpacity - 1) * cardProgress;

      transformString = `translateX(calc(-50% + ${txCurrent.toFixed(2)}px)) translateY(${tyCurrent.toFixed(2)}px) rotateZ(${rotateZCurrent.toFixed(2)}deg) rotateY(${totalRotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }

    // Stacking order: center card has highest prominence (15), outer cards cascade down
    const zIndex = Math.max(1, Math.round((5 - absDiff) * 3));

    const brightness = Math.max(0.88, 1 - absDiff * 0.024);
    const isCenter = absDiff < 0.35;

    return {
      transform: transformString,
      zIndex,
      opacity: opacity.toFixed(3),
      filter: `brightness(${brightness.toFixed(3)})`,
      borderRadius: isMobile ? "14px" : "20px",
      cursor: isCenter ? "grab" : "pointer",
      pointerEvents: opacity < 0.12 ? ("none" as const) : ("auto" as const),
      boxShadow: isCenter
        ? "0 28px 56px -10px rgba(6, 17, 12, 0.96), 0 12px 28px rgba(0, 0, 0, 0.65), inset 0 1px 1.5px rgba(247, 243, 238, 0.34)"
        : "0 12px 28px -8px rgba(6, 17, 12, 0.72), inset 0 1px 1px rgba(247, 243, 238, 0.16)",
      transition: isDraggingRef.current
        ? "none"
        : "box-shadow 260ms ease, border-color 260ms ease",
    };
  };

  // Normalized active garment index for center prominence
  const activeIndex = N > 0 ? ((Math.round(progress) % N) + N) % N : 0;

  return (
    <div
      ref={containerRef}
      className="hero-fan-container"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero garment interactive fan carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Symmetrical Upward-Curving Fan Arc Stage (7 Cards) */}
      <div className="hero-fan-stage">
        {activeCards.map((item, idx) => {
          const style = getCardStyle(idx);
          const isCenter = idx === activeIndex;

          let diff = (idx - progress) % N;
          while (diff > N / 2) diff -= N;
          while (diff < -N / 2) diff += N;
          const isNeighbour = Math.abs(diff) <= 1.2;
          const isEager = isCenter || isNeighbour;

          return (
            <div
              key={item.id}
              className={`hero-fan-card ${isCenter ? "hero-fan-card--active" : ""}`}
              style={style}
              onClick={() => handleCardClick(idx)}
              aria-label={`${item.title} — ${item.category}${isCenter ? " (Center Active)" : " (Click to center)"}`}
              aria-current={isCenter ? "true" : undefined}
            >
              <div className="hero-garment-sheen" aria-hidden="true" />
              {isCenter && <div className="hero-garment-light" aria-hidden="true" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.alt}
                className="hero-fan-img"
                loading={isEager ? "eager" : "lazy"}
                fetchPriority={isCenter && !isBannerActive ? "high" : "auto"}
                decoding="async"
                draggable={false}
              />
            </div>
          );
        })}

        {/* Ambient floor shadow under fan */}
        <div className="hero-fan-floor-shadow" aria-hidden="true" />
      </div>
    </div>
  );
}
