"use client";

import { useState, useRef, useEffect, useCallback, type DragEvent, type ChangeEvent } from "react";
import {
  authFetch,
  PageHeader,
  Button,
  Icon,
  Field,
  DEPARTMENT_CATEGORIES,
  type Page,
} from "./wireframe-ui";
import { compressImageForUpload, uploadToR2WithProgress } from "@/lib/images/client-compression";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export interface BulkItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "processing" | "success" | "error";
  progressPercent: number;
  stageLabel: string;
  error?: string;
  savedProduct?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    department: string;
  };
}

interface BulkUploadScreenProps {
  showToast: (message: string) => void;
  navigate?: (page: Page, pId?: string) => void;
  onProductsCreated?: () => void;
}

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free Size", "One Size"];

export function BulkUploadScreen({
  showToast,
  navigate,
  onProductsCreated,
}: BulkUploadScreenProps) {
  // ── Shared Information Form State ──
  const [department, setDepartment] = useState<"Men" | "Women" | "Kids">("Men");
  const [category, setCategory] = useState<string>("Shirts");
  const [productName, setProductName] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [size, setSize] = useState<string>("Free Size");
  const [isCustomSize, setIsCustomSize] = useState<boolean>(false);
  const [customSizeValue, setCustomSizeValue] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("5");

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ── Image Batch State ──
  const [items, setItems] = useState<BulkItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [overallPercent, setOverallPercent] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Theme State (Scoped to Bulk Upload) ──
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("style_edit_bulk_theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("style_edit_bulk_theme", next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Sync category options when department changes
  const handleDepartmentChange = (newDept: "Men" | "Women" | "Kids") => {
    setDepartment(newDept);
    const validCats = DEPARTMENT_CATEGORIES[newDept] || [];
    if (!validCats.includes(category)) {
      setCategory(validCats[0] || "");
    }
  };

  // Revoke preview object URLs when items change or unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl) {
          try {
            URL.revokeObjectURL(item.previewUrl);
          } catch {
            // ignore
          }
        }
      });
    };
  }, [items]);

  // Handle file additions
  const addFiles = useCallback((files: FileList | File[]) => {
    const validMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    const newItems: BulkItem[] = [];

    Array.from(files).forEach((file) => {
      if (!validMimes.has(file.type)) {
        showToast(`Skipped "${file.name}": Unsupported format. Use JPEG, PNG, WebP, or AVIF.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(`Skipped "${file.name}": File size exceeds 10MB limit.`);
        return;
      }

      newItems.push({
        id: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending",
        progressPercent: 0,
        stageLabel: "Ready",
      });
    });

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setIsCompleted(false);
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next.images;
        return next;
      });
    }
  }, [showToast]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset input value so re-selecting same files triggers change event
      e.target.value = "";
    }
  };

  const removeItem = (id: string) => {
    if (isProcessing) return;
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAllItems = () => {
    if (isProcessing) return;
    items.forEach((item) => {
      if (item.previewUrl) {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch {
          // ignore
        }
      }
    });
    setItems([]);
    setIsCompleted(false);
    setOverallPercent(0);
  };

  const updateItem = (id: string, updates: Partial<BulkItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // ── Validation ──
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!productName.trim()) {
      errs.productName = "Product name is required.";
    }
    if (!category.trim()) {
      errs.category = "Category is required.";
    }
    const numPrice = Number(price);
    if (!price.trim() || isNaN(numPrice) || numPrice < 0 || !isFinite(numPrice)) {
      errs.price = "Enter a valid positive regular price (₹).";
    }
    if (!size.trim()) {
      errs.size = "Size is required (e.g. 'M', 'L', 'Free Size').";
    }
    const numQty = parseInt(quantity, 10);
    if (!quantity.trim() || isNaN(numQty) || numQty < 1) {
      errs.quantity = "Quantity must be at least 1 unit per product.";
    }
    if (items.length === 0) {
      errs.images = "Please select at least one garment photo to upload.";
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Execute Batch Upload ──
  const processBatch = async (onlyFailed: boolean = false) => {
    if (!validateForm()) {
      showToast("Please complete all required shared fields before creating products.");
      return;
    }

    setIsProcessing(true);
    setIsCompleted(false);

    const targetItems = items.filter((item) =>
      onlyFailed ? item.status === "error" : item.status !== "success"
    );

    if (targetItems.length === 0) {
      setIsProcessing(false);
      showToast("No pending items to process.");
      return;
    }

    let successCount = items.filter((i) => i.status === "success").length;
    let failCount = 0;
    const totalTarget = targetItems.length;

    for (let idx = 0; idx < totalTarget; idx++) {
      const item = targetItems[idx];

      updateItem(item.id, {
        status: "processing",
        progressPercent: 10,
        stageLabel: "Compressing image...",
        error: undefined,
      });

      setOverallPercent(Math.round(((idx) / totalTarget) * 100));

      try {
        // 1. Browser-side compression before presigning
        const processed = await compressImageForUpload(item.file);

        updateItem(item.id, {
          progressPercent: 30,
          stageLabel: "Requesting upload URL...",
        });

        // 2. Request presigned upload URL from Cloudflare R2 proxy
        const presignRes = await authFetch("/api/admin/images/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: "temp-batch",
            fileName: processed.file.name,
            contentType: processed.mimeType,
            fileSize: processed.finalSize,
          }),
        });

        if (!presignRes.ok) {
          const presignErr = await presignRes.json().catch(() => ({}));
          throw new Error(presignErr.error || "Failed to generate presigned upload URL.");
        }

        const { presignedUrl, objectKey } = await presignRes.json();

        updateItem(item.id, {
          progressPercent: 50,
          stageLabel: "Uploading to Cloudflare R2...",
        });

        // 3. Direct binary upload to R2
        await uploadToR2WithProgress(
          presignedUrl,
          processed.file,
          processed.mimeType,
          (loaded, total) => {
            const pct = 50 + Math.round((loaded / total) * 30);
            updateItem(item.id, { progressPercent: pct });
          }
        );

        updateItem(item.id, {
          progressPercent: 85,
          stageLabel: "Creating product record...",
        });

        // 4. Create individual product record in database
        const createRes = await authFetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: productName.trim(),
            department: department.toLowerCase(),
            category: category.trim(),
            price: Number(price),
            status: "published",
            is_featured: false,
            variants: [
              {
                size: size.trim(),
                color: "Standard",
                stock_quantity: Math.max(1, parseInt(quantity, 10)),
                is_available: true,
              },
            ],
            images: [
              {
                storage_path: objectKey,
                alt_text: productName.trim(),
                is_primary: true,
                display_order: 0,
                mime_type: processed.mimeType,
                file_size_bytes: processed.finalSize,
                width: processed.width,
                height: processed.height,
              },
            ],
          }),
        });

        if (!createRes.ok) {
          const createErr = await createRes.json().catch(() => ({}));
          throw new Error(createErr.error || "Failed to create product in database.");
        }

        const createData = await createRes.json();
        const createdProd = createData.product;

        updateItem(item.id, {
          status: "success",
          progressPercent: 100,
          stageLabel: "Published",
          savedProduct: {
            id: createdProd.id,
            name: createdProd.name,
            slug: createdProd.slug,
            price: Number(createdProd.price),
            department: createdProd.department,
          },
        });

        successCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload or product creation failed.";
        updateItem(item.id, {
          status: "error",
          progressPercent: 0,
          stageLabel: "Failed",
          error: msg,
        });
        failCount++;
      }

      setOverallPercent(Math.round(((idx + 1) / totalTarget) * 100));
    }

    setIsProcessing(false);
    setIsCompleted(true);

    if (successCount > 0) {
      onProductsCreated?.();
    }

    if (failCount === 0) {
      showToast(`Batch completed successfully! ${successCount} products published.`);
    } else {
      showToast(`Batch finished with issues: ${successCount} published, ${failCount} failed.`);
    }
  };

  const handleStartNewBatch = () => {
    if (isProcessing) return;
    clearAllItems();
    setProductName("");
    setPrice("");
    setSize("Free Size");
    setIsCustomSize(false);
    setCustomSizeValue("");
    setValidationErrors({});
    setIsCompleted(false);
  };

  // Metrics
  const totalItems = items.length;
  const successItems = items.filter((i) => i.status === "success");
  const failedItems = items.filter((i) => i.status === "error");
  const pendingItems = items.filter((i) => i.status === "pending" || i.status === "processing");

  const categories = DEPARTMENT_CATEGORIES[department] || [];

  return (
    <div className={`page bulk-upload-page ${theme === "dark" ? "theme-dark" : ""}`}>
      <PageHeader
        title="Bulk Upload"
        actions={
          <div className="bulk-header-actions">
            {isCompleted && (
              <Button variant="secondary" onClick={handleStartNewBatch} disabled={isProcessing}>
                Start New Batch
              </Button>
            )}
            {failedItems.length > 0 && !isProcessing && (
              <Button
                variant="primary"
                onClick={() => processBatch(true)}
                icon="refresh"
              >
                Retry Failed ({failedItems.length})
              </Button>
            )}
            <button
              type="button"
              className="bulk-theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
              <span className="sr-only">
                {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </span>
            </button>
          </div>
        }
      />

      {/* ── Section 1: Shared Product Information Form ── */}
      <section className="panel bulk-panel">
        <div className="bulk-panel-body">
          <div className="bulk-shared-grid">
            {/* Department */}
            <div className="bulk-field-col bulk-field-department">
              <Field label="Department" required>
                <DropdownMenu>
                  <DropdownMenuTrigger disabled={isProcessing} aria-label="Select department">
                    <span className="bulk-trigger-value">{department}</span>
                    <svg className="bulk-trigger-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuRadioGroup
                        value={department}
                        onValueChange={(val) => handleDepartmentChange(val as "Men" | "Women" | "Kids")}
                      >
                        <DropdownMenuRadioItem value="Men">Men</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Women">Women</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Kids">Kids</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Field>
            </div>

            {/* Category */}
            <div className={`bulk-field-col bulk-field-category ${validationErrors.category ? "has-error" : ""}`}>
              <Field
                label="Category"
                required
                hint={validationErrors.category}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger disabled={isProcessing} aria-label="Select category">
                    <span className="bulk-trigger-value">{category || "Select category"}</span>
                    <svg className="bulk-trigger-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuRadioGroup
                        value={category}
                        onValueChange={(val) => {
                          setCategory(val);
                          setValidationErrors((prev) => {
                            const next = { ...prev };
                            delete next.category;
                            return next;
                          });
                        }}
                      >
                        {categories.map((cat) => (
                          <DropdownMenuRadioItem key={cat} value={cat}>
                            {cat}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Field>
            </div>

            {/* Shared Product Name */}
            <div className={`bulk-field-col bulk-field-name ${validationErrors.productName ? "has-error" : ""}`}>
              <Field
                label="Product Name"
                required
                hint={validationErrors.productName || "Unique URLs and slugs are generated automatically."}
              >
                <input
                  type="text"
                  placeholder="e.g. Casual Shirt, Striped Polo, Linen Pant"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.productName;
                      return next;
                    });
                  }}
                  disabled={isProcessing}
                  maxLength={200}
                />
              </Field>
            </div>

            {/* Regular Price */}
            <div className={`bulk-field-col bulk-field-price ${validationErrors.price ? "has-error" : ""}`}>
              <Field
                label="Regular Price (₹)"
                required
                hint={validationErrors.price || "Applied to every product in the batch."}
              >
                <input
                  type="number"
                  placeholder="e.g. 800"
                  value={price}
                  min="0"
                  step="1"
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.price;
                      return next;
                    });
                  }}
                  disabled={isProcessing}
                />
              </Field>
            </div>

            {/* Size */}
            <div className={`bulk-field-col bulk-field-size ${validationErrors.size ? "has-error" : ""}`}>
              <Field
                label="Size"
                required
                hint={validationErrors.size}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger disabled={isProcessing} aria-label="Select size">
                    <span className="bulk-trigger-value">
                      {isCustomSize ? (customSizeValue ? `Custom (${customSizeValue})` : "Custom size…") : size}
                    </span>
                    <svg className="bulk-trigger-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuRadioGroup
                        value={isCustomSize ? "__custom__" : size}
                        onValueChange={(val) => {
                          if (val === "__custom__") {
                            setIsCustomSize(true);
                            setSize(customSizeValue);
                          } else {
                            setIsCustomSize(false);
                            setSize(val);
                            setValidationErrors((prev) => {
                              const next = { ...prev };
                              delete next.size;
                              return next;
                            });
                          }
                        }}
                      >
                        {COMMON_SIZES.map((s) => (
                          <DropdownMenuRadioItem key={s} value={s}>
                            {s}
                          </DropdownMenuRadioItem>
                        ))}
                        <DropdownMenuRadioItem value="__custom__">
                          Custom size…
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {isCustomSize && (
                  <input
                    type="text"
                    placeholder="Enter custom size (e.g. 32, 34, UK 8)"
                    value={customSizeValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomSizeValue(val);
                      setSize(val);
                      if (val.trim()) {
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.size;
                          return next;
                        });
                      }
                    }}
                    disabled={isProcessing}
                    style={{ marginTop: "8px" }}
                    autoFocus
                  />
                )}
              </Field>
            </div>

            {/* Quantity per Product */}
            <div className={`bulk-field-col bulk-field-quantity ${validationErrors.quantity ? "has-error" : ""}`}>
              <Field
                label="Quantity Per Product"
                required
                hint={validationErrors.quantity || "Each created product receives this stock quantity."}
              >
                <input
                  type="number"
                  placeholder="e.g. 5"
                  value={quantity}
                  min="1"
                  step="1"
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.quantity;
                      return next;
                    });
                  }}
                  disabled={isProcessing}
                />
              </Field>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Multiple Photo Upload Zone ── */}
      <section className="panel bulk-panel">
        <div className="section-header bulk-upload-header">
          <div className="bulk-upload-header-left">
            <span className="section-title">Upload Garment Photos</span>
            {items.length > 0 && (
              <span className="bulk-count-badge">
                {items.length} {items.length === 1 ? "photo" : "photos"}
              </span>
            )}
          </div>
          {items.length > 0 && !isProcessing && (
            <button
              type="button"
              onClick={clearAllItems}
              className="bulk-clear-btn"
            >
              Clear all photos
            </button>
          )}
        </div>

        <div className="bulk-panel-body">
          {/* Drag and Drop Zone */}
          <div
            className={`bulk-upload-zone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Click or drag and drop garment photos to upload"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              style={{ display: "none" }}
              disabled={isProcessing}
            />
            <div className="upload-icon">
              <Icon name="upload" size={20} />
            </div>
            <div className="bulk-upload-zone-text">
              <strong>Drag and drop garment photos here, or click to browse</strong>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={isProcessing}
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              Browse Files
            </Button>
          </div>

          {validationErrors.images && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fee2e2",
                border: "1px solid #f87171",
                borderRadius: "6px",
                color: "#991b1b",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              {validationErrors.images}
            </div>
          )}

          {/* Batch Progress Bar during processing */}
          {isProcessing && (
            <div className="bulk-progress-box">
              <div className="bulk-progress-header">
                <span className="bulk-progress-title">Processing batch: {overallPercent}%</span>
                <span className="bulk-progress-count">{successItems.length + failedItems.length} of {totalItems} items completed</span>
              </div>
              <div className="bulk-progress-track">
                <div
                  className="bulk-progress-bar"
                  style={{
                    width: `${overallPercent}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Results Summary Banner */}
          {isCompleted && (
            <div className={`bulk-results-banner ${failedItems.length === 0 ? "success" : "warning"}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>
                    {failedItems.length === 0
                      ? `✓ All ${successItems.length} products created successfully!`
                      : `Batch finished: ${successItems.length} succeeded, ${failedItems.length} failed.`}
                  </strong>
                  <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                    {failedItems.length === 0
                      ? "Each item is published to the storefront catalogue with its own unique URL, inventory, and primary photo."
                      : "You can review failed items below and click 'Retry Failed' to re-attempt creation without duplicating successful items."}
                  </p>
                </div>
                {failedItems.length > 0 && !isProcessing && (
                  <Button
                    variant="primary"
                    onClick={() => processBatch(true)}
                    icon="refresh"
                  >
                    Retry Failed ({failedItems.length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Selected Images Preview Grid */}
          {items.length > 0 && (
            <div className="bulk-photo-grid">
              {items.map((item, idx) => {
                const isItemPending = item.status === "pending";
                const isItemProcessing = item.status === "processing";
                const isItemSuccess = item.status === "success";
                const isItemError = item.status === "error";

                return (
                  <div
                    key={item.id}
                    className="bulk-photo-card"
                    style={{
                      borderColor: isItemSuccess
                        ? "#10b981"
                        : isItemError
                        ? "#ef4444"
                        : isItemProcessing
                        ? "var(--admin-burgundy)"
                        : undefined,
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="bulk-photo-thumb-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="bulk-photo-thumb"
                      />

                      {/* Sequential Index Badge */}
                      <span className="bulk-photo-badge-idx">
                        #{idx + 1}
                      </span>

                      {/* Remove button (when idle) */}
                      {!isProcessing && !isItemSuccess && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="bulk-photo-remove-btn"
                          title="Remove image"
                          aria-label="Remove image"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      )}
                    </div>

                    {/* Card Content & Status */}
                    <div className="bulk-photo-meta">
                      <div className="bulk-photo-name">
                        {item.file.name}
                      </div>

                      <div className="bulk-photo-size">
                        {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                      </div>

                      {/* Status Indicator */}
                      <div className="bulk-photo-status">
                        {isItemPending && (
                          <span className="bulk-badge-pending">
                            Pending
                          </span>
                        )}

                        {isItemProcessing && (
                          <div className="bulk-photo-progress-wrap">
                            <div className="bulk-photo-stage">
                              {item.stageLabel}
                            </div>
                            <div className="bulk-photo-track">
                              <div
                                className="bulk-photo-bar"
                                style={{
                                  width: `${item.progressPercent}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {isItemSuccess && item.savedProduct && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span className="bulk-badge-success">
                              <Icon name="check" size={12} /> Published
                            </span>
                            <div style={{ display: "flex", gap: "8px", fontSize: "10px", marginTop: "2px" }}>
                              <a
                                href={`/product/${item.savedProduct.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bulk-photo-link"
                                style={{ color: "var(--admin-burgundy)", textDecoration: "underline", fontWeight: 600 }}
                              >
                                View Page ↗
                              </a>
                              {navigate && (
                                <button
                                  type="button"
                                  onClick={() => navigate("editor", item.savedProduct?.id)}
                                  className="bulk-photo-edit-btn"
                                  style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    color: "var(--admin-charcoal)",
                                    textDecoration: "underline",
                                    fontSize: "10px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Edit Garment
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {isItemError && (
                          <div>
                            <span className="bulk-badge-error">
                              Failed
                            </span>
                            {item.error && (
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#b91c1c",
                                  lineHeight: "1.3",
                                }}
                              >
                                {item.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Floating Action Bar when images are loaded ── */}
      {items.length > 0 && (
        <div className="bulk-bottom-bar">
          <div className="bulk-bottom-bar-summary">
            <span className="bulk-summary-count">
              Batch: {items.length} garments ({department} &gt; {category})
            </span>
            <span className="bulk-summary-details">
              Price: ₹{price || "0"} • Size: {size || "—"} • Qty: {quantity || "0"}/each
            </span>
          </div>

          <div className="bulk-bottom-bar-actions">
            {failedItems.length > 0 && !isProcessing && (
              <Button
                variant="secondary"
                onClick={() => processBatch(true)}
                icon="refresh"
              >
                Retry Failed ({failedItems.length})
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => processBatch(false)}
              disabled={isProcessing || pendingItems.length === 0}
              icon="upload"
            >
              {isProcessing
                ? "Creating Products..."
                : `Create & Publish ${pendingItems.length} Products`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

