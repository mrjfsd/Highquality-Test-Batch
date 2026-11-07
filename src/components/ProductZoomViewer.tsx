"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import type { ProductGalleryImage } from "@/data/products";
import { getOptimizedImageUrl } from "@/lib/images/responsive";

export interface ProductZoomViewerProps {
  isOpen: boolean;
  images: ProductGalleryImage[];
  initialIndex: number;
  productName: string;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;
const DOUBLE_TAP_SCALE = 2.5;

export default function ProductZoomViewer({
  isOpen,
  images,
  initialIndex,
  productName,
  onClose,
  onIndexChange,
}: ProductZoomViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState<number>(MIN_SCALE);
  const [isHighResLoaded, setIsHighResLoaded] = useState<boolean>(false);

  // Position transform
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scaleRef = useRef<number>(MIN_SCALE);

  // Prefetch tracking for high-res images (1600w)
  const prefetchedHighRes = useRef<Set<string>>(new Set());

  // DOM refs
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const transformLayerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  // Animation frame id for zero-thrash transforms
  const rafId = useRef<number | null>(null);

  // Multi-pointer tracking for pinch zoom & panning
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef<number>(MIN_SCALE);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  // Double tap / double click detection
  const lastTapTime = useRef<number>(0);
  const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Synchronize scaleRef with state
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Keep transformLayer updated via RAF
  const applyTransform = useCallback((animate = false) => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(() => {
      const el = transformLayerRef.current;
      if (!el) return;
      el.style.transition = animate ? "transform 220ms cubic-bezier(0.2, 0, 0.2, 1)" : "none";
      el.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0px) scale(${scaleRef.current})`;
    });
  }, []);

  // Clamps pan coordinates so the image cannot leave the viewport screen
  const clampPan = useCallback((s: number, p: { x: number; y: number }) => {
    if (s <= 1.01) {
      return { x: 0, y: 0 };
    }
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) {
      return p;
    }

    const sRect = stage.getBoundingClientRect();
    const naturalRatio = img.naturalWidth && img.naturalHeight
      ? img.naturalWidth / img.naturalHeight
      : sRect.width / sRect.height;
    const stageRatio = sRect.width / sRect.height;

    let baseW = sRect.width;
    let baseH = sRect.height;

    // Based on object-fit: contain sizing
    if (stageRatio > naturalRatio) {
      baseH = sRect.height;
      baseW = baseH * naturalRatio;
    } else {
      baseW = sRect.width;
      baseH = baseW / naturalRatio;
    }

    const scaledW = baseW * s;
    const scaledH = baseH * s;

    const maxPanX = Math.max(0, (scaledW - sRect.width) / 2);
    const maxPanY = Math.max(0, (scaledH - sRect.height) / 2);

    return {
      x: Math.min(maxPanX, Math.max(-maxPanX, p.x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, p.y)),
    };
  }, []);

  // Reset zoom & pan to 1.0
  const resetZoom = useCallback((animate = true) => {
    setScale(MIN_SCALE);
    scaleRef.current = MIN_SCALE;
    panRef.current = { x: 0, y: 0 };
    applyTransform(animate);
  }, [applyTransform]);

  // Set zoom with optional center point
  const setZoom = useCallback(
    (newScale: number, centerX?: number, centerY?: number, animate = true) => {
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      const stage = stageRef.current;

      if (stage && typeof centerX === "number" && typeof centerY === "number" && clampedScale > 1) {
        const rect = stage.getBoundingClientRect();
        const offsetX = centerX - (rect.left + rect.width / 2);
        const offsetY = centerY - (rect.top + rect.height / 2);

        // Adjust pan to zoom towards pointer point
        const factor = (clampedScale - scaleRef.current) / scaleRef.current;
        const targetPan = {
          x: panRef.current.x - offsetX * factor,
          y: panRef.current.y - offsetY * factor,
        };
        panRef.current = clampPan(clampedScale, targetPan);
      } else if (clampedScale <= 1.01) {
        panRef.current = { x: 0, y: 0 };
      } else {
        panRef.current = clampPan(clampedScale, panRef.current);
      }

      setScale(clampedScale);
      scaleRef.current = clampedScale;
      applyTransform(animate);
    },
    [applyTransform, clampPan]
  );

  // Navigate to slide
  const goToIndex = useCallback(
    (newIndex: number) => {
      const total = images.length;
      if (total <= 1) return;
      const validIndex = (newIndex + total) % total;
      setCurrentIndex(validIndex);
      setIsHighResLoaded(false);
      resetZoom(false);
      onIndexChange?.(validIndex);
    },
    [images.length, onIndexChange, resetZoom]
  );

  const goToNext = useCallback(() => {
    goToIndex(currentIndex + 1);
  }, [currentIndex, goToIndex]);

  const goToPrev = useCallback(() => {
    goToIndex(currentIndex - 1);
  }, [currentIndex, goToIndex]);

  // High-res on-demand loading & adjacent slide prefetching
  const currentImage = images[currentIndex] || images[0];
  const placeholderSrc = currentImage ? getOptimizedImageUrl(currentImage.url, 800, 80) : "";
  const highResSrc = currentImage ? getOptimizedImageUrl(currentImage.url, 1600, 80) : "";

  // When high-res finishes loading for current image, prefetch neighbors
  const handleHighResLoad = useCallback(() => {
    setIsHighResLoaded(true);
    if (images.length <= 1 || typeof window === "undefined") return;

    // Check Data Saver / 2G before prefetching large variants
    const nav = navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    if (
      nav.connection?.saveData === true ||
      nav.connection?.effectiveType === "2g" ||
      nav.connection?.effectiveType === "slow-2g"
    ) {
      return;
    }

    const nextIdx = (currentIndex + 1) % images.length;
    const prevIdx = (currentIndex - 1 + images.length) % images.length;
    const neighborUrls = [images[nextIdx]?.url, images[prevIdx]?.url].filter(Boolean);

    neighborUrls.forEach((url) => {
      if (!url) return;
      const target = getOptimizedImageUrl(url, 1600, 80);
      if (prefetchedHighRes.current.has(target)) return;
      prefetchedHighRes.current.add(target);
      const img = new Image();
      img.decoding = "async";
      img.src = target;
    });
  }, [currentIndex, images]);

  // Lock background scroll (including iOS Safari) and manage focus
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element for focus restoration
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;

    const scrollY = window.scrollY;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;

    // Bulletproof scroll lock for mobile Safari and desktop
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    // Move focus into the viewer
    closeBtnRef.current?.focus();

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);

      // Restore focus to clicked gallery image
      lastActiveElementRef.current?.focus?.();
    };
  }, [isOpen]);

  // Keyboard navigation & accessibility focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom(scaleRef.current + 0.5);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom(scaleRef.current - 0.5);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        resetZoom(true);
        return;
      }

      // Focus trap within modal
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex="0"]'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goToNext, goToPrev, setZoom, resetZoom]);

  // Mouse wheel zoom
  useEffect(() => {
    if (!isOpen) return;
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Sensitivity factor
      const zoomFactor = -e.deltaY * 0.0025;
      const targetScale = scaleRef.current + zoomFactor;
      setZoom(targetScale, e.clientX, e.clientY, false);
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
    };
  }, [isOpen, setZoom]);

  // Pointer event handlers (Multi-touch pinch, drag-to-pan, double-tap)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only capture primary mouse button or touch
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const stage = stageRef.current;
    if (stage) {
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        // Ignored for synthetic pointer events or if pointer capture is unavailable
      }
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    hasMovedRef.current = false;

    if (activePointers.current.size === 1) {
      lastPanPoint.current = { x: e.clientX, y: e.clientY };

      // Double tap / double click detection
      const now = Date.now();
      const dist = Math.hypot(
        e.clientX - lastTapPos.current.x,
        e.clientY - lastTapPos.current.y
      );

      if (now - lastTapTime.current < 320 && dist < 24) {
        // Double tap confirmed
        lastTapTime.current = 0;
        if (scaleRef.current > 1.1) {
          resetZoom(true);
        } else {
          setZoom(DOUBLE_TAP_SCALE, e.clientX, e.clientY, true);
        }
        return;
      }

      lastTapTime.current = now;
      lastTapPos.current = { x: e.clientX, y: e.clientY };
    } else if (activePointers.current.size === 2) {
      // Pinch started
      const pts = Array.from(activePointers.current.values());
      pinchStartDistance.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartScale.current = scaleRef.current;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch zoom
    if (activePointers.current.size === 2 && pinchStartDistance.current) {
      const pts = Array.from(activePointers.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = currentDist / pinchStartDistance.current;
      const targetScale = pinchStartScale.current * ratio;

      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      setZoom(targetScale, midX, midY, false);
      hasMovedRef.current = true;
      return;
    }

    // Single-pointer pan when zoomed in
    if (activePointers.current.size === 1 && scaleRef.current > 1.01 && lastPanPoint.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasMovedRef.current = true;
      }

      const nextPan = {
        x: panRef.current.x + dx,
        y: panRef.current.y + dy,
      };

      panRef.current = clampPan(scaleRef.current, nextPan);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      applyTransform(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (stage && stage.hasPointerCapture(e.pointerId)) {
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture was already lost
      }
    }

    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size < 2) {
      pinchStartDistance.current = null;
    }

    if (activePointers.current.size === 0) {
      lastPanPoint.current = null;
      // If scale snapped below 1, smoothly restore to 1.0
      if (scaleRef.current <= 1.01) {
        resetZoom(true);
      } else {
        panRef.current = clampPan(scaleRef.current, panRef.current);
        applyTransform(true);
      }
    }
  };

  // Close on backdrop click (only if not zoomed and user didn't drag)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !hasMovedRef.current && scaleRef.current <= 1.05) {
      onClose();
    }
  };

  if (!isOpen || !currentImage) {
    return null;
  }

  const hasMultiple = images.length > 1;

  return (
    <div
      ref={dialogRef}
      className="zoom-viewer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} image full-screen zoom viewer`}
      onClick={handleBackdropClick}
    >
      {/* Top Bar: Title, Counter & Zoom / Close Controls */}
      <header className="zoom-viewer-header" onClick={(e) => e.stopPropagation()}>
        <div className="zoom-viewer-title-wrap">
          <span className="zoom-viewer-product-title">{productName}</span>
          {hasMultiple && (
            <span className="zoom-viewer-counter" aria-live="polite">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div className="zoom-viewer-toolbar">
          {/* Zoom Out Button */}
          <button
            type="button"
            className="zoom-toolbar-btn"
            onClick={() => setZoom(scaleRef.current - 0.5)}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            title="Zoom out (-)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          {/* Zoom Reset / Level Indicator */}
          <button
            type="button"
            className={`zoom-toolbar-btn zoom-level-btn ${scale > 1.05 ? "is-zoomed" : ""}`}
            onClick={() => resetZoom(true)}
            aria-label={`Current zoom ${Math.round(scale * 100)}%. Click to reset.`}
            title="Reset zoom (0)"
          >
            <span className="zoom-level-text">{Math.round(scale * 100)}%</span>
          </button>

          {/* Zoom In Button */}
          <button
            type="button"
            className="zoom-toolbar-btn"
            onClick={() => setZoom(scaleRef.current + 0.5)}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          {/* Close Viewer Button */}
          <button
            ref={closeBtnRef}
            type="button"
            className="zoom-toolbar-btn zoom-close-btn"
            onClick={onClose}
            aria-label="Close zoom viewer"
            title="Close (Escape)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Interactive Stage with touch-action: none strictly on viewer stage */}
      <div
        ref={stageRef}
        className={`zoom-viewer-stage ${scale > 1.05 ? "is-panning" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        <div ref={transformLayerRef} className="zoom-transform-layer">
          {/* Instant Placeholder layer using already-loaded 800w image */}
          {placeholderSrc && !isHighResLoaded && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={placeholderSrc}
              alt=""
              aria-hidden="true"
              className="zoom-viewer-img zoom-viewer-img--placeholder"
              draggable={false}
            />
          )}

          {/* High-Resolution 1600w Image Layer (Loaded on-demand only when viewer is active) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={highResSrc}
            alt={currentImage.alt || `${productName} zoomed view`}
            className={`zoom-viewer-img ${isHighResLoaded ? "is-loaded" : "is-loading"}`}
            onLoad={handleHighResLoad}
            draggable={false}
          />
        </div>
      </div>

      {/* Previous / Next Slide Controls */}
      {hasMultiple && (
        <>
          <button
            type="button"
            className="zoom-nav-btn zoom-nav-btn--prev"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous image"
            title="Previous image (Left arrow)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="zoom-nav-btn zoom-nav-btn--next"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next image"
            title="Next image (Right arrow)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Subtle Hint Bar at Bottom */}
      <footer className="zoom-viewer-footer" onClick={(e) => e.stopPropagation()}>
        <span className="zoom-hint-text">
          Double-click, double-tap, scroll or pinch to zoom &bull; Drag to pan &bull; Esc to close
        </span>
      </footer>
    </div>
  );
}

