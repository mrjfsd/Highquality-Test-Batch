"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { authFetch, PageHeader, Button, Icon, ConfirmDialog, type Page } from "./wireframe-ui";
import { compressImageForUpload, uploadToR2WithProgress } from "@/lib/images/client-compression";
import { type HeroCardConfigItem, DEFAULT_HERO_CARDS } from "@/types/hero-cards";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface HeroCardsManagementScreenProps {
  showToast: (message: string) => void;
  navigate?: (page: Page) => void;
}

export function HeroCardsManagementScreen({ showToast }: HeroCardsManagementScreenProps) {
  // ── Hero Cards State (Always 7 slots) ──
  const [cards, setCards] = useState<HeroCardConfigItem[]>(DEFAULT_HERO_CARDS);
  const [loading, setLoading] = useState(true);

  // ── Active Card Slot Target for Replace ──
  const [targetSlotIndex, setTargetSlotIndex] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Active Card Slot Target for Remove ──
  const [cardToRemove, setCardToRemove] = useState<HeroCardConfigItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Load Hero Cards from API ──
  const loadHeroCards = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/hero-cards");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.heroCards) && data.heroCards.length > 0) {
          setCards(data.heroCards);
        }
      }
    } catch (err) {
      console.warn("Error loading hero cards:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeroCards();
  }, []);

  // ── Initiate Replace for a Slot ──
  const handleStartReplace = (slotIndex: number) => {
    setTargetSlotIndex(slotIndex);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // ── File Selection ──
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || targetSlotIndex === null) return;
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
    setTargetSlotIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ── Save Replacement to R2 and Server ──
  const handleConfirmReplace = async () => {
    if (!selectedFile || targetSlotIndex === null) return;

    setIsUploading(true);
    setUploadProgress(15);

    try {
      // 1. Client-side compression
      const processed = await compressImageForUpload(selectedFile, {
        maxSizeMB: 0.75,
        maxWidthOrHeight: 1600,
        initialQuality: 0.88,
      });

      setUploadProgress(40);

      // 2. Presigned R2 upload URL
      const presignRes = await authFetch("/api/admin/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: "hero",
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

      // 3. Upload binary to R2
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

      // 4. Update the specific card slot in backend settings
      const newImageUrl = `/api/images/${objectKey}`;
      const saveRes = await authFetch("/api/admin/hero-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotIndex: targetSlotIndex,
          image: newImageUrl,
          storagePath: objectKey,
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save card replacement.");
      }

      const savedData = await saveRes.json();
      if (Array.isArray(savedData.heroCards)) {
        setCards(savedData.heroCards);
      }

      showToast(`Card #${targetSlotIndex + 1} updated successfully!`);
      handleCancelReplace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to replace image.";
      showToast(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Remove Custom Override (Restores Default) ──
  const handleConfirmRemove = async () => {
    if (!cardToRemove) return;
    setIsRemoving(true);

    try {
      const res = await authFetch("/api/admin/hero-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotIndex: cardToRemove.slotIndex,
          action: "restore-default",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.heroCards)) {
          setCards(data.heroCards);
        }
        showToast(`Card #${cardToRemove.slotIndex + 1} restored to default image.`);
      } else {
        showToast("Failed to restore default image.");
      }
    } catch {
      showToast("Network error restoring default image.");
    } finally {
      setIsRemoving(false);
      setCardToRemove(null);
    }
  };

  return (
    <div className="hero-cards-section" role="region" aria-label="Hero Cards Management">
      <PageHeader title="Homepage Hero Cards" />

      {/* Hidden file input for device picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Exactly 7 Fixed Cards Grid ── */}
      <div className="hero-cards-grid">
        {cards.map((card, idx) => {
          const isCenter = idx === 0;

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
                  src={card.image || card.defaultImage}
                  alt={card.alt || card.title}
                  className="hero-card-img"
                  loading="lazy"
                />
              </div>

              <div className="hero-card-tile-body">
                <span className="hero-card-title" title={card.title}>
                  {card.title}
                </span>
                <span className="hero-card-cat" title={card.category}>
                  {card.category}
                </span>
              </div>

              <div className="hero-card-tile-footer">
                <Button
                  variant="secondary"
                  onClick={() => handleStartReplace(idx)}
                  disabled={loading}
                  aria-label={`Replace image for Card #${idx + 1}`}
                >
                  Replace
                </Button>
                <Button
                  variant="danger"
                  disabled={!card.isCustom || loading}
                  onClick={() => setCardToRemove(card)}
                  title={card.isCustom ? "Restore default image" : "Already displaying default image"}
                  aria-label={`Remove custom image for Card #${idx + 1}`}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Replace Image Preview Dialog ── */}
      {selectedFile && stagedPreviewUrl && targetSlotIndex !== null && (
        <div className="modal-backdrop" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" style={{ maxWidth: "520px" }}>
            <h2>Replace Card #{targetSlotIndex + 1}</h2>
            <p style={{ margin: "4px 0 12px 0", color: "var(--admin-muted, #78716c)", fontSize: "13px" }}>
              Preview the selected image before saving. This will update only Card #{targetSlotIndex + 1} on the homepage carousel.
            </p>

            <div className="hero-replace-dialog-grid">
              <div className="hero-replace-preview-box">
                <span>Current Image</span>
                <div className="hero-replace-preview-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cards[targetSlotIndex]?.image || cards[targetSlotIndex]?.defaultImage}
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
      {cardToRemove && (
        <ConfirmDialog
          title={`Restore default image for Card #${cardToRemove.slotIndex + 1}?`}
          body={`Removing the custom image will immediately restore this card's default garment (${cardToRemove.defaultTitle}).`}
          action="Restore Default"
          onCancel={() => setCardToRemove(null)}
          onConfirm={handleConfirmRemove}
          loading={isRemoving}
          loadingText="Restoring..."
        />
      )}
    </div>
  );
}
