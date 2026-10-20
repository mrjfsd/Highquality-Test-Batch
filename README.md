# Style-Edit — Clothing E-Commerce POC Foundation

A minimal, scalable Next.js project foundation for a clothing e-commerce Proof of Concept (POC). Built with Supabase PostgreSQL for relational catalog data & authentication, and private Cloudflare R2 for zero-egress, high-performance image asset storage.

---

## Architecture Overview

The architecture separates structured product records from binary image assets:

```
[Admin Portal (/admin)] 
        │
        ├── 1. Request Presigned Upload URL ──► [Next.js Route Handler (/api/admin/images/upload-url)]
        │                                           │ (Validates Admin JWT & File Size/MIME)
        │   ◄── Presigned PUT URL (10m expiry) ─────┘
        │
        ├── 2. Direct Binary Upload (PUT) ────► [Cloudflare R2 (Private Bucket)]
        │
        ├── 3. Metadata & Object Key ────────► [Supabase PostgreSQL (Database)]
        │
[Customer Storefront (/)]
        │
        ├── 4. Read Catalog Records ─────────► [Supabase PostgreSQL (Database)]
        │
        └── 5. Private Image Proxy ──────────► [Next.js Proxy (/api/images/[...key])]
                                                    │ (Redirects via signed GET URL, 1h expiry)
                                                    ▼
                                               [Cloudflare R2 (Private Bucket)]
```

1. **Supabase PostgreSQL**: Stores structured product records (SKU, title, category, price, asset references) with Row Level Security.
2. **Cloudflare R2**: Stores binary catalog images in a private bucket with zero egress fees (~500–600 images targeted).
3. **Supabase Auth & SSR**: Guards admin routes and sensitive API operations using cookie-forwarded server verification.

---

## Project Structure

```
Style-Edit/
├── .env.example             # Supabase & Cloudflare R2 environment variable template
├── package.json             # Next.js 16, React 19, AWS S3 SDK, Supabase SSR
├── tsconfig.json            # TypeScript configuration with @/* path alias
├── next.config.ts           # Next.js configuration
├── supabase/
│   └── migrations/          # Idempotent PostgreSQL DDL migrations with RLS
├── src/
│   ├── middleware.ts        # Supabase SSR session token refresh middleware
│   ├── app/
│   │   ├── layout.tsx       # Root layout with POC navigation header & footer
│   │   ├── page.tsx         # Customer storefront route (/)
│   │   ├── admin/           # Admin management portal (/admin)
│   │   │   ├── page.tsx     # Admin dashboard
│   │   │   ├── login/       # Admin sign-in route
│   │   │   ├── image-test/  # Isolated R2 presigned upload tester
│   │   │   └── products/    # Product creation (/new) and inspector (/[id])
│   │   └── api/             # Server-side Route Handlers
│   │       ├── admin/images/upload-url/ # Presigned R2 PUT URL generator
│   │       ├── admin/images/[id]/       # Authorized single-image deletion
│   │       ├── admin/products/[id]/     # Authorized product + R2 images deletion
│   │       └── images/[...key]/         # Secure proxy redirect for private R2 assets
│   ├── lib/
│   │   ├── r2/              # S3-compatible Cloudflare R2 client & operations
│   │   └── supabase/        # Browser client, SSR server client, admin client, auth verifiers
│   └── types/
│       ├── product.ts       # Domain schemas (Product, ProductVariant, ProductImage)
│       └── index.ts         # Type exports
└── README.md
```

---

## POC Routes

| Route | Role | Description |
| :--- | :--- | :--- |
| `/` | Customer Storefront | Displays published products and loads images via private R2 proxy |
| `/admin` | Admin Portal | Management dashboard checking admin status |
| `/admin/login` | Admin Authentication | Sign in for authorized personnel |
| `/admin/products/new` | Product Creation | Atomic product creation with direct-to-R2 image upload |
| `/admin/products/[id]` | Product Inspector | Inspects product details, variants, images, and deletion |
| `/admin/image-test` | Upload POC | Isolated single-image upload test tool |

---

## Setup Instructions

### 1. Prerequisites
- Node.js `v20+` (tested on Node `v24.x`)
- npm `v10+`

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
```bash
copy .env.example .env.local
```
Fill in `.env.local` with your Supabase project credentials and Cloudflare R2 credentials.

### 4. Database Schema
Execute the SQL migration in `supabase/migrations/20261019_initial_schema.sql` inside the Supabase SQL Editor.

### 5. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the Storefront and [http://localhost:3000/admin](http://localhost:3000/admin) for the Admin interface.
