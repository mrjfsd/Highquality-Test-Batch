"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { verifyAdminAuthorization } from "@/lib/supabase/auth";
import { compressImageForUpload, uploadToR2WithProgress } from "@/lib/images/client-compression";

export type Page = "overview" | "intake" | "catalogue" | "editor" | "media";
export type ProductStatus = "Published" | "Draft" | "Review" | "Archived";

export interface LiveProductImage {
  id?: string;
  storage_path: string;
  is_primary?: boolean;
  display_order?: number;
  alt_text?: string | null;
  width?: number | null;
  height?: number | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
}

export interface LiveProductVariant {
  id?: string;
  size: string;
  color: string;
  sku?: string | null;
  stock_quantity: number;
  is_available: boolean;
}

export interface LiveProduct {
  id: string;
  name: string;
  slug: string;
  department: string;
  category: string;
  price: number;
  sale_price?: number | null;
  fabric?: string | null;
  fit?: string | null;
  description?: string | null;
  status: "published" | "draft" | "archived" | string;
  primaryImage?: string | null;
  imageCount?: number;
  variantCount?: number;
  variantsSummary?: Array<{ size: string; color: string; is_available: boolean; stock_quantity: number }>;
  created_at: string;
  updated_at: string;
  product_images?: LiveProductImage[];
  product_variants?: LiveProductVariant[];
}

export interface IntakePhoto {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  previewUrl: string;
  storagePath?: string;
  state: "Uploaded" | "Uploading" | "Failed";
  uploadProgress?: number;
  error?: string;
  assignedGroup?: string;
}

export interface GarmentGroup {
  id: string;
  name: string;
  department: string;
  category: string;
  price: string;
  salePrice?: string;
  fabric?: string;
  fit?: string;
  description?: string;
  status: "Draft" | "Published";
  photoIds: string[];
  primaryPhotoId?: string;
  savedProductId?: string;
  error?: string;
  variants: Array<{ size: string; color: string; sku: string; qty: string; is_available?: boolean }>;
}

export interface IntakeSession {
  batchId: string;
  createdAt: string;
  updatedAt: string;
  photos: IntakePhoto[];
  groups: GarmentGroup[];
}

export interface LiveImageAsset {
  id: string;
  storagePath: string;
  proxyUrl: string;
  name: string;
  altText?: string | null;
  displayOrder?: number;
  isPrimary?: boolean;
  fileSizeBytes: number;
  size: string;
  dimensions: string;
  mimeType: string;
  createdAt: string;
  assigned: boolean;
  product?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    department: string;
    category: string;
    price: number;
  } | null;
}

const INTAKE_STORAGE_KEY = "style_edit_intake_session_v2";
const INTAKE_REVIEW_KEY = "style_edit_intake_review_v2";

export interface ReviewGarmentItem {
  id: string;
  name: string;
  department: string;
  category: string;
  price: string;
  salePrice?: string;
  fabric?: string;
  fit?: string;
  description?: string;
  status: "Draft" | "Published";
  primaryPhotoUrl?: string;
  photoCount: number;
  photoStoragePaths: string[];
  savedProductId?: string;
  variants: Array<{ size: string; color: string; sku: string; qty: string; is_available?: boolean }>;
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let token: string | undefined;
  try {
    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    token = data.session?.access_token;
  } catch (err) {
    console.warn("Could not retrieve Supabase session token:", err);
  }

  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, {
    ...init,
    headers,
    credentials: "same-origin",
  });
}

export function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return "recently";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "recently";
  }
}

export function formatUpdatedDate(dateStr: string): string {
  if (!dateStr) return "Recently";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Today, ${timeStr}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return `Yesterday, ${timeStr}`;

    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "Recently";
  }
}

export const nav: { id: Page; label: string; icon: string }[] = [
  { id: "overview", label: "Dashboard", icon: "grid" },
  { id: "intake", label: "Add Clothes", icon: "upload" },
  { id: "catalogue", label: "All Clothes", icon: "list" },
  { id: "editor", label: "Edit Garment", icon: "edit" },
];

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m0 0L7 9m5-5 5 5" />
        <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.64 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.36 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18M6 6l12 12" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M12 9v4m0 4h.01" />
        <path d="M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </>
    ),
    drag: (
      <>
        <path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5" />
      </>
    ),
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8Z" />,
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}

export function Button({
  children,
  variant = "secondary",
  icon,
  onClick,
  disabled,
  type = "button",
  style,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "text";
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type={type}
      className={`button button-${variant}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label={ariaLabel}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function Status({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "dark" | "outline" | "error";
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  const isOptional = label.toLowerCase().includes("(optional)");
  const cleanLabel = isOptional ? label.replace(/\s*\(\s*optional\s*\)/i, "").trim() : label;

  return (
    <label className="field">
      <span className="field-label">
        {cleanLabel}
        {required && <b className="field-required"> *</b>}
        {isOptional && <span className="field-optional"> (optional)</span>}
      </span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

export function ProductThumb({
  src,
  alt,
  type = "shirt",
  label,
  large = false,
}: {
  src?: string | null;
  alt?: string;
  type?: string;
  label?: string;
  large?: boolean;
}) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (src && !error) {
    return (
      <div className={`product-thumb ${large ? "thumb-large" : ""}`} style={{ padding: 0 }}>
        <img
          src={src}
          alt={alt || label || "Garment thumbnail"}
          onError={() => setError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div className={`product-thumb ${large ? "thumb-large" : ""}`}>
      <Icon name="image" size={large ? 30 : 18} />
      <span>{label || type}</span>
    </div>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast">
      <span className="toast-icon">
        <Icon name="check" size={15} />
      </span>
      <div>
        <strong>Changes saved</strong>
        <p>{message}</p>
      </div>
      <button aria-label="Close notification" onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

export function Sidebar({
  page,
  setPage,
  collapsed = false,
  setCollapsed,
  mobileOpen = false,
  setMobileOpen,
}: {
  page: Page;
  setPage: (page: Page) => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const [adminEmail, setAdminEmail] = useState("Store Admin");
  const [adminInitials, setAdminInitials] = useState("SE");

  useEffect(() => {
    verifyAdminAuthorization().then((res) => {
      if (res.user?.email) {
        setAdminEmail(res.user.email);
        setAdminInitials(res.user.email.slice(0, 2).toUpperCase());
      }
    });
  }, []);

  const handleNav = (target: Page) => {
    setPage(target);
    setMobileOpen?.(false);
  };

  const handleSignOut = async () => {
    try {
      const client = getSupabaseClient();
      await client.auth.signOut();
      window.location.href = "/admin/login";
    } catch {
      window.location.href = "/admin/login";
    }
  };

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "open" : ""}`}
      aria-label="Admin Navigation"
    >
      <div className="sidebar-header">
        {!collapsed ? (
          <button
            className="wordmark"
            onClick={() => handleNav("overview")}
            aria-label="Style-Edit Admin Home"
          >
            STYLE · EDIT
          </button>
        ) : (
          <button
            className="wordmark-compact"
            onClick={() => handleNav("overview")}
            title="Style-Edit Admin Home"
            aria-label="Style-Edit Admin Home"
          >
            SE
          </button>
        )}

        {setCollapsed && (
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={16} />
          </button>
        )}

        {setMobileOpen && (
          <button
            className="sidebar-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            title="Close navigation"
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <nav aria-label="Main navigation">
        {nav.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""} ${collapsed ? "compact" : ""}`}
            onClick={() => handleNav(item.id)}
            title={collapsed ? item.label : undefined}
            type="button"
          >
            <Icon name={item.icon} size={18} />
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.id === "editor" && <span className="context-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="admin-avatar" title={`${adminEmail} (Store admin)`}>
          {adminInitials}
        </div>
        {!collapsed && (
          <div className="admin-meta">
            <strong title={adminEmail} style={{ maxWidth: "125px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {adminEmail.split("@")[0]}
            </strong>
            <span>Store admin</span>
          </div>
        )}
        {!collapsed && (
          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            type="button"
            onClick={handleSignOut}
          >
            <Icon name="logout" size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}

export function Overview({
  products,
  intakeSession,
  navigate,
}: {
  products: LiveProduct[];
  intakeSession: IntakeSession | null;
  navigate: (page: Page, pId?: string) => void;
}) {
  const totalCount = products.length;
  const draftCount = products.filter((p) => p.status?.toLowerCase() === "draft").length;
  const publishedCount = products.filter((p) => p.status?.toLowerCase() === "published").length;
  const unassignedIntakePhotosCount = intakeSession
    ? intakeSession.photos.filter((p) => !p.assignedGroup).length
    : 0;

  const summaries = [
    [
      "Total Garments",
      String(totalCount),
      totalCount === 0 ? "No garments yet" : `${publishedCount} published`,
    ],
    [
      "Drafts to Finish",
      String(draftCount),
      draftCount === 0 ? "No active drafts" : `${draftCount} draft${draftCount > 1 ? "s" : ""} in progress`,
    ],
    [
      "Published Clothes",
      String(publishedCount),
      totalCount > 0 ? `${((publishedCount / totalCount) * 100).toFixed(1)}% of total` : "0% of total",
    ],
    [
      "Photos Not Assigned",
      String(unassignedIntakePhotosCount),
      unassignedIntakePhotosCount === 0 ? "All photos grouped" : `${unassignedIntakePhotosCount} waiting in Add Clothes`,
    ],
  ];

  const readyGroupsCount = intakeSession
    ? intakeSession.groups.filter((g) => g.name.trim() && g.price && g.photoIds.length > 0).length
    : 0;
  const totalGroupsCount = intakeSession ? intakeSession.groups.length : 0;
  const progressPercent =
    totalGroupsCount > 0 ? Math.round((readyGroupsCount / totalGroupsCount) * 100) : 0;

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="See what needs doing and continue adding clothes."
        actions={
          <Button variant="primary" icon="plus" onClick={() => navigate("intake")}>
            Add Clothes
          </Button>
        }
      />
      <section className="summary-grid">
        {summaries.map(([label, value, sub]) => (
          <article className="summary-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{sub}</small>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Recently updated clothes</h2>
            <p>Garments added or changed recently</p>
          </div>
          <Button variant="text" onClick={() => navigate("catalogue")}>
            View all clothes <Icon name="arrow" size={15} />
          </Button>
        </div>
        {products.length > 0 ? (
          <ProductTable
            rows={products.slice(0, 5)}
            compact
            onEdit={(id) => navigate("editor", id)}
          />
        ) : (
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <span><Icon name="list" size={24} /></span>
            <h3>No garments in catalogue yet</h3>
            <p>Upload photos and add garments to get started.</p>
            <Button variant="primary" onClick={() => navigate("intake")}>Add Clothes</Button>
          </div>
        )}
      </section>
      <div className="overview-bottom">
        <section className="panel">
          <div className="section-header">
            <div>
              <h2>Attention needed</h2>
              <p>Tasks to finish before publishing</p>
            </div>
            <Status>
              {(draftCount > 0 ? 1 : 0) + (unassignedIntakePhotosCount > 0 ? 1 : 0)} items
            </Status>
          </div>
          <div className="attention-list">
            {draftCount > 0 && (
              <button onClick={() => navigate("catalogue")}>
                <span className="attention-icon">
                  <Icon name="edit" />
                </span>
                <span>
                  <strong>Finish {draftCount} incomplete draft{draftCount > 1 ? "s" : ""}</strong>
                  <small>Some garment details are still missing</small>
                </span>
                <Icon name="chevron" />
              </button>
            )}
            {unassignedIntakePhotosCount > 0 && (
              <button onClick={() => navigate("intake")}>
                <span className="attention-icon">
                  <Icon name="alert" />
                </span>
                <span>
                  <strong>Group {unassignedIntakePhotosCount} unassigned photo{unassignedIntakePhotosCount > 1 ? "s" : ""}</strong>
                  <small>Photos uploaded to Add Clothes waiting to be grouped</small>
                </span>
                <Icon name="chevron" />
              </button>
            )}
            {draftCount === 0 && unassignedIntakePhotosCount === 0 && (
              <div style={{ padding: "16px 14px", color: "var(--admin-muted)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="check" size={16} /> All tasks complete. No items need attention.
              </div>
            )}
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="section-header">
            <div>
              <h2>Continue adding clothes</h2>
              <p>Pick up where you left off</p>
            </div>
          </div>
          {intakeSession && (intakeSession.photos.length > 0 || intakeSession.groups.length > 0) ? (
            <>
              <div className="batch-summary">
                <div>
                  <strong>Clothes batch #{intakeSession.batchId}</strong>
                  <span>{readyGroupsCount} of {totalGroupsCount} garments ready</span>
                </div>
                <Status tone="outline">Saved {formatTimeAgo(intakeSession.updatedAt)}</Status>
              </div>
              <div className="progress">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <Button
                variant="secondary"
                icon="arrow"
                onClick={() => navigate("intake")}
              >
                Continue adding clothes
              </Button>
            </>
          ) : (
            <>
              <div className="batch-summary">
                <div>
                  <strong>Start adding clothes</strong>
                  <span>Upload garment photos to start a new batch</span>
                </div>
                <Status tone="outline">No batch in progress</Status>
              </div>
              <div className="progress">
                <span style={{ width: "0%" }} />
              </div>
              <Button
                variant="secondary"
                icon="arrow"
                onClick={() => navigate("intake")}
              >
                Add clothes
              </Button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function getNextBatchId(current: string): string {
  const match = current.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2], 10) + 1;
    const padded = String(num).padStart(match[2].length, "0");
    return `${prefix}${padded}`;
  }
  return "SE-02";
}



export const PREDEFINED_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "Free Size",
] as const;

export const PREDEFINED_COLOURS = [
  "Black",
  "White",
  "Grey",
  "Charcoal",
  "Navy Blue",
  "Blue",
  "Sky Blue",
  "Red",
  "Maroon",
  "Green",
  "Olive",
  "Beige",
  "Cream",
  "Brown",
  "Pink",
  "Purple",
  "Yellow",
  "Orange",
  "Multicolour",
  "Other",
] as const;

const DEPARTMENT_CATEGORIES: Record<string, string[]> = {
  Women: [
    "T-Shirts",
    "Track Pants",
    "Short Kurtis",
    "Crop Tops",
    "Jeans",
    "Hoodies",
    "Oversized T-Shirts",
    "Sleepwear Sets",
    "Korean-Style Sleepwear Sets",
    "Korean-Style Pants",
    "Korean-Style Formal Trousers",
    "Palazzo Pants",
    "Dresses",
    "Jackets",
    "Shirts",
  ],
  Men: [
    "Oversized T-Shirts",
    "Track Pants",
    "Hoodies",
    "Jeans",
    "Shirts",
    "Jackets",
    "Trousers",
  ],
  Kids: [
    "T-Shirts",
    "Pants",
    "Co-ord Sets",
    "Sleepwear Sets",
    "Frocks",
    "Korean-Style Sets",
    "Korean-Style Frocks",
  ],
};

export function Intake({
  products = [],
  navigate,
  showToast,
  onProductCreated,
}: {
  products?: LiveProduct[];
  navigate: (page: Page, pId?: string) => void;
  showToast: (message: string) => void;
  onProductCreated?: () => void;
}) {
  const [session, setSession] = useState<IntakeSession>({
    batchId: "SE-01",
    createdAt: "",
    updatedAt: "",
    photos: [],
    groups: [],
  });

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [tab, setTab] = useState<"unassigned" | "groups" | "review">("unassigned");
  const [savedBadge, setSavedBadge] = useState(true);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [restoredBannerVisible, setRestoredBannerVisible] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, { name?: string; price?: string }>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(INTAKE_REVIEW_KEY);
      } catch {
        // ignore
      }

      try {
        const saved = localStorage.getItem(INTAKE_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            let activeGroups: GarmentGroup[] = Array.isArray(parsed.groups) ? parsed.groups : [];
            let activePhotos: IntakePhoto[] = Array.isArray(parsed.photos) ? parsed.photos : [];

            if (products && products.length > 0) {
              const publishedProductIds = new Set(
                products.filter((p) => p.status === "published").map((p) => p.id)
              );
              activeGroups = activeGroups.filter(
                (g) =>
                  g.status !== "Published" &&
                  !(g.savedProductId && publishedProductIds.has(g.savedProductId))
              );
            }

            if (activePhotos.length > 0 || activeGroups.length > 0) {
              const reconciledSession: IntakeSession = {
                batchId: typeof parsed.batchId === "string" ? parsed.batchId : "SE-01",
                createdAt: parsed.createdAt || new Date().toISOString(),
                updatedAt: parsed.updatedAt || new Date().toISOString(),
                photos: activePhotos,
                groups: activeGroups,
              };
              setSession(reconciledSession);
              if (activeGroups.length > 0) {
                setRestoredBannerVisible(true);
              }
              localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(reconciledSession));
            } else {
              localStorage.removeItem(INTAKE_STORAGE_KEY);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load or reconcile intake session:", err);
      }
    }
  }, [products]);

  const fileRef = useRef<HTMLInputElement>(null);

  const persistSession = useCallback((updated: IntakeSession) => {
    setSession(updated);
    setSavedBadge(true);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn("Could not save intake session to localStorage:", err);
      }
    }
  }, []);

  const togglePhoto = (id: string) => {
    setSelectedPhotos((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleRealFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newPhotos: IntakePhoto[] = fileList.map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: file.size,
      mimeType: file.type || "image/jpeg",
      previewUrl: URL.createObjectURL(file),
      state: "Uploading",
      uploadProgress: 0,
    }));

    const updatedPhotos = [...session.photos, ...newPhotos];
    const newSession: IntakeSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      photos: updatedPhotos,
    };
    persistSession(newSession);

    if (event.target) event.target.value = "";

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const photoItem = newPhotos[i];

      try {
        const processed = await compressImageForUpload(file);

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
          const errData = await presignRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload auth error (HTTP ${presignRes.status})`);
        }

        const { presignedUrl, objectKey } = await presignRes.json();

        await uploadToR2WithProgress(
          presignedUrl,
          processed.file,
          processed.mimeType,
          (loaded, total) => {
            const pct = Math.round((loaded / total) * 100);
            setSession((curr) => ({
              ...curr,
              photos: curr.photos.map((p) =>
                p.id === photoItem.id ? { ...p, uploadProgress: pct } : p
              ),
            }));
          }
        );

        setSession((curr) => {
          const updated = {
            ...curr,
            updatedAt: new Date().toISOString(),
            photos: curr.photos.map((p) =>
              p.id === photoItem.id
                ? {
                    ...p,
                    state: "Uploaded" as const,
                    uploadProgress: 100,
                    storagePath: objectKey,
                    previewUrl: `/api/images/${objectKey}`,
                  }
                : p
            ),
          };
          if (typeof window !== "undefined") {
            localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
          }
          return updated;
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Upload failed.";
        console.error(`Upload error for ${file.name}:`, errorMsg);
        setSession((curr) => {
          const updated = {
            ...curr,
            updatedAt: new Date().toISOString(),
            photos: curr.photos.map((p) =>
              p.id === photoItem.id ? { ...p, state: "Failed" as const, error: errorMsg } : p
            ),
          };
          if (typeof window !== "undefined") {
            localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
          }
          return updated;
        });
      }
    }
  };

  const retryUpload = async (photoId: string) => {
    const photo = session.photos.find((p) => p.id === photoId);
    if (!photo) return;

    setSession((curr) => ({
      ...curr,
      photos: curr.photos.map((p) =>
        p.id === photoId ? { ...p, state: "Uploading", error: undefined, uploadProgress: 10 } : p
      ),
    }));

    showToast(`Retrying upload for ${photo.name}...`);
    fileRef.current?.click();
  };

  const createGroupFromSelected = () => {
    if (!selectedPhotos.length) return;

    const groupNum = session.groups.length + 1;
    const newGroup: GarmentGroup = {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `New Garment ${groupNum}`,
      department: "Women",
      category: "T-Shirts",
      price: "1200.00",
      status: "Draft",
      photoIds: [...selectedPhotos],
      primaryPhotoId: selectedPhotos[0],
      variants: [{ size: "M", color: "Black", sku: "", qty: "1", is_available: true }],
    };

    const updatedPhotos = session.photos.map((p) =>
      selectedPhotos.includes(p.id) ? { ...p, assignedGroup: newGroup.id } : p
    );

    const updatedSession: IntakeSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      photos: updatedPhotos,
      groups: [...session.groups, newGroup],
    };

    persistSession(updatedSession);
    setSelectedPhotos([]);
    setTab("groups");
    showToast("Photos grouped into one garment.");
  };

  const deleteSelectedPhotos = async () => {
    const photosToDelete = session.photos.filter((p) => selectedPhotos.includes(p.id));
    const storageKeysToDelete = photosToDelete
      .map((p) => p.storagePath)
      .filter((k): k is string => Boolean(k));

    if (storageKeysToDelete.length > 0) {
      try {
        await authFetch("/api/admin/images/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: storageKeysToDelete }),
        });
      } catch (err) {
        console.warn("Cleanup error for unassigned photos:", err);
      }
    }

    const updatedPhotos = session.photos.filter((p) => !selectedPhotos.includes(p.id));
    const updatedSession: IntakeSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      photos: updatedPhotos,
    };
    persistSession(updatedSession);
    setSelectedPhotos([]);
    setConfirm(null);
    showToast("Selected photos removed.");
  };

  const updateGroupField = (groupId: string, field: keyof GarmentGroup, value: any) => {
    setSession((curr) => {
      const updatedGroups = curr.groups.map((g) => {
        if (g.id !== groupId) return g;
        if (field === "department") {
          const validCategories = DEPARTMENT_CATEGORIES[value] || DEPARTMENT_CATEGORIES.Women;
          const currentCategoryValid = validCategories.includes(g.category);
          return {
            ...g,
            department: value,
            category: currentCategoryValid ? g.category : validCategories[0],
          };
        }
        return { ...g, [field]: value };
      });
      const updated = { ...curr, groups: updatedGroups, updatedAt: new Date().toISOString() };
      if (typeof window !== "undefined") {
        localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const updateVariantInGroup = (groupId: string, variantIndex: number, field: string, value: any) => {
    setSession((curr) => {
      const updatedGroups = curr.groups.map((g) => {
        if (g.id !== groupId) return g;
        const newVariants = [...g.variants];
        newVariants[variantIndex] = { ...newVariants[variantIndex], [field]: value };
        return { ...g, variants: newVariants };
      });
      const updated = { ...curr, groups: updatedGroups, updatedAt: new Date().toISOString() };
      if (typeof window !== "undefined") {
        localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const toggleGarmentForSale = (groupId: string, forSale: boolean) => {
    setSession((curr) => {
      const updatedGroups = curr.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          variants: g.variants.map((v) => ({ ...v, is_available: forSale })),
        };
      });
      const updated = { ...curr, groups: updatedGroups, updatedAt: new Date().toISOString() };
      if (typeof window !== "undefined") {
        localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const addVariantToGroup = (groupId: string) => {
    setSession((curr) => {
      const updatedGroups = curr.groups.map((g) => {
        if (g.id !== groupId) return g;
        const groupForSale = g.variants.some((v) => v.is_available !== false);
        return {
          ...g,
          variants: [
            ...g.variants,
            { size: "L", color: "Black", sku: "", qty: "1", is_available: groupForSale },
          ],
        };
      });
      const updated = { ...curr, groups: updatedGroups, updatedAt: new Date().toISOString() };
      if (typeof window !== "undefined") {
        localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const removeVariantFromGroup = (groupId: string, variantIndex: number) => {
    setSession((curr) => {
      const updatedGroups = curr.groups.map((g) => {
        if (g.id !== groupId) return g;
        if (g.variants.length <= 1) return g;
        return {
          ...g,
          variants: g.variants.filter((_, idx) => idx !== variantIndex),
        };
      });
      const updated = { ...curr, groups: updatedGroups, updatedAt: new Date().toISOString() };
      if (typeof window !== "undefined") {
        localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const ungroupGarment = (groupId: string) => {
    const groupToUngroup = session.groups.find((g) => g.id === groupId);
    if (!groupToUngroup) return;

    const photoIdsToUnassign = new Set(groupToUngroup.photoIds);
    const updatedPhotos = session.photos.map((p) =>
      photoIdsToUnassign.has(p.id) ? { ...p, assignedGroup: undefined } : p
    );
    const updatedGroups = session.groups.filter((g) => g.id !== groupId);

    const updatedSession: IntakeSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      photos: updatedPhotos,
      groups: updatedGroups,
    };
    persistSession(updatedSession);
    showToast(`"${groupToUngroup.name}" ungrouped. Photos returned to Photos to Group.`);
  };

  const saveGroupToDb = async (
    group: GarmentGroup,
    targetStatus: "draft" | "published" = "draft"
  ): Promise<string | undefined> => {
    if (!group.name.trim()) return undefined;

    const groupPhotos = session.photos.filter(
      (p) => group.photoIds.includes(p.id) && p.storagePath
    );

    const imagesPayload = groupPhotos.map((p, idx) => ({
      storage_path: p.storagePath!,
      alt_text: `${group.name} image ${idx + 1}`,
      display_order: idx,
      is_primary: p.id === (group.primaryPhotoId || groupPhotos[0]?.id) || idx === 0,
      mime_type: p.mimeType,
      file_size_bytes: p.size,
    }));

    const variantsPayload = group.variants.map((v) => ({
      size: v.size?.trim() || "One Size",
      color: v.color?.trim() || "Standard",
      sku: v.sku?.trim() || null,
      stock_quantity: parseInt(v.qty, 10) || 1,
      is_available: v.is_available !== false,
    }));

    try {
      let res: Response;
      const payload = {
        name: group.name.trim(),
        description: group.description?.trim() || null,
        department: group.department.toLowerCase(),
        category: group.category.trim(),
        price: parseFloat(group.price) || 0,
        sale_price: group.salePrice ? parseFloat(group.salePrice) : null,
        fabric: group.fabric?.trim() || null,
        fit: group.fit?.trim() || null,
        status: targetStatus,
        variants: variantsPayload,
        images: imagesPayload,
      };

      if (group.savedProductId) {
        res = await authFetch(`/api/admin/products/${group.savedProductId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const json = await res.json();
        const savedId = json.product?.id || group.savedProductId;
        return savedId;
      }
    } catch (err) {
      console.error(`Failed to save garment ${group.name} to DB:`, err);
    }
    return group.savedProductId;
  };

  const handleSaveAllDrafts = async () => {
    if (session.groups.length === 0) {
      showToast("No garment groups to save.");
      return;
    }

    setIsSavingDrafts(true);
    let savedCount = 0;
    const updatedGroups = [...session.groups];

    for (let i = 0; i < updatedGroups.length; i++) {
      const group = updatedGroups[i];
      if (group.name.trim()) {
        try {
          const savedId = await saveGroupToDb(group, "draft");
          if (savedId) {
            updatedGroups[i] = { ...group, savedProductId: savedId, status: "Draft" };
            savedCount++;
          }
        } catch (err) {
          console.warn("Error saving draft for group:", group.name, err);
        }
      }
    }

    persistSession({ ...session, groups: updatedGroups, updatedAt: new Date().toISOString() });
    onProductCreated?.();
    setIsSavingDrafts(false);
    showToast(`${savedCount} garment draft${savedCount === 1 ? "" : "s"} saved successfully.`);
  };

  const handleNextToReview = async () => {
    if (session.groups.length === 0) {
      showToast("No garment groups created yet. Please group photos first.");
      setTab("unassigned");
      return;
    }

    const errors: Record<string, { name?: string; price?: string }> = {};
    let hasError = false;

    for (const group of session.groups) {
      const groupErrors: { name?: string; price?: string } = {};
      if (!group.name || !group.name.trim()) {
        groupErrors.name = "Garment name is required";
        hasError = true;
      }
      const priceNum = parseFloat(group.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        groupErrors.price = "Valid selling price is required (greater than 0)";
        hasError = true;
      }
      if (Object.keys(groupErrors).length > 0) {
        errors[group.id] = groupErrors;
      }
    }

    if (hasError) {
      setValidationErrors(errors);
      showToast("Please complete required fields (Garment Name and Price) before proceeding.");
      return;
    }

    setValidationErrors({});

    // Auto-save any unsaved drafts to preserve state
    for (let i = 0; i < session.groups.length; i++) {
      const group = session.groups[i];
      if (!group.savedProductId && group.name.trim()) {
        try {
          const savedId = await saveGroupToDb(group, "draft");
          if (savedId) {
            session.groups[i].savedProductId = savedId;
          }
        } catch (err) {
          console.warn("Could not auto-save draft:", group.name, err);
        }
      }
    }

    persistSession({ ...session, groups: [...session.groups], updatedAt: new Date().toISOString() });
    onProductCreated?.();
    setTab("review");
    showToast("Garment details validated. Review your garments before publishing.");
  };

  const publishReadyGarments = async () => {
    const readyGroups = session.groups.filter(
      (g) => g.name.trim().length > 0 && parseFloat(g.price) > 0 && g.photoIds.length > 0
    );

    if (readyGroups.length === 0) {
      showToast("No ready garments found to publish. Please check name, price, and photos.");
      setConfirm(null);
      return;
    }

    setIsPublishing(true);
    let publishedCount = 0;
    const successfulGroupIds = new Set<string>();
    const updatedGroups = [...session.groups];

    for (const group of readyGroups) {
      const groupPhotos = session.photos.filter(
        (p) => group.photoIds.includes(p.id) && p.storagePath
      );

      const imagesPayload = groupPhotos.map((p, idx) => ({
        storage_path: p.storagePath!,
        alt_text: `${group.name} image ${idx + 1}`,
        display_order: idx,
        is_primary: p.id === (group.primaryPhotoId || groupPhotos[0]?.id) || idx === 0,
        mime_type: p.mimeType,
        file_size_bytes: p.size,
      }));

      const variantsPayload = group.variants.map((v) => ({
        size: v.size?.trim() || "One Size",
        color: v.color?.trim() || "Standard",
        sku: v.sku?.trim() || null,
        stock_quantity: parseInt(v.qty, 10) || 1,
        is_available: v.is_available !== false,
      }));

      try {
        let res: Response;
        const payload = {
          name: group.name.trim(),
          description: group.description?.trim() || null,
          department: group.department.toLowerCase(),
          category: group.category.trim(),
          price: parseFloat(group.price) || 0,
          sale_price: group.salePrice ? parseFloat(group.salePrice) : null,
          fabric: group.fabric?.trim() || null,
          fit: group.fit?.trim() || null,
          status: "published",
          variants: variantsPayload,
          images: imagesPayload,
        };

        if (group.savedProductId) {
          res = await authFetch(`/api/admin/products/${group.savedProductId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          res = await authFetch("/api/admin/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        if (res.ok) {
          const json = await res.json();
          group.savedProductId = json.product?.id || group.savedProductId;
          group.status = "Published";
          delete group.error;
          successfulGroupIds.add(group.id);
          publishedCount++;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || `Publish failed (HTTP ${res.status})`;
          const idx = updatedGroups.findIndex((g) => g.id === group.id);
          if (idx >= 0) {
            updatedGroups[idx] = { ...updatedGroups[idx], error: errMsg };
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Network error publishing garment";
        console.error(`Error publishing ${group.name}:`, err);
        const idx = updatedGroups.findIndex((g) => g.id === group.id);
        if (idx >= 0) {
          updatedGroups[idx] = { ...updatedGroups[idx], error: errMsg };
        }
      }
    }

    const publishedPhotoIds = new Set(
      session.groups
        .filter((g) => successfulGroupIds.has(g.id))
        .flatMap((g) => g.photoIds)
    );

    const remainingGroups = updatedGroups.filter((g) => !successfulGroupIds.has(g.id));
    const remainingPhotos = session.photos.filter((p) => !publishedPhotoIds.has(p.id));

    if (remainingGroups.length === 0) {
      const nextBatchId = getNextBatchId(session.batchId);
      const cleanSession: IntakeSession = {
        batchId: nextBatchId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photos: remainingPhotos,
        groups: [],
      };
      persistSession(cleanSession);
      setRestoredBannerVisible(false);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(INTAKE_STORAGE_KEY);
          localStorage.removeItem(INTAKE_REVIEW_KEY);
        } catch {
          // ignore
        }
      }
      showToast(`${publishedCount} garment(s) published successfully. Intake batch completed.`);
    } else {
      const partialSession: IntakeSession = {
        ...session,
        updatedAt: new Date().toISOString(),
        photos: remainingPhotos,
        groups: remainingGroups,
      };
      persistSession(partialSession);
      showToast(
        `${publishedCount} published, ${readyGroups.length - publishedCount} failed. Failed items remain in intake.`
      );
    }

    setIsPublishing(false);
    setConfirm(null);
    onProductCreated?.();
  };

  const unassignedPhotos = session.photos.filter((p) => !p.assignedGroup);
  const totalUploaded = session.photos.filter((p) => p.state === "Uploaded").length;
  const failedUploads = session.photos.filter((p) => p.state === "Failed");

  return (
    <div className="page intake-page">
      <div className="batch-head">
        <div className="batch-head-info">
          <div className="batch-eyebrow">ADD CLOTHES / BATCH #{session.batchId}</div>
          <div className="batch-title-row">
            <h1>Add Clothes</h1>
            <div className="mobile-header-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  persistSession({ ...session, updatedAt: new Date().toISOString() });
                  showToast("Your garment details and photo groups were saved.");
                }}
              >
                Save Progress
              </Button>
            </div>
          </div>
          <div className="batch-meta-row">
            <span className="batch-meta-counts">
              {session.groups.length} garment{session.groups.length === 1 ? "" : "s"} · {session.photos.length} photo{session.photos.length === 1 ? "" : "s"}
            </span>
            <span className="batch-meta-dot">·</span>
            <span className={`save-state ${savedBadge ? "saved" : ""}`}>
              <span className="save-dot" />
              {savedBadge ? "All changes saved" : "Unsaved changes"}
            </span>
            <span className="desktop-save-time">· Last saved {formatTimeAgo(session.updatedAt)}</span>
          </div>
        </div>

        <div className="batch-actions desktop-header-actions">
          <span className={`save-state ${savedBadge ? "saved" : ""}`}>
            <span className="save-dot" />
            {savedBadge ? "All changes saved" : "Unsaved changes"}
          </span>
          <Button
            onClick={() => {
              persistSession({ ...session, updatedAt: new Date().toISOString() });
              showToast("Your garment details and photo groups were saved.");
            }}
          >
            Save Progress
          </Button>
          {session.groups.length > 0 && (
            <Button
              variant="primary"
              onClick={() => {
                if (tab === "unassigned") setTab("groups");
                else if (tab === "groups") handleNextToReview();
                else setConfirm("Publish ready garments?");
              }}
            >
              {tab === "review" ? "Publish Ready Garments" : tab === "groups" ? "Next →" : "Continue to Details →"}
            </Button>
          )}
        </div>      </div>

      {restoredBannerVisible && session.groups.length > 0 && (
        <div className="recovery-banner">
          <div className="recovery-content">
            <span className="recovery-icon"><Icon name="refresh" size={16} /></span>
            <div className="recovery-text">
              <strong>Your work was restored</strong>
              <span className="recovery-desc">Your saved garment details and photo groups are ready to continue.</span>
            </div>
          </div>
          <div className="recovery-actions">
            <button
              type="button"
              className="recovery-action-btn fresh-batch-btn"
              onClick={() => {
                const nextBatchId = getNextBatchId(session.batchId);
                const cleanSession: IntakeSession = {
                  batchId: nextBatchId,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  photos: [],
                  groups: [],
                };
                persistSession(cleanSession);
                setRestoredBannerVisible(false);
                if (typeof window !== "undefined") {
                  try {
                    localStorage.removeItem(INTAKE_STORAGE_KEY);
                    localStorage.removeItem(INTAKE_REVIEW_KEY);
                  } catch {
                    // ignore
                  }
                }
                showToast("Started fresh batch.");
              }}
            >
              Start fresh batch
            </button>
            <button
              type="button"
              className="recovery-action-btn dismiss-btn"
              onClick={() => setRestoredBannerVisible(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Step Navigation Tabs Strip */}
            {/* Main 3-Step Navigation Tabs Strip */}
      <nav className="workflow-tabs" aria-label="Workflow Steps">
        <button
          type="button"
          className={`workflow-tab ${tab === "unassigned" ? "active" : ""}`}
          onClick={() => setTab("unassigned")}
          aria-current={tab === "unassigned" ? "step" : undefined}
          aria-label="Step 1: Photos to Group"
        >
          <span className="tab-step-num">1</span>
          <span className="tab-label desktop-tab-label">Photos to Group</span>
          <span className="tab-label mobile-tab-label">Photos</span>
        </button>

        <button
          type="button"
          className={`workflow-tab ${tab === "groups" ? "active" : ""}`}
          onClick={() => setTab("groups")}
          aria-current={tab === "groups" ? "step" : undefined}
          aria-label="Step 2: Add Garment Details"
        >
          <span className="tab-step-num">2</span>
          <span className="tab-label desktop-tab-label">Add Details</span>
          <span className="tab-label mobile-tab-label">Details</span>
        </button>

        <button
          type="button"
          className={`workflow-tab ${tab === "review" ? "active" : ""}`}
          onClick={() => {
            if (session.groups.length > 0) {
              handleNextToReview();
            } else {
              setTab("review");
            }
          }}
          aria-current={tab === "review" ? "step" : undefined}
          aria-label="Step 3: Review and Publish"
        >
          <span className="tab-step-num">3</span>
          <span className="tab-label desktop-tab-label">Review &amp; Publish</span>
          <span className="tab-label mobile-tab-label">Review</span>
        </button>
      </nav>

{/* STEP 1: Photos to Group (Upload area strictly rendered here) */}
      {tab === "unassigned" && (
        <>
          <section className="upload-panel">
            <div className="upload-zone" onClick={() => fileRef.current?.click()}>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                hidden
                onChange={handleRealFileUpload}
              />
              <span className="upload-icon">
                <Icon name="upload" size={22} />
              </span>
              <div>
                <strong>Upload Photos</strong>
                <p>Drop photos here, or choose several photos from your computer.</p>
              </div>
              <Button>Choose Photos</Button>
            </div>

            {session.photos.length > 0 && (
              <div className="upload-summary">
                <div className="upload-stat">
                  <span>Photo upload</span>
                  <strong>
                    {totalUploaded} of {session.photos.length} complete
                  </strong>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${session.photos.length > 0 ? Math.round((totalUploaded / session.photos.length) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span>
                  {session.photos.length > 0 ? Math.round((totalUploaded / session.photos.length) * 100) : 0}%
                </span>
                {failedUploads.length > 0 && (
                  <Status tone="error">
                    {failedUploads.length} failed
                  </Status>
                )}
              </div>
            )}

            {failedUploads.length > 0 && (
              <div className="file-rows">
                {failedUploads.map((fail) => (
                  <div className="file-row" key={fail.id}>
                    <ProductThumb src={fail.previewUrl} label={fail.name.slice(0, 4)} />
                    <div>
                      <strong>{fail.name}</strong>
                      <span>
                        {(fail.size / (1024 * 1024)).toFixed(1)} MB · {fail.error || "Upload failed — try again"}
                      </span>
                    </div>
                    <Status tone="error">Upload failed</Status>
                    <button onClick={() => retryUpload(fail.id)}>
                      <Icon name="refresh" size={15} /> Retry
                    </button>
                    <button
                      aria-label="Remove file"
                      onClick={() => {
                        const filtered = session.photos.filter((p) => p.id !== fail.id);
                        persistSession({ ...session, photos: filtered });
                      }}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="workspace photo-grouping-workspace">

            {selectedPhotos.length > 0 && (
            <div className="selection-bar">
              <div className="selection-info-group">
                <strong className="selection-count">{selectedPhotos.length} selected</strong>
                <button
                  type="button"
                  className="select-all-btn"
                  onClick={() => {
                    if (selectedPhotos.length === unassignedPhotos.length) {
                      setSelectedPhotos([]);
                    } else {
                      setSelectedPhotos(unassignedPhotos.map((p) => p.id));
                    }
                  }}
                >
                  {selectedPhotos.length === unassignedPhotos.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="selection-actions-group">
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={createGroupFromSelected}
                >
                  <span className="desktop-btn-text">Group Photos into a Garment</span>
                  <span className="mobile-btn-text">Group photos</span>
                </Button>
                <Button
                  variant="danger"
                  icon="trash"
                  onClick={() => setConfirm("Delete selected photos?")}
                >
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {unassignedPhotos.length > 0 ? (
              <div className="photo-grid">
                {unassignedPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    className={`photo-card ${selectedPhotos.includes(photo.id) ? "selected" : ""} ${photo.state === "Failed" ? "failed" : ""}`}
                    onClick={() => togglePhoto(photo.id)}
                  >
                    <span className="photo-check">
                      {selectedPhotos.includes(photo.id) && <Icon name="check" size={13} />}
                    </span>
                    <div className="photo-placeholder">
                      {photo.previewUrl ? (
                        <img
                          src={photo.previewUrl}
                          alt={photo.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <>
                          <Icon name="image" size={26} />
                          <span>PHOTO</span>
                        </>
                      )}
                    </div>
                    <div className="photo-meta">
                      <strong>{photo.name}</strong>
                      <span>
                        {photo.state === "Failed"
                          ? "Upload failed — try again"
                          : photo.state === "Uploading"
                          ? `Uploading ${photo.uploadProgress || 0}%`
                          : "Waiting to be grouped"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "40px 20px" }}>
                <span><Icon name="image" size={28} /></span>
                <h3>No unassigned photos</h3>
                <p>Choose or drop photos above to add them to this intake batch.</p>
                <Button variant="primary" onClick={() => fileRef.current?.click()}>
                  Choose Photos
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      {/* STEP 2: Add Garment Details (Complete Inline Editor) */}
      {tab === "groups" && (
        <section className="workspace">
          <div className="workspace-head">
            <div>
              <h2>Add Garment Details</h2>
              <p>Complete details, pricing, fabric, and inventory for each grouped garment right here.</p>
            </div>
          </div>

          {session.groups.length > 0 ? (
            <div className="garment-cards-container">
              {session.groups.map((group, index) => {
                const groupPhotos = session.photos.filter((p) => group.photoIds.includes(p.id));
                const primaryPhoto =
                  groupPhotos.find((p) => p.id === group.primaryPhotoId) || groupPhotos[0];
                const groupErrors = validationErrors[group.id] || {};
                const validCategories = DEPARTMENT_CATEGORIES[group.department] || DEPARTMENT_CATEGORIES.Women;

                return (
                  <article className="garment-editor-card" key={group.id}>
                    <div className="garment-card-layout">
                      {/* Left: Photos Reference & Selection */}
                      <div className="garment-photos-panel">
                        <div className="primary-image-container">
                          <ProductThumb src={primaryPhoto?.previewUrl} label="MAIN" large />
                          <span className="main-photo-tag">Main photo</span>
                        </div>
                        {groupPhotos.length > 1 && (
                          <div className="garment-thumbnails-strip">
                            {groupPhotos.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={`thumb-btn ${p.id === (group.primaryPhotoId || primaryPhoto?.id) ? "active" : ""}`}
                                onClick={() => updateGroupField(group.id, "primaryPhotoId", p.id)}
                                title="Click to set as main photo"
                              >
                                <ProductThumb src={p.previewUrl} />
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="photos-meta-caption">
                          <span>{groupPhotos.length} photo{groupPhotos.length === 1 ? "" : "s"}</span>
                          <small>Click thumbnail to set as main photo</small>
                        </div>

                        {/* Compact Garment-level For Sale Toggle Card */}
                        <div className="garment-forsale-card">
                          <span className="garment-forsale-label">For sale</span>
                          <label className="toggle" title="Available for purchase">
                            <input
                              type="checkbox"
                              checked={group.variants.some((v) => v.is_available !== false)}
                              onChange={(e) => toggleGarmentForSale(group.id, e.target.checked)}
                              aria-label="For sale"
                            />
                            <span />
                          </label>
                        </div>
                      </div>

                      {/* Right: Complete Inline Editor Form */}
                      <div className="garment-fields-panel">
                        <div className="garment-card-header">
                          <div className="garment-badge-row">
                            <span className="garment-index-label">GARMENT {String(index + 1).padStart(2, "0")}</span>
                            <Status tone={group.name.trim() && parseFloat(group.price) > 0 ? "dark" : "outline"}>
                              {group.name.trim() && parseFloat(group.price) > 0 ? "Ready to publish" : "Needs more details"}
                            </Status>
                            {group.savedProductId && (
                              <span className="saved-draft-pill">Draft saved</span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="ungroup-action-btn"
                            onClick={() => ungroupGarment(group.id)}
                            title="Ungroup this garment and return its photos to Photos to Group"
                          >
                            <Icon name="trash" size={13} /> Ungroup
                          </button>
                        </div>

                        <div className="garment-form-section">
                          <Field label="Garment name" required>
                            <input
                              className={groupErrors.name ? "input-error" : ""}
                              value={group.name}
                              placeholder="e.g. Silk Blend Midi Dress"
                              onChange={(e) => {
                                updateGroupField(group.id, "name", e.target.value);
                                if (validationErrors[group.id]?.name) {
                                  setValidationErrors((prev) => ({
                                    ...prev,
                                    [group.id]: { ...prev[group.id], name: undefined },
                                  }));
                                }
                              }}
                            />
                          </Field>
                          {groupErrors.name && (
                            <span className="field-error">
                              <Icon name="alert" size={13} /> {groupErrors.name}
                            </span>
                          )}

                          <Field label="Product description (optional)">
                            <textarea
                              rows={3}
                              value={group.description || ""}
                              placeholder="Describe fabric texture, fit, styling notes, or details..."
                              onChange={(e) => updateGroupField(group.id, "description", e.target.value)}
                            />
                          </Field>

                          <div className="form-grid two">
                            <Field label="Department" required>
                              <select
                                value={group.department}
                                onChange={(e) => updateGroupField(group.id, "department", e.target.value)}
                              >
                                <option value="Women">Women</option>
                                <option value="Men">Men</option>
                                <option value="Kids">Kids</option>
                              </select>
                            </Field>

                            <Field label="Category" required>
                              <select
                                value={group.category}
                                onChange={(e) => updateGroupField(group.id, "category", e.target.value)}
                              >
                                {validCategories.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Fabric (optional)">
                              <input
                                value={group.fabric || ""}
                                placeholder="e.g. 100% Cotton / Linen blend"
                                onChange={(e) => updateGroupField(group.id, "fabric", e.target.value)}
                              />
                            </Field>

                            <Field label="Fit (optional)">
                              <select
                                value={group.fit || "Regular"}
                                onChange={(e) => updateGroupField(group.id, "fit", e.target.value)}
                              >
                                <option value="Regular">Regular</option>
                                <option value="Relaxed">Relaxed</option>
                                <option value="Slim">Slim</option>
                                <option value="Oversized">Oversized</option>
                              </select>
                            </Field>
                          </div>

                          <div className="form-grid two" style={{ marginTop: "12px" }}>
                            <Field label="Selling price (₹)" required>
                              <div className={`money-input ${groupErrors.price ? "input-error" : ""}`}>
                                <span>₹</span>
                                <input
                                  value={group.price}
                                  placeholder="0.00"
                                  onChange={(e) => {
                                    updateGroupField(group.id, "price", e.target.value);
                                    if (validationErrors[group.id]?.price) {
                                      setValidationErrors((prev) => ({
                                        ...prev,
                                        [group.id]: { ...prev[group.id], price: undefined },
                                      }));
                                    }
                                  }}
                                />
                              </div>
                            </Field>

                            <Field label="Discounted price (₹) (optional)">
                              <div className="money-input">
                                <span>₹</span>
                                <input
                                  value={group.salePrice || ""}
                                  placeholder="Leave blank if not on sale"
                                  onChange={(e) => updateGroupField(group.id, "salePrice", e.target.value)}
                                />
                              </div>
                            </Field>
                          </div>
                          {groupErrors.price && (
                            <span className="field-error">
                              <Icon name="alert" size={13} /> {groupErrors.price}
                            </span>
                          )}

                          {/* Variants Section */}
                          <div className="garment-variants-section">
                            <div className="variants-header-row">
                              <strong>Sizes and Inventory</strong>
                              <span className="variants-subtitle">Configure size, colour, SKU, quantity and sale availability</span>
                            </div>
                            <div className="variant-head" aria-hidden="true">
                              <span>Size</span>
                              <span>Colour</span>
                              <span>SKU <span className="field-optional">(optional)</span></span>
                              <span>Quantity</span>
                              <span className="vcol-action" />
                            </div>
                            <div className="variant-list">
                              {group.variants.map((v, vIdx) => (
                                <div className="variant-editor-row" key={vIdx}>
                                  <div className="variant-cell variant-cell-size">
                                    <label className="variant-mobile-label">Size</label>
                                    <select
                                      value={v.size}
                                      onChange={(e) => updateVariantInGroup(group.id, vIdx, "size", e.target.value)}
                                      aria-label="Size"
                                    >
                                      {!PREDEFINED_SIZES.includes(v.size as any) && v.size && (
                                        <option value={v.size}>{v.size}</option>
                                      )}
                                      {PREDEFINED_SIZES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="variant-cell variant-cell-color">
                                    <label className="variant-mobile-label">Colour</label>
                                    <select
                                      value={v.color}
                                      onChange={(e) => updateVariantInGroup(group.id, vIdx, "color", e.target.value)}
                                      aria-label="Colour"
                                    >
                                      {!PREDEFINED_COLOURS.includes(v.color as any) && v.color && (
                                        <option value={v.color}>{v.color}</option>
                                      )}
                                      {PREDEFINED_COLOURS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="variant-cell variant-cell-sku">
                                    <label className="variant-mobile-label">
                                      SKU <span className="field-optional">(optional)</span>
                                    </label>
                                    <input
                                      value={v.sku || ""}
                                      placeholder="e.g. BLK-M"
                                      onChange={(e) => updateVariantInGroup(group.id, vIdx, "sku", e.target.value)}
                                      aria-label="SKU"
                                    />
                                  </div>
                                  <div className="variant-cell variant-cell-qty">
                                    <label className="variant-mobile-label">Quantity</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={v.qty}
                                      placeholder="0"
                                      onChange={(e) => updateVariantInGroup(group.id, vIdx, "qty", e.target.value)}
                                      aria-label="Quantity"
                                    />
                                  </div>
                                  <div className="variant-cell variant-cell-remove">
                                    <button
                                      type="button"
                                      className="variant-remove-btn"
                                      disabled={group.variants.length <= 1}
                                      onClick={() => removeVariantFromGroup(group.id, vIdx)}
                                      title={group.variants.length <= 1 ? "At least one variant is required" : "Remove variant"}
                                      aria-label="Remove variant"
                                    >
                                      <Icon name="trash" size={15} />
                                      <span className="mobile-remove-text">Remove</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="variant-add-action">
                              <Button
                                variant="secondary"
                                icon="plus"
                                onClick={() => addVariantToGroup(group.id)}
                              >
                                Add size or colour
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Clean Horizontal Action Row at Bottom */}
              <div className="details-footer-actions">
                <Button
                  variant="secondary"
                  disabled={isSavingDrafts}
                  onClick={handleSaveAllDrafts}
                  className="details-save-draft-btn"
                >
                  {isSavingDrafts ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleNextToReview}
                  className="details-next-btn"
                >
                  Next →
                </Button>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "40px 20px" }}>
              <span><Icon name="upload" size={28} /></span>
              <h3>No garment groups created yet</h3>
              <p>Select photos in "Photos to Group" and click "Group Photos into a Garment".</p>
              <Button onClick={() => setTab("unassigned")}>Go to Photos to Group</Button>
            </div>
          )}
        </section>
      )}

      {/* STEP 3: Review and Publish */}
      {tab === "review" && (
        <section className="workspace review-workspace">
          <div className="workspace-head">
            <div>
              <h2>Review and Publish</h2>
              <p>Publish ready garments to the catalogue. Incomplete garments will stay safely saved as drafts.</p>
            </div>
          </div>

          {session.groups.length > 0 ? (
            <div className="review-cards-list">
              {session.groups.map((group, idx) => {
                const groupPhotos = session.photos.filter((p) => group.photoIds.includes(p.id));
                const primary = groupPhotos.find((p) => p.id === group.primaryPhotoId) || groupPhotos[0];
                const isReady =
                  group.name.trim().length > 0 &&
                  parseFloat(group.price) > 0 &&
                  groupPhotos.length > 0;
                const hasError = Boolean(group.error);
                const totalQty = group.variants.reduce((sum, v) => sum + (parseInt(v.qty, 10) || 0), 0);

                return (
                  <div className="review-card" key={group.id}>
                    <div className="review-card-thumb">
                      <ProductThumb src={primary?.previewUrl} label={`#${idx + 1}`} large />
                      <span className="review-photo-count">{groupPhotos.length} photo{groupPhotos.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="review-card-info">
                      <div className="review-card-top">
                        <div>
                          <h3>{group.name}</h3>
                          <div className="review-meta-tags">
                            <span className="tag-dept">{group.department}</span>
                            <span className="tag-cat">{group.category}</span>
                            {group.fabric && <span className="tag-fabric">{group.fabric}</span>}
                            {group.fit && <span className="tag-fit">{group.fit} Fit</span>}
                          </div>
                        </div>
                        <div className="review-price-block">
                          <span className="review-price">₹{group.price}</span>
                          {group.salePrice && <span className="review-sale-price">₹{group.salePrice}</span>}
                        </div>
                      </div>

                      {group.description && (
                        <p className="review-desc">{group.description}</p>
                      )}

                      <div className="review-variants-summary">
                        <strong>Variants & Inventory ({totalQty} total units):</strong>
                        <div className="review-variant-chips">
                          {group.variants.map((v, vIdx) => (
                            <span className="review-variant-chip" key={vIdx}>
                              <b>{v.size}</b> / {v.color} · Qty: {v.qty}{v.sku ? ` · SKU: ${v.sku}` : ""}{v.is_available === false ? " (Hidden)" : ""}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="review-card-footer">
                        <Status tone={hasError ? "error" : isReady ? "dark" : "outline"}>
                          {hasError ? "Publish failed" : isReady ? "Ready to publish" : "Needs more details"}
                        </Status>
                        {hasError && <span className="field-error" style={{ marginLeft: "8px" }}>{group.error}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "40px 20px" }}>
              <h3>No garments to review</h3>
              <p>Group photos and add garment details first.</p>
            </div>
          )}

          {session.groups.length > 0 && (
            <div className="review-footer-simple">
              <Button
                variant="secondary"
                onClick={() => setTab("groups")}
                aria-label="Back to Garment Details"
                className="review-back-btn"
              >
                <span className="desktop-btn-text">← Back to Garment Details</span>
                <span className="mobile-btn-text">← Back to details</span>
              </Button>
              <Button
                variant="primary"
                disabled={isPublishing}
                onClick={() => setConfirm("Publish ready garments?")}
                aria-label="Publish Ready Garments"
                className="review-publish-btn"
              >
                <span className="desktop-btn-text">
                  {isPublishing ? "Publishing..." : "Publish Ready Garments"}
                </span>
                <span className="mobile-btn-text">
                  {isPublishing ? "Publishing..." : "Publish ready"}
                </span>
              </Button>
            </div>
          )}
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm}
          body={
            confirm.startsWith("Publish")
              ? "Only garments that are ready will be published to the catalogue and storefront. Incomplete garments will stay saved as drafts."
              : "This cannot be undone. Selected unassigned photos will be deleted."
          }
          action={confirm.startsWith("Publish") ? "Publish garments" : "Delete photos"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.startsWith("Publish")) {
              publishReadyGarments();
            } else {
              deleteSelectedPhotos();
            }
          }}
        />
      )}
    </div>
  );
}


export function ProductTable({
  rows,
  compact,
  selected = [],
  onSelect,
  onEdit,
}: {
  rows: LiveProduct[];
  compact?: boolean;
  selected?: string[];
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className={`data-table ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            {!compact && (
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all clothes"
                  checked={rows.length > 0 && selected.length === rows.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      rows.forEach((r) => !selected.includes(r.id) && onSelect?.(r.id));
                    } else {
                      rows.forEach((r) => selected.includes(r.id) && onSelect?.(r.id));
                    }
                  }}
                />
              </th>
            )}
            <th>Garment</th>
            <th>Department</th>
            {!compact && <th>Category</th>}
            <th>Status</th>
            {!compact && <th>Selling price</th>}
            {!compact && <th>Sizes / stock</th>}
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((product) => {
            const stockSummary =
              product.variantsSummary && product.variantsSummary.length > 0
                ? `${product.variantsSummary.length} size${product.variantsSummary.length > 1 ? "s" : ""} · ${product.variantsSummary.reduce((acc, v) => acc + (v.stock_quantity || 0), 0)} in stock`
                : "One size";

            return (
              <tr
                key={product.id}
                className={selected.includes(product.id) ? "selected-row" : ""}
              >
                {!compact && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(product.id)}
                      onChange={() => onSelect?.(product.id)}
                    />
                  </td>
                )}
                <td>
                  <div className="product-cell">
                    <ProductThumb src={product.primaryImage} label={product.name.slice(0, 3)} />
                    <strong>{product.name}</strong>
                  </div>
                </td>
                <td style={{ textTransform: "capitalize" }}>{product.department}</td>
                {!compact && <td>{product.category}</td>}
                <td>
                  <Status
                    tone={
                      product.status?.toLowerCase() === "published"
                        ? "dark"
                        : product.status?.toLowerCase() === "archived"
                        ? "neutral"
                        : "outline"
                    }
                  >
                    {product.status?.toLowerCase() === "published"
                      ? "Published"
                      : product.status?.toLowerCase() === "archived"
                      ? "In archive"
                      : "Draft"}
                  </Status>
                </td>
                {!compact && <td>₹{Number(product.price || 0).toFixed(2)}</td>}
                {!compact && <td>{stockSummary}</td>}
                <td>{formatUpdatedDate(product.updated_at || product.created_at)}</td>
                <td>
                  {compact ? (
                    <button
                      className="icon-button"
                      onClick={() => onEdit?.(product.id)}
                      title="Edit garment"
                    >
                      <Icon name="chevron" />
                    </button>
                  ) : (
                    <Button variant="text" onClick={() => onEdit?.(product.id)}>
                      Edit
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GalleryImage({
  src,
  alt,
  fallbackLabel,
}: {
  src?: string | null;
  alt: string;
  fallbackLabel: string;
}) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (src && !error) {
    return (
      <img
        src={src}
        alt={alt}
        className="gallery-img"
        onError={() => setError(true)}
        loading="lazy"
      />
    );
  }

  return (
    <div className="gallery-img-fallback">
      <Icon name="image" size={32} />
      <span className="fallback-text">{fallbackLabel}</span>
    </div>
  );
}

export function ProductGallery({
  rows,
  selected = [],
  onSelect,
  onEdit,
}: {
  rows: LiveProduct[];
  selected?: string[];
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const allPageSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <div className="product-gallery-wrap">
      <div className="gallery-toolbar-row">
        <label className="gallery-select-all-label">
          <input
            type="checkbox"
            aria-label="Select all clothes on this page"
            checked={allPageSelected}
            onChange={(e) => {
              if (e.target.checked) {
                rows.forEach((r) => !selected.includes(r.id) && onSelect?.(r.id));
              } else {
                rows.forEach((r) => selected.includes(r.id) && onSelect?.(r.id));
              }
            }}
          />
          <span>Select all on page ({rows.length})</span>
        </label>
        <span className="gallery-count-hint">
          {selected.length > 0 ? `${selected.length} selected` : ""}
        </span>
      </div>

      <div className="product-gallery-grid">
        {rows.map((product) => {
          const isSelected = selected.includes(product.id);
          const stockSummary =
            product.variantsSummary && product.variantsSummary.length > 0
              ? `${product.variantsSummary.length} size${product.variantsSummary.length > 1 ? "s" : ""} · ${product.variantsSummary.reduce((acc, v) => acc + (v.stock_quantity || 0), 0)} in stock`
              : "One size";

          return (
            <article
              key={product.id}
              className={`gallery-card ${isSelected ? "selected" : ""}`}
            >
              <div className="gallery-card-top">
                <label className="gallery-card-checkbox" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect?.(product.id)}
                    aria-label={`Select ${product.name}`}
                  />
                </label>
                <Status
                  tone={
                    product.status?.toLowerCase() === "published"
                      ? "dark"
                      : product.status?.toLowerCase() === "archived"
                      ? "neutral"
                      : "outline"
                  }
                >
                  {product.status?.toLowerCase() === "published"
                    ? "Published"
                    : product.status?.toLowerCase() === "archived"
                    ? "In archive"
                    : "Draft"}
                </Status>
              </div>

              <div
                className="gallery-card-image-wrap"
                onClick={() => onEdit?.(product.id)}
                title={`Edit ${product.name}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit?.(product.id);
                  }
                }}
              >
                <GalleryImage
                  src={product.primaryImage}
                  alt={product.name}
                  fallbackLabel={product.name.slice(0, 3)}
                />
              </div>

              <div className="gallery-card-body">
                <div className="gallery-card-category" style={{ textTransform: "capitalize" }}>
                  <span>{product.department}</span>
                  <span className="dot-sep">·</span>
                  <span>{product.category}</span>
                </div>

                <h3
                  className="gallery-card-title"
                  onClick={() => onEdit?.(product.id)}
                  title={product.name}
                >
                  {product.name}
                </h3>

                <div className="gallery-card-meta-row">
                  <div className="gallery-card-price">
                    ₹{Number(product.price || 0).toFixed(2)}
                  </div>
                  <div className="gallery-card-stock" title={stockSummary}>
                    {stockSummary}
                  </div>
                </div>

                <div className="gallery-card-footer">
                  <span className="gallery-card-date">
                    {formatUpdatedDate(product.updated_at || product.created_at)}
                  </span>
                  <Button variant="text" onClick={() => onEdit?.(product.id)}>
                    Edit
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function Catalogue({
  products,
  navigate,
  showToast,
  onRefresh,
}: {
  products: LiveProduct[];
  navigate: (p: Page, pId?: string) => void;
  showToast: (v: string) => void;
  onRefresh?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [department, setDepartment] = useState("All");
  const [sortBy, setSortBy] = useState("Updated date");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const rowsPerPage = 25;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("style_edit_admin_catalogue_view");
      if (saved === "grid" || saved === "list") {
        setViewMode(saved);
      }
    } catch {}
  }, []);

  const handleSetViewMode = (mode: "list" | "grid") => {
    setViewMode(mode);
    try {
      localStorage.setItem("style_edit_admin_catalogue_view", mode);
    } catch {}
  };

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase()) ||
        product.department.toLowerCase().includes(query.toLowerCase());

      const matchesStatus =
        status === "All statuses" ||
        (status === "Published" && product.status?.toLowerCase() === "published") ||
        (status === "Draft" && product.status?.toLowerCase() === "draft") ||
        (status === "In archive" && product.status?.toLowerCase() === "archived");

      const matchesDept =
        department === "All" ||
        product.department.toLowerCase() === department.toLowerCase();

      return matchesQuery && matchesStatus && matchesDept;
    }).sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Selling price") return (b.price || 0) - (a.price || 0);
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });
  }, [products, query, status, department, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page]);

  const toggleSelect = (id: string) => {
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((item) => item !== id) : [...curr, id]
    );
  };

  const handleBulkStatusChange = async (targetStatus: "published" | "draft" | "archived") => {
    if (selected.length === 0) return;
    try {
      for (const id of selected) {
        await authFetch(`/api/admin/products/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
      }
      onRefresh?.();
      setSelected([]);
      showToast(`${selected.length} garments updated to ${targetStatus}.`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error updating garments.");
    }
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    try {
      const res = await authFetch("/api/admin/products/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selected }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to delete garments");
      }
      onRefresh?.();
      setSelected([]);
      setConfirm(false);
      showToast("Selected garments deleted.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error deleting garments.");
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="All Clothes"
        description="Find and manage every garment in your shop."
        actions={
          <Button variant="primary" icon="plus" onClick={() => navigate("editor")}>
            Add Garment
          </Button>
        }
      />
      <section className="panel catalogue-panel">
        <div className="catalogue-toolbar">
          <div className="search-input">
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search clothes by name or category"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option>All statuses</option>
            <option>Published</option>
            <option>Draft</option>
            <option>In archive</option>
          </select>
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">Men, Women, Kids</option>
            <option value="Men">Men</option>
            <option value="Women">Women</option>
            <option value="Kids">Kids</option>
          </select>

          <div className="catalogue-view-switcher" role="group" aria-label="Catalogue view mode">
            <button
              type="button"
              className={`view-switcher-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => handleSetViewMode("list")}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <Icon name="list" size={15} />
              <span>List</span>
            </button>
            <button
              type="button"
              className={`view-switcher-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => handleSetViewMode("grid")}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <Icon name="grid" size={15} />
              <span>Grid</span>
            </button>
          </div>
        </div>

        <div className="saved-views">
          <span>Saved views</span>
          <button
            className={status === "All statuses" ? "active" : ""}
            onClick={() => {
              setStatus("All statuses");
              setPage(1);
            }}
          >
            All clothes <b>{products.length}</b>
          </button>
          <button
            className={status === "Draft" ? "active" : ""}
            onClick={() => {
              setStatus("Draft");
              setPage(1);
            }}
          >
            Drafts <b>{products.filter((p) => p.status?.toLowerCase() === "draft").length}</b>
          </button>
          <button
            className={status === "In archive" ? "active" : ""}
            onClick={() => {
              setStatus("In archive");
              setPage(1);
            }}
          >
            Archived <b>{products.filter((p) => p.status?.toLowerCase() === "archived").length}</b>
          </button>
          <div />
          <label>
            Sort by{" "}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option>Updated date</option>
              <option>Name</option>
              <option>Selling price</option>
            </select>
          </label>
        </div>

        {selected.length > 0 && (
          <div className="selection-bar catalogue-selection">
            <strong>{selected.length} garments selected</strong>
            <button onClick={() => setSelected(products.map((p) => p.id))}>
              Select all {products.length}
            </button>
            <span />
            <Button onClick={() => handleBulkStatusChange("published")}>Publish</Button>
            <Button onClick={() => handleBulkStatusChange("draft")}>Unpublish</Button>
            <Button onClick={() => handleBulkStatusChange("archived")}>Move to archive</Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>
              Delete clothes
            </Button>
          </div>
        )}

        {paginated.length > 0 ? (
          viewMode === "grid" ? (
            <ProductGallery
              rows={paginated}
              selected={selected}
              onSelect={toggleSelect}
              onEdit={(id) => navigate("editor", id)}
            />
          ) : (
            <ProductTable
              rows={paginated}
              selected={selected}
              onSelect={toggleSelect}
              onEdit={(id) => navigate("editor", id)}
            />
          )
        ) : (
          <div className="empty-state">
            <span>
              <Icon name="search" size={24} />
            </span>
            <h3>No clothes found</h3>
            <p>Try a different name or clear the selected filters.</p>
            <Button
              onClick={() => {
                setQuery("");
                setStatus("All statuses");
                setDepartment("All");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}

        <div className="pagination">
          <span>
            Showing {filtered.length ? (page - 1) * rowsPerPage + 1 : 0}–
            {Math.min(page * rowsPerPage, filtered.length)} of {filtered.length} garments
          </span>
          <div />
          <Button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="page-number">{page}</span>
          <Button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </Button>
        </div>
      </section>

      {confirm && (
        <ConfirmDialog
          title="Delete selected clothes?"
          body={`${selected.length} garments will be permanently deleted from the database and their images cleaned up.`}
          action="Delete clothes"
          onCancel={() => setConfirm(false)}
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}

export function Editor({
  productId,
  navigate,
  showToast,
  onProductSaved,
}: {
  productId?: string;
  navigate?: (p: Page, pId?: string) => void;
  showToast: (v: string) => void;
  onProductSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("Women");
  const [category, setCategory] = useState("Jackets");
  const [fabric, setFabric] = useState("");
  const [fit, setFit] = useState("Regular");
  const [price, setPrice] = useState("1200.00");
  const [salePrice, setSalePrice] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [images, setImages] = useState<LiveProductImage[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [variants, setVariants] = useState<LiveProductVariant[]>([
    { size: "M", color: "Black", sku: "", stock_quantity: 1, is_available: true },
  ]);
  const [confirm, setConfirm] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing product
  useEffect(() => {
    if (!productId) {
      setName("New Garment");
      setDescription("");
      setPrice("1200.00");
      setSalePrice("");
      setDepartment("Women");
      setCategory("Jackets");
      setStatus("draft");
      setImages([]);
      return;
    }

    let isMounted = true;
    async function loadProduct() {
      setLoading(true);
      try {
        const res = await authFetch(`/api/admin/products/${productId}`);
        if (!res.ok) throw new Error("Could not load garment.");
        const json = await res.json();
        const p: LiveProduct = json.product;
        if (!isMounted) return;

        setName(p.name || "");
        setDescription(p.description || "");
        setDepartment(p.department ? p.department.charAt(0).toUpperCase() + p.department.slice(1) : "Women");
        setCategory(p.category || "Jackets");
        setFabric(p.fabric || "");
        setFit(p.fit || "Regular");
        setPrice(p.price ? p.price.toString() : "0.00");
        setSalePrice(p.sale_price ? p.sale_price.toString() : "");
        setStatus((p.status as "draft" | "published" | "archived") || "draft");

        const loadedImages: LiveProductImage[] = (p.product_images || []).sort(
          (a, b) => (a.display_order || 0) - (b.display_order || 0)
        );
        setImages(loadedImages);
        const primIdx = loadedImages.findIndex((img) => img.is_primary);
        setPrimaryIndex(primIdx >= 0 ? primIdx : 0);

        if (p.product_variants && p.product_variants.length > 0) {
          setVariants(p.product_variants);
        }
      } catch (err) {
        console.error("Error loading product:", err);
        showToast("Error loading product details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId, showToast]);

  const handleSave = async (targetStatus?: "draft" | "published" | "archived") => {
    if (!name.trim()) {
      showToast("Garment name is required.");
      return;
    }

    const finalStatus = targetStatus || status;

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      department: department.toLowerCase(),
      category: category.trim(),
      price: parseFloat(price) || 0,
      sale_price: salePrice ? parseFloat(salePrice) : null,
      fabric: fabric.trim() || null,
      fit: fit.trim() || null,
      status: finalStatus,
      images: images.map((img, idx) => ({
        storage_path: img.storage_path,
        is_primary: idx === primaryIndex,
        display_order: idx,
        alt_text: img.alt_text || `${name} image ${idx + 1}`,
        mime_type: img.mime_type || "image/jpeg",
        file_size_bytes: img.file_size_bytes || null,
      })),
      variants: variants.map((v) => ({
        size: v.size.trim() || "One size",
        color: v.color.trim() || "Standard",
        sku: v.sku?.trim() || null,
        stock_quantity: v.stock_quantity || 1,
        is_available: v.is_available,
      })),
    };

    try {
      let res: Response;
      if (productId) {
        res = await authFetch(`/api/admin/products/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Save failed (HTTP ${res.status})`);
      }

      const json = await res.json();
      setStatus(finalStatus);
      onProductSaved?.();

      if (!productId && json.product?.id) {
        navigate?.("editor", json.product.id);
      }

      showToast(
        finalStatus === "published"
          ? "Garment checked and published successfully."
          : "Garment saved as a draft."
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error saving garment.");
    }
  };

  const handleAddPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const processed = await compressImageForUpload(file);
        const presignRes = await authFetch("/api/admin/images/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: productId || "new-product",
            fileName: processed.file.name,
            contentType: processed.mimeType,
            fileSize: processed.finalSize,
          }),
        });

        if (!presignRes.ok) throw new Error("Could not get upload URL.");
        const { presignedUrl, objectKey } = await presignRes.json();

        await uploadToR2WithProgress(presignedUrl, processed.file, processed.mimeType);

        setImages((curr) => [
          ...curr,
          {
            storage_path: objectKey,
            is_primary: curr.length === 0,
            display_order: curr.length,
            alt_text: `${name} photo`,
            file_size_bytes: processed.finalSize,
            mime_type: processed.mimeType,
          },
        ]);
        showToast(`Uploaded ${file.name}.`);
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Image upload failed.");
      }
    }
  };

  const valid = name.trim().length > 0;

  return (
    <div className="page editor-page">
      <div className="editor-breadcrumb">
        All Clothes <Icon name="chevron" size={13} /> {status === "published" ? "Published" : "Drafts"}{" "}
        <Icon name="chevron" size={13} /> {name || "New Garment"}
      </div>
      <PageHeader
        title={productId ? "Edit Garment" : "New Garment"}
        description={`${status.charAt(0).toUpperCase() + status.slice(1)} · ${productId ? `Garment ${productId.slice(0, 8)}` : "Unsaved"}`}
        actions={
          <>
            <Button onClick={() => handleSave("draft")}>Save Draft</Button>
            <Button variant="primary" onClick={() => handleSave("published")}>
              Publish
            </Button>
          </>
        }
      />
      <div className="editor-layout">
        <main className="editor-main">
          <section className="form-section">
            <div className="section-title">
              <h2>Garment details</h2>
            </div>
            <div className="form-body">
              <Field label="Garment name" required>
                <input
                  className={!valid ? "input-error" : ""}
                  value={name}
                  placeholder="e.g. Wool Blend Check Jacket"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              {!valid && (
                <span className="field-error">
                  <Icon name="alert" size={13} /> Garment name is required.
                </span>
              )}
              <Field label="Description (optional)">
                <textarea
                  rows={5}
                  value={description}
                  placeholder="Describe the garment, material, condition, colour, or notable details."
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <div className="form-grid two">
                <Field label="Department" required>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option>Women</option>
                    <option>Men</option>
                    <option>Kids</option>
                  </select>
                </Field>
                <Field label="Category" required>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option>Jackets</option>
                    <option>Shirts</option>
                    <option>Jeans</option>
                    <option>Trousers</option>
                    <option>Dresses</option>
                  </select>
                </Field>
                <Field label="Fabric (optional)">
                  <input value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="e.g. 100% Wool" />
                </Field>
                <Field label="Fit (optional)">
                  <select value={fit} onChange={(e) => setFit(e.target.value)}>
                    <option>Regular</option>
                    <option>Relaxed</option>
                    <option>Slim</option>
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>Photos</h2>
            </div>
            <div className="form-body">
              <p className="section-help">
                Select a photo to make it the main photo. Add photos via the button below.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                hidden
                onChange={handleAddPhotos}
              />
              <div className="editor-gallery">
                {images.map((img, i) => (
                  <button
                    key={img.storage_path || i}
                    type="button"
                    className={primaryIndex === i ? "primary" : ""}
                    onClick={() => setPrimaryIndex(i)}
                  >
                    <ProductThumb src={`/api/images/${img.storage_path}`} label={`${i + 1}`} large />
                    {primaryIndex === i && (
                      <b>
                        <Icon name="check" size={12} /> Main photo
                      </b>
                    )}
                    <span
                      className="remove-photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImages((curr) => curr.filter((_, idx) => idx !== i));
                        if (primaryIndex === i) setPrimaryIndex(0);
                      }}
                      title="Remove photo"
                    >
                      <Icon name="close" size={13} />
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="gallery-add"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="plus" />
                  <span>Add photos</span>
                </button>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>Pricing</h2>
            </div>
            <div className="form-body form-grid two">
              <Field label="Selling price (₹)" required>
                <div className="money-input">
                  <span>₹</span>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
              </Field>
              <Field label="Discounted price (optional)">
                <div className="money-input">
                  <span>₹</span>
                  <input
                    value={salePrice}
                    placeholder="Leave blank if not on sale"
                    onChange={(e) => setSalePrice(e.target.value)}
                  />
                </div>
              </Field>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>Sizes and stock</h2>
            </div>
            <div className="form-body">
              <div className="variant-head" aria-hidden="true">
                <span>Size</span>
                <span>Colour</span>
                <span>SKU <span className="field-optional">(optional)</span></span>
                <span>Quantity</span>
                <span className="vcol-sale">For sale</span>
                <span className="vcol-action" />
              </div>
              <div className="variant-list">
                {variants.map((variant, i) => (
                  <div className="variant-editor-row" key={i}>
                    <div className="variant-cell variant-cell-size">
                      <label className="variant-mobile-label">Size</label>
                      <select
                        value={variant.size}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[i].size = e.target.value;
                          setVariants(updated);
                        }}
                        aria-label="Size"
                      >
                        {!PREDEFINED_SIZES.includes(variant.size as any) && variant.size && (
                          <option value={variant.size}>{variant.size}</option>
                        )}
                        {PREDEFINED_SIZES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="variant-cell variant-cell-color">
                      <label className="variant-mobile-label">Colour</label>
                      <select
                        value={variant.color}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[i].color = e.target.value;
                          setVariants(updated);
                        }}
                        aria-label="Colour"
                      >
                        {!PREDEFINED_COLOURS.includes(variant.color as any) && variant.color && (
                          <option value={variant.color}>{variant.color}</option>
                        )}
                        {PREDEFINED_COLOURS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="variant-cell variant-cell-sku">
                      <label className="variant-mobile-label">
                        SKU <span className="field-optional">(optional)</span>
                      </label>
                      <input
                        value={variant.sku || ""}
                        placeholder="e.g. BLK-M"
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[i].sku = e.target.value;
                          setVariants(updated);
                        }}
                        aria-label="SKU"
                      />
                    </div>
                    <div className="variant-cell variant-cell-qty">
                      <label className="variant-mobile-label">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={variant.stock_quantity.toString()}
                        placeholder="0"
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[i].stock_quantity = parseInt(e.target.value, 10) || 0;
                          setVariants(updated);
                        }}
                        aria-label="Quantity"
                      />
                    </div>
                    <div className="variant-cell variant-cell-toggle">
                      <div className="variant-toggle-control">
                        <span className="variant-mobile-label">For sale</span>
                        <label className="toggle" title="Available for purchase">
                          <input
                            type="checkbox"
                            checked={variant.is_available}
                            onChange={(e) => {
                              const updated = [...variants];
                              updated[i].is_available = e.target.checked;
                              setVariants(updated);
                            }}
                            aria-label="For sale"
                          />
                          <span />
                        </label>
                      </div>
                    </div>
                    <div className="variant-cell variant-cell-remove">
                      <button
                        type="button"
                        className="variant-remove-btn"
                        disabled={variants.length <= 1}
                        onClick={() => {
                          if (variants.length > 1) {
                            setVariants(variants.filter((_, idx) => idx !== i));
                          }
                        }}
                        title={variants.length <= 1 ? "At least one variant required" : "Remove variant"}
                        aria-label="Remove variant"
                      >
                        <Icon name="trash" size={15} />
                        <span className="mobile-remove-text">Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="variant-add-action">
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() =>
                    setVariants((curr) => [
                      ...curr,
                      { size: "L", color: "Black", sku: "", stock_quantity: 1, is_available: true },
                    ])
                  }
                >
                  Add size or colour
                </Button>
              </div>
            </div>
          </section>
        </main>

        <aside className="editor-aside">
          <section className="side-card">
            <div className="side-card-head">
              <h2>Publishing</h2>
              <Status tone={status === "published" ? "dark" : "outline"}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Status>
            </div>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "published" | "archived")}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Button variant="primary" onClick={() => handleSave("published")}>
              Publish Garment
            </Button>
          </section>

          <section className="side-card checklist">
            <div className="side-card-head">
              <h2>Ready to publish?</h2>
              <strong>
                {[name.trim().length > 0, department, category, parseFloat(price) > 0, images.length > 0].filter(Boolean).length} of 5
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name={name.trim().length > 0 ? "check" : "close"} size={13} /> Garment name added
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name={department ? "check" : "close"} size={13} /> Department chosen
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name={category ? "check" : "close"} size={13} /> Category chosen
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name={parseFloat(price) > 0 ? "check" : "close"} size={13} /> Selling price added
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name={images.length > 0 ? "check" : "close"} size={13} /> At least one photo added
              </div>
            </div>
          </section>

          {productId && (
            <section className="side-card danger-zone">
              <h2>Garment actions</h2>
              <Button onClick={() => handleSave("archived")}>Move to archive</Button>
              <Button
                variant="danger"
                onClick={() => setConfirm("Delete this garment?")}
              >
                Delete Garment
              </Button>
            </section>
          )}
        </aside>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm}
          body="This garment and its image attachments will be permanently removed."
          action="Delete garment"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            if (productId) {
              await authFetch("/api/admin/products/bulk-delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productIds: [productId] }),
              });
              onProductSaved?.();
              setConfirm(null);
              showToast("Garment deleted.");
              navigate?.("catalogue");
            }
          }}
        />
      )}
    </div>
  );
}

export function MediaLibrary({
  showToast,
  navigate,
}: {
  showToast: (v: string) => void;
  navigate?: (p: Page, pId?: string) => void;
}) {
  const [images, setImages] = useState<LiveImageAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<LiveImageAsset | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("All");
  const [fileType, setFileType] = useState("All file types");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/images");
      if (res.ok) {
        const json = await res.json();
        setImages(json.images || []);
      }
    } catch (err) {
      console.error("Error loading images:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const shown = useMemo(() => {
    return images.filter((img) => {
      const matchesSearch = !search || img.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (filter === "Assigned" && img.assigned) ||
        (filter === "Unassigned" && !img.assigned);

      const matchesType =
        fileType === "All file types" ||
        img.name.toLowerCase().endsWith(fileType.toLowerCase());

      return matchesSearch && matchesFilter && matchesType;
    });
  }, [images, search, filter, fileType]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id]
    );
  };

  const handleDeleteImage = async (image: LiveImageAsset) => {
    try {
      const res = await authFetch(`/api/admin/images/${image.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to delete photo.");
      }

      setDrawer(null);
      setConfirmDelete(false);
      showToast("Photo deleted from the garment and Photo Library.");
      loadImages();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error deleting photo.");
    }
  };

  return (
    <div className="page media-page">
      <PageHeader
        title="Photo Library"
        description="Find photos and see which garment each one belongs to."
        actions={
          <Button variant="primary" icon="upload" onClick={() => navigate?.("intake")}>
            Upload Photos
          </Button>
        }
      />
      <section className="panel">
        <div className="media-toolbar">
          <div className="search-input">
            <Icon name="search" size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename"
            />
          </div>
          <div className="segmented">
            {["All", "Unassigned", "Assigned"].map((item) => (
              <button
                className={filter === item ? "active" : ""}
                key={item}
                onClick={() => setFilter(item)}
              >
                {item === "All"
                  ? "All Photos"
                  : item === "Unassigned"
                  ? "Unassigned Photos"
                  : "Photos Assigned to Garments"}
              </button>
            ))}
          </div>
          <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
            <option>All file types</option>
            <option>jpg</option>
            <option>png</option>
            <option>webp</option>
          </select>
          <div />
          <div className="view-toggle">
            <button
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              <Icon name="grid" size={16} />
            </button>
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              <Icon name="list" size={16} />
            </button>
          </div>
        </div>

        {shown.length > 0 ? (
          <div className={view === "grid" ? "asset-grid" : "asset-list"}>
            {shown.map((asset) => (
              <article
                className={`asset-card ${selected.includes(asset.id) ? "selected" : ""}`}
                key={asset.id}
              >
                <button className="asset-select" onClick={() => toggle(asset.id)}>
                  {selected.includes(asset.id) && <Icon name="check" size={12} />}
                </button>
                <button className="asset-preview" onClick={() => setDrawer(asset)}>
                  <img
                    src={asset.proxyUrl}
                    alt={asset.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </button>
                <div className="asset-meta">
                  <strong>{asset.name}</strong>
                  <span>{asset.dimensions} · {asset.size}</span>
                  <Status tone={asset.assigned ? "neutral" : "outline"}>
                    {asset.assigned ? "Assigned to a garment" : "Not assigned"}
                  </Status>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <span><Icon name="image" size={28} /></span>
            <h3>No photos found</h3>
            <p>Upload photos via Add Clothes to populate the Photo Library.</p>
            <Button variant="primary" onClick={() => navigate?.("intake")}>Upload Photos</Button>
          </div>
        )}

        <div className="pagination">
          <span>Showing 1–{shown.length} of {images.length} photos</span>
        </div>
      </section>

      {drawer !== null && (
        <div className="drawer">
          <div className="drawer-head">
            <div>
              <span>PHOTO DETAILS</span>
              <h2 style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {drawer.name}
              </h2>
            </div>
            <button onClick={() => setDrawer(null)}>
              <Icon name="close" />
            </button>
          </div>
          <div className="drawer-preview">
            <img
              src={drawer.proxyUrl}
              alt={drawer.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <div className="drawer-section">
            <h3>File information</h3>
            <dl>
              <div>
                <dt>File type</dt>
                <dd>{drawer.mimeType}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{drawer.dimensions}</dd>
              </div>
              <div>
                <dt>File size</dt>
                <dd>{drawer.size}</dd>
              </div>
              <div>
                <dt>Uploaded</dt>
                <dd>{formatUpdatedDate(drawer.createdAt)}</dd>
              </div>
            </dl>
          </div>
          <div className="drawer-section">
            <h3>Assignment</h3>
            {drawer.product ? (
              <div
                className="assigned-product"
                onClick={() => navigate?.("editor", drawer.product?.id)}
                style={{ cursor: "pointer" }}
              >
                <ProductThumb src={drawer.proxyUrl} />
                <div>
                  <strong>{drawer.product.name}</strong>
                  <span>{drawer.isPrimary ? "Main photo" : "Gallery photo"} · {drawer.product.status} garment</span>
                </div>
                <Icon name="chevron" />
              </div>
            ) : (
              <p style={{ color: "var(--admin-muted)", fontSize: "11px" }}>This photo is not currently assigned to any garment.</p>
            )}
          </div>
          <div className="drawer-footer">
            <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>
              Delete Photo
            </Button>
          </div>
        </div>
      )}

      {confirmDelete && drawer && (
        <ConfirmDialog
          title="Delete this photo?"
          body={
            drawer.product
              ? `This photo is attached to ${drawer.product.name}. Deleting it will remove it from the garment and from Cloudflare R2.`
              : "This photo will be permanently deleted from Cloudflare R2."
          }
          action="Delete Photo"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => handleDeleteImage(drawer)}
        />
      )}
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  action,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  action: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true">
        <span className="dialog-icon">
          <Icon name="alert" />
        </span>
        <h2>{title}</h2>
        <p>{body}</p>
        <div>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function App({
  initialPage = "overview",
  initialProductId,
}: {
  initialPage?: Page;
  initialProductId?: string;
}) {
  const [page, setPageInternal] = useState<Page>(initialPage);
  const [editingProductId, setEditingProductId] = useState<string | undefined>(initialProductId);
  const [toast, setToast] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Live Products State
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Intake session state shared with Dashboard
  const [intakeSession, setIntakeSession] = useState<IntakeSession | null>(null);

  const refreshProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await authFetch("/api/admin/products");
      if (res.ok) {
        const json = await res.json();
        setProducts(json.products || []);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const refreshIntakeSession = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(INTAKE_STORAGE_KEY);
        if (saved) {
          setIntakeSession(JSON.parse(saved));
        } else {
          setIntakeSession(null);
        }
      } catch {
        setIntakeSession(null);
      }
    }
  }, []);

  useEffect(() => {
    refreshProducts();
    refreshIntakeSession();
  }, [refreshProducts, refreshIntakeSession]);

  useEffect(() => {
    setPageInternal(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (initialProductId) {
      setEditingProductId(initialProductId);
    }
  }, [initialProductId]);

  const setPage = (p: Page, pId?: string) => {
    setPageInternal(p);
    if (pId !== undefined) {
      setEditingProductId(pId);
    }
    const routeMap: Record<Page, string> = {
      overview: "/admin",
      intake: "/admin/intake",
      catalogue: "/admin/products",
      editor: pId
        ? `/admin/products/${pId}`
        : editingProductId
        ? `/admin/products/${editingProductId}`
        : "/admin/editor",
      media: "/admin/media",
    };
    if (typeof window !== "undefined" && window.location.pathname !== routeMap[p]) {
      window.history.pushState(null, "", routeMap[p]);
    }
    refreshIntakeSession();
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };

  const screen = useMemo(() => {
    if (page === "overview")
      return (
        <Overview
          products={products}
          intakeSession={intakeSession}
          navigate={setPage}
        />
      );
    if (page === "intake")
      return (
        <Intake
          products={products}
          navigate={setPage}
          showToast={showToast}
          onProductCreated={() => {
            refreshProducts();
            refreshIntakeSession();
          }}
        />
      );
    if (page === "catalogue")
      return (
        <Catalogue
          products={products}
          navigate={setPage}
          showToast={showToast}
          onRefresh={refreshProducts}
        />
      );
    if (page === "editor")
      return (
        <Editor
          productId={editingProductId}
          showToast={showToast}
          navigate={setPage}
          onProductSaved={refreshProducts}
        />
      );
    return <MediaLibrary showToast={showToast} navigate={setPage} />;
  }, [page, editingProductId, products, intakeSession, refreshProducts]);

  return (
    <div className="app-shell">
      <div className="mobile-admin-bar">
        <button
          className="mobile-admin-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          title="Open navigation menu"
          type="button"
        >
          <Icon name="menu" size={18} />
        </button>
        <button className="mobile-admin-wordmark" onClick={() => setPage("overview")} type="button">
          STYLE · EDIT
        </button>
        <span className="mobile-page-badge">
          {nav.find((n) => n.id === page)?.label || (page === "media" ? "Photo Library" : "Admin")}
        </span>
      </div>
      {mobileOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className={`main-region ${collapsed ? "collapsed" : ""}`}>{screen}</div>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
