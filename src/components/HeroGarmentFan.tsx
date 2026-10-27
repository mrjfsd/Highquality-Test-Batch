"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type GarmentCardItem = {
  id: number;
  title: string;
  category: string;
  image: string;
  alt: string;
};

// 10 distinct, authentic product cards from the repository
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
    alt: "Casual structured outerwear jacket",
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
  {
    id: 7,
    title: "Structured Blazer",
    category: "Women's Edit",
    image: "/assets/dummy-products/women/women-blazer-side.jpg",
    alt: "Structured linen blazer profile drape",
  },
  {
    id: 8,
    title: "Tactile Knit Detail",
    category: "Men's Edit",
    image: "/assets/dummy-products/men/men-knit-detail.jpg",
    alt: "Tactile knit detail and collar weave",
  },
  {
    id: 9,
    title: "Classic Denim Jeans",
    category: "Essential Denim",
    image: "/assets/floating-jeans-mobile.webp",
    alt: "Floating blue denim jeans",
  },
];

const N = HERO_GARMENTS.length; // 10 cards

export default function HeroGarmentFan({
  isBannerActive = true,
}: {
  isBannerActive?: boolean;
}) {
  // Continuous rotation progress (in card units: 0.0, 1.0, 2.5, etc.)
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Animation and physics refs for continuous, fluid interpolation
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const rafId = useRef<number | null>(null);

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

  // Continuous animation loop using critically damped lerp
  const startAnimation = useCallback(() => {
    if (rafId.current !== null) return;

    const tick = () => {
      const target = targetProgressRef.current;
      const current = progressRef.current;
      const diff = target - current;

      // Slower, more stately, and luxurious glide
      const isDragging = isDraggingRef.current;
      const lerpFactor = isDragging ? 0.28 : 0.082;

      if (!isDragging && Math.abs(diff) < 0.0008) {
        progressRef.current = target;
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

  // Horizontal wheel / trackpad continuous rotation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
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
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        targetProgressRef.current = Math.round(targetProgressRef.current) - 1;
        startAnimation();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        targetProgressRef.current = Math.round(targetProgressRef.current) + 1;
        startAnimation();
      }
    },
    [startAnimation]
  );

  // Pointer event handlers for unified smooth mouse drag and touch swipe
  const handlePointerDown = (e: React.PointerEvent) => {
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
    // Prevent accidental click if user was dragging
    if (hasDragged.current) return;

    // Find the shortest circular path from current progress to cardIndex
    const cur = targetProgressRef.current;
    const curMod = ((cur % N) + N) % N;
    let delta = cardIndex - curMod;
    if (delta > N / 2) delta -= N;
    if (delta < -N / 2) delta += N;

    targetProgressRef.current = cur + delta;
    startAnimation();
  };

  // Compute smooth geometric transform for card `i`
  const getCardStyle = (i: number) => {
    // Relative continuous circular distance from current progress (-5 to +5)
    let diff = (i - progress) % N;
    while (diff > N / 2) diff -= N;
    while (diff < -N / 2) diff += N;

    const absDiff = Math.abs(diff);

    // Responsive geometry parameters for 10-card fan distribution
    const spacingX = isMobile ? 42 : isTablet ? 84 : 114;
    const arcDrop = isMobile ? 2.4 : isTablet ? 3.8 : 4.8;
    const rotStep = isMobile ? 3.2 : isTablet ? 3.9 : 4.4;
    const scaleStep = isMobile ? 0.062 : 0.068;

    const translateX = diff * spacingX;
    const translateY = Math.pow(absDiff, 1.28) * arcDrop;
    const rotate = diff * rotStep;
    const scale = Math.max(0.60, 1.05 - absDiff * scaleStep);

    // Continuous z-index: center card has highest prominence (12), outer cards cascade down
    const zIndex = Math.max(1, Math.round((5 - absDiff) * 2) + 1);

    // Smooth progressive fade curve:
    // - Active center card (absDiff = 0) is 1.0 (fully visible, crisp, dominant).
    // - Immediate adjacent cards (absDiff = 1) remain mostly visible (~0.95) with natural colors.
    // - Side cards progressively soften (absDiff = 2 -> ~0.83, absDiff = 3 -> ~0.63, absDiff = 4 -> ~0.34).
    // - Smoothly blends into 0.0 before reaching the outer wrapping threshold so cards never pop or snap.
    const maxVisibleRadius = isMobile ? 3.6 : isTablet ? 4.3 : 4.8;
    let opacity = 0;
    if (absDiff < maxVisibleRadius) {
      const normalizedDist = absDiff / maxVisibleRadius;
      // Cosine ease-out curve with 0.8 exponent for silky, natural opacity falloff
      opacity = Math.pow(Math.cos((normalizedDist * Math.PI) / 2), 0.8);
    }

    // Keep garment colors vivid, natural, and sharp without dark muddying overlays
    const brightness = Math.max(0.88, 1 - absDiff * 0.024);
    const isCenter = absDiff < 0.35;

    return {
      transform: `translateX(calc(-50% + ${translateX.toFixed(2)}px)) translateY(${translateY.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
      zIndex,
      opacity: opacity.toFixed(3),
      filter: `brightness(${brightness.toFixed(3)})`,
      cursor: isCenter ? "default" : "pointer",
      pointerEvents: opacity < 0.15 ? ("none" as const) : ("auto" as const),
      boxShadow: isCenter
        ? "0 24px 50px -10px rgba(6, 17, 12, 0.95), 0 10px 24px rgba(0, 0, 0, 0.6), inset 0 1px 1.5px rgba(247, 243, 238, 0.32)"
        : "0 12px 28px -8px rgba(6, 17, 12, 0.72), inset 0 1px 1px rgba(247, 243, 238, 0.16)",
      // No CSS transition delays during continuous pointer drag; instant silky smooth rendering
      transition: "box-shadow 240ms ease, border-color 240ms ease",
    };
  };

  // Normalized active garment index for center prominence
  const activeIndex = ((Math.round(progress) % N) + N) % N;

  return (
    <div
      ref={containerRef}
      className="hero-fan-container"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero garment interactive circular fan"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* The 10-Card Circular Overlapping Fan Stage */}
      <div className="hero-fan-stage">
        {HERO_GARMENTS.map((item, idx) => {
          const style = getCardStyle(idx);
          const isCenter = idx === activeIndex;

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
                loading="eager"
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
