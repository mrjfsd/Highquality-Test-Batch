"use client";

import React, { useState, useEffect, useRef } from "react";

export interface PredefinedColor {
  name: string;
  hex: string;
  border?: boolean;
}

export const PREDEFINED_COLORS: PredefinedColor[] = [
  { name: "Black", hex: "#111827" },
  { name: "White", hex: "#FFFFFF", border: true },
  { name: "Blue", hex: "#2563EB" },
  { name: "Navy", hex: "#1E3A8A" },
  { name: "Grey", hex: "#6B7280" },
  { name: "Light Grey", hex: "#D1D5DB", border: true },
  { name: "Beige", hex: "#D4C5B9", border: true },
  { name: "Brown", hex: "#78350F" },
  { name: "Green", hex: "#16A34A" },
  { name: "Olive", hex: "#556B2F" },
  { name: "Red", hex: "#DC2626" },
  { name: "Maroon", hex: "#800020" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Orange", hex: "#F97316" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Purple", hex: "#9333EA" },
];

export const COLOR_HEX_MAP: Record<string, string> = {
  black: "#111827",
  white: "#FFFFFF",
  blue: "#2563EB",
  navy: "#1E3A8A",
  grey: "#6B7280",
  gray: "#6B7280",
  "light grey": "#D1D5DB",
  "light gray": "#D1D5DB",
  beige: "#D4C5B9",
  brown: "#78350F",
  green: "#16A34A",
  olive: "#556B2F",
  red: "#DC2626",
  maroon: "#800020",
  burgundy: "#800020",
  pink: "#EC4899",
  orange: "#F97316",
  yellow: "#EAB308",
  purple: "#9333EA",
  charcoal: "#374151",
  cream: "#FFFDD0",
  ivory: "#FFFFF0",
  sand: "#C2B280",
  taupe: "#8B8589",
  stone: "#9CA3AF",
  khaki: "#C3B091",
};

export function resolveColorHex(colorName: string): string {
  if (!colorName) return "#6B7280";
  const trimmed = colorName.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb")) return trimmed;
  const lower = trimmed.toLowerCase();
  return COLOR_HEX_MAP[lower] || "#6B7280";
}

export function isLightColor(colorName: string): boolean {
  const lower = colorName.trim().toLowerCase();
  return ["white", "beige", "light grey", "light gray", "cream", "ivory"].includes(lower);
}

export function normalizeColorName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export interface ColorMultiSelectProps {
  selectedColors: string[];
  onChange: (colors: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export function ColorMultiSelect({
  selectedColors,
  onChange,
  disabled = false,
  hasError = false,
}: ColorMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleToggleColor = (colorName: string) => {
    const norm = normalizeColorName(colorName);
    const exists = selectedColors.some((c) => c.toLowerCase() === norm.toLowerCase());
    if (exists) {
      onChange(selectedColors.filter((c) => c.toLowerCase() !== norm.toLowerCase()));
    } else {
      onChange([...selectedColors, norm]);
    }
  };

  const handleRemoveColor = (colorName: string) => {
    onChange(selectedColors.filter((c) => c.toLowerCase() !== colorName.toLowerCase()));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleAddCustomColor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = normalizeColorName(customInput);
    if (!clean) return;
    const exists = selectedColors.some((c) => c.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      onChange([...selectedColors, clean]);
    }
    setCustomInput("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger & Selected Chips container */}
      <div
        className={`min-h-[38px] p-1.5 bg-white border rounded-lg transition-all flex flex-wrap items-center gap-1.5 ${
          hasError
            ? "border-red-400 bg-red-50/30 ring-1 ring-red-300"
            : isOpen
            ? "border-[#800020] ring-1 ring-[#800020]"
            : "border-neutral-300 hover:border-neutral-400"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-neutral-50" : ""}`}
      >
        {selectedColors.map((color) => {
          const hex = resolveColorHex(color);
          const needsBorder = isLightColor(color);

          return (
            <span
              key={color}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-medium border border-neutral-200 transition-colors"
            >
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  needsBorder ? "border border-neutral-300" : ""
                }`}
                style={{ backgroundColor: hex }}
              />
              <span>{color}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveColor(color);
                  }}
                  className="w-3.5 h-3.5 rounded-full hover:bg-neutral-300 flex items-center justify-center text-neutral-500 hover:text-neutral-800 text-[10px] cursor-pointer"
                  title={`Remove ${color}`}
                >
                  ✕
                </button>
              )}
            </span>
          );
        })}

        {/* Add/Select Colors Button Trigger */}
        {!disabled && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-600 hover:text-[#800020] hover:bg-neutral-50 rounded transition-colors cursor-pointer"
          >
            <span className="text-[#800020] font-bold">+</span>
            <span>{selectedColors.length === 0 ? "Select Colors..." : "Add Color"}</span>
          </button>
        )}
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 p-3 space-y-3 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
              Select Colors ({selectedColors.length})
            </span>
            {selectedColors.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] text-red-600 hover:text-red-800 font-semibold cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Predefined Color Grid */}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            <div className="grid grid-cols-2 gap-1.5">
              {PREDEFINED_COLORS.map((color) => {
                const isSelected = selectedColors.some(
                  (c) => c.toLowerCase() === color.name.toLowerCase()
                );

                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => handleToggleColor(color.name)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#800020]/10 border-[#800020] text-[#800020] font-semibold"
                        : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                          color.border ? "border border-neutral-300" : ""
                        }`}
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="truncate">{color.name}</span>
                    </div>
                    {isSelected && <span className="text-[11px] font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Input Form */}
          <div className="pt-2 border-t border-neutral-100 space-y-1.5">
            <span className="text-[10px] font-semibold uppercase text-neutral-500 tracking-wider">
              Or Add Custom Color:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="e.g. Charcoal, Sage, Terracotta"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomColor();
                  }
                }}
                className="flex-1 px-2.5 py-1 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800020] focus:border-[#800020]"
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                disabled={!customInput.trim()}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Done Button */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-1.5 text-xs font-semibold rounded-lg bg-[#800020] text-white hover:bg-[#66001a] transition-colors cursor-pointer text-center"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
