"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

export type Page = "overview" | "intake" | "catalogue" | "editor" | "media"
export type ProductStatus = "Published" | "Draft" | "Review" | "Archived"
export type Photo = {
  id: number
  name: string
  state: "Uploaded" | "Uploading" | "Failed"
  assigned?: string
}
export type Product = {
  id: number
  name: string
  department: string
  category: string
  price: number
  stock: string
  status: ProductStatus
  updated: string
  photo: string
}

export const initialPhotos: Photo[] = [
  { id: 1, name: "IMG_4821.jpg", state: "Uploaded" },
  { id: 2, name: "IMG_4822.jpg", state: "Uploaded" },
  { id: 3, name: "IMG_4823.jpg", state: "Uploaded" },
  { id: 4, name: "IMG_4824.jpg", state: "Uploaded" },
  { id: 5, name: "IMG_4825.jpg", state: "Failed" },
  { id: 6, name: "IMG_4826.jpg", state: "Uploaded" },
  { id: 7, name: "IMG_4827.jpg", state: "Uploading" },
  { id: 8, name: "IMG_4828.jpg", state: "Uploaded" },
  { id: 9, name: "IMG_4829.jpg", state: "Uploaded" },
  { id: 10, name: "IMG_4830.jpg", state: "Uploaded" },
  { id: 11, name: "IMG_4831.jpg", state: "Uploaded" },
  { id: 12, name: "IMG_4832.jpg", state: "Uploaded" },
]

export const products: Product[] = [
  {
    id: 1,
    name: "Vintage Oxford Shirt",
    department: "Men",
    category: "Shirts",
    price: 3400,
    stock: "3 sizes · 8 in stock",
    status: "Published",
    updated: "Today, 09:42",
    photo: "shirt",
  },
  {
    id: 2,
    name: "Straight-Leg Denim Jeans",
    department: "Women",
    category: "Jeans",
    price: 4800,
    stock: "4 sizes · 6 in stock",
    status: "Published",
    updated: "Today, 09:16",
    photo: "jeans",
  },
  {
    id: 3,
    name: "Wool Blend Check Jacket",
    department: "Women",
    category: "Jackets",
    price: 7200,
    stock: "One size",
    status: "Draft",
    updated: "Yesterday, 16:03",
    photo: "jacket",
  },
  {
    id: 4,
    name: "Cotton Utility Trousers",
    department: "Men",
    category: "Trousers",
    price: 4200,
    stock: "3 sizes · 4 in stock",
    status: "Review",
    updated: "Yesterday, 14:28",
    photo: "trousers",
  },
  {
    id: 5,
    name: "Pleated Midi Dress",
    department: "Women",
    category: "Dresses",
    price: 5600,
    stock: "2 sizes · 2 in stock",
    status: "Published",
    updated: "28 May 2025",
    photo: "dress",
  },
  {
    id: 6,
    name: "Kids Denim Overshirt",
    department: "Kids",
    category: "Shirts",
    price: 2800,
    stock: "3 sizes · 5 in stock",
    status: "Draft",
    updated: "27 May 2025",
    photo: "shirt",
  },
  {
    id: 7,
    name: "Corduroy Chore Jacket",
    department: "Men",
    category: "Jackets",
    price: 6400,
    stock: "One size",
    status: "Archived",
    updated: "25 May 2025",
    photo: "jacket",
  },
  {
    id: 8,
    name: "Linen Pull-On Trousers",
    department: "Women",
    category: "Trousers",
    price: 3800,
    stock: "2 sizes · 3 in stock",
    status: "Published",
    updated: "24 May 2025",
    photo: "trousers",
  },
]

export const nav: { id: Page; label: string; icon: string }[] = [
  { id: "overview", label: "Dashboard", icon: "grid" },
  { id: "intake", label: "Add Clothes", icon: "upload" },
  { id: "catalogue", label: "All Clothes", icon: "list" },
  { id: "editor", label: "Edit Garment", icon: "edit" },
  { id: "media", label: "Photo Library", icon: "image" },
]

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
  }
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
  )
}

export function Button({
  children,
  variant = "secondary",
  icon,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "danger" | "text"
  icon?: string
  onClick?: () => void
  disabled?: boolean
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      className={`button button-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

export function Status({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "dark" | "outline" | "error"
}) {
  return <span className={`status status-${tone}`}>{children}</span>
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string
  children: ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <b> *</b>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  )
}

export function ProductThumb({
  type = "shirt",
  label,
  large = false,
}: {
  type?: string
  label?: string
  large?: boolean
}) {
  return (
    <div className={`product-thumb ${large ? "thumb-large" : ""}`}>
      <Icon name="image" size={large ? 30 : 18} />
      <span>{label || type}</span>
    </div>
  )
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
  )
}

export function Sidebar({
  page,
  setPage,
  collapsed = false,
  setCollapsed,
  mobileOpen = false,
  setMobileOpen,
}: {
  page: Page
  setPage: (page: Page) => void
  collapsed?: boolean
  setCollapsed?: (collapsed: boolean) => void
  mobileOpen?: boolean
  setMobileOpen?: (open: boolean) => void
}) {
  const handleNav = (target: Page) => {
    setPage(target)
    setMobileOpen?.(false)
  }
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

        {/* Desktop collapse / expand toggle */}
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

        {/* Mobile close button */}
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
        <div className="admin-avatar" title="Alex Morgan (Store admin)">AM</div>
        {!collapsed && (
          <div className="admin-meta">
            <strong>Alex Morgan</strong>
            <span>Store admin</span>
          </div>
        )}
        {!collapsed && (
          <button className="icon-button" title="Sign out" aria-label="Sign out" type="button">
            <Icon name="logout" size={16} />
          </button>
        )}
      </div>
    </aside>
  )
}

export function Overview({ navigate }: { navigate: (page: Page) => void }) {
  const summaries = [
    ["Total Garments", "248", "+12 this month"],
    ["Drafts to Finish", "14", "6 need more details"],
    ["Published Clothes", "227", "91.5% of total"],
    ["Photos Not Assigned", "36", "3 uploads need attention"],
  ]
  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="See what needs doing and continue adding clothes."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => navigate("intake")}
          >
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
        <ProductTable
          rows={products.slice(0, 5)}
          compact
          onEdit={() => navigate("editor")}
        />
      </section>
      <div className="overview-bottom">
        <section className="panel">
          <div className="section-header">
            <div>
              <h2>Attention needed</h2>
              <p>Tasks to finish before publishing</p>
            </div>
            <Status>6 items</Status>
          </div>
          <div className="attention-list">
            <button>
              <span className="attention-icon">
                <Icon name="edit" />
              </span>
              <span>
                <strong>Finish 6 incomplete drafts</strong>
                <small>Some garment details are still missing</small>
              </span>
              <Icon name="chevron" />
            </button>
            <button>
              <span className="attention-icon">
                <Icon name="alert" />
              </span>
              <span>
                <strong>Review 3 failed photo uploads</strong>
                <small>From the clothes added on 30 May</small>
              </span>
              <Icon name="chevron" />
            </button>
            <button>
              <span className="attention-icon">
                <Icon name="check" />
              </span>
              <span>
                <strong>Review 2 garments</strong>
                <small>Ready for final checks</small>
              </span>
              <Icon name="chevron" />
            </button>
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="section-header">
            <div>
              <h2>Continue adding clothes</h2>
              <p>Pick up where you left off</p>
            </div>
          </div>
          <div className="batch-summary">
            <div>
              <strong>Clothes added · 30 May</strong>
              <span>8 of 12 garments ready</span>
            </div>
            <Status tone="outline">Saved 12 min ago</Status>
          </div>
          <div className="progress">
            <span style={{ width: "67%" }} />
          </div>
          <Button
            variant="secondary"
            icon="arrow"
            onClick={() => navigate("intake")}
          >
            Continue adding clothes
          </Button>
        </section>
      </div>
    </div>
  )
}

export function Intake({
  navigate,
  showToast,
}: {
  navigate: (page: Page) => void
  showToast: (message: string) => void
}) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [selected, setSelected] = useState<number[]>([1, 2, 3])
  const [tab, setTab] = useState<"unassigned" | "groups" | "review">(
    "unassigned",
  )
  const [groupCreated, setGroupCreated] = useState(false)
  const [groupName, setGroupName] = useState("Wool Blend Check Jacket")
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  const createGroup = () => {
    if (!selected.length) return
    setGroupCreated(true)
    setTab("groups")
    setPhotos((current) =>
      current.map((photo) =>
        selected.includes(photo.id)
          ? { ...photo, assigned: "Group 09" }
          : photo,
      ),
    )
    setSelected([])
    showToast("Photos grouped into one garment.")
  }
  const retry = (id: number) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id ? { ...photo, state: "Uploading" } : photo,
      ),
    )
    window.setTimeout(
      () =>
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === id ? { ...photo, state: "Uploaded" } : photo,
          ),
        ),
      700,
    )
  }
  const handleMockUpload = () => {
    setPhotos((current) => [
      ...current,
      {
        id: current.length + 20,
        name: "new_garment_front.jpg",
        state: "Uploading",
      },
    ])
    window.setTimeout(
      () =>
        setPhotos((current) =>
          current.map((photo) =>
            photo.name === "new_garment_front.jpg"
              ? { ...photo, state: "Uploaded" }
              : photo,
          ),
        ),
      800,
    )
  }
  return (
    <div className="page intake-page">
      <div className="batch-head">
        <div>
          <div className="eyebrow">ADD CLOTHES / SAVED GROUP #SE-0530</div>
          <h1>Add Clothes</h1>
          <p>12 garments · 36 photos · Last saved 12 minutes ago</p>
        </div>
        <div className="batch-actions">
          <span className={`save-state ${saved ? "saved" : ""}`}>
            <span />
            {saved ? "All changes saved" : "Unsaved changes"}
          </span>
          <Button
            onClick={() => {
              setSaved(true)
              showToast("Your garment details and photo groups were saved.")
            }}
          >
            Save Progress
          </Button>
          <Button variant="primary" onClick={() => setTab("review")}>
            Review and Publish
          </Button>
        </div>
      </div>
      <div className="recovery-banner">
        <Icon name="refresh" />
        <div>
          <strong>Your work was restored</strong>
          <span>
            Your saved garment details and photo groups are ready to continue.
          </span>
        </div>
        <button>See restored work</button>
      </div>
      <section className="upload-panel">
        <div className="upload-zone" onClick={() => fileRef.current?.click()}>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={handleMockUpload}
          />
          <span className="upload-icon">
            <Icon name="upload" size={22} />
          </span>
          <div>
            <strong>Upload Photos</strong>
            <p>
              Drop photos here, or choose several photos from your computer.
            </p>
          </div>
          <Button>Choose Photos</Button>
        </div>
        <div className="upload-summary">
          <div className="upload-stat">
            <span>Photo upload</span>
            <strong>34 of 36 complete</strong>
          </div>
          <div className="progress">
            <span style={{ width: "94%" }} />
          </div>
          <span>94%</span>
          <Status tone="error">1 failed</Status>
        </div>
        <div className="file-rows">
          <div className="file-row">
            <ProductThumb label="4825" />
            <div>
              <strong>IMG_4825.jpg</strong>
              <span>4.8 MB · Upload failed — try again</span>
            </div>
            <Status tone="error">Upload failed</Status>
            <button onClick={() => retry(5)}>
              <Icon name="refresh" size={15} /> Retry
            </button>
            <button aria-label="Remove file">
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="file-row">
            <ProductThumb label="4827" />
            <div>
              <strong>IMG_4827.jpg</strong>
              <span>2.1 MB · Uploading</span>
            </div>
            <div className="mini-progress">
              <span />
            </div>
            <b>62%</b>
            <button>Cancel</button>
          </div>
        </div>
      </section>
      <div className="workspace-tabs">
        <button
          className={tab === "unassigned" ? "active" : ""}
          onClick={() => setTab("unassigned")}
        >
          Photos to Group{" "}
          <span>{photos.filter((p) => !p.assigned).length}</span>
        </button>
        <button
          className={tab === "groups" ? "active" : ""}
          onClick={() => setTab("groups")}
        >
          Add Garment Details <span>{groupCreated ? 9 : 8}</span>
        </button>
        <button
          className={tab === "review" ? "active" : ""}
          onClick={() => setTab("review")}
        >
          Review and Publish <span>5</span>
        </button>
      </div>
      {tab === "unassigned" && (
        <section className="workspace">
          <div className="workspace-head">
            <div>
              <h2>Group Photos into a Garment</h2>
              <p>
                Select every photo of the same physical garment, then group them
                together. We never create a separate garment from each photo.
              </p>
            </div>
            <div className="view-controls">
              <Button icon="filter">Filter</Button>
              <Button icon="grid">Compact</Button>
            </div>
          </div>
          {selected.length > 0 && (
            <div className="selection-bar">
              <strong>{selected.length} selected</strong>
              <button
                onClick={() =>
                  setSelected(
                    photos.filter((p) => !p.assigned).map((p) => p.id),
                  )
                }
              >
                Select all
              </button>
              <span />
              <Button variant="primary" icon="plus" onClick={createGroup}>
                Group Photos into a Garment
              </Button>
              <Button>Add to Garment</Button>
              <Button disabled>Remove from Garment</Button>
              <Button
                variant="danger"
                icon="trash"
                onClick={() => setConfirm("Delete selected photos?")}
              >
                Delete Selected
              </Button>
            </div>
          )}
          <div className="photo-grid">
            {photos
              .filter((p) => !p.assigned)
              .map((photo) => (
                <button
                  key={photo.id}
                  className={`photo-card ${
                    selected.includes(photo.id) ? "selected" : ""
                  } ${photo.state === "Failed" ? "failed" : ""}`}
                  onClick={() => toggle(photo.id)}
                >
                  <span className="photo-check">
                    {selected.includes(photo.id) && (
                      <Icon name="check" size={13} />
                    )}
                  </span>
                  <div className="photo-placeholder">
                    <Icon name="image" size={26} />
                    <span>
                      {photo.id % 3 === 0
                        ? "BACK"
                        : photo.id % 2
                          ? "FRONT"
                          : "DETAIL"}
                    </span>
                  </div>
                  <div className="photo-meta">
                    <strong>{photo.name}</strong>
                    <span>
                      {photo.state === "Failed"
                        ? "Upload failed — try again"
                        : photo.state === "Uploading"
                          ? "Uploading 62%"
                          : "Waiting to be grouped"}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </section>
      )}
      {tab === "groups" && (
        <GroupsWorkspace
          created={groupCreated}
          name={groupName}
          setName={setGroupName}
          navigate={navigate}
          showToast={showToast}
        />
      )}
      {tab === "review" && (
        <ReviewWorkspace
          navigate={navigate}
          showToast={showToast}
          setConfirm={setConfirm}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm}
          body={
            confirm.startsWith("Publish")
              ? "Only garments that are ready will be published. The remaining garments will stay safely saved as drafts."
              : "This cannot be undone. Your garment details will stay safe, but the selected photos will be permanently removed."
          }
          action={
            confirm.startsWith("Publish")
              ? "Publish 5 garments"
              : "Delete photos"
          }
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.startsWith("Publish")) {
              setConfirm(null)
              showToast("5 garments published. 3 unfinished drafts were kept.")
              return
            }
            setPhotos((current) =>
              current.filter((p) => !selected.includes(p.id)),
            )
            setSelected([])
            setConfirm(null)
            showToast("Selected photos deleted.")
          }}
        />
      )}
    </div>
  )
}

export function GroupsWorkspace({
  created,
  name,
  setName,
  navigate,
  showToast,
}: {
  created: boolean
  name: string
  setName: (v: string) => void
  navigate: (p: Page) => void
  showToast: (v: string) => void
}) {
  const groups = [
    {
      name: "Vintage Oxford Shirt",
      dept: "Men",
      category: "Shirts",
      price: "3400.00",
      photos: 4,
      status: "Ready to publish",
    },
    {
      name: "Straight-Leg Denim Jeans",
      dept: "Women",
      category: "Jeans",
      price: "4800.00",
      photos: 5,
      status: "Ready to publish",
    },
    {
      name: "Cotton Utility Trousers",
      dept: "Men",
      category: "Trousers",
      price: "4200.00",
      photos: 3,
      status: "Needs more details",
    },
  ]
  if (created)
    groups.unshift({
      name,
      dept: "Women",
      category: "Jackets",
      price: "7200.00",
      photos: 3,
      status: "Needs more details",
    })
  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <h2>Add Garment Details</h2>
          <p>
            Each group is one physical garment. Add the basic details here or
            open the full garment form.
          </p>
        </div>
        <div className="default-controls">
          <span>Apply defaults:</span>
          <select>
            <option>Women · Pre-owned · Qty 1</option>
          </select>
          <Button>Apply</Button>
        </div>
      </div>
      <div className="group-list">
        {groups.map((group, index) => (
          <article className="group-card" key={`${group.name}-${index}`}>
            <div className="group-gallery">
              <div className="primary-image">
                <ProductThumb label="MAIN" large />
                <span>Main photo</span>
              </div>
              <div className="gallery-strip">
                {Array.from({ length: Math.min(group.photos, 4) }).map(
                  (_, i) => (
                    <button key={i} className={i === 0 ? "active" : ""}>
                      <span className="drag-handle">
                        <Icon name="drag" size={13} />
                      </span>
                      <ProductThumb label={`${i + 1}`} />
                    </button>
                  ),
                )}
                <button className="add-photo">
                  <Icon name="plus" size={17} />
                  <span>Add</span>
                </button>
              </div>
              <small>{group.photos} photos · Drag to reorder</small>
            </div>
            <div className="quick-fields">
              <div className="group-title">
                <div>
                  <span>GARMENT {String(index + 1).padStart(2, "0")}</span>
                  <Status
                    tone={
                      group.status === "Ready to publish" ? "dark" : "outline"
                    }
                  >
                    {group.status}
                  </Status>
                </div>
                <Button variant="text" onClick={() => navigate("editor")}>
                  Edit Garment <Icon name="arrow" size={14} />
                </Button>
              </div>
              <div className="form-grid">
                <Field label="Garment name" required>
                  <input
                    value={index === 0 && created ? name : group.name}
                    onChange={(e) =>
                      index === 0 && created && setName(e.target.value)
                    }
                  />
                </Field>
                <Field label="Department" required>
                  <select defaultValue={group.dept}>
                    <option>Women</option>
                    <option>Men</option>
                    <option>Kids</option>
                  </select>
                </Field>
                <Field label="Category" required>
                  <select defaultValue={group.category}>
                    <option>Jackets</option>
                    <option>Shirts</option>
                    <option>Jeans</option>
                    <option>Trousers</option>
                  </select>
                </Field>
                <Field label="Selling price" required>
                  <div className="money-input">
                    <span>₹</span>
                    <input defaultValue={group.price} />
                  </div>
                </Field>
                <Field label="Discounted price">
                  <div className="money-input">
                    <span>₹</span>
                    <input placeholder="Optional" />
                  </div>
                </Field>
                <Field label="Fabric">
                  <input placeholder="e.g. 100% cotton" />
                </Field>
                <Field label="Fit">
                  <select>
                    <option>Not specified</option>
                    <option>Regular</option>
                    <option>Relaxed</option>
                    <option>Slim</option>
                  </select>
                </Field>
              </div>
              <details>
                <summary>
                  Description and sizes (optional){" "}
                  <span>Size · Colour · SKU · Quantity</span>
                </summary>
                <div className="variant-row">
                  <input placeholder="Size" />
                  <input placeholder="Colour" />
                  <input placeholder="SKU" />
                  <input placeholder="Qty" />
                  <Button variant="text" icon="trash">
                    Remove
                  </Button>
                </div>
                <Button icon="plus">Add size or colour</Button>
              </details>
            </div>
            <div className="group-actions">
              <button title="More options">
                <Icon name="more" />
              </button>
              <Button
                onClick={() => showToast(`${group.name} saved as a draft.`)}
              >
                Save Draft
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ReviewWorkspace({
  navigate,
  showToast,
  setConfirm,
}: {
  navigate: (p: Page) => void
  showToast: (v: string) => void
  setConfirm: (v: string) => void
}) {
  const rows = [
    [
      "Vintage Oxford Shirt",
      "4 photos",
      "Ready to publish",
      "All details added",
    ],
    [
      "Straight-Leg Denim Jeans",
      "5 photos",
      "Ready to publish",
      "All details added",
    ],
    [
      "Wool Blend Check Jacket",
      "3 photos",
      "Needs more details",
      "Add a category",
    ],
    [
      "Cotton Utility Trousers",
      "3 photos",
      "Upload failed",
      "1 photo needs retrying",
    ],
    ["Pleated Midi Dress", "4 photos", "Ready to publish", "All details added"],
  ]
  return (
    <section className="workspace review-workspace">
      <div className="workspace-head">
        <div>
          <h2>Review and Publish</h2>
          <p>
            Publish the garments that are ready. Unfinished garments will stay
            safely saved as drafts.
          </p>
        </div>
        <div className="review-summary">
          <strong>5</strong>
          <span>valid</span>
          <strong>3</strong>
          <span>need attention</span>
        </div>
      </div>
      <div className="validation-banner">
        <Icon name="alert" />
        <div>
          <strong>3 garments need more work</strong>
          <span>
            Add missing details or retry failed photos. You can still publish
            the 5 garments that are ready.
          </span>
        </div>
      </div>
      <div className="review-list">
        {rows.map((row, i) => (
          <div className="review-row" key={row[0]}>
            <ProductThumb type={i % 2 ? "jeans" : "shirt"} />
            <div>
              <strong>{row[0]}</strong>
              <span>{row[1]}</span>
            </div>
            <Status
              tone={
                row[2] === "Ready to publish"
                  ? "dark"
                  : row[2] === "Upload failed"
                    ? "error"
                    : "outline"
              }
            >
              {row[2]}
            </Status>
            <span className="validation-detail">{row[3]}</span>
            <Button variant="text" onClick={() => navigate("editor")}>
              {row[2] === "Ready to publish" ? "View" : "Fix this"}{" "}
              <Icon name="chevron" size={14} />
            </Button>
          </div>
        ))}
      </div>
      <div className="review-footer">
        <div>
          <strong>5 of 8 garments are ready</strong>
          <span>
            Publishing ready garments will not remove unfinished work.
          </span>
        </div>
        <Button onClick={() => showToast("All 8 garments saved as drafts.")}>
          Save Drafts
        </Button>
        <Button
          variant="primary"
          onClick={() => setConfirm("Publish 5 ready garments?")}
        >
          Publish Ready Garments
        </Button>
      </div>
    </section>
  )
}

export function ProductTable({
  rows,
  compact,
  selected = [],
  onSelect,
  onEdit,
}: {
  rows: Product[]
  compact?: boolean
  selected?: number[]
  onSelect?: (id: number) => void
  onEdit?: () => void
}) {
  return (
    <div className="table-wrap">
      <table className={`data-table ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            {!compact && (
              <th>
                <input type="checkbox" aria-label="Select all clothes" />
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
          {rows.map((product) => (
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
                  <ProductThumb type={product.photo} />
                  <strong>{product.name}</strong>
                </div>
              </td>
              <td>{product.department}</td>
              {!compact && <td>{product.category}</td>}
              <td>
                <Status
                  tone={
                    product.status === "Published"
                      ? "dark"
                      : product.status === "Archived"
                        ? "neutral"
                        : "outline"
                  }
                >
                  {product.status === "Review"
                    ? "Needs review"
                    : product.status === "Archived"
                      ? "In archive"
                      : product.status}
                </Status>
              </td>
              {!compact && <td>₹{product.price.toFixed(2)}</td>}
              {!compact && <td>{product.stock}</td>}
              <td>{product.updated}</td>
              <td>
                {compact ? (
                  <button
                    className="icon-button"
                    onClick={onEdit}
                    title="Edit garment"
                  >
                    <Icon name="chevron" />
                  </button>
                ) : (
                  <Button variant="text" onClick={onEdit}>
                    Edit
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Catalogue({
  navigate,
  showToast,
}: {
  navigate: (p: Page) => void
  showToast: (v: string) => void
}) {
  const [selected, setSelected] = useState<number[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All statuses")
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState(false)
  const filtered = products.filter(
    (product) =>
      product.name.toLowerCase().includes(query.toLowerCase()) &&
      (status === "All statuses" || product.status === status),
  )
  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  return (
    <div className="page">
      <PageHeader
        title="All Clothes"
        description="Find and manage every garment in your shop."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => navigate("editor")}
          >
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clothes by name"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All statuses</option>
            <option>Published</option>
            <option>Draft</option>
            <option value="Review">Needs review</option>
            <option value="Archived">In archive</option>
          </select>
          <select>
            <option>Men, Women, Kids</option>
            <option>Men</option>
            <option>Women</option>
            <option>Kids</option>
          </select>
          <Button icon="filter">More filters</Button>
        </div>
        <div className="saved-views">
          <span>Saved views</span>
          <button className="active">
            All clothes <b>248</b>
          </button>
          <button>
            Drafts <b>14</b>
          </button>
          <button>
            Archived <b>7</b>
          </button>
          <div />
          <label>
            Sort by{" "}
            <select>
              <option>Updated date</option>
              <option>Name</option>
              <option>Selling price</option>
              <option>Creation date</option>
            </select>
          </label>
        </div>
        {selected.length > 0 && (
          <div className="selection-bar catalogue-selection">
            <strong>{selected.length} garments selected</strong>
            <button onClick={() => setSelected(products.map((p) => p.id))}>
              Select all 248
            </button>
            <span />
            <Button onClick={() => showToast("Selected garments published.")}>
              Publish
            </Button>
            <Button>Unpublish</Button>
            <Button>Move to archive</Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => setConfirm(true)}
            >
              Delete clothes
            </Button>
          </div>
        )}
        {filtered.length ? (
          <ProductTable
            rows={filtered}
            selected={selected}
            onSelect={toggle}
            onEdit={() => navigate("editor")}
          />
        ) : (
          <div className="empty-state">
            <span>
              <Icon name="search" size={24} />
            </span>
            <h3>No clothes found</h3>
            <p>Try a different name or clear the selected filters.</p>
            <Button
              onClick={() => {
                setQuery("")
                setStatus("All statuses")
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        <div className="pagination">
          <span>
            Showing {filtered.length ? "1–8" : "0"} of{" "}
            {filtered.length ? "248" : "0"} garments
          </span>
          <label>
            Rows per page{" "}
            <select>
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
          </label>
          <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="page-number">{page}</span>
          <Button onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </section>
      {confirm && (
        <ConfirmDialog
          title="Delete selected clothes?"
          body={`${selected.length} garments will be permanently deleted. Their photos will stay in the Photo Library so you can use them again.`}
          action="Delete clothes"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setSelected([])
            setConfirm(false)
            showToast("Selected garments deleted.")
          }}
        />
      )}
    </div>
  )
}

export function Editor({ showToast }: { showToast: (v: string) => void }) {
  const [name, setName] = useState("Wool Blend Check Jacket")
  const [slug] = useState(() =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
  )
  const [primary, setPrimary] = useState(0)
  const [variants, setVariants] = useState([
    { size: "M", color: "Brown check", sku: "SE-WBJ-M-01", qty: "1" },
  ])
  const [confirm, setConfirm] = useState<string | null>(null)
  const valid = name.trim().length > 0
  return (
    <div className="page editor-page">
      <div className="editor-breadcrumb">
        All Clothes <Icon name="chevron" size={13} /> Drafts{" "}
        <Icon name="chevron" size={13} /> Wool Blend Check Jacket
      </div>
      <PageHeader
        title="Edit Garment"
        description="Draft · Garment SE-0248 · Last saved 12 minutes ago"
        actions={
          <>
            <span className="save-state">
              <span />
              Unsaved changes
            </span>
            <Button onClick={() => showToast("Garment saved as a draft.")}>
              Save Draft
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                showToast("Garment checked and published successfully.")
              }
            >
              Publish
            </Button>
          </>
        }
      />
      <div className="editor-layout">
        <main className="editor-main">
          <input type="hidden" name="slug" value={slug} />
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
                  placeholder="Describe the garment, material, condition, colour, or notable details."
                  defaultValue="A structured wool-blend jacket in a soft brown check. Fully lined with two front pockets and a single-button closure."
                />
              </Field>
              <div className="form-grid two">
                <Field label="Department" required>
                  <select defaultValue="Women">
                    <option>Women</option>
                    <option>Men</option>
                    <option>Kids</option>
                  </select>
                </Field>
                <Field label="Category" required>
                  <select defaultValue="Jackets">
                    <option>Jackets</option>
                    <option>Shirts</option>
                    <option>Jeans</option>
                    <option>Dresses</option>
                  </select>
                </Field>
                <Field label="Fabric (optional)">
                  <input defaultValue="70% wool, 30% polyester" />
                </Field>
                <Field label="Fit (optional)">
                  <select defaultValue="Regular">
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
                Drag photos to reorder them. Select a photo to make it the main
                photo.
              </p>
              <div className="editor-gallery">
                {[0, 1, 2, 3].map((i) => (
                  <button
                    key={i}
                    className={primary === i ? "primary" : ""}
                    onClick={() => setPrimary(i)}
                  >
                    <span className="drag-handle">
                      <Icon name="drag" size={14} />
                    </span>
                    <ProductThumb
                      label={i === 0 ? "FRONT" : i === 1 ? "BACK" : "DETAIL"}
                      large
                    />
                    {primary === i && (
                      <b>
                        <Icon name="check" size={12} /> Main photo
                      </b>
                    )}
                    <span className="remove-photo">
                      <Icon name="close" size={13} />
                    </span>
                  </button>
                ))}
                <button className="gallery-add">
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
                  <input defaultValue="720.00" />
                </div>
              </Field>
              <Field label="Discounted price (optional)">
                <div className="money-input">
                  <span>₹</span>
                  <input placeholder="Leave blank if not on sale" />
                </div>
              </Field>
            </div>
          </section>
          <section className="form-section">
            <div className="section-title">
              <h2>Sizes and stock</h2>
            </div>
            <div className="form-body">
              <p className="section-help">
                Add sizes, colours, and quantities if needed. Leave this empty
                for a one-off garment with no size choice.
              </p>
              <div className="variant-head">
                <span>Size</span>
                <span>Colour</span>
                <span>SKU</span>
                <span>Quantity</span>
                <span>For sale</span>
                <span />
              </div>
              {variants.map((variant, i) => (
                <div className="variant-editor-row" key={i}>
                  <input defaultValue={variant.size} />
                  <input defaultValue={variant.color} />
                  <input defaultValue={variant.sku} />
                  <input defaultValue={variant.qty} />
                  <label className="toggle">
                    <input type="checkbox" defaultChecked />
                    <span />
                  </label>
                  <Button
                    variant="text"
                    icon="trash"
                    onClick={() =>
                      setVariants((current) =>
                        current.filter((_, index) => index !== i),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                icon="plus"
                onClick={() =>
                  setVariants((v) => [
                    ...v,
                    { size: "", color: "", sku: "", qty: "1" },
                  ])
                }
              >
                Add size or colour
              </Button>
            </div>
          </section>
        </main>
        <aside className="editor-aside">
          <section className="side-card">
            <div className="side-card-head">
              <h2>Publishing</h2>
              <Status tone="outline">Draft</Status>
            </div>
            <Field label="Status">
              <select>
                <option>Draft</option>
                <option>Published</option>
                <option>Archived</option>
              </select>
            </Field>
            <Field label="Publish date">
              <input type="date" defaultValue="2025-05-30" />
            </Field>
            <Button
              variant="primary"
              onClick={() => showToast("Garment published successfully.")}
            >
              Publish Garment
            </Button>
          </section>
          <section className="side-card checklist">
            <div className="side-card-head">
              <h2>Ready to publish?</h2>
              <strong>5 of 5</strong>
            </div>
            {[
              "Garment name added",
              "Department chosen",
              "Category chosen",
              "Selling price added",
              "At least one photo added",
            ].map((item) => (
              <div key={item}>
                <span>
                  <Icon name="check" size={13} />
                </span>
                {item}
              </div>
            ))}
            <p>This garment is ready to publish.</p>
          </section>
          <section className="side-card save-info">
            <h2>Save state</h2>
            <div>
              <span />
              <p>
                <strong>Unsaved changes</strong>
                <small>Changes remain in this browser until saved.</small>
              </p>
            </div>
            <Button onClick={() => showToast("Garment saved as a draft.")}>
              Save Draft
            </Button>
          </section>
          <section className="side-card danger-zone">
            <h2>Garment actions</h2>
            <Button
              onClick={() => setConfirm("Move this garment to the archive?")}
            >
              Move to archive
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirm("Delete this garment?")}
            >
              Delete Garment
            </Button>
          </section>
        </aside>
      </div>
      {confirm && (
        <ConfirmDialog
          title={confirm}
          body="Any unsaved changes may be lost. Please check before continuing."
          action={
            confirm.startsWith("Delete") ? "Delete garment" : "Move to archive"
          }
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            showToast("Garment updated.")
          }}
        />
      )}
    </div>
  )
}

export function MediaLibrary({ showToast }: { showToast: (v: string) => void }) {
  const [selected, setSelected] = useState<number[]>([])
  const [drawer, setDrawer] = useState<number | null>(2)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [filter, setFilter] = useState("All")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const assets = Array.from({ length: 18 }, (_, i) => ({
    id: i + 1,
    name: `IMG_${4821 + i}.jpg`,
    assigned: i % 4 !== 0,
    size: `${(2.1 + (i % 5) * 0.6).toFixed(1)} MB`,
    dimensions: i % 2 ? "3024 × 4032" : "4032 × 3024",
  }))
  const shown =
    filter === "All"
      ? assets
      : assets.filter((a) => (filter === "Assigned" ? a.assigned : !a.assigned))
  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    )
  return (
    <div className="page media-page">
      <PageHeader
        title="Photo Library"
        description="Find photos and see which garment each one belongs to."
        actions={
          <Button variant="primary" icon="upload">
            Upload Photos
          </Button>
        }
      />
      <section className="panel">
        <div className="media-toolbar">
          <div className="search-input">
            <Icon name="search" size={17} />
            <input placeholder="Search by filename" />
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
          <select>
            <option>All file types</option>
            <option>JPG</option>
            <option>PNG</option>
            <option>WEBP</option>
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
        {selected.length > 0 && (
          <div className="selection-bar">
            <strong>{selected.length} photos selected</strong>
            <button onClick={() => setSelected(shown.map((a) => a.id))}>
              Select all
            </button>
            <span />
            <Button>Assign to Garment</Button>
            <Button>Move Photos</Button>
            <Button variant="danger" icon="trash">
              Delete Photos
            </Button>
          </div>
        )}
        <div className={view === "grid" ? "asset-grid" : "asset-list"}>
          {shown.map((asset) => (
            <article
              className={`asset-card ${
                selected.includes(asset.id) ? "selected" : ""
              }`}
              key={asset.id}
            >
              <button className="asset-select" onClick={() => toggle(asset.id)}>
                {selected.includes(asset.id) && <Icon name="check" size={12} />}
              </button>
              <button
                className="asset-preview"
                onClick={() => setDrawer(asset.id)}
              >
                <Icon name="image" size={26} />
                <span>
                  {asset.id % 3 === 0
                    ? "DETAIL"
                    : asset.id % 2
                      ? "FRONT"
                      : "BACK"}
                </span>
              </button>
              <div className="asset-meta">
                <strong>{asset.name}</strong>
                <span>
                  {asset.dimensions} · {asset.size}
                </span>
                <Status tone={asset.assigned ? "neutral" : "outline"}>
                  {asset.assigned ? "Assigned to a garment" : "Not assigned"}
                </Status>
              </div>
            </article>
          ))}
        </div>
        <div className="pagination">
          <span>Showing 1–18 of 1,284 photos</span>
          <div />
          <Button disabled>Previous</Button>
          <span className="page-number">1</span>
          <Button>Next</Button>
        </div>
      </section>
      {drawer !== null && (
        <div className="drawer">
          <div className="drawer-head">
            <div>
              <span>PHOTO DETAILS</span>
              <h2>IMG_{4820 + drawer}.jpg</h2>
            </div>
            <button onClick={() => setDrawer(null)}>
              <Icon name="close" />
            </button>
          </div>
          <div className="drawer-preview">
            <Icon name="image" size={36} />
            <span>GARMENT PHOTO</span>
          </div>
          <div className="drawer-section">
            <h3>File information</h3>
            <dl>
              <div>
                <dt>File type</dt>
                <dd>JPEG image</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>3024 × 4032 px</dd>
              </div>
              <div>
                <dt>File size</dt>
                <dd>3.8 MB</dd>
              </div>
              <div>
                <dt>Uploaded</dt>
                <dd>30 May 2025, 09:18</dd>
              </div>
            </dl>
          </div>
          <div className="drawer-section">
            <h3>Assignment</h3>
            <div className="assigned-product">
              <ProductThumb type="jacket" />
              <div>
                <strong>Wool Blend Check Jacket</strong>
                <span>Main photo · Draft garment</span>
              </div>
              <Icon name="chevron" />
            </div>
            <Button>Assign to a Different Garment</Button>
          </div>
          <div className="drawer-footer">
            <Button
              variant="danger"
              icon="trash"
              onClick={() => setConfirmDelete(true)}
            >
              Delete Photo
            </Button>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this photo?"
          body="This photo is attached to Wool Blend Check Jacket. Deleting it will remove it from that garment too."
          action="Delete Photo"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            setDrawer(null)
            showToast("Photo deleted from the garment and Photo Library.")
          }}
        />
      )}
    </div>
  )
}


export function ConfirmDialog({
  title,
  body,
  action,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  action: string
  onCancel: () => void
  onConfirm: () => void
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
  )
}

export default function App({ initialPage = "overview" }: { initialPage?: Page }) {
  const [page, setPageInternal] = useState<Page>(initialPage)
  const [toast, setToast] = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setPageInternal(initialPage)
  }, [initialPage])

  const setPage = (p: Page) => {
    setPageInternal(p)
    const routeMap: Record<Page, string> = {
      overview: "/admin",
      intake: "/admin/intake",
      catalogue: "/admin/products",
      editor: "/admin/products/1",
      media: "/admin/media",
    }
    if (typeof window !== "undefined" && window.location.pathname !== routeMap[p]) {
      window.history.pushState(null, "", routeMap[p])
    }
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 3200)
  }
  const screen = useMemo(() => {
    if (page === "overview") return <Overview navigate={setPage} />
    if (page === "intake")
      return <Intake navigate={setPage} showToast={showToast} />
    if (page === "catalogue")
      return <Catalogue navigate={setPage} showToast={showToast} />
    if (page === "editor") return <Editor showToast={showToast} />
    return <MediaLibrary showToast={showToast} />
  }, [page])
  return (
    <div className="app-shell">
      {/* Mobile top bar */}
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
          {nav.find((n) => n.id === page)?.label || "Admin"}
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
  )
}
