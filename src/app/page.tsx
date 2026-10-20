export default function StarterPlaceholderPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-16 sm:py-24 max-w-4xl mx-auto w-full">
      <div className="w-full space-y-10">
        {/* Header Block */}
        <div className="space-y-4 text-center sm:text-left border-b border-neutral-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Backend Integrations Preserved & Ready
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Style-Edit Clean Starter
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            All previous storefront and admin UI pages have been cleanly removed. The project is ready for new website design, with full Supabase PostgreSQL database and private Cloudflare R2 storage connectivity intact.
          </p>
        </div>

        {/* Integration Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Supabase Module */}
          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
                Database & Auth
              </span>
              <span className="text-[11px] font-mono text-neutral-500">Supabase</span>
            </div>
            <h2 className="text-base font-semibold text-white">
              @/lib/supabase
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Browser and server Supabase clients, SSR session cookie refresh middleware, and server-side admin privilege verifiers.
            </p>
            <div className="pt-2 border-t border-neutral-800/80 font-mono text-[11px] text-neutral-400">
              <code>import &#123; getSupabaseClient &#125; from &apos;@/lib/supabase&apos;;</code>
            </div>
          </div>

          {/* Cloudflare R2 Module */}
          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
                Object Storage
              </span>
              <span className="text-[11px] font-mono text-neutral-500">Cloudflare R2</span>
            </div>
            <h2 className="text-base font-semibold text-white">
              @/lib/r2
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              S3-compatible R2 operations: presigned upload URL generation, secure read proxies, and atomic batch asset deletions.
            </p>
            <div className="pt-2 border-t border-neutral-800/80 font-mono text-[11px] text-neutral-400">
              <code>import &#123; generatePresignedUploadUrl &#125; from &apos;@/lib/r2&apos;;</code>
            </div>
          </div>

          {/* Preserved API Endpoints */}
          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
                Backend Handlers
              </span>
              <span className="text-[11px] font-mono text-neutral-500">Next.js App Router</span>
            </div>
            <h2 className="text-base font-semibold text-white">
              API Routes Preserved
            </h2>
            <ul className="text-xs text-neutral-400 space-y-1 font-mono">
              <li>• /api/images/[...key] (R2 Proxy)</li>
              <li>• /api/admin/images/upload-url</li>
              <li>• /api/admin/images/[id]</li>
              <li>• /api/admin/products/[id]</li>
              <li>• /api/products/[id]/gallery</li>
            </ul>
          </div>

          {/* Types & Compression */}
          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-purple-400">
                Types & Utilities
              </span>
              <span className="text-[11px] font-mono text-neutral-500">TypeScript</span>
            </div>
            <h2 className="text-base font-semibold text-white">
              @/types &amp; @/lib/images
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Strongly-typed schemas for Product, Variant, and ProductImage records, plus client-side compression &amp; batch uploader helpers.
            </p>
            <div className="pt-2 border-t border-neutral-800/80 font-mono text-[11px] text-neutral-400">
              <code>import type &#123; Product, ProductImage &#125; from &apos;@/types&apos;;</code>
            </div>
          </div>
        </div>

        {/* Quick-Start Guide Callout */}
        <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-950/80 space-y-3 text-xs">
          <p className="font-semibold text-neutral-200">
            How to start building new pages:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-neutral-400 leading-relaxed">
            <li>
              Replace or edit <code className="text-neutral-200 font-mono">src/app/page.tsx</code> to design your new homepage.
            </li>
            <li>
              Create new folders under <code className="text-neutral-200 font-mono">src/app/</code> (e.g. <code className="text-neutral-200 font-mono">src/app/shop/page.tsx</code>) for new routes.
            </li>
            <li>
              Query database data directly with <code className="text-neutral-200 font-mono">getSupabaseClient()</code> or server-side helpers in <code className="text-neutral-200 font-mono">@/lib/supabase</code>.
            </li>
            <li>
              Serve uploaded R2 images via <code className="text-neutral-200 font-mono">/api/images/&lt;storage_path&gt;</code> without exposing R2 credentials.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
