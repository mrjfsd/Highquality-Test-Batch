"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { authFetch, PageHeader, Button, Icon, ConfirmDialog, type Page } from "./wireframe-ui";
import { compressImageForUpload, uploadToR2WithProgress } from "@/lib/images/client-compression";
import { type HeroCardConfigItem, DEFAULT_HERO_CARDS } from "@/types/hero-cards";
import {
  type HomepageFavouriteItem,
  DEFAULT_HOMEPAGE_FAVOURITES,
  type HomepageFormPerspectiveItem,
  DEFAULT_HOMEPAGE_FORM_PERSPECTIVE,
} from "@/types/homepage-images";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type SectionKey = "hero" | "favourites" | "form-perspective";

interface TargetSlot {
  section: SectionKey;
  slotIndex: number;
  title: string;
  sectionName: string;
  currentImageUrl: string;
}

interface RemoveTarget {
  section: SectionKey;
  slotIndex: number;
  title: string;
  defaultLabel: string;
}

interface HomepageManagementScreenProps {
  showToast: (message: string) => void;
  navigate?: (page: Page) => void;
}

export function HomepageManagementScreen({ showToast }: HomepageManagementScreenProps) {
  // ── 1. Hero Cards State (Always 7 slots) ──
  const [heroCards, setHeroCards] = useState<HeroCardConfigItem[]>(DEFAULT_HERO_CARDS);

  // ── 2. Current Favourites State (Always 4 slots) ──
  const [favourites, setFavourites] = useState<HomepageFavouriteItem[]>(DEFAULT_HOMEPAGE_FAVOURITES);

  // ── 3. Form & Perspective State (Always 4 slots: Silhouette, Texture, Profile, Craft) ──
  const [formPerspective, setFormPerspective] = useState<HomepageFormPerspectiveItem[]>(
    DEFAULT_HOMEPAGE_FORM_PERSPECTIVE
  );

  const [loading, setLoading] = useState(true);

  // ── Target Slot for Image Replacement ──
  const [targetSlot, setTargetSlot] = useState<TargetSlot | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Target Slot for Removing Custom Override (Restores Default) ──
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Load All 3 Sections on Mount ──
  const loadHomepageData = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/homepage");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.heroCards) && data.heroCards.length > 0) {
          setHeroCards(data.heroCards);
        }
        if (Array.isArray(data.favourites) && data.favourites.length > 0) {
          setFavourites(data.favourites);
        }
        if (Array.isArray(data.formPerspective) && data.formPerspective.length > 0) {
          setFormPerspective(data.formPerspective);
        }
      } else {
        // Fallback to hero-cards endpoint if needed
        const heroRes = await authFetch("/api/admin/hero-cards");
        if (heroRes.ok) {
          const heroData = await heroRes.json();
          if (Array.isArray(heroData.heroCards)) {
            setHeroCards(heroData.heroCards);
          }
        }
      }
    } catch (err) {
      console.warn("[HomepageManagement] Error loading homepage images:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomepageData();
  }, []);

  // ── Trigger File Dialog for Target Slot ──
  const handleStartReplace = (slot: TargetSlot) => {
    setTargetSlot(slot);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // ── File Selection & Validation ──
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !targetSlot) return;
    const file = e.target.files[0];

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      showToast("Unsupported file format. Please upload JPEG, PNG, WebP, or AVIF.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      showToast("File is too large. Maximum supported size is 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setStagedPreviewUrl(objectUrl);
  };

  const handleCancelReplace = () => {
    if (stagedPreviewUrl && stagedPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    setSelectedFile(null);
    setStagedPreviewUrl(null);
    setTargetSlot(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ── Upload & Commit Replacement ──
  const handleConfirmReplace = async () => {
    if (!selectedFile || !targetSlot) return;

    setIsUploading(true);
    setUploadProgress(15);

    try {
      // 1. Client-side compression
      const processed = await compressImageForUpload(selectedFile, {
        maxSizeMB: 0.75,
        maxWidthOrHeight: 1800,
        initialQuality: 0.88,
      });

      setUploadProgress(40);

      // 2. Presigned upload URL
      const presignRes = await authFetch("/api/admin/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: "homepage",
          fileName: processed.file.name,
          contentType: processed.mimeType,
          fileSize: processed.finalSize,
        }),
      });

      if (!presignRes.ok) {
        throw new Error("Failed to generate upload URL.");
      }

      const { presignedUrl, objectKey } = await presignRes.json();
      setUploadProgress(55);

      // 3. Binary upload to R2
      await uploadToR2WithProgress(
        presignedUrl,
        processed.file,
        processed.mimeType,
        (loaded, total) => {
          const percent = 55 + Math.round((loaded / total) * 35);
          setUploadProgress(percent);
        }
      );

      setUploadProgress(92);

      // 4. Update the section slot via backend API
      const newImageUrl = `/api/images/${objectKey}`;
      const saveRes = await authFetch("/api/admin/homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: targetSlot.section,
          slotIndex: targetSlot.slotIndex,
          image: newImageUrl,
          storagePath: objectKey,
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save image replacement.");
      }

      const savedData = await saveRes.json();
      if (targetSlot.section === "hero" && Array.isArray(savedData.heroCards)) {
        setHeroCards(savedData.heroCards);
      } else if (targetSlot.section === "favourites" && Array.isArray(savedData.favourites)) {
        setFavourites(savedData.favourites);
      } else if (targetSlot.section === "form-perspective" && Array.isArray(savedData.formPerspective)) {
        setFormPerspective(savedData.formPerspective);
      }

      showToast(`${targetSlot.title} updated successfully!`);
      handleCancelReplace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to replace image.";
      showToast(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Remove Custom Image (Restore Default) ──
  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);

    try {
      const res = await authFetch("/api/admin/homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: removeTarget.section,
          slotIndex: removeTarget.slotIndex,
          action: "restore-default",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (removeTarget.section === "hero" && Array.isArray(data.heroCards)) {
          setHeroCards(data.heroCards);
        } else if (removeTarget.section === "favourites" && Array.isArray(data.favourites)) {
          setFavourites(data.favourites);
        } else if (removeTarget.section === "form-perspective" && Array.isArray(data.formPerspective)) {
          setFormPerspective(data.formPerspective);
        }
        showToast(`${removeTarget.title} restored to default.`);
      } else {
        showToast("Failed to restore default image.");
      }
    } catch {
      showToast("Network error restoring default image.");
    } finally {
      setIsRemoving(false);
      setRemoveTarget(null);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="homepage-admin-screen" role="region" aria-label="Homepage Image Management">
      <PageHeader title="Homepage Image Management" />

      {/* Hidden file input for file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Subnav Jump Bar ── */}
      <div className="homepage-jump-nav" aria-label="Homepage sections jump navigation">
        <button
          type="button"
          className="homepage-jump-btn"
          onClick={() => scrollToSection("section-hero-cards")}
        >
          <span className="jump-num">1</span> Hero Cards <span className="jump-count">7 slots</span>
        </button>
        <button
          type="button"
          className="homepage-jump-btn"
          onClick={() => scrollToSection("section-current-favourites")}
        >
          <span className="jump-num">2</span> Current Favourites <span className="jump-count">4 slots</span>
        </button>
        <button
          type="button"
          className="homepage-jump-btn"
          onClick={() => scrollToSection("section-form-perspective")}
        >
          <span className="jump-num">3</span> Form & Perspective <span className="jump-count">4 slots</span>
        </button>
      </div>

      <div className="homepage-sections-stack">
        {/* =========================================================================
            SECTION A: HERO CARDS (7 Slots)
            ========================================================================= */}
        <section
          id="section-hero-cards"
          className="homepage-section-block"
          aria-labelledby="heading-hero-cards"
        >
          <div className="homepage-section-header">
            <div>
              <div className="homepage-section-tag">Group 1 of 3 · Homepage Carousel</div>
              <h2 id="heading-hero-cards" className="homepage-section-title">
                Hero Cards <span className="homepage-count-badge">7 Fixed Slots</span>
              </h2>
              <p className="homepage-section-desc">
                Manages the 7 rotating cards in the interactive Hero deck. Card #1 occupies the center active position.
              </p>
            </div>
          </div>

          <div className="hero-cards-grid">
            {heroCards.map((card, idx) => {
              const isCenter = idx === 0;
              const title = card.title || card.defaultTitle || `Card #${idx + 1}`;
              const category = card.category || card.defaultCategory || "";
              const effectiveImg = card.image || card.defaultImage;

              return (
                <div
                  key={card.id || `hero-${idx}`}
                  className={`hero-card-tile ${isCenter ? "is-center" : ""}`}
                >
                  <div className="hero-card-tile-header">
                    <span>
                      Card #{idx + 1} {isCenter ? "· Center Active" : ""}
                    </span>
                    <span className={`hero-slot-badge ${card.isCustom ? "is-custom" : "is-default"}`}>
                      {card.isCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <div className="hero-card-thumb-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={effectiveImg}
                      alt={card.alt || title}
                      className="hero-card-img"
                      loading="lazy"
                    />
                  </div>

                  <div className="hero-card-tile-body">
                    <span className="hero-card-title" title={title}>
                      {title}
                    </span>
                    <span className="hero-card-cat" title={category}>
                      {category}
                    </span>
                  </div>

                  <div className="hero-card-tile-footer">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        handleStartReplace({
                          section: "hero",
                          slotIndex: idx,
                          title: `Hero Card #${idx + 1}`,
                          sectionName: "Hero Cards",
                          currentImageUrl: effectiveImg,
                        })
                      }
                      disabled={loading}
                      aria-label={`Replace image for Hero Card #${idx + 1}`}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!card.isCustom || loading}
                      onClick={() =>
                        setRemoveTarget({
                          section: "hero",
                          slotIndex: idx,
                          title: `Hero Card #${idx + 1}`,
                          defaultLabel: card.defaultTitle || "default image",
                        })
                      }
                      title={card.isCustom ? "Restore default image" : "Already displaying default image"}
                      aria-label={`Remove custom image for Hero Card #${idx + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            SECTION B: CURRENT FAVOURITES (4 Slots)
            ========================================================================= */}
        <section
          id="section-current-favourites"
          className="homepage-section-block"
          aria-labelledby="heading-current-favourites"
        >
          <div className="homepage-section-header">
            <div>
              <div className="homepage-section-tag">Group 2 of 3 · Homepage Grid</div>
              <h2 id="heading-current-favourites" className="homepage-section-title">
                Current Favourites <span className="homepage-count-badge">4 Product Slots</span>
              </h2>
              <p className="homepage-section-desc">
                Curated customer-facing favourites. Replacing an image updates only the displayed visual; product titles, pricing, and links remain intact.
              </p>
            </div>
          </div>

          <div className="hero-cards-grid">
            {favourites.map((fav, idx) => {
              const effectiveImg = fav.image || fav.defaultImage;

              return (
                <div key={fav.id || `fav-${idx}`} className="hero-card-tile">
                  <div className="hero-card-tile-header">
                    <span>Slot #{idx + 1} · Favourite</span>
                    <span className={`hero-slot-badge ${fav.isCustom ? "is-custom" : "is-default"}`}>
                      {fav.isCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <div className="hero-card-thumb-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={effectiveImg}
                      alt={fav.alt || fav.title}
                      className="hero-card-img"
                      loading="lazy"
                    />
                  </div>

                  <div className="hero-card-tile-body">
                    <span className="hero-card-title" title={fav.title}>
                      {fav.title}
                    </span>
                    <span className="hero-card-cat" style={{ color: "var(--admin-charcoal, #1f1d1a)", fontWeight: 600 }}>
                      {fav.price}
                    </span>
                  </div>

                  <div className="hero-card-tile-footer">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        handleStartReplace({
                          section: "favourites",
                          slotIndex: idx,
                          title: `Current Favourite #${idx + 1} (${fav.title})`,
                          sectionName: "Current Favourites",
                          currentImageUrl: effectiveImg,
                        })
                      }
                      disabled={loading}
                      aria-label={`Replace image for Favourite #${idx + 1}`}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!fav.isCustom || loading}
                      onClick={() =>
                        setRemoveTarget({
                          section: "favourites",
                          slotIndex: idx,
                          title: `Current Favourite #${idx + 1}`,
                          defaultLabel: fav.title,
                        })
                      }
                      title={fav.isCustom ? "Restore default image" : "Already displaying default image"}
                      aria-label={`Remove custom image for Favourite #${idx + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            SECTION C: FORM & PERSPECTIVE (4 Slots)
            ========================================================================= */}
        <section
          id="section-form-perspective"
          className="homepage-section-block"
          aria-labelledby="heading-form-perspective"
        >
          <div className="homepage-section-header">
            <div>
              <div className="homepage-section-tag">Group 3 of 3 · Editorial Scroll Showcase</div>
              <h2 id="heading-form-perspective" className="homepage-section-title">
                Form & Perspective <span className="homepage-count-badge">4 Editorial Slides</span>
              </h2>
              <p className="homepage-section-desc">
                Editorial scroll stages: Silhouette (0), Texture (1), Profile (2), Craft (3). Section layout, tags, labels, and scroll animations remain intact.
              </p>
            </div>
          </div>

          <div className="hero-cards-grid">
            {formPerspective.map((item, idx) => {
              const effectiveImg = item.image || item.defaultImage;

              return (
                <div key={item.id || `fp-${idx}`} className="hero-card-tile">
                  <div className="hero-card-tile-header">
                    <span>
                      Stage {item.tagNum} · {item.tagLabel}
                    </span>
                    <span className={`hero-slot-badge ${item.isCustom ? "is-custom" : "is-default"}`}>
                      {item.isCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <div className="hero-card-thumb-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={effectiveImg}
                      alt={item.alt || item.title}
                      className="hero-card-img"
                      loading="lazy"
                    />
                  </div>

                  <div className="hero-card-tile-body">
                    <span className="hero-card-title" title={item.title}>
                      {item.title}
                    </span>
                    <span className="hero-card-cat" title={item.subtitle}>
                      {item.subtitle}
                    </span>
                  </div>

                  <div className="hero-card-tile-footer">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        handleStartReplace({
                          section: "form-perspective",
                          slotIndex: idx,
                          title: `Form & Perspective ${item.position} (${item.tagLabel})`,
                          sectionName: "Form & Perspective",
                          currentImageUrl: effectiveImg,
                        })
                      }
                      disabled={loading}
                      aria-label={`Replace image for ${item.position}`}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!item.isCustom || loading}
                      onClick={() =>
                        setRemoveTarget({
                          section: "form-perspective",
                          slotIndex: idx,
                          title: `Form & Perspective ${item.position}`,
                          defaultLabel: item.title,
                        })
                      }
                      title={item.isCustom ? "Restore default image" : "Already displaying default image"}
                      aria-label={`Remove custom image for ${item.position}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Replace Image Preview Dialog ── */}
      {selectedFile && stagedPreviewUrl && targetSlot && (
        <div className="modal-backdrop" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" style={{ maxWidth: "540px" }}>
            <h2>Replace Image: {targetSlot.title}</h2>
            <p style={{ margin: "4px 0 12px 0", color: "var(--admin-muted, #78716c)", fontSize: "13px" }}>
              Preview the selected image before saving. This will update only this slot in {targetSlot.sectionName} on the live customer homepage.
            </p>

            <div className="hero-replace-dialog-grid">
              <div className="hero-replace-preview-box">
                <span>Current Image</span>
                <div className="hero-replace-preview-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={targetSlot.currentImageUrl}
                    alt="Current card"
                  />
                </div>
              </div>

              <div className="hero-replace-preview-box">
                <span>New Preview</span>
                <div className="hero-replace-preview-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stagedPreviewUrl}
                    alt="Selected replacement"
                  />
                </div>
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "var(--admin-muted, #78716c)", marginBottom: "16px" }}>
              File: <strong>{selectedFile.name}</strong> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <Button
                variant="secondary"
                onClick={handleCancelReplace}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmReplace}
                disabled={isUploading}
              >
                {isUploading ? `Uploading (${uploadProgress}%)` : "Save Image"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Confirmation Dialog ── */}
      {removeTarget && (
        <ConfirmDialog
          title={`Restore default image for ${removeTarget.title}?`}
          body={`Removing the custom image will immediately restore the original default image (${removeTarget.defaultLabel}) on the customer homepage.`}
          action="Restore Default"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={handleConfirmRemove}
          loading={isRemoving}
          loadingText="Restoring..."
        />
      )}
    </div>
  );
}
