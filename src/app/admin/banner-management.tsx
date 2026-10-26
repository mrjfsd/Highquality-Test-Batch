"use client";

import { useEffect, useState, useRef, type ChangeEvent, type PointerEvent } from "react";
import { authFetch, PageHeader, Button, Icon, type Page } from "./wireframe-ui";
import { compressImageForUpload, uploadToR2WithProgress } from "@/lib/images/client-compression";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const DEFAULT_BANNER_URL = "/assets/image.png";
const DEFAULT_ADS: [string, string, string] = [
  "BUY ANY 4 GET Rs.200 OFF",
  "BUY ANY 2 GET Rs.100 OFF",
  "10% OFF ON FIRST ORDER",
];

interface BannerManagementScreenProps {
  showToast: (message: string) => void;
  navigate?: (page: Page) => void;
}

export function BannerManagementScreen({ showToast }: BannerManagementScreenProps) {
  // ── Active Banner State ──
  const [activeBannerUrl, setActiveBannerUrl] = useState<string>(DEFAULT_BANNER_URL);
  const [activeBannerAlt, setActiveBannerAlt] = useState<string>(
    "Diwali Sale Promotional Banner — Click to explore sale pieces"
  );
  const [bannerEnabled, setBannerEnabled] = useState<boolean>(true);
  const [showSaleLink, setShowSaleLink] = useState<boolean>(true);
  const [posX, setPosX] = useState<number>(50);
  const [posY, setPosY] = useState<number>(46);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [isTogglingBanner, setIsTogglingBanner] = useState(false);
  const [isTogglingSaleLink, setIsTogglingSaleLink] = useState(false);

  const [showAdjust, setShowAdjust] = useState(false);

  // ── Drag-to-Position on Preview ──
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);

  // ── Upload & Staging State ──
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Running Ads State ──
  const [ad1, setAd1] = useState<string>("");
  const [ad2, setAd2] = useState<string>("");
  const [ad3, setAd3] = useState<string>("");
  const [isSavingAds, setIsSavingAds] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Fetch current settings on mount ──
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;

          if (data.promoBanner) {
            if (data.promoBanner.imageUrl) {
              setActiveBannerUrl(data.promoBanner.imageUrl);
            }
            if (data.promoBanner.altText) {
              setActiveBannerAlt(data.promoBanner.altText);
            }
            setBannerEnabled(data.promoBanner.enabled !== false);
            setPosX(typeof data.promoBanner.positionX === "number" ? data.promoBanner.positionX : 50);
            setPosY(typeof data.promoBanner.positionY === "number" ? data.promoBanner.positionY : 46);
            setZoom(typeof data.promoBanner.zoom === "number" ? data.promoBanner.zoom : 1.0);
          }

          if (data.navbar && typeof data.navbar.showSaleLink === "boolean") {
            setShowSaleLink(data.navbar.showSaleLink);
          }

          if (data.catalogueMarquee?.rawAds && Array.isArray(data.catalogueMarquee.rawAds)) {
            const raw = data.catalogueMarquee.rawAds;
            setAd1(typeof raw[0] === "string" ? raw[0] : "");
            setAd2(typeof raw[1] === "string" ? raw[1] : "");
            setAd3(typeof raw[2] === "string" ? raw[2] : "");
          } else {
            setAd1(DEFAULT_ADS[0]);
            setAd2(DEFAULT_ADS[1]);
            setAd3(DEFAULT_ADS[2]);
          }
        }
      } catch (err) {
        console.warn("Could not load initial settings:", err);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── Toggle Banner Visibility ──
  const handleToggleBanner = async (newVal: boolean) => {
    setBannerEnabled(newVal);
    setIsTogglingBanner(true);
    try {
      const res = await authFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoBanner: {
            enabled: newVal,
          },
        }),
      });

      if (res.ok) {
        showToast(newVal ? "Homepage banner enabled" : "Homepage banner hidden");
      } else {
        setBannerEnabled(!newVal);
        showToast("Failed to update banner visibility");
      }
    } catch {
      setBannerEnabled(!newVal);
      showToast("Network error updating banner visibility");
    } finally {
      setIsTogglingBanner(false);
    }
  };

  // ── Toggle Sale Link in Navbar ──
  const handleToggleSaleLink = async (newVal: boolean) => {
    setShowSaleLink(newVal);
    setIsTogglingSaleLink(true);
    try {
      const res = await authFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          navbar: {
            showSaleLink: newVal,
          },
        }),
      });

      if (res.ok) {
        showToast(
          newVal
            ? "Sale link is now visible in navbar"
            : "Sale link hidden from navbar"
        );
      } else {
        setShowSaleLink(!newVal);
        showToast("Failed to update navbar setting");
      }
    } catch {
      setShowSaleLink(!newVal);
      showToast("Network error updating navbar setting");
    } finally {
      setIsTogglingSaleLink(false);
    }
  };

  // ── Save Crop & Position Adjustments ──
  const handleSaveCrop = async () => {
    setIsSavingCrop(true);
    try {
      const res = await authFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoBanner: {
            positionX: posX,
            positionY: posY,
            zoom,
          },
        }),
      });

      if (res.ok) {
        showToast("Banner positioning saved");
      } else {
        showToast("Failed to save positioning adjustments");
      }
    } catch {
      showToast("Network error saving positioning");
    } finally {
      setIsSavingCrop(false);
    }
  };

  // ── Reset Crop & Position to Default ──
  const handleResetCrop = () => {
    setPosX(50);
    setPosY(46);
    setZoom(1.0);
    showToast("Positioning reset to default");
  };

  // ── Drag-to-Position Event Handlers ──
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!previewBoxRef.current) return;
    previewBoxRef.current.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: posX,
      startY: posY,
    };
    setIsDraggingPreview(true);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPreview || !dragStartRef.current || !previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStartRef.current.clientX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStartRef.current.clientY) / rect.height) * 100;

    // Invert delta because dragging the image right moves focal point left
    const newX = Math.max(0, Math.min(100, Math.round(dragStartRef.current.startX - deltaX)));
    const newY = Math.max(0, Math.min(100, Math.round(dragStartRef.current.startY - deltaY)));

    setPosX(newX);
    setPosY(newY);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPreview) return;
    setIsDraggingPreview(false);
    if (previewBoxRef.current) {
      previewBoxRef.current.releasePointerCapture(e.pointerId);
    }
    dragStartRef.current = null;
  };

  // ── File Selection & Staging ──
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        showToast("Unsupported file type. Please choose a JPEG, PNG, or WebP image.");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast("File is too large. Maximum supported size is 10 MB.");
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setStagedPreviewUrl(url);
    }
  };

  const handleCancelStaged = () => {
    if (stagedPreviewUrl && stagedPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    setSelectedFile(null);
    setStagedPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ── Save & Publish Replacement Banner ──
  const handleSaveBanner = async () => {
    if (!selectedFile) return;

    setIsUploadingBanner(true);
    setUploadProgress(10);

    try {
      const processed = await compressImageForUpload(selectedFile, {
        maxSizeMB: 2.5,
        maxWidthOrHeight: 2560,
        initialQuality: 0.9,
      });

      setUploadProgress(35);

      const presignRes = await authFetch("/api/admin/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: "banner",
          fileName: processed.file.name,
          contentType: processed.mimeType,
          fileSize: processed.finalSize,
        }),
      });

      if (!presignRes.ok) {
        throw new Error("Failed to get presigned upload URL");
      }

      const { presignedUrl, objectKey } = await presignRes.json();
      setUploadProgress(50);

      await uploadToR2WithProgress(
        presignedUrl,
        processed.file,
        processed.mimeType,
        (loaded, total) => {
          const percent = 50 + Math.round((loaded / total) * 35);
          setUploadProgress(percent);
        }
      );

      setUploadProgress(90);

      const newImageUrl = `/api/images/${objectKey}`;
      const saveRes = await authFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoBanner: {
            imageUrl: newImageUrl,
            storagePath: objectKey,
            positionX: posX,
            positionY: posY,
            zoom,
            enabled: bannerEnabled,
          },
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save banner settings");
      }

      const savedData = await saveRes.json();
      setActiveBannerUrl(savedData.promoBanner?.imageUrl || newImageUrl);

      handleCancelStaged();
      showToast("Homepage banner published successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      showToast(msg);
    } finally {
      setIsUploadingBanner(false);
      setUploadProgress(0);
    }
  };

  // ── Save Running Ads ──
  const handleSaveAds = async () => {
    setIsSavingAds(true);
    try {
      const adsToSave = [ad1.trim(), ad2.trim(), ad3.trim()];
      const res = await authFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogueMarquee: {
            ads: adsToSave,
          },
        }),
      });

      if (res.ok) {
        showToast("Running ads saved successfully!");
      } else {
        showToast("Failed to save running ads");
      }
    } catch {
      showToast("Network error saving ads");
    } finally {
      setIsSavingAds(false);
    }
  };

  const displayBannerUrl = stagedPreviewUrl || activeBannerUrl;

  return (
    <div className="page banner-management-page">
      <PageHeader
        title="Banner"
        description="Configure the homepage promotional banner and running ads."
      />

      {/* ────────────────────────────────────────────────────────
          CARD 1: HOMEPAGE BANNER
          ──────────────────────────────────────────────────────── */}
      <section className="panel" aria-labelledby="heading-homepage-banner">
        <div className="banner-card-header">
          <h2 id="heading-homepage-banner">Homepage Banner</h2>
        </div>

        {/* Independent Controls: Show Promotional Banner & Show Sale Link in Navbar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            padding: "12px 18px",
            borderBottom: "1px solid var(--admin-stone, #e8e4de)",
            backgroundColor: "var(--admin-bg, #fcfbf9)",
          }}
        >
          {/* Control 1: Show Promotional Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "1 1 280px",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--admin-charcoal, #1f1d1a)" }}>
              Show Promotional Banner
            </span>
            <div className="banner-toggle-group">
              <span
                className={`banner-status-badge ${
                  bannerEnabled ? "banner-status-active" : "banner-status-hidden"
                }`}
              >
                <span className={bannerEnabled ? "banner-dot-green" : "banner-dot-gray"} />
                {bannerEnabled ? "Active" : "Hidden"}
              </span>

              <label className="banner-switch" title="Toggle promotional banner on homepage">
                <input
                  type="checkbox"
                  checked={bannerEnabled}
                  disabled={isTogglingBanner}
                  onChange={(e) => handleToggleBanner(e.target.checked)}
                  aria-label="Show Promotional Banner"
                />
                <span className="banner-switch-slider" />
              </label>
            </div>
          </div>

          <div
            style={{
              width: "1px",
              backgroundColor: "var(--admin-stone, #e8e4de)",
              alignSelf: "stretch",
            }}
          />

          {/* Control 2: Show Sale Link in Navbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "1 1 280px",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--admin-charcoal, #1f1d1a)" }}>
              Show Sale Link in Navbar
            </span>
            <div className="banner-toggle-group">
              <span
                className={`banner-status-badge ${
                  showSaleLink ? "banner-status-active" : "banner-status-hidden"
                }`}
              >
                <span className={showSaleLink ? "banner-dot-green" : "banner-dot-gray"} />
                {showSaleLink ? "Visible" : "Hidden"}
              </span>

              <label className="banner-switch" title="Toggle Sale link in navbar">
                <input
                  type="checkbox"
                  checked={showSaleLink}
                  disabled={isTogglingSaleLink}
                  onChange={(e) => handleToggleSaleLink(e.target.checked)}
                  aria-label="Show Sale Link in Navbar"
                />
                <span className="banner-switch-slider" />
              </label>
            </div>
          </div>
        </div>

        <div className="banner-panel-body">
          {/* Compact Banner Preview Frame */}
          <div
            ref={previewBoxRef}
            className={`banner-preview-box is-draggable ${
              isDraggingPreview ? "is-dragging" : ""
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            title="Click and drag to reposition banner"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayBannerUrl}
              alt={activeBannerAlt}
              className="banner-preview-img"
              style={{
                objectPosition: `${posX}% ${posY}%`,
                transform: zoom > 1 ? `scale(${zoom})` : undefined,
                transformOrigin: `${posX}% ${posY}%`,
              }}
            />

            {!bannerEnabled && (
              <div className="banner-disabled-overlay">
                <Icon name="close" size={14} />
                <span>Banner is hidden on storefront</span>
              </div>
            )}
          </div>

          {/* Actions: Replace Image & Adjust Image */}
          {selectedFile ? (
            <div className="banner-staged-box">
              <div className="banner-staged-info">
                <Icon name="image" size={16} />
                <span className="banner-staged-name">{selectedFile.name}</span>
                <span className="banner-staged-size">
                  ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>

              <div className="banner-staged-actions">
                <Button
                  variant="secondary"
                  onClick={handleCancelStaged}
                  disabled={isUploadingBanner}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveBanner}
                  disabled={isUploadingBanner}
                >
                  {isUploadingBanner ? `Uploading (${uploadProgress}%)` : "Save Banner"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="banner-actions-bar">
              <div className="banner-actions-left">
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingBanner}
                >
                  <Icon name="upload" size={14} />
                  <span>Replace Image</span>
                </Button>

                <Button
                  variant={showAdjust ? "primary" : "secondary"}
                  onClick={() => setShowAdjust((prev) => !prev)}
                >
                  <Icon name="edit" size={14} />
                  <span>{showAdjust ? "Hide Controls" : "Adjust Image"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Compact Crop Controls Row: Position, Zoom, Reset, and Save */}
          {showAdjust && (
            <div className="banner-adjust-row">
              <div className="banner-adjust-item">
                <div className="banner-adjust-label">
                  <span>Position X</span>
                  <span className="banner-adjust-val">{posX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={posX}
                  onChange={(e) => setPosX(Number(e.target.value))}
                  className="crop-range-input"
                  aria-label="Horizontal Position"
                />
              </div>

              <div className="banner-adjust-item">
                <div className="banner-adjust-label">
                  <span>Position Y</span>
                  <span className="banner-adjust-val">{posY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={posY}
                  onChange={(e) => setPosY(Number(e.target.value))}
                  className="crop-range-input"
                  aria-label="Vertical Position"
                />
              </div>

              <div className="banner-adjust-item">
                <div className="banner-adjust-label">
                  <span>Zoom</span>
                  <span className="banner-adjust-val">{zoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="crop-range-input"
                  aria-label="Zoom Level"
                />
              </div>

              <div className="banner-adjust-actions">
                <Button
                  variant="secondary"
                  onClick={handleResetCrop}
                  title="Reset positioning to default"
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveCrop}
                  disabled={isSavingCrop}
                >
                  {isSavingCrop ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
            id="banner-file-input"
          />
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          CARD 2: RUNNING ADS
          ──────────────────────────────────────────────────────── */}
      <section className="panel" aria-labelledby="heading-running-ads" style={{ marginTop: "16px" }}>
        <div className="banner-card-header">
          <h2 id="heading-running-ads">Running Ads</h2>
        </div>

        <div className="banner-panel-body">
          {/* Three Compact Fields: One Row on Desktop, Stacked on Mobile */}
          <div className="ads-inputs-row">
            <div className="ad-input-group">
              <label htmlFor="input-ad-1">Ad 1</label>
              <input
                id="input-ad-1"
                type="text"
                value={ad1}
                onChange={(e) => setAd1(e.target.value)}
                placeholder="e.g. BUY ANY 4 GET Rs.200 OFF"
                className="ad-input-field"
              />
            </div>

            <div className="ad-input-group">
              <label htmlFor="input-ad-2">Ad 2</label>
              <input
                id="input-ad-2"
                type="text"
                value={ad2}
                onChange={(e) => setAd2(e.target.value)}
                placeholder="e.g. BUY ANY 2 GET Rs.100 OFF"
                className="ad-input-field"
              />
            </div>

            <div className="ad-input-group">
              <label htmlFor="input-ad-3">Ad 3</label>
              <input
                id="input-ad-3"
                type="text"
                value={ad3}
                onChange={(e) => setAd3(e.target.value)}
                placeholder="e.g. 10% OFF ON FIRST ORDER"
                className="ad-input-field"
              />
            </div>
          </div>

          {/* Single Save Ads Action */}
          <div className="ads-actions-bar">
            <Button
              variant="primary"
              onClick={handleSaveAds}
              disabled={isSavingAds}
            >
              {isSavingAds ? "Saving..." : "Save Ads"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
