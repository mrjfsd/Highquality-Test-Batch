"use client";

import Link from "next/link";
import React from "react";

export type AdminProductNavTab = "catalogue" | "single" | "bulk";

interface AdminProductNavProps {
  current: AdminProductNavTab;
  title?: string;
  subtitle?: string;
  extraActions?: React.ReactNode;
}

export function AdminProductNav({
  current,
  title,
  subtitle,
  extraActions,
}: AdminProductNavProps) {
  const tabs = [
    {
      id: "catalogue" as const,
      label: "Product Catalogue",
      href: "/admin/products",
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M2 4.75A2.75 2.75 0 014.75 2h10.5A2.75 2.75 0 0118 4.75v10.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25V4.75zM4.75 3.5c-.69 0-1.25.56-1.25 1.25v2.75h13V4.75c0-.69-.56-1.25-1.25-1.25H4.75zM3.5 9v6.25c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V9h-13z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: "single" as const,
      label: "Single Product",
      href: "/admin/products/new",
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
      ),
    },
    {
      id: "bulk" as const,
      label: "Bulk Upload",
      href: "/admin/products/bulk",
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4.25A2.25 2.25 0 014.25 2h2.5A2.25 2.25 0 019 4.25v2.5A2.25 2.25 0 016.75 9h-2.5A2.25 2.25 0 012 6.75v-2.5zM2 13.25A2.25 2.25 0 014.25 11h2.5A2.25 2.25 0 019 13.25v2.5A2.25 2.25 0 016.75 18h-2.5A2.25 2.25 0 012 15.75v-2.5zM11 4.25A2.25 2.25 0 0113.25 2h2.5A2.25 2.25 0 0118 4.25v2.5A2.25 2.25 0 0115.75 9h-2.5A2.25 2.25 0 0111 6.75v-2.5zM11 13.25A2.25 2.25 0 0113.25 11h2.5A2.25 2.25 0 0118 13.25v2.5A2.25 2.25 0 0115.75 18h-2.5A2.25 2.25 0 0111 15.75v-2.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-4">
      {/* Top Meta & Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
            <Link href="/admin/products" className="hover:text-neutral-900 transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span className="text-neutral-900 font-semibold">
              {current === "catalogue"
                ? "Catalogue"
                : current === "single"
                ? "Add Single Product"
                : "Bulk Add Products"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 font-serif">
            {title ||
              (current === "catalogue"
                ? "Product Catalogue"
                : current === "single"
                ? "Add New Product"
                : "Bulk Add Products")}
          </h1>

          {subtitle && (
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {extraActions && (
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            {extraActions}
          </div>
        )}
      </div>

      {/* Unified Tab Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div
          role="tablist"
          aria-label="Admin Product Navigation"
          className="inline-flex flex-wrap items-center p-1 bg-neutral-100/90 border border-neutral-200 rounded-xl gap-1"
        >
          {tabs.map((tab) => {
            const isActive = current === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#702b38] text-white shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-white/70"
                }`}
              >
                <span className={isActive ? "text-white" : "text-neutral-400"}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Quick Help / Storefront link */}
        <Link
          href="/shop"
          className="text-[11px] font-semibold text-neutral-500 hover:text-[#702b38] transition-colors inline-flex items-center gap-1 ml-auto"
        >
          <span>View Customer Storefront</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
