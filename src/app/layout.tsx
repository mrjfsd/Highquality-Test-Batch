import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Style-Edit | Next.js Starter",
  description: "Clean Next.js project foundation with Supabase and Cloudflare R2 integrations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-900 text-neutral-100 antialiased flex flex-col font-sans selection:bg-neutral-700 selection:text-white">
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
