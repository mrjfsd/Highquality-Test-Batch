"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react";

// ── DropdownMenu Root Context ──
interface DropdownContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

export interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (updater: boolean | ((prev: boolean) => boolean)) => {
    if (isControlled) {
      const nextVal = typeof updater === "function" ? updater(controlledOpen) : updater;
      onOpenChange?.(nextVal);
    } else {
      setUncontrolledOpen((prev) => {
        const nextVal = typeof updater === "function" ? updater(prev) : updater;
        onOpenChange?.(nextVal);
        return nextVal;
      });
    }
  };

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking or touching outside
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="bulk-dropdown-root" style={{ position: "relative", width: "100%" }}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

// ── DropdownMenuTrigger ──
export interface DropdownMenuTriggerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children?: ReactNode | ((props: { open: boolean }) => ReactNode);
  asChild?: boolean;
  render?: (props: Record<string, unknown>) => ReactNode;
}

export function DropdownMenuTrigger({
  children,
  className = "",
  asChild = false,
  render,
  disabled,
  onClick,
  ...props
}: DropdownMenuTriggerProps) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.(e);
    if (!e.defaultPrevented && !disabled) {
      ctx.setOpen((prev) => !prev);
    }
  };

  const triggerClasses = `bulk-form-control bulk-dropdown-trigger ${ctx.open ? "open" : ""} ${className}`.trim();

  // If a custom render function is provided
  if (typeof render === "function") {
    return render({
      ref: ctx.triggerRef,
      open: ctx.open,
      className: triggerClasses,
      onClick: handleClick,
      disabled,
      "aria-haspopup": "listbox",
      "aria-expanded": ctx.open,
      ...props,
    }) as React.ReactElement;
  }

  // If asChild is specified and children is a valid React element
  if (asChild && isValidElement(children)) {
    const childElement = children as React.ReactElement<Record<string, unknown>>;
    return cloneElement(childElement, {
      ref: ctx.triggerRef,
      className: `${triggerClasses} ${(childElement.props.className as string) || ""}`.trim(),
      onClick: handleClick,
      disabled,
      "aria-haspopup": "listbox",
      "aria-expanded": ctx.open,
    } as Record<string, unknown>);
  }

  return (
    <button
      ref={ctx.triggerRef}
      type="button"
      className={triggerClasses}
      onClick={handleClick}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      {...props}
    >
      {typeof children === "function" ? children({ open: ctx.open }) : children}
    </button>
  );
}

// ── DropdownMenuContent ──
export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "center";
}

export function DropdownMenuContent({
  children,
  className = "",
  align = "start",
  onClick,
  onPointerDown,
  ...props
}: DropdownMenuContentProps) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenuContent must be used within DropdownMenu");

  if (!ctx.open) return null;

  return (
    <div
      ref={ctx.contentRef}
      className={`bulk-dropdown-content align-${align} ${className}`.trim()}
      role="listbox"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

// ── DropdownMenuGroup ──
export function DropdownMenuGroup({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bulk-dropdown-group ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

// ── DropdownMenuRadioGroup Context & Component ──
interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (val: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface DropdownMenuRadioGroupProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  className = "",
  ...props
}: DropdownMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div className={`bulk-dropdown-radio-group ${className}`.trim()} role="radiogroup" {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

// ── DropdownMenuRadioItem ──
export interface DropdownMenuRadioItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

export function DropdownMenuRadioItem({
  value,
  children,
  className = "",
  disabled = false,
  onClick,
  ...props
}: DropdownMenuRadioItemProps) {
  const group = useContext(RadioGroupContext);
  const dropdown = useContext(DropdownContext);
  const isSelected = group?.value === value;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onClick?.(e);
    if (!disabled) {
      dropdown?.setOpen(false);
      group?.onValueChange?.(value);
      dropdown?.triggerRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      e.stopPropagation();
      dropdown?.setOpen(false);
      group?.onValueChange?.(value);
      dropdown?.triggerRef.current?.focus();
    }
  };

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={disabled ? -1 : 0}
      className={`bulk-dropdown-radio-item ${isSelected ? "selected" : ""} ${disabled ? "disabled" : ""} ${className}`.trim()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <span className="bulk-radio-item-label">{children}</span>
      {isSelected && (
        <span className="bulk-radio-item-check" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
    </div>
  );
}
