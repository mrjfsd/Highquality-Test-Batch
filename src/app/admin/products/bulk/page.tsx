"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { verifyAdminAuthorization, type AdminVerificationResult } from "@/lib/supabase/auth";
import {
  executeBatchUpload,
  type BatchUploadItem,
} from "@/lib/images/batch-uploader";
import { AdminProductNav } from "@/components/AdminProductNav";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// File and Category Constants
const MAX_INPUT_FILE_SIZE = 35 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const STANDARD_CATEGORIES = [
  "Jackets",
  "Coats",
  "Shirts",
  "T-Shirts",
  "Pants",
  "Knitwear",
  "Dresses",
  "Tops",
  "Accessories",
  "Shoes",
];

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const WAIST_SIZES = ["28", "30", "32", "34", "36", "38", "40"];
const OTHER_SIZES = ["One Size"];

// --- ColorMultiSelect and helpers imported from shared component ---
import {
  normalizeColorName,
  ColorMultiSelect,
} from "@/components/ColorMultiSelect";

// --- Types ---

export interface SharedProductDetails {
  name: string;
  department: "Men" | "Women" | "Kids";
  category: string;
  customCategory: string;
  price: string;
  salePrice: string;
  fabric: string;
  fit: string;
  description: string;
  status: "draft" | "published" | "archived";
  isFeatured: boolean;
}

export interface SharedSizeConfig {
  id: string;
  size: string;
  colors: string[]; // Multi-select colors per size
  sku: string;
  stock_quantity: number;
  is_available: boolean;
  isCustomSize?: boolean;
}

export interface BulkProductImageItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
  customAltText: string;

  // Execution state per product
  status: "pending" | "uploading" | "saving" | "success" | "error";
  error?: string;
  createdProduct?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    department: string;
  };
}

export default function BulkProductsPage() {
  // --- Auth State ---
  const [authStatus, setAuthStatus] = useState<AdminVerificationResult>({
    isAuthenticated: false,
    isAdmin: false,
    user: null,
  });
  const [checkingAuth, setCheckingAuth] = useState(true);

  // --- Section A: Shared Product Information (Entered Once) ---
  const [sharedDetails, setSharedDetails] = useState<SharedProductDetails>({
    name: "",
    department: "Women",
    category: "Pants",
    customCategory: "",
    price: "",
    salePrice: "",
    fabric: "",
    fit: "",
    description: "",
    status: "published",
    isFeatured: false,
  });

  // --- Section B: Shared Variants & Inventory Template (Multi-Color per Size) ---
  const [sharedVariants, setSharedVariants] = useState<SharedSizeConfig[]>([
    {
      id: "v-initial-1",
      size: "M",
      colors: ["Black", "Blue"],
      sku: "",
      stock_quantity: 10,
      is_available: true,
      isCustomSize: false,
    },
    {
      id: "v-initial-2",
      size: "L",
      colors: ["Black", "Blue"],
      sku: "",
      stock_quantity: 8,
      is_available: true,
      isCustomSize: false,
    },
  ]);

  // --- Section C: Upload Multiple Product Images (Each Image = One Product) ---
  const [imageItems, setImageItems] = useState<BulkProductImageItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // --- Batch Execution State ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    currentIndex: number;
    totalCount: number;
    currentStage: string;
    currentPercent: number;
  } | null>(null);
  const [batchSummaryMessage, setBatchSummaryMessage] = useState<string | null>(null);

  // Ref for aborting operations if unmounted
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Verify admin authentication on mount
  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      try {
        const result = await verifyAdminAuthorization();
        if (mounted) {
          setAuthStatus(result);
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (mounted) {
          setAuthStatus({
            isAuthenticated: false,
            isAdmin: false,
            user: null,
            reason: "Unable to verify administrative authorization.",
          });
          setCheckingAuth(false);
        }
      }
    }
    checkAuth();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Cleanup object URLs on unmount or removal
  useEffect(() => {
    return () => {
      imageItems.forEach((item) => {
        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [imageItems]);

  // --- Handlers: Section A (Shared Details) ---
  const updateSharedDetails = <K extends keyof SharedProductDetails>(
    field: K,
    value: SharedProductDetails[K]
  ) => {
    setSharedDetails((prev) => ({ ...prev, [field]: value }));
  };

  // --- Handlers: Section B (Shared Variants & Multi-Select Colors) ---
  const handleAddSharedVariant = () => {
    const lastConfig = sharedVariants[sharedVariants.length - 1];
    const newConfig: SharedSizeConfig = {
      id: nextId("variant"),
      size: "M",
      colors: lastConfig && lastConfig.colors.length > 0 ? [...lastConfig.colors] : ["Black"],
      sku: "",
      stock_quantity: 10,
      is_available: true,
      isCustomSize: false,
    };
    setSharedVariants((prev) => [...prev, newConfig]);
  };

  const handleRemoveSharedVariant = (id: string) => {
    if (sharedVariants.length <= 1) return;
    setSharedVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateSharedVariant = (
    id: string,
    field: keyof SharedSizeConfig,
    value: unknown
  ) => {
    setSharedVariants((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        return { ...v, [field]: value };
      })
    );
  };

  const handleColorsChange = (id: string, colors: string[]) => {
    setSharedVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, colors } : v))
    );
  };

  const handleQuickAddClothingSizes = (defaultColors = ["Black"]) => {
    const sizes = ["S", "M", "L", "XL"];
    const existingSizes = new Set(sharedVariants.map((v) => v.size.trim()));
    const toAdd: SharedSizeConfig[] = [];

    for (const sz of sizes) {
      if (!existingSizes.has(sz)) {
        toAdd.push({
          id: nextId("variant"),
          size: sz,
          colors: [...defaultColors],
          sku: "",
          stock_quantity: 10,
          is_available: true,
          isCustomSize: false,
        });
      }
    }
    if (toAdd.length > 0) {
      setSharedVariants((prev) => [...prev, ...toAdd]);
    }
  };

  const handleQuickAddWaistSizes = (defaultColors = ["Black"]) => {
    const waistList = ["28", "30", "32", "34", "36"];
    const existingSizes = new Set(sharedVariants.map((v) => v.size.trim()));
    const toAdd: SharedSizeConfig[] = [];

    for (const sz of waistList) {
      if (!existingSizes.has(sz)) {
        toAdd.push({
          id: nextId("variant"),
          size: sz,
          colors: [...defaultColors],
          sku: "",
          stock_quantity: 8,
          is_available: true,
          isCustomSize: false,
        });
      }
    }
    if (toAdd.length > 0) {
      setSharedVariants((prev) => [...prev, ...toAdd]);
    }
  };

  // --- Handlers: Section C (Multi-Image Uploader) ---
  const handleAddFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validItems: BulkProductImageItem[] = [];

    for (const file of fileArray) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        alert(`File "${file.name}" is not a supported format. Please upload JPG, PNG, WebP, or AVIF.`);
        continue;
      }
      if (file.size > MAX_INPUT_FILE_SIZE) {
        alert(`File "${file.name}" exceeds the maximum limit of 35MB.`);
        continue;
      }
      validItems.push({
        id: nextId("bulk-img"),
        file,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileSizeBytes: file.size,
        customAltText: "",
        status: "pending",
      });
    }

    if (validItems.length > 0) {
      setImageItems((prev) => [...prev, ...validItems]);
    }
  };

  const handleRemoveImageItem = (id: string) => {
    setImageItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUpdateAltText = (id: string, altText: string) => {
    setImageItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, customAltText: altText } : item))
    );
  };

  const handleClearAllImages = () => {
    if (imageItems.length === 0) return;
    if (!confirm("Are you sure you want to remove all selected images?")) return;
    imageItems.forEach((item) => {
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setImageItems([]);
    setBatchSummaryMessage(null);
  };

  // --- Validation Calculations & Expanded Variants ---
  const effectiveCategory =
    sharedDetails.category === "Custom..."
      ? sharedDetails.customCategory.trim()
      : sharedDetails.category.trim();

  const isSharedNameValid = sharedDetails.name.trim().length > 0;
  const isSharedCategoryValid = effectiveCategory.length > 0;
  const numSharedPrice = Number(sharedDetails.price);
  const isSharedPriceValid = !isNaN(numSharedPrice) && numSharedPrice > 0;

  let isSharedSalePriceValid = true;
  if (sharedDetails.salePrice.trim() !== "") {
    const numSale = Number(sharedDetails.salePrice);
    if (isNaN(numSale) || numSale < 0 || (isSharedPriceValid && numSale > numSharedPrice)) {
      isSharedSalePriceValid = false;
    }
  }

  // Variant validations & Expand combinations
  const variantErrors: string[] = [];
  const seenCombinations = new Set<string>();
  const duplicateCombinations = new Set<string>();

  sharedVariants.forEach((config, idx) => {
    const cleanSize = config.size.trim();
    if (!cleanSize) {
      variantErrors.push(`Configuration #${idx + 1}: Size is missing.`);
    }
    if (!config.colors || config.colors.length === 0) {
      variantErrors.push(
        `Configuration #${idx + 1} (${cleanSize || "Unknown Size"}): At least one color must be selected.`
      );
    }
    if (
      isNaN(config.stock_quantity) ||
      config.stock_quantity < 0 ||
      !Number.isInteger(config.stock_quantity)
    ) {
      variantErrors.push(
        `Configuration #${idx + 1} (${cleanSize}): Stock quantity must be a non-negative integer.`
      );
    }

    config.colors.forEach((col) => {
      const cleanCol = normalizeColorName(col);
      if (!cleanSize || !cleanCol) return;
      const key = `${cleanSize.toLowerCase()}:::${cleanCol.toLowerCase()}`;
      if (seenCombinations.has(key)) {
        duplicateCombinations.add(key);
        variantErrors.push(
          `Duplicate combination: Size "${cleanSize}" with Color "${cleanCol}" is defined more than once.`
        );
      } else {
        seenCombinations.add(key);
      }
    });
  });

  const totalCombinationsPerProduct = sharedVariants.reduce(
    (sum, v) => sum + (v.colors?.length || 0),
    0
  );

  const isVariantsValid =
    sharedVariants.length > 0 && totalCombinationsPerProduct > 0 && variantErrors.length === 0;
  const hasImages = imageItems.length > 0;

  const isOverallValid =
    isSharedNameValid &&
    isSharedCategoryValid &&
    isSharedPriceValid &&
    isSharedSalePriceValid &&
    isVariantsValid &&
    hasImages;

  // Key metrics
  const totalProductsToCreate = imageItems.length;
  const totalVariantRowsToCreate = totalProductsToCreate * totalCombinationsPerProduct;

  // --- Batch Execution Engine ---
  const handleCreateAllProducts = async (retryFailedOnly = false) => {
    if (!isOverallValid || isSubmitting) return;

    setIsSubmitting(true);
    setBatchSummaryMessage(null);
    abortControllerRef.current = new AbortController();

    const targetItems = retryFailedOnly
      ? imageItems.filter((item) => item.status !== "success")
      : imageItems;

    if (targetItems.length === 0) {
      setIsSubmitting(false);
      return;
    }

    const totalCount = targetItems.length;
    let completedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    const authClient = getSupabaseClient();
    const sessionRes = await authClient.auth.getSession();
    const token = sessionRes.data.session?.access_token;

    for (let i = 0; i < targetItems.length; i++) {
      const item = targetItems[i];
      const productDesignIndex = i + 1;

      // Update state to uploading
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === item.id ? { ...img, status: "uploading", error: undefined } : img
        )
      );

      setBatchProgress({
        currentIndex: i + 1,
        totalCount,
        currentStage: `Uploading image for Product #${productDesignIndex} (${item.fileName})...`,
        currentPercent: Math.round(((i + 0.3) / totalCount) * 100),
      });

      let uploadedStoragePath: string | null = null;

      try {
        // Step 1: Upload single image binary to Cloudflare R2
        const tempProductId = `prod-${nextId("bulk")}`;
        const defaultAlt = `${sharedDetails.name.trim()} - Design ${productDesignIndex}`;
        const finalAlt = item.customAltText.trim() || defaultAlt;

        const batchItem: BatchUploadItem = {
          id: item.id,
          file: item.file,
          altText: finalAlt,
          color: "",
          isPrimary: true,
          displayOrder: 0,
        };

        const uploadResult = await executeBatchUpload({
          productId: tempProductId,
          items: [batchItem],
          getAuthToken: async () => token,
        });

        if (uploadResult.failed.length > 0 || uploadResult.successful.length === 0) {
          const failErr = uploadResult.failed[0]?.error || "R2 image upload failed.";
          throw new Error(failErr);
        }

        const uploadedAsset = uploadResult.successful[0];
        uploadedStoragePath = uploadedAsset.storagePath;

        // Step 2: Create product record via POST /api/admin/products
        setImageItems((prev) =>
          prev.map((img) => (img.id === item.id ? { ...img, status: "saving" } : img))
        );

        setBatchProgress({
          currentIndex: i + 1,
          totalCount,
          currentStage: `Creating Product #${productDesignIndex} record & ${totalCombinationsPerProduct} variants...`,
          currentPercent: Math.round(((i + 0.8) / totalCount) * 100),
        });

        // Expand multi-color size configs into distinct (size, color) variant rows
        const variantsPayload: Array<{
          size: string;
          color: string;
          sku: string | null;
          stock_quantity: number;
          is_available: boolean;
        }> = [];

        sharedVariants.forEach((config) => {
          const cleanSize = config.size.trim();
          config.colors.forEach((col) => {
            const cleanCol = normalizeColorName(col);
            if (!cleanSize || !cleanCol) return;

            // Generate distinct SKU if prefix provided: e.g. JNS-M-BLK-1
            const colorShort = cleanCol.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
            const finalSku = config.sku.trim()
              ? `${config.sku.trim()}-${cleanSize}-${colorShort}-${productDesignIndex}`
              : null;

            variantsPayload.push({
              size: cleanSize,
              color: cleanCol,
              sku: finalSku,
              stock_quantity: config.stock_quantity,
              is_available: config.is_available,
            });
          });
        });

        const imagePayload = [
          {
            storage_path: uploadedAsset.storagePath,
            alt_text: uploadedAsset.altText || finalAlt,
            display_order: 0,
            is_primary: true,
            mime_type: uploadedAsset.mimeType,
            file_size_bytes: uploadedAsset.fileSizeBytes,
            width: uploadedAsset.width,
            height: uploadedAsset.height,
          },
        ];

        const createRes = await fetch("/api/admin/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: sharedDetails.name.trim(),
            department: sharedDetails.department.toLowerCase(),
            category: effectiveCategory,
            price: Number(sharedDetails.price),
            sale_price: sharedDetails.salePrice.trim() ? Number(sharedDetails.salePrice) : null,
            fabric: sharedDetails.fabric.trim() || null,
            fit: sharedDetails.fit.trim() || null,
            description: sharedDetails.description.trim() || null,
            status: sharedDetails.status,
            is_featured: sharedDetails.isFeatured,
            variants: variantsPayload,
            images: imagePayload,
          }),
        });

        const createData = await createRes.json();

        if (!createRes.ok || !createData.product) {
          throw new Error(createData.error || `HTTP ${createRes.status}: Unable to create product record.`);
        }

        // Product successfully created!
        successCount++;
        setImageItems((prev) =>
          prev.map((img) =>
            img.id === item.id
              ? {
                  ...img,
                  status: "success",
                  error: undefined,
                  createdProduct: {
                    id: createData.product.id,
                    name: createData.product.name,
                    slug: createData.product.slug,
                    price: createData.product.price,
                    department: createData.product.department,
                  },
                }
              : img
          )
        );
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Creation failed.";
        errorCount++;

        // Rollback uploaded R2 file if product record creation failed
        if (uploadedStoragePath) {
          try {
            await fetch("/api/admin/images/cleanup", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ keys: [uploadedStoragePath] }),
            });
          } catch (cleanupErr) {
            console.warn("Failed to cleanup R2 asset after product creation failure:", cleanupErr);
          }
        }

        setImageItems((prev) =>
          prev.map((img) =>
            img.id === item.id ? { ...img, status: "error", error: errorMsg } : img
          )
        );
      }

      completedCount++;
      setBatchProgress({
        currentIndex: completedCount,
        totalCount,
        currentStage: `Completed ${completedCount} of ${totalCount}`,
        currentPercent: Math.round((completedCount / totalCount) * 100),
      });
    }

    setIsSubmitting(false);
    setBatchProgress(null);

    if (errorCount === 0) {
      setBatchSummaryMessage(`🎉 All ${successCount} products were created successfully!`);
    } else {
      setBatchSummaryMessage(
        `Batch finished: ${successCount} created successfully, ${errorCount} failed.`
      );
    }
  };

  const handleResetForm = () => {
    if (!confirm("Are you sure you want to reset the form and image selection?")) {
      return;
    }
    imageItems.forEach((item) => {
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setSharedDetails({
      name: "",
      department: "Women",
      category: "Pants",
      customCategory: "",
      price: "",
      salePrice: "",
      fabric: "",
      fit: "",
      description: "",
      status: "published",
      isFeatured: false,
    });
    setSharedVariants([
      {
        id: nextId("variant"),
        size: "M",
        colors: ["Black", "Blue"],
        sku: "",
        stock_quantity: 10,
        is_available: true,
        isCustomSize: false,
      },
      {
        id: nextId("variant"),
        size: "L",
        colors: ["Black", "Blue"],
        sku: "",
        stock_quantity: 8,
        is_available: true,
        isCustomSize: false,
      },
    ]);
    setImageItems([]);
    setBatchSummaryMessage(null);
  };

  // --- Auth Guard State ---
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-[#800020] rounded-full animate-spin" />
          <p className="text-sm text-neutral-600 font-mono">Verifying administrator authorization...</p>
        </div>
      </div>
    );
  }

  if (!authStatus.isAuthenticated || !authStatus.isAdmin) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-red-50 text-red-700 rounded-full flex items-center justify-center mx-auto text-xl">
            🔒
          </div>
          <h2 className="text-xl font-bold font-serif text-neutral-900">Access Restricted</h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {authStatus.reason || "You must be authenticated as an authorized administrator to access Bulk Add Products."}
          </p>
          <div className="pt-2">
            <Link
              href="/admin/products"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#800020] hover:bg-[#66001a] transition-colors"
            >
              Return to Catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = imageItems.filter((i) => i.status === "success").length;
  const failedCount = imageItems.filter((i) => i.status === "error").length;

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24 text-neutral-900">
      {/* 1. Unified Admin Navigation Subheader */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <AdminProductNav
          current="bulk"
          title="Bulk Add Products"
          subtitle="One shared product form + multiple image uploads = multiple distinct product records with identical shared info and variants."
          extraActions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                Reset Form
              </button>
              <Link
                href="/admin/products"
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                View Catalogue
              </Link>
            </div>
          }
        />
      </div>

      {/* Main Form Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-8">
        {/* Status Notification Banner */}
        {batchSummaryMessage && (
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              failedCount === 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{failedCount === 0 ? "✓" : "⚠️"}</span>
              <div>
                <p className="text-sm font-semibold">{batchSummaryMessage}</p>
                {completedCount > 0 && (
                  <p className="text-xs opacity-90 mt-0.5">
                    {completedCount} product{completedCount > 1 ? "s" : ""} created in Supabase with R2 images and linked variants.
                  </p>
                )}
              </div>
            </div>
            {failedCount > 0 && (
              <button
                type="button"
                onClick={() => handleCreateAllProducts(true)}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-900 text-white hover:bg-amber-800 transition-colors shrink-0 shadow-2xs"
              >
                Retry {failedCount} Failed Product{failedCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION A — SHARED PRODUCT INFORMATION (ONE FORM ONCE)    */}
        {/* ========================================================= */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#800020] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-neutral-900">
                  Shared Product Information
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-700">
                  Applies to all uploaded images
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                Enter common details once. Every uploaded image will generate a separate product record with these values.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Product Name */}
            <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Product Name <span className="text-[#800020]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Jeans"
                value={sharedDetails.name}
                onChange={(e) => updateSharedDetails("name", e.target.value)}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2.5 text-sm bg-neutral-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/20 transition-all ${
                  !isSharedNameValid && sharedDetails.name !== ""
                    ? "border-red-400 bg-red-50/30"
                    : "border-neutral-300 focus:border-[#800020]"
                }`}
              />
              <p className="text-[11px] text-neutral-500">
                Shared name. The server automatically assigns unique collision-safe slugs (e.g. jeans, jeans-2, jeans-3).
              </p>
            </div>

            {/* 2. Department */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Department <span className="text-[#800020]">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Men", "Women", "Kids"] as const).map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => updateSharedDetails("department", dept)}
                    disabled={isSubmitting}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      sharedDetails.department === dept
                        ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                        : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Category <span className="text-[#800020]">*</span>
              </label>
              <div className="space-y-2">
                <select
                  value={sharedDetails.category}
                  onChange={(e) => updateSharedDetails("category", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] transition-all"
                >
                  {STANDARD_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Custom...">Custom Category...</option>
                </select>
                {sharedDetails.category === "Custom..." && (
                  <input
                    type="text"
                    placeholder="Enter custom category"
                    value={sharedDetails.customCategory}
                    onChange={(e) => updateSharedDetails("customCategory", e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]"
                  />
                )}
              </div>
            </div>

            {/* 4. Regular Price */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Regular Price (₹) <span className="text-[#800020]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="999"
                  value={sharedDetails.price}
                  onChange={(e) => updateSharedDetails("price", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-neutral-50/50 border border-neutral-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] transition-all"
                />
              </div>
            </div>

            {/* 5. Optional Sale Price */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Sale Price (₹) <span className="text-neutral-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Leave empty if regular price"
                  value={sharedDetails.salePrice}
                  onChange={(e) => updateSharedDetails("salePrice", e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full pl-8 pr-3.5 py-2.5 text-sm bg-neutral-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/20 transition-all ${
                    !isSharedSalePriceValid
                      ? "border-red-400 bg-red-50/30"
                      : "border-neutral-300 focus:border-[#800020]"
                  }`}
                />
              </div>
              {!isSharedSalePriceValid && (
                <p className="text-[11px] text-red-600">Must be non-negative and ≤ regular price.</p>
              )}
            </div>

            {/* 6. Publication Status */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Publication Status
              </label>
              <select
                value={sharedDetails.status}
                onChange={(e) =>
                  updateSharedDetails("status", e.target.value as "draft" | "published" | "archived")
                }
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] transition-all"
              >
                <option value="published">Published (Visible in store)</option>
                <option value="draft">Draft (Hidden from storefront)</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* 7. Fabric */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Fabric <span className="text-neutral-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 100% Cotton Denim"
                value={sharedDetails.fabric}
                onChange={(e) => updateSharedDetails("fabric", e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-neutral-50/50 border border-neutral-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] transition-all"
              />
            </div>

            {/* 8. Fit */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Fit <span className="text-neutral-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Straight Leg / Regular Fit"
                value={sharedDetails.fit}
                onChange={(e) => updateSharedDetails("fit", e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-neutral-50/50 border border-neutral-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] transition-all"
              />
            </div>

            {/* 9. Featured Status */}
            <div className="flex items-center pt-6">
              <label className="relative flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sharedDetails.isFeatured}
                  onChange={(e) => updateSharedDetails("isFeatured", e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-[#800020] rounded border-neutral-300 focus:ring-[#800020]"
                />
                <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Mark as Featured Product
                </span>
              </label>
            </div>

            {/* 10. Description */}
            <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                Product Description <span className="text-neutral-400 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Shared description applied to all products generated in this batch..."
                value={sharedDetails.description}
                onChange={(e) => updateSharedDetails("description", e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-neutral-50/50 border border-neutral-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] transition-all resize-y"
              />
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION B — SHARED VARIANTS & INVENTORY (MULTI-COLOR)    */}
        {/* ========================================================= */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#800020] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-neutral-900">
                  Shared Variants & Inventory
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#800020]/10 text-[#800020]">
                  Multi-Color per Size Supported
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                Configure sizes and select multiple colors per size. On submission, each size/color combination expands into its own variant row.
                <strong className="text-neutral-700 ml-1">
                  (Stock quantities are applied per combination on each generated product).
                </strong>
              </p>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-neutral-500">Quick Presets:</span>
              <button
                type="button"
                onClick={() => handleQuickAddClothingSizes(["Black"])}
                disabled={isSubmitting}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
              >
                + S, M, L, XL
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddWaistSizes(["Black"])}
                disabled={isSubmitting}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
              >
                + Waist 28–36
              </button>
            </div>
          </div>

          {/* Validation warnings for variants */}
          {duplicateCombinations.size > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>
                Duplicate Size and Color combinations detected across configurations. Each size/color combination must be unique per product.
              </span>
            </div>
          )}

          {/* Variants Container: Desktop Table + Mobile/Tablet Responsive Cards */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
            {/* Desktop Table View (lg: 1024px and up) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-left text-xs">
                <thead className="bg-neutral-50/80 font-semibold text-neutral-600 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 w-48">
                      Size <span className="text-[#800020]">*</span>
                    </th>
                    <th scope="col" className="px-4 py-3.5 min-w-[280px]">
                      Colors (Multi-Select) <span className="text-[#800020]">*</span>
                    </th>
                    <th scope="col" className="px-4 py-3.5 w-44">
                      SKU Prefix <span className="text-neutral-400 font-normal lowercase">(optional)</span>
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right w-36">
                      Stock per Combo <span className="text-[#800020]">*</span>
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center w-24">
                      Available
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right w-20">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {sharedVariants.map((variant) => {
                    const hasMissingColor = !variant.colors || variant.colors.length === 0;

                    return (
                      <tr
                        key={variant.id}
                        className={`transition-colors ${
                          hasMissingColor ? "bg-amber-50/20" : "hover:bg-neutral-50/50"
                        }`}
                      >
                        {/* Size */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="space-y-1">
                            <select
                              value={variant.isCustomSize ? "custom" : variant.size}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "custom") {
                                  handleUpdateSharedVariant(variant.id, "isCustomSize", true);
                                  handleUpdateSharedVariant(variant.id, "size", "");
                                } else {
                                  handleUpdateSharedVariant(variant.id, "isCustomSize", false);
                                  handleUpdateSharedVariant(variant.id, "size", val);
                                }
                              }}
                              disabled={isSubmitting}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800020] focus:border-[#800020]"
                            >
                              <optgroup label="Apparel Sizes">
                                {CLOTHING_SIZES.map((sz) => (
                                  <option key={sz} value={sz}>
                                    {sz}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Waist / Numerical">
                                {WAIST_SIZES.map((sz) => (
                                  <option key={sz} value={sz}>
                                    {sz}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Other">
                                {OTHER_SIZES.map((sz) => (
                                  <option key={sz} value={sz}>
                                    {sz}
                                  </option>
                                ))}
                              </optgroup>
                              <option value="custom">Custom Size...</option>
                            </select>

                            {variant.isCustomSize && (
                              <input
                                type="text"
                                placeholder="Enter size (e.g. 34W/32L)"
                                value={variant.size}
                                onChange={(e) =>
                                  handleUpdateSharedVariant(variant.id, "size", e.target.value)
                                }
                                disabled={isSubmitting}
                                className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-md focus:outline-none focus:border-[#800020]"
                              />
                            )}
                          </div>
                        </td>

                        {/* Colors Multi-Select */}
                        <td className="px-4 py-3.5 align-top">
                          <ColorMultiSelect
                            selectedColors={variant.colors}
                            onChange={(colors) => handleColorsChange(variant.id, colors)}
                            disabled={isSubmitting}
                            hasError={hasMissingColor}
                          />
                          <p className="text-[10px] text-neutral-400 mt-1">
                            {variant.colors.length === 0
                              ? "⚠️ Select at least one color"
                              : `Creates ${variant.colors.length} variant combination${
                                  variant.colors.length > 1 ? "s" : ""
                                } for size ${variant.size || "selected"}`}
                          </p>
                        </td>

                        {/* SKU Prefix */}
                        <td className="px-4 py-3.5 align-top">
                          <input
                            type="text"
                            placeholder="e.g. JNS (auto-suffix added)"
                            value={variant.sku}
                            onChange={(e) =>
                              handleUpdateSharedVariant(variant.id, "sku", e.target.value)
                            }
                            disabled={isSubmitting}
                            className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800020] focus:border-[#800020]"
                          />
                        </td>

                        {/* Stock Quantity */}
                        <td className="px-4 py-3.5 text-right align-top">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={variant.stock_quantity}
                            onChange={(e) =>
                              handleUpdateSharedVariant(
                                variant.id,
                                "stock_quantity",
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            disabled={isSubmitting}
                            className="w-24 px-2.5 py-1.5 text-xs text-right border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800020] focus:border-[#800020]"
                          />
                        </td>

                        {/* Available */}
                        <td className="px-4 py-3.5 text-center align-top">
                          <input
                            type="checkbox"
                            checked={variant.is_available}
                            onChange={(e) =>
                              handleUpdateSharedVariant(variant.id, "is_available", e.target.checked)
                            }
                            disabled={isSubmitting}
                            className="w-4 h-4 text-[#800020] rounded border-neutral-300 focus:ring-[#800020] cursor-pointer mt-1"
                          />
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-right align-top">
                          <button
                            type="button"
                            onClick={() => handleRemoveSharedVariant(variant.id)}
                            disabled={isSubmitting || sharedVariants.length <= 1}
                            className={`text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer mt-0.5 ${
                              sharedVariants.length <= 1
                                ? "text-neutral-300 cursor-not-allowed"
                                : "text-neutral-500 hover:text-red-700 hover:bg-red-50"
                            }`}
                            title="Remove variant size configuration"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Responsive Cards Layout (under 1024px) */}
            <div className="block lg:hidden p-4 bg-neutral-50/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sharedVariants.map((variant, idx) => {
                  const hasMissingColor = !variant.colors || variant.colors.length === 0;

                  return (
                    <div
                      key={variant.id}
                      className={`bg-white border rounded-xl p-4 space-y-3.5 shadow-2xs transition-all ${
                        hasMissingColor
                          ? "border-amber-300 ring-2 ring-amber-100 bg-amber-50/10"
                          : "border-neutral-200"
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#800020]/10 text-[#800020]">
                            Configuration #{idx + 1}
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            ({variant.colors.length} color{variant.colors.length !== 1 ? "s" : ""})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSharedVariant(variant.id)}
                          disabled={isSubmitting || sharedVariants.length <= 1}
                          className={`text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                            sharedVariants.length <= 1
                              ? "text-neutral-300 cursor-not-allowed"
                              : "text-red-600 hover:bg-red-50 hover:text-red-700"
                          }`}
                        >
                          Remove
                        </button>
                      </div>

                      {/* Fields Stack */}
                      <div className="space-y-3">
                        {/* Size Field */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                            Size <span className="text-[#800020]">*</span>
                          </label>
                          <select
                            value={variant.isCustomSize ? "custom" : variant.size}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "custom") {
                                handleUpdateSharedVariant(variant.id, "isCustomSize", true);
                                handleUpdateSharedVariant(variant.id, "size", "");
                              } else {
                                handleUpdateSharedVariant(variant.id, "isCustomSize", false);
                                handleUpdateSharedVariant(variant.id, "size", val);
                              }
                            }}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800020] focus:border-[#800020]"
                          >
                            <optgroup label="Apparel Sizes">
                              {CLOTHING_SIZES.map((sz) => (
                                <option key={sz} value={sz}>
                                  {sz}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Waist / Numerical">
                              {WAIST_SIZES.map((sz) => (
                                <option key={sz} value={sz}>
                                  {sz}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Other">
                              {OTHER_SIZES.map((sz) => (
                                <option key={sz} value={sz}>
                                  {sz}
                                </option>
                              ))}
                            </optgroup>
                            <option value="custom">Custom Size...</option>
                          </select>

                          {variant.isCustomSize && (
                            <input
                              type="text"
                              placeholder="Enter custom size (e.g. 34W/32L)"
                              value={variant.size}
                              onChange={(e) =>
                                handleUpdateSharedVariant(variant.id, "size", e.target.value)
                              }
                              disabled={isSubmitting}
                              className="w-full mt-1.5 px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#800020]"
                            />
                          )}
                        </div>

                        {/* Colors Multi-Select */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                            Colors (Multi-Select) <span className="text-[#800020]">*</span>
                          </label>
                          <ColorMultiSelect
                            selectedColors={variant.colors}
                            onChange={(colors) => handleColorsChange(variant.id, colors)}
                            disabled={isSubmitting}
                            hasError={hasMissingColor}
                          />
                        </div>

                        {/* SKU Prefix & Stock per Product Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                              SKU Prefix <span className="text-neutral-400 font-normal lowercase">(optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. JNS"
                              value={variant.sku}
                              onChange={(e) =>
                                handleUpdateSharedVariant(variant.id, "sku", e.target.value)
                              }
                              disabled={isSubmitting}
                              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800020] focus:border-[#800020]"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                              Stock per Combination <span className="text-[#800020]">*</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={variant.stock_quantity}
                              onChange={(e) =>
                                handleUpdateSharedVariant(
                                  variant.id,
                                  "stock_quantity",
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              disabled={isSubmitting}
                              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800020] focus:border-[#800020]"
                            />
                          </div>
                        </div>

                        {/* Availability Toggle */}
                        <div className="pt-1 flex items-center justify-between">
                          <label className="text-xs font-medium text-neutral-700 cursor-pointer flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={variant.is_available}
                              onChange={(e) =>
                                handleUpdateSharedVariant(variant.id, "is_available", e.target.checked)
                              }
                              disabled={isSubmitting}
                              className="w-4 h-4 text-[#800020] rounded border-neutral-300 focus:ring-[#800020] cursor-pointer"
                            />
                            <span>Available in stock for these variants</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Add Row Bar */}
            <div className="p-3.5 bg-neutral-50/80 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <span className="text-xs text-neutral-500">
                {sharedVariants.length} size configuration{sharedVariants.length > 1 ? "s" : ""} (
                {totalCombinationsPerProduct} total variant combination{totalCombinationsPerProduct !== 1 ? "s" : ""})
              </span>
              <button
                type="button"
                onClick={handleAddSharedVariant}
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 transition-colors shadow-2xs cursor-pointer"
              >
                <span>+</span> Add Size Configuration
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION C — UPLOAD MULTIPLE PRODUCT IMAGES               */}
        {/* ========================================================= */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#800020] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-neutral-900">
                  Upload Product Images
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#800020]/10 text-[#800020]">
                  1 Image = 1 Product
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                Select 5, 10, or more product images together. Each uploaded image creates a separate product record with the shared details and variants above.
              </p>
            </div>

            {imageItems.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAllImages}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-red-700 bg-white border border-neutral-300 rounded-lg hover:bg-red-50 transition-colors shadow-2xs"
                >
                  Clear All ({imageItems.length})
                </button>
              </div>
            )}
          </div>

          {/* Unified Drag-and-Drop Multi-File Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files) {
                handleAddFiles(e.dataTransfer.files);
              }
            }}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              isDraggingOver
                ? "border-[#800020] bg-[#800020]/5 scale-[0.99]"
                : "border-neutral-300 bg-neutral-50/40 hover:border-neutral-400"
            }`}
          >
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={isSubmitting}
              onChange={(e) => {
                if (e.target.files) {
                  handleAddFiles(e.target.files);
                  e.target.value = "";
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#800020] shadow-xs">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-neutral-800">
                  Drag and drop product images here, or <span className="text-[#800020] underline">browse files</span>
                </p>
                <p className="text-xs text-neutral-500">
                  Upload multiple product photos in one go. Supports JPG, PNG, WebP, AVIF up to 35MB each.
                </p>
              </div>
              <div className="mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-neutral-200/70 text-neutral-700">
                  {imageItems.length === 0
                    ? "No images selected yet"
                    : `${imageItems.length} product image${imageItems.length > 1 ? "s" : ""} selected`}
                </span>
              </div>
            </div>
          </div>

          {/* Responsive Multi-Image Preview Grid */}
          {imageItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                <span>Selected Product Images ({imageItems.length} Products to Create)</span>
                <span className="text-neutral-500 font-normal normal-case">
                  Click ✕ to remove any image before submitting
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                {imageItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`group relative bg-white border rounded-xl overflow-hidden shadow-2xs transition-all ${
                      item.status === "success"
                        ? "border-emerald-300 ring-2 ring-emerald-100"
                        : item.status === "error"
                        ? "border-red-300 ring-2 ring-red-100"
                        : item.status === "uploading" || item.status === "saving"
                        ? "border-amber-300 ring-2 ring-amber-100 animate-pulse"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square relative bg-neutral-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt={item.customAltText || `${sharedDetails.name || "Product"} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Product # Tag */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-bold shadow-xs">
                        Product #{idx + 1}
                      </div>

                      {/* Status Badges */}
                      {item.status === "success" && (
                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                          <span>✓</span> Created
                        </div>
                      )}
                      {item.status === "error" && (
                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-red-700 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                          <span>✕</span> Failed
                        </div>
                      )}
                      {item.status === "uploading" && (
                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-bold shadow-xs">
                          Uploading...
                        </div>
                      )}
                      {item.status === "saving" && (
                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-blue-700 text-white text-[10px] font-bold shadow-xs">
                          Saving...
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImageItem(item.id)}
                        disabled={isSubmitting || item.status === "success"}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white text-xs flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all shadow-xs"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Meta info & Alt input */}
                    <div className="p-2 space-y-1.5 bg-white text-[11px]">
                      <div className="flex items-center justify-between text-neutral-500 font-mono text-[10px]">
                        <span className="truncate max-w-[100px]" title={item.fileName}>
                          {item.fileName}
                        </span>
                        <span>{formatBytes(item.fileSizeBytes)}</span>
                      </div>

                      {item.error ? (
                        <p className="text-[10px] text-red-600 font-medium truncate" title={item.error}>
                          {item.error}
                        </p>
                      ) : (
                        <input
                          type="text"
                          placeholder={`${sharedDetails.name || "Product"} design ${idx + 1}`}
                          value={item.customAltText}
                          onChange={(e) => handleUpdateAltText(item.id, e.target.value)}
                          disabled={isSubmitting || item.status === "success"}
                          className="w-full px-1.5 py-0.5 text-[10px] bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:outline-none focus:border-[#800020]"
                          title="Custom alt text for this product image"
                        />
                      )}

                      {item.createdProduct && (
                        <div className="pt-1 border-t border-neutral-100 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-700 font-medium">Slug: {item.createdProduct.slug}</span>
                          <Link
                            href={`/product/${item.createdProduct.slug}`}
                            target="_blank"
                            className="text-[#800020] underline font-semibold"
                          >
                            View
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* SECTION D — BATCH REVIEW & SUMMARY                       */}
        {/* ========================================================= */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#800020] text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-neutral-900">
                  Review & Create All Products
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                Verify summary metrics before submitting. Each selected image creates an independent product in Supabase with R2 storage.
              </p>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                Products to Create
              </span>
              <p className="text-2xl font-bold font-serif text-neutral-900 mt-1">
                {totalProductsToCreate}
              </p>
              <span className="text-[10px] text-neutral-500">1 per selected image</span>
            </div>

            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                Variants per Product
              </span>
              <p className="text-2xl font-bold font-serif text-neutral-900 mt-1">
                {totalCombinationsPerProduct}
              </p>
              <span className="text-[10px] text-neutral-500">Expanded size/color combos</span>
            </div>

            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                Total Variant Records
              </span>
              <p className="text-2xl font-bold font-serif text-neutral-900 mt-1">
                {totalVariantRowsToCreate}
              </p>
              <span className="text-[10px] text-neutral-500">Rows in public.product_variants</span>
            </div>

            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                Images to Upload
              </span>
              <p className="text-2xl font-bold font-serif text-neutral-900 mt-1">
                {imageItems.length}
              </p>
              <span className="text-[10px] text-neutral-500">Binary files to Cloudflare R2</span>
            </div>
          </div>

          {/* Validation Warnings List */}
          {!isOverallValid && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-900">
              <div className="font-semibold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Please complete the required fields to enable product creation:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-2 opacity-90 text-[11px]">
                {!isSharedNameValid && <li>Product Name is required.</li>}
                {!isSharedCategoryValid && <li>Category is required.</li>}
                {!isSharedPriceValid && <li>Regular Price must be a valid number greater than 0.</li>}
                {!isSharedSalePriceValid && <li>Sale Price must be valid and cannot exceed Regular Price.</li>}
                {sharedVariants.length === 0 && <li>At least one size configuration must be defined.</li>}
                {variantErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {!hasImages && <li>At least one product image must be selected in Section 3.</li>}
              </ul>
            </div>
          )}

          {/* In-Progress Progress Bar */}
          {isSubmitting && batchProgress && (
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">{batchProgress.currentStage}</span>
                <span className="font-mono text-neutral-600">{batchProgress.currentPercent}%</span>
              </div>
              <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#800020] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${batchProgress.currentPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-500 text-center">
                Processing product {batchProgress.currentIndex} of {batchProgress.totalCount}... Please do not close this window.
              </p>
            </div>
          )}

          {/* Final Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-100">
            <div className="text-xs text-neutral-500 text-center sm:text-left">
              <span>Submitting creates </span>
              <strong className="text-neutral-800">{totalProductsToCreate} distinct products</strong>
              <span> with </span>
              <strong className="text-neutral-800">{totalVariantRowsToCreate} variant rows</strong>
              <span> and </span>
              <strong className="text-neutral-800">{imageItems.length} R2 image records</strong>.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleCreateAllProducts(false)}
                disabled={!isOverallValid || isSubmitting}
                className="w-full sm:w-auto px-6 py-3 text-sm font-semibold rounded-xl text-white bg-[#800020] hover:bg-[#66001a] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Processing Batch...</span>
                  </>
                ) : (
                  <span>
                    Create All {totalProductsToCreate > 0 ? `${totalProductsToCreate} ` : ""}Product{totalProductsToCreate === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
