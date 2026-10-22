"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { verifyAdminAuthorization, type AdminVerificationResult } from "@/lib/supabase/auth";
import type { Product, ProductVariant, ProductImage } from "@/types/product";
import {
  executeBatchUpload,
  type BatchProgressState,
  type BatchUploadItem,
} from "@/lib/images/batch-uploader";
import { normalizeSlug } from "@/lib/products/slug";
import { AdminProductNav } from "@/components/AdminProductNav";
import {
  ColorMultiSelect,
  normalizeColorName,
  resolveColorHex,
} from "@/components/ColorMultiSelect";

// Constants
const MAX_INPUT_FILE_SIZE = 35 * 1024 * 1024; // 35 MB raw file limit (compressed in-browser to ~1-2 MB)
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
const ALL_SUGGESTED_SIZES = [...CLOTHING_SIZES, ...WAIST_SIZES, ...OTHER_SIZES];

interface SizeConfigInput {
  id: string; // temporary key for list rendering
  size: string;
  colors: string[];
  sku: string;
  total_stock: number;
  is_available: boolean;
  isCustomSize?: boolean;
}

export interface StockAllocationInfo {
  isValid: boolean;
  numColors: number;
  stockPerColor: number;
  message: string;
  errorMessage?: string;
}

export function getStockAllocation(cfg: SizeConfigInput): StockAllocationInfo {
  const numColors = cfg.colors.length;
  if (numColors === 0) {
    return {
      isValid: false,
      numColors: 0,
      stockPerColor: 0,
      message: "Select at least one color",
      errorMessage: "At least one color must be selected.",
    };
  }
  const total = Number(cfg.total_stock);
  if (isNaN(total) || total < 0 || !Number.isInteger(total)) {
    return {
      isValid: false,
      numColors,
      stockPerColor: 0,
      message: "Total stock must be a non-negative integer",
      errorMessage: "Total stock quantity must be a non-negative integer.",
    };
  }
  if (total === 0) {
    return {
      isValid: true,
      numColors,
      stockPerColor: 0,
      message: `0 units per color (${numColors} color${numColors > 1 ? "s" : ""}) — Out of Stock`,
    };
  }
  const remainder = total % numColors;
  if (remainder !== 0) {
    const lower = Math.floor(total / numColors) * numColors;
    const upper = Math.ceil(total / numColors) * numColors;
    const suggestion = lower > 0 ? `Try ${lower} or ${upper}` : `Try ${upper}`;
    return {
      isValid: false,
      numColors,
      stockPerColor: 0,
      message: `Indivisible: ${total} cannot be divided evenly across ${numColors} colors (${suggestion})`,
      errorMessage: `Total stock quantity (${total}) cannot be divided evenly across ${numColors} selected colors. Each color must receive an equal share (${suggestion}).`,
    };
  }
  const perColor = total / numColors;
  return {
    isValid: true,
    numColors,
    stockPerColor: perColor,
    message: `${perColor} unit${perColor > 1 ? "s" : ""} per color across ${numColors} color${numColors > 1 ? "s" : ""}`,
  };
}

export function generateVariantSku(skuPrefix: string, size: string, color: string): string | null {
  const cleanPrefix = skuPrefix.trim();
  if (!cleanPrefix) return null;
  const colorCode = color.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "VAR";
  const sizeCode = size.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (sizeCode && cleanPrefix.toUpperCase().endsWith(`-${sizeCode}`)) {
    return `${cleanPrefix}-${colorCode}`;
  }
  return `${cleanPrefix}-${sizeCode}-${colorCode}`;
}

interface ImageInput {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
  isPrimary: boolean;
}

export default function NewProductPage() {
  // --- Auth State ---
  const [authStatus, setAuthStatus] = useState<AdminVerificationResult>({
    isAuthenticated: false,
    isAdmin: false,
    user: null,
  });
  const [checkingAuth, setCheckingAuth] = useState(true);

  // --- Section 1: Product Information ---
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState<"Men" | "Women" | "Kids">("Women");
  const [category, setCategory] = useState("Jackets");
  const [customCategory, setCustomCategory] = useState("");

  // --- Section 2: Pricing ---
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  // --- Section 3: Attributes ---
  const [fabric, setFabric] = useState("");
  const [fit, setFit] = useState("");

  // --- Section 4: Variants & Size Configurations ---
  const [sizeConfigs, setSizeConfigs] = useState<SizeConfigInput[]>([
    {
      id: "sc-init-1",
      size: "M",
      colors: ["Black"],
      sku: "",
      total_stock: 6,
      is_available: true,
    },
  ]);

  // --- Section 5: Images ---
  const [selectedImages, setSelectedImages] = useState<ImageInput[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Section 6: Publishing ---
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [isFeatured, setIsFeatured] = useState(false);

  // --- Submission & Upload Progress ---
  const [concurrency, setConcurrency] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressState, setProgressState] = useState<BatchProgressState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Errors & Result
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdProduct, setCreatedProduct] = useState<{
    product: Product;
    variants: ProductVariant[];
    images: ProductImage[];
  } | null>(null);

  // 1. Verify administrator authorization on mount
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const result = await verifyAdminAuthorization();
        if (isMounted) setAuthStatus(result);
      } finally {
        if (isMounted) setCheckingAuth(false);
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup object preview URLs on unmount
  useEffect(() => {
    return () => {
      selectedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [selectedImages]);

  // Size Configuration operations
  function addSizeConfig() {
    const last = sizeConfigs[sizeConfigs.length - 1];
    const currentIdx = CLOTHING_SIZES.indexOf(last?.size || "");
    const nextSize =
      currentIdx !== -1 && currentIdx < CLOTHING_SIZES.length - 1
        ? CLOTHING_SIZES[currentIdx + 1]
        : "L";

    setSizeConfigs((prev) => [
      ...prev,
      {
        id: `sc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        size: nextSize,
        colors: last?.colors && last.colors.length > 0 ? [...last.colors] : ["Black"],
        sku: "",
        total_stock: last?.colors?.length ? last.colors.length * 2 : 6,
        is_available: true,
        isCustomSize: false,
      },
    ]);
  }

  function removeSizeConfig(id: string) {
    if (sizeConfigs.length <= 1) {
      alert("At least one size configuration is required.");
      return;
    }
    setSizeConfigs((prev) => prev.filter((sc) => sc.id !== id));
  }

  function updateSizeConfig(id: string, field: keyof SizeConfigInput, value: unknown) {
    setSizeConfigs((prev) =>
      prev.map((sc) => (sc.id === id ? { ...sc, [field]: value } : sc))
    );
  }

  function handleColorsChange(id: string, newColors: string[]) {
    setSizeConfigs((prev) =>
      prev.map((sc) => (sc.id === id ? { ...sc, colors: newColors } : sc))
    );
  }

  // Check for duplicate variant combinations in real time across all size configurations
  const duplicateCombinations: string[] = [];
  const seenCombos = new Set<string>();

  sizeConfigs.forEach((cfg) => {
    const cleanSize = cfg.size.trim();
    cfg.colors.forEach((col) => {
      const cleanCol = normalizeColorName(col);
      if (!cleanSize || !cleanCol) return;
      const key = `${cleanSize.toLowerCase()}:::${cleanCol.toLowerCase()}`;
      const display = `${cleanSize} / ${cleanCol}`;
      if (seenCombos.has(key)) {
        if (!duplicateCombinations.includes(display)) {
          duplicateCombinations.push(display);
        }
      } else {
        seenCombos.add(key);
      }
    });
  });

  // Image handling
  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageInput[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file, index) => {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Unsupported type (${file.type}). Accepted formats: JPEG, PNG, WebP, AVIF.`);
        return;
      }
      if (file.size > MAX_INPUT_FILE_SIZE) {
        errors.push(`${file.name}: Exceeds 35MB input limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      newImages.push({
        id: `img-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
        altText: "",
        isPrimary: selectedImages.length === 0 && index === 0,
      });
    });

    if (errors.length > 0) {
      setErrorMessage(errors.join(" | "));
    }

    if (newImages.length > 0) {
      setSelectedImages((prev) => {
        const combined = [...prev, ...newImages];
        if (!combined.some((img) => img.isPrimary) && combined.length > 0) {
          combined[0].isPrimary = true;
        }
        return combined;
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeImage(id: string) {
    setSelectedImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const remaining = prev.filter((img) => img.id !== id);
      if (target?.isPrimary && remaining.length > 0) {
        remaining[0].isPrimary = true;
      }
      return remaining;
    });
  }

  function setPrimaryImage(id: string) {
    setSelectedImages((prev) =>
      prev.map((img) => ({
        ...img,
        isPrimary: img.id === id,
      }))
    );
  }

  function moveImage(index: number, direction: "up" | "down") {
    setSelectedImages((prev) => {
      const list = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return list;
    });
  }

  // Validate form client-side
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Product name is required.";
    } else if (!normalizeSlug(name)) {
      errors.name = "Product name must contain letters or numbers to generate a URL.";
    }

    const effectiveCategory = category === "custom" ? customCategory.trim() : category.trim();
    if (!effectiveCategory) errors.category = "Category is required.";

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      errors.price = "Price must be a valid non-negative number.";
    }

    if (salePrice.trim()) {
      const numSale = parseFloat(salePrice);
      if (isNaN(numSale) || numSale < 0) {
        errors.salePrice = "Sale price must be a valid non-negative number.";
      } else if (!isNaN(numPrice) && numSale > numPrice) {
        errors.salePrice = "Sale price cannot be greater than regular price.";
      }
    }

    if (duplicateCombinations.length > 0) {
      errors.variants = `Duplicate variant combination detected: ${duplicateCombinations.join(", ")}. Each size & color combination must be unique.`;
    }

    sizeConfigs.forEach((cfg, idx) => {
      if (!cfg.size.trim()) {
        errors[`sizeConfig_${idx}_size`] = "Size is required.";
      }
      if (cfg.colors.length === 0) {
        errors[`sizeConfig_${idx}_colors`] = "At least one color must be selected.";
      }
      const alloc = getStockAllocation(cfg);
      if (!alloc.isValid) {
        errors[`sizeConfig_${idx}_stock`] = alloc.errorMessage || alloc.message;
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Submit Handler
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) {
      setErrorMessage("Please correct the highlighted fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const uploadedR2Keys: string[] = [];

    try {
      // Step 1: Upload Images to R2 if selected
      const finalImagePayload: {
        storage_path: string;
        alt_text: string;
        display_order: number;
        is_primary: boolean;
        color: string | null;
        mime_type: string | null;
        file_size_bytes: number | null;
        width: number | null;
        height: number | null;
      }[] = [];

      if (selectedImages.length > 0) {
        setProgressState({
          stage: "Compressing",
          overallPercent: 5,
          processedCount: 0,
          totalCount: selectedImages.length,
          successCount: 0,
          failedCount: 0,
          cancelledCount: 0,
          currentFileName: null,
          totalOriginalBytes: 0,
          totalCompressedBytes: 0,
          items: {},
        });

        // Generate client UUID for image folder path
        const tempFolderId = crypto.randomUUID();

        const batchItems: BatchUploadItem[] = selectedImages.map((img, idx) => ({
          id: img.id,
          file: img.file,
          altText: img.altText,
          color: "", // Image colors are no longer collected per-image
          isPrimary: img.isPrimary,
          displayOrder: idx,
        }));

        const uploadResult = await executeBatchUpload({
          productId: tempFolderId,
          items: batchItems,
          concurrency,
          signal: abortController.signal,
          getAuthToken: async () => {
            const client = getSupabaseClient();
            const { data } = await client.auth.getSession();
            return data.session?.access_token;
          },
          onProgress: (state) => {
            setProgressState(state);
          },
        });

        // Track uploaded keys for rollback cleanup in case of failure
        uploadResult.successful.forEach((item) => uploadedR2Keys.push(item.storagePath));

        if (uploadResult.failed.length > 0 || uploadResult.cancelled.length > 0) {
          const failReasons = uploadResult.failed.map((f) => `${f.fileName}: ${f.error}`).join("; ");
          throw new Error(`Image upload failed: ${failReasons || "Operation was cancelled."}`);
        }

        // Map successfully uploaded image metadata
        uploadResult.successful.forEach((item) => {
          finalImagePayload.push({
            storage_path: item.storagePath,
            alt_text: item.altText.trim() || `${name.trim()} image ${item.displayOrder + 1}`,
            display_order: item.displayOrder,
            is_primary: item.isPrimary,
            color: null, // Nullable per schema, variants determine product colors
            mime_type: item.mimeType || null,
            file_size_bytes: item.fileSizeBytes || null,
            width: item.width || null,
            height: item.height || null,
          });
        });
      }

      // Step 2: Submit to server endpoint POST /api/admin/products
      setProgressState((prev) =>
        prev
          ? { ...prev, stage: "Saving product", overallPercent: 92 }
          : {
              stage: "Saving product",
              overallPercent: 92,
              processedCount: 0,
              totalCount: 0,
              successCount: 0,
              failedCount: 0,
              cancelledCount: 0,
              currentFileName: null,
              totalOriginalBytes: 0,
              totalCompressedBytes: 0,
              items: {},
            }
      );

      const effectiveCategory = category === "custom" ? customCategory.trim() : category.trim();

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        department: department.toLowerCase(),
        category: effectiveCategory,
        price: parseFloat(price),
        sale_price: salePrice.trim() ? parseFloat(salePrice) : null,
        fabric: fabric.trim() || null,
        fit: fit.trim() || null,
        status,
        is_featured: isFeatured,
        size_configs: sizeConfigs.map((sc) => ({
          size: sc.size.trim(),
          colors: sc.colors.map(normalizeColorName),
          sku: sc.sku.trim() || null,
          total_stock: Math.max(0, parseInt(sc.total_stock.toString(), 10) || 0),
          is_available: sc.is_available,
        })),
        variants: (() => {
          const expanded: {
            size: string;
            color: string;
            sku: string | null;
            stock_quantity: number;
            is_available: boolean;
          }[] = [];

          sizeConfigs.forEach((cfg) => {
            const cleanSize = cfg.size.trim();
            const alloc = getStockAllocation(cfg);
            cfg.colors.forEach((col) => {
              const cleanCol = normalizeColorName(col);
              if (!cleanSize || !cleanCol) return;

              const finalSku = generateVariantSku(cfg.sku, cleanSize, cleanCol);

              expanded.push({
                size: cleanSize,
                color: cleanCol,
                sku: finalSku,
                stock_quantity: alloc.stockPerColor,
                is_available: cfg.is_available,
              });
            });
          });

          return expanded;
        })(),
        images: finalImagePayload,
      };

      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server responded with status ${response.status}`);
      }

      // Step 3: Success!
      setCreatedProduct({
        product: result.product,
        variants: result.variants || [],
        images: result.images || [],
      });
      setProgressState(null);
    } catch (err: unknown) {
      console.error("[add-product] Submission failed:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred during submission.";
      setErrorMessage(message);
      setProgressState(null);

      // Rollback orphaned uploaded R2 keys if product was not created
      if (uploadedR2Keys.length > 0) {
        console.warn("[add-product] Cleaning up orphaned R2 objects:", uploadedR2Keys);
        try {
          const client = getSupabaseClient();
          const { data: sData } = await client.auth.getSession();
          await fetch("/api/admin/products/rollback-images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(sData.session?.access_token ? { Authorization: `Bearer ${sData.session.access_token}` } : {}),
            },
            body: JSON.stringify({ keys: uploadedR2Keys }),
          });
        } catch (cleanupErr) {
          console.error("[add-product] Warning: failed cleaning up orphaned R2 images:", cleanupErr);
        }
      }
    } finally {
      setIsSubmitting(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancelUpload() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setProgressState((prev) => (prev ? { ...prev, stage: "Cancelled" } : null));
      setIsSubmitting(false);
    }
  }

  function handleResetForm() {
    setName("");
    setDescription("");
    setDepartment("Women");
    setCategory("Jackets");
    setCustomCategory("");
    setPrice("");
    setSalePrice("");
    setFabric("");
    setFit("");
    setSizeConfigs([
      {
        id: `sc-${Date.now()}-1`,
        size: "M",
        colors: ["Black"],
        sku: "",
        total_stock: 6,
        is_available: true,
      },
    ]);
    selectedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setSelectedImages([]);
    setStatus("draft");
    setIsFeatured(false);
    setErrorMessage(null);
    setFieldErrors({});
    setCreatedProduct(null);
    setProgressState(null);
  }

  // --- Auth Guard State ---
  if (checkingAuth) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-500 text-xs">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#781d29] rounded-full animate-spin" />
          <span>Verifying administrator permissions...</span>
        </div>
      </div>
    );
  }

  if (!authStatus.isAuthenticated || !authStatus.isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-neutral-200 rounded-xl shadow-xs space-y-4 text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-lg font-bold">
          !
        </div>
        <h1 className="text-base font-semibold text-neutral-900">Administrator Access Required</h1>
        <p className="text-xs text-neutral-600 leading-relaxed">
          {authStatus.isAuthenticated
            ? "Your current account is authenticated but does not possess store administrator role privileges."
            : "You must be signed in with an authorized administrator account to manage store products."}
        </p>
        <Link
          href="/admin/login"
          className="inline-block px-4 py-2 bg-[#781d29] text-white rounded-lg text-xs font-semibold hover:bg-[#5c151e] transition-colors"
        >
          Sign In as Administrator
        </Link>
      </div>
    );
  }

  // --- Success State Screen ---
  if (createdProduct) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center text-lg font-bold shrink-0 border border-emerald-200">
              ✓
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Product Successfully Published</h1>
              <p className="text-xs text-neutral-600 mt-0.5">
                Saved to Supabase and image assets synchronized with Cloudflare R2.
              </p>
            </div>
          </div>

          <div className="border border-neutral-100 bg-[#faf9f6] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Product Name</span>
              <span className="font-semibold text-neutral-900 mt-0.5 block">{createdProduct.product.name}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Generated Slug</span>
              <span className="font-mono text-neutral-700 mt-0.5 block">/{createdProduct.product.slug}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Price</span>
              <span className="font-semibold text-neutral-900 mt-0.5 block">₹{createdProduct.product.price.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Status</span>
              <span className="capitalize font-semibold text-emerald-700 mt-0.5 block">{createdProduct.product.status}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Department</span>
              <span className="capitalize text-neutral-800 mt-0.5 block">{createdProduct.product.department}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Category</span>
              <span className="text-neutral-800 mt-0.5 block">{createdProduct.product.category}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Variants</span>
              <span className="text-neutral-800 mt-0.5 block">{createdProduct.variants.length} option(s)</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Media Assets</span>
              <span className="text-neutral-800 mt-0.5 block">{createdProduct.images.length} image(s)</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-5 py-2.5 bg-[#781d29] text-white rounded-lg text-xs font-semibold hover:bg-[#5c151e] transition-colors cursor-pointer"
            >
              + Create Another Product
            </button>
            <Link
              href={`/product/${createdProduct.product.slug}`}
              className="px-5 py-2.5 border border-neutral-300 text-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 transition-colors"
            >
              View on Storefront →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Add Product Form ---
  return (
    <div className="min-h-screen bg-[#f8f5f0] py-6 sm:py-10 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Unified Admin Product Navigation Bar */}
        <AdminProductNav
          current="single"
          title="Add New Product"
          subtitle="Configure product details, select valid sizes and colors under inventory variants, and upload high-resolution images. A clean URL slug is generated automatically."
          extraActions={
            <div className="flex items-center gap-2">
              <Link
                href="/admin/products"
                className="px-3.5 py-2 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors shadow-xs"
              >
                ← Back to Catalogue
              </Link>
              <Link
                href="/admin/products/bulk"
                className="px-3.5 py-2 bg-[#702b38] hover:bg-[#57202b] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                + Bulk Upload
              </Link>
            </div>
          }
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 space-y-1 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <span className="text-rose-600">✕</span>
              <span>Submission Error</span>
            </div>
            <p className="leading-relaxed pl-4">{errorMessage}</p>
          </div>
        )}

        {/* Upload Progress Bar (Visible during compression & upload) */}
        {isSubmitting && progressState && (
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-800">
              <span className="flex items-center gap-2">
                <span className="inline-block w-3.5 h-3.5 border-2 border-neutral-400 border-t-[#702b38] rounded-full animate-spin" />
                <span className="font-semibold text-neutral-900">{progressState.stage}...</span>
              </span>
              <span className="font-mono text-neutral-700 font-bold">{progressState.overallPercent}%</span>
            </div>

            <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#702b38] h-2 rounded-full transition-all duration-200"
                style={{ width: `${progressState.overallPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-500">
              <span className="truncate max-w-[280px]">
                {progressState.currentFileName ? `Processing: ${progressState.currentFileName}` : "Preparing upload pipeline"}
              </span>
              <span className="shrink-0">
                {progressState.processedCount} of {progressState.totalCount} assets completed
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <section className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
              <span className="w-6 h-6 rounded-full bg-[#702b38]/10 text-[#702b38] font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                  Basic Information
                </h2>
                <p className="text-[11px] text-neutral-500">
                  General merchandise details. The storefront URL slug is generated automatically from the title.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Product Name (Full Width) */}
              <div>
                <label htmlFor="product-name" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="product-name"
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Relaxed Wool Overshirt"
                  className={`w-full text-xs px-3.5 py-2.5 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#702b38] bg-white transition-colors ${
                    fieldErrors.name ? "border-rose-400 bg-rose-50/20" : "border-neutral-300"
                  }`}
                />
                {fieldErrors.name ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.name}</p>
                ) : (
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Customer-facing title. A unique, search-friendly URL slug is created automatically.
                  </p>
                )}
              </div>

              {/* Department & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-department" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="product-department"
                    disabled={isSubmitting}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as "Men" | "Women" | "Kids")}
                    className="w-full text-xs px-3.5 py-2.5 border border-neutral-300 rounded-xl bg-white text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-[#702b38] cursor-pointer"
                  >
                    <option value="Women">Women</option>
                    <option value="Men">Men</option>
                    <option value="Kids">Kids</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="product-category" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="product-category"
                    disabled={isSubmitting}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-neutral-300 rounded-xl bg-white text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-[#702b38] cursor-pointer"
                  >
                    {STANDARD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="custom">+ Custom Category</option>
                  </select>
                </div>
              </div>

              {category === "custom" && (
                <div>
                  <label htmlFor="custom-category" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    Custom Category Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="custom-category"
                    type="text"
                    disabled={isSubmitting}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="e.g. Loungewear"
                    className="w-full text-xs px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#702b38] bg-white"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label htmlFor="product-description" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Description <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="product-description"
                  rows={3}
                  disabled={isSubmitting}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Garment silhouette, drape, versatility, styling suggestions..."
                  className="w-full text-xs px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#702b38] bg-white leading-relaxed"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Pricing */}
          <section className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
              <span className="w-6 h-6 rounded-full bg-[#702b38]/10 text-[#702b38] font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                  Pricing
                </h2>
                <p className="text-[11px] text-neutral-500">
                  Set standard retail price and optional promotional sale price in Indian Rupees.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="product-price" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Regular Price <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-semibold text-neutral-400 pointer-events-none">
                    ₹
                  </span>
                  <input
                    id="product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    disabled={isSubmitting}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1499"
                    className={`w-full text-xs pl-8 pr-3.5 py-2.5 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#702b38] bg-white transition-colors ${
                      fieldErrors.price ? "border-rose-400 bg-rose-50/20" : "border-neutral-300"
                    }`}
                  />
                </div>
                {fieldErrors.price && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.price}</p>}
              </div>

              <div>
                <label htmlFor="product-sale-price" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Sale Price <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-semibold text-neutral-400 pointer-events-none">
                    ₹
                  </span>
                  <input
                    id="product-sale-price"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isSubmitting}
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="Leave blank if not on sale"
                    className={`w-full text-xs pl-8 pr-3.5 py-2.5 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#702b38] bg-white transition-colors ${
                      fieldErrors.salePrice ? "border-rose-400 bg-rose-50/20" : "border-neutral-300"
                    }`}
                  />
                </div>
                {fieldErrors.salePrice && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.salePrice}</p>}
              </div>
            </div>
          </section>

          {/* Section 3: Garment Specifications */}
          <section className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
              <span className="w-6 h-6 rounded-full bg-[#702b38]/10 text-[#702b38] font-bold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                  Garment Specifications
                </h2>
                <p className="text-[11px] text-neutral-500">
                  Fabric composition and silhouette details displayed on customer storefront accordions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="product-fabric" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Fabric / Material <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="product-fabric"
                  type="text"
                  disabled={isSubmitting}
                  value={fabric}
                  onChange={(e) => setFabric(e.target.value)}
                  placeholder="e.g. 100% Organic Cotton, Heavyweight Linen"
                  className="w-full text-xs px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#702b38] bg-white"
                />
              </div>

              <div>
                <label htmlFor="product-fit" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Fit Profile <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="product-fit"
                  type="text"
                  disabled={isSubmitting}
                  value={fit}
                  onChange={(e) => setFit(e.target.value)}
                  placeholder="e.g. Relaxed Fit, Boxy Silhouette, True to Size"
                  className="w-full text-xs px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#702b38] bg-white"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Variants & Inventory */}
          <section className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 gap-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#702b38]/10 text-[#702b38] font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                    Variants &amp; Inventory
                  </h2>
                  <p className="text-[11px] text-neutral-500">
                    Configure sizes and select multi-select colors. The entered <strong>Total Stock Qty</strong> is divided evenly among the selected colors for each size.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addSizeConfig}
                disabled={isSubmitting}
                className="self-start sm:self-center px-4 py-2 bg-[#702b38] hover:bg-[#57202b] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5"
              >
                <span>+</span> Add Size Configuration
              </button>
            </div>

            {/* Duplicate Combination Warning */}
            {duplicateCombinations.length > 0 && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2 shadow-xs">
                <span className="text-rose-600 font-bold shrink-0">!</span>
                <p className="leading-relaxed">
                  Duplicate variant combination detected: <strong>{duplicateCombinations.join(", ")}</strong>. Each size &amp; color combination must be unique.
                </p>
              </div>
            )}

            {/* Field Error / Indivisibility Alert */}
            {fieldErrors.variants && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2 shadow-xs">
                <span className="text-rose-600 font-bold shrink-0">!</span>
                <p className="leading-relaxed">{fieldErrors.variants}</p>
              </div>
            )}

            {/* Desktop Table Column Headers (hidden on mobile/tablet) */}
            <div className="hidden lg:grid lg:grid-cols-[28px_140px_1fr_150px_140px_90px_36px] items-center gap-3 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              <span>#</span>
              <span>Size <span className="text-rose-500">*</span></span>
              <span>Colors (Multi-Select) <span className="text-rose-500">*</span></span>
              <span>SKU Prefix <span className="text-neutral-400 font-normal">(Opt)</span></span>
              <span>Total Stock <span className="text-rose-500">*</span></span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>

            {/* Size Configuration Rows */}
            <div className="space-y-4">
              {sizeConfigs.map((cfg, idx) => {
                const alloc = getStockAllocation(cfg);
                const hasDuplicate = cfg.colors.some((c) =>
                  duplicateCombinations.includes(`${cfg.size} / ${normalizeColorName(c)}`)
                );
                const stockError = fieldErrors[`sizeConfig_${idx}_stock`];

                return (
                  <div
                    key={cfg.id}
                    className={`border rounded-xl p-3.5 transition-all space-y-3 ${
                      !alloc.isValid || hasDuplicate || stockError
                        ? "border-rose-300 bg-rose-50/20"
                        : "border-neutral-200/90 bg-[#faf9f6] hover:border-neutral-300"
                    }`}
                  >
                    {/* Desktop View (lg and above) */}
                    <div className="hidden lg:grid lg:grid-cols-[28px_140px_1fr_150px_140px_90px_36px] items-start gap-3">
                      <span className="font-mono text-neutral-400 text-xs font-bold text-center pt-2">
                        {idx + 1}
                      </span>

                      {/* Size Select Dropdown */}
                      <div>
                        {cfg.isCustomSize ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              disabled={isSubmitting}
                              value={cfg.size}
                              onChange={(e) => updateSizeConfig(cfg.id, "size", e.target.value)}
                              placeholder="Custom size"
                              className="w-full text-xs px-2.5 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#702b38]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateSizeConfig(cfg.id, "size", "M");
                                updateSizeConfig(cfg.id, "isCustomSize", false);
                              }}
                              title="Switch back to dropdown list"
                              className="px-1.5 py-2 text-[10px] text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-100 transition-colors shrink-0"
                            >
                              List
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              disabled={isSubmitting}
                              value={cfg.size}
                              onChange={(e) => {
                                if (e.target.value === "__custom__") {
                                  updateSizeConfig(cfg.id, "size", "");
                                  updateSizeConfig(cfg.id, "isCustomSize", true);
                                } else {
                                  updateSizeConfig(cfg.id, "size", e.target.value);
                                  updateSizeConfig(cfg.id, "isCustomSize", false);
                                }
                              }}
                              className="w-full text-xs px-3 py-2 pr-7 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-[#702b38] focus:border-[#702b38] appearance-none cursor-pointer font-medium"
                            >
                              <optgroup label="Standard Sizes">
                                {CLOTHING_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Waist / Pants">
                                {WAIST_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Other">
                                {OTHER_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </optgroup>
                              {cfg.size && !ALL_SUGGESTED_SIZES.includes(cfg.size) && (
                                <option value={cfg.size}>{cfg.size} (Custom)</option>
                              )}
                              <option value="__custom__">+ Custom Size...</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Multi-Select Colors Component */}
                      <div>
                        <ColorMultiSelect
                          selectedColors={cfg.colors}
                          onChange={(colors) => handleColorsChange(cfg.id, colors)}
                          disabled={isSubmitting}
                          hasError={cfg.colors.length === 0}
                        />
                        <p className="text-[10px] text-neutral-400 mt-1">
                          {cfg.colors.length === 0
                            ? "⚠️ Select at least one color"
                            : `Selected ${cfg.colors.length} color${cfg.colors.length > 1 ? "s" : ""}`}
                        </p>
                      </div>

                      {/* SKU Prefix */}
                      <div>
                        <input
                          type="text"
                          disabled={isSubmitting}
                          value={cfg.sku}
                          onChange={(e) => updateSizeConfig(cfg.id, "sku", e.target.value)}
                          placeholder="e.g. JNS"
                          className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg bg-white font-mono text-[11px] text-neutral-800"
                        />
                        <p className="text-[10px] text-neutral-400 mt-1">Auto-suffixed</p>
                      </div>

                      {/* Total Stock Quantity & Allocation Preview */}
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isSubmitting}
                          value={cfg.total_stock}
                          onChange={(e) =>
                            updateSizeConfig(
                              cfg.id,
                              "total_stock",
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className={`w-full text-xs px-3 py-2 border rounded-lg bg-white text-center font-medium ${
                            !alloc.isValid
                              ? "border-rose-300 focus:ring-rose-400"
                              : "border-neutral-300 focus:ring-[#702b38]"
                          }`}
                        />
                        <div
                          className={`text-[10px] rounded px-1.5 py-0.5 mt-1 font-medium leading-tight text-center ${
                            !alloc.isValid
                              ? "text-rose-700 bg-rose-50 border border-rose-200"
                              : "text-emerald-700 bg-emerald-50 border border-emerald-200"
                          }`}
                        >
                          {alloc.message}
                        </div>
                      </div>

                      {/* Status Toggle */}
                      <div className="flex items-center justify-center pt-2">
                        <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isSubmitting}
                            checked={cfg.is_available}
                            onChange={(e) => updateSizeConfig(cfg.id, "is_available", e.target.checked)}
                            className="rounded border-neutral-300 text-[#702b38] focus:ring-[#702b38]"
                          />
                          <span className="text-[11px] font-medium">{cfg.is_available ? "In Stock" : "Inactive"}</span>
                        </label>
                      </div>

                      {/* Remove Button */}
                      <div className="flex justify-end pt-1.5">
                        <button
                          type="button"
                          onClick={() => removeSizeConfig(cfg.id)}
                          disabled={isSubmitting || sizeConfigs.length <= 1}
                          title="Remove size configuration"
                          className="p-1.5 text-neutral-400 hover:text-rose-600 disabled:opacity-30 transition-colors cursor-pointer rounded-lg hover:bg-white"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Mobile & Tablet Card View (< lg) */}
                    <div className="lg:hidden space-y-3.5">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-200/70">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-700 bg-neutral-200/60 px-2 py-0.5 rounded-md">
                            Configuration #{idx + 1}
                          </span>
                          {hasDuplicate && (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-100/80 px-2 py-0.5 rounded">
                              Duplicate
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeSizeConfig(cfg.id)}
                          disabled={isSubmitting || sizeConfigs.length <= 1}
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 font-semibold cursor-pointer"
                        >
                          ✕ Remove
                        </button>
                      </div>

                      {/* Size Input */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          Size <span className="text-rose-500">*</span>
                        </label>
                        {cfg.isCustomSize ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              disabled={isSubmitting}
                              value={cfg.size}
                              onChange={(e) => updateSizeConfig(cfg.id, "size", e.target.value)}
                              placeholder="Custom size"
                              className="w-full text-xs px-3 py-2.5 border border-neutral-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#702b38]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateSizeConfig(cfg.id, "size", "M");
                                updateSizeConfig(cfg.id, "isCustomSize", false);
                              }}
                              className="px-2 py-2.5 text-[10px] text-neutral-600 border border-neutral-300 rounded-lg bg-white"
                            >
                              List
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              disabled={isSubmitting}
                              value={cfg.size}
                              onChange={(e) => {
                                if (e.target.value === "__custom__") {
                                  updateSizeConfig(cfg.id, "size", "");
                                  updateSizeConfig(cfg.id, "isCustomSize", true);
                                } else {
                                  updateSizeConfig(cfg.id, "size", e.target.value);
                                  updateSizeConfig(cfg.id, "isCustomSize", false);
                                }
                              }}
                              className="w-full text-xs px-3.5 py-2.5 pr-8 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-[#702b38] appearance-none cursor-pointer"
                            >
                              <optgroup label="Standard Sizes">
                                {CLOTHING_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Waist / Pants">
                                {WAIST_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Other">
                                {OTHER_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </optgroup>
                              {cfg.size && !ALL_SUGGESTED_SIZES.includes(cfg.size) && (
                                <option value={cfg.size}>{cfg.size} (Custom)</option>
                              )}
                              <option value="__custom__">+ Custom Size...</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-400">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Multi-Select Colors */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          Colors (Multi-Select) <span className="text-rose-500">*</span>
                        </label>
                        <ColorMultiSelect
                          selectedColors={cfg.colors}
                          onChange={(colors) => handleColorsChange(cfg.id, colors)}
                          disabled={isSubmitting}
                          hasError={cfg.colors.length === 0}
                        />
                      </div>

                      {/* Total Stock Quantity & Status */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Total Stock Qty <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            disabled={isSubmitting}
                            value={cfg.total_stock}
                            onChange={(e) =>
                              updateSizeConfig(
                                cfg.id,
                                "total_stock",
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className={`w-full text-xs px-3 py-2.5 border rounded-lg bg-white ${
                              !alloc.isValid
                                ? "border-rose-300 focus:ring-rose-400"
                                : "border-neutral-300"
                            }`}
                          />
                          <p className="text-[10px] text-neutral-500 mt-1">
                            Total quantity shared evenly across the selected colors.
                          </p>
                          <div
                            className={`text-[10px] rounded px-2 py-1 mt-1 font-medium leading-tight ${
                              !alloc.isValid
                                ? "text-rose-700 bg-rose-50 border border-rose-200"
                                : "text-emerald-700 bg-emerald-50 border border-emerald-200"
                            }`}
                          >
                            {alloc.message}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            SKU Prefix <span className="text-neutral-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            disabled={isSubmitting}
                            value={cfg.sku}
                            onChange={(e) => updateSizeConfig(cfg.id, "sku", e.target.value)}
                            placeholder="e.g. JNS"
                            className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg bg-white font-mono text-[11px]"
                          />
                          <div className="pt-3">
                            <label className="inline-flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={isSubmitting}
                                checked={cfg.is_available}
                                onChange={(e) => updateSizeConfig(cfg.id, "is_available", e.target.checked)}
                                className="rounded border-neutral-300 text-[#702b38] focus:ring-[#702b38] w-4 h-4"
                              />
                              <span className="font-semibold text-xs">{cfg.is_available ? "In Stock" : "Inactive"}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resulting Variants Allocation Preview Banner */}
                    {cfg.colors.length > 0 && (
                      <div className="pt-2.5 border-t border-neutral-200/70 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          <span>
                            Resulting Variants for size {cfg.size || "(Unspecified)"} ({cfg.colors.length}):
                          </span>
                          {alloc.isValid && (
                            <span className="text-emerald-700 normal-case font-medium">
                              {alloc.stockPerColor} unit{alloc.stockPerColor !== 1 ? "s" : ""} each
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {cfg.colors.map((color) => {
                            const cleanCol = normalizeColorName(color);
                            const sku = generateVariantSku(cfg.sku, cfg.size, cleanCol);
                            const isIndivisible = !alloc.isValid;

                            return (
                              <span
                                key={color}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium shadow-2xs transition-colors ${
                                  isIndivisible
                                    ? "bg-rose-50 border-rose-200 text-rose-800"
                                    : "bg-white border-neutral-200 text-neutral-800"
                                }`}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: resolveColorHex(cleanCol) }}
                                />
                                <span>
                                  <strong>{cfg.size || "Size"}</strong> / {cleanCol}:{" "}
                                  <span className={alloc.isValid ? "text-[#702b38] font-bold" : "text-rose-600 font-bold"}>
                                    {alloc.isValid ? `${alloc.stockPerColor} unit${alloc.stockPerColor !== 1 ? "s" : ""}` : "Indivisible"}
                                  </span>
                                </span>
                                {sku && (
                                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded">
                                    {sku}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 5: Product Images */}
          <section className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 gap-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#702b38]/10 text-[#702b38] font-bold text-xs flex items-center justify-center shrink-0">
                  5
                </span>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                    Product Images
                  </h2>
                  <p className="text-[11px] text-neutral-500">
                    High-resolution imagery. Assets are compressed in-browser and uploaded to Cloudflare R2 storage.
                  </p>
                </div>
              </div>

              {/* Concurrency Selector */}
              <div className="flex items-center gap-2 self-start sm:self-auto bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded-xl text-xs">
                <label htmlFor="concurrency-select" className="text-neutral-600 font-medium whitespace-nowrap text-[11px]">
                  Concurrency:
                </label>
                <select
                  id="concurrency-select"
                  disabled={isSubmitting}
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 3)}
                  className="bg-white border border-neutral-300 rounded-lg px-2 py-0.5 text-xs font-semibold text-neutral-800 cursor-pointer"
                >
                  <option value={1}>1 (Sequential)</option>
                  <option value={2}>2 Concurrent</option>
                  <option value={3}>3 (Recommended)</option>
                  <option value={4}>4 Concurrent</option>
                </select>
              </div>
            </div>

            {/* Upload Area / Dropzone */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={isSubmitting}
                onChange={handleFilesSelected}
                className="hidden"
                id="image-file-input"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 hover:border-[#702b38] rounded-2xl p-6 sm:p-8 text-center bg-[#faf9f6] hover:bg-[#faf5f5] transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs border border-neutral-200 group-hover:border-[#702b38]/30 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 text-neutral-500 group-hover:text-[#702b38] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-neutral-800">
                  Click or tap to upload product images
                </p>
                <p className="text-[11px] text-neutral-500 mt-1 max-w-md mx-auto">
                  Supports JPEG, PNG, WebP, or AVIF up to 35 MB each. Automatically compressed in-browser before upload.
                </p>
                <button
                  type="button"
                  disabled={isSubmitting}
                  className="mt-3 px-4 py-1.5 bg-neutral-900 group-hover:bg-[#702b38] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  Select Media Files
                </button>
              </div>
            </div>

            {/* Previews Grid */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {selectedImages.map((img, index) => (
                  <div
                    key={img.id}
                    className={`border rounded-xl p-3 bg-white space-y-3 relative transition-all shadow-xs ${
                      img.isPrimary ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-neutral-200"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-48 bg-[#faf9f6] rounded-lg overflow-hidden flex items-center justify-center border border-neutral-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt="Thumbnail preview"
                        className="max-h-full max-w-full object-contain"
                      />
                      {img.isPrimary && (
                        <span className="absolute top-2 left-2 bg-emerald-700 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded shadow-xs">
                          Primary Image
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] space-y-2.5">
                      <div className="flex items-center justify-between text-neutral-500">
                        <span className="font-mono text-[10px] truncate max-w-[140px]" title={img.file.name}>
                          {img.file.name}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {(img.file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>

                      {/* Primary Radio & Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-700 cursor-pointer">
                          <input
                            type="radio"
                            name="primary_image_selection"
                            checked={img.isPrimary}
                            disabled={isSubmitting}
                            onChange={() => setPrimaryImage(img.id)}
                            className="text-[#702b38] focus:ring-[#702b38]"
                          />
                          <span>{img.isPrimary ? "Primary" : "Set as Primary"}</span>
                        </label>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveImage(index, "up")}
                            disabled={isSubmitting || index === 0}
                            title="Move earlier"
                            className="px-2 py-0.5 border border-neutral-200 rounded text-[10px] hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(index, "down")}
                            disabled={isSubmitting || index === selectedImages.length - 1}
                            title="Move later"
                            className="px-2 py-0.5 border border-neutral-200 rounded text-[10px] hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          >
                            →
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            disabled={isSubmitting}
                            className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold underline ml-1 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Alt Text (Full width, no Color Tag) */}
                      <div>
                        <label className="block text-[9px] uppercase font-bold tracking-wider text-neutral-500 mb-0.5">
                          Alt Text (Description for SEO &amp; Accessibility)
                        </label>
                        <input
                          type="text"
                          disabled={isSubmitting}
                          value={img.altText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedImages((prev) =>
                              prev.map((item) => (item.id === img.id ? { ...item, altText: val } : item))
                            );
                          }}
                          placeholder={`e.g. Front view of ${name || "garment"}`}
                          className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-[#702b38]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 6: Visibility & Publishing */}
          <section className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
              <span className="w-6 h-6 rounded-full bg-[#702b38]/10 text-[#702b38] font-bold text-xs flex items-center justify-center shrink-0">
                6
              </span>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                  Visibility &amp; Publishing
                </h2>
                <p className="text-[11px] text-neutral-500">
                  Control whether the product is published immediately or saved as a draft.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "draft", title: "Draft", desc: "Saved in database, hidden from customer storefront" },
                { id: "published", title: "Published", desc: "Live immediately on customer storefront" },
                { id: "archived", title: "Archived", desc: "Archived in database, hidden from customer view" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`border rounded-xl p-4 cursor-pointer transition-all flex flex-col justify-between ${
                    status === opt.id
                      ? "border-[#702b38] bg-[#702b38]/5 ring-1 ring-[#702b38]"
                      : "border-neutral-200 bg-[#faf9f6] hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-neutral-900">{opt.title}</span>
                    <input
                      type="radio"
                      name="product_status"
                      value={opt.id}
                      checked={status === opt.id}
                      disabled={isSubmitting}
                      onChange={() => setStatus(opt.id as "draft" | "published" | "archived")}
                      className="text-[#702b38] focus:ring-[#702b38]"
                    />
                  </div>
                  <span className="text-[11px] text-neutral-500 leading-snug">{opt.desc}</span>
                </label>
              ))}
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-800">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  disabled={isSubmitting}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded border-neutral-300 text-[#702b38] focus:ring-[#702b38] w-4 h-4"
                />
                <span>Feature this product in homepage showcases</span>
              </label>
            </div>
          </section>

          {/* Action Buttons Bar */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/admin/products"
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              ← Cancel &amp; Return to Catalogue
            </Link>

            <div className="flex items-center gap-3">
              {isSubmitting && (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-xl text-xs font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Cancel Upload
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-[#702b38] hover:bg-[#57202b] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md hover:shadow-lg flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing &amp; Publishing...</span>
                  </>
                ) : (
                  <span>Publish Product</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
