"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ProductColorContextType {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}

const ProductColorContext = createContext<ProductColorContextType | null>(null);

export function ProductColorProvider({
  initialColor = "",
  children,
}: {
  initialColor?: string;
  children: ReactNode;
}) {
  const [selectedColor, setSelectedColor] = useState<string>(initialColor);

  return (
    <ProductColorContext.Provider value={{ selectedColor, setSelectedColor }}>
      {children}
    </ProductColorContext.Provider>
  );
}

export function useProductColor() {
  return useContext(ProductColorContext);
}

