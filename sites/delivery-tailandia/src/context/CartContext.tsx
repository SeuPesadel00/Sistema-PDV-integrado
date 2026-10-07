'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Product, CartItem, DeliveryAddress } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, delta: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  deliveryType: 'DELIVERY' | 'RETIRADA';
  setDeliveryType: (type: 'DELIVERY' | 'RETIRADA') => void;
  couponCode: string;
  discount: number;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalItemsCount: number;
  selectedLocation: string;
  setSelectedLocation: (loc: string) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tailandia_cart');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'RETIRADA'>('DELIVERY');
  const [couponCode, setCouponCode] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState('Taguatinga Norte / Brasília - DF');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('TODAS');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persiste no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tailandia_cart', JSON.stringify(items));
    }
  }, [items]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const addItem = (product: Product, quantity: number = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity += quantity;
        return updated;
      }
      return [...prev, { product, quantity }];
    });
    showToast(`Adicionado: ${quantity}x ${product.nome}`);
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setItems((prev) => {
      return prev
        .map((i) => {
          if (i.product.id === productId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setItems([]);
    setCouponCode('');
    setDiscountPct(0);
  };

  const applyCoupon = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return { success: false, message: 'Digite o código do cupom.' };

    if (clean === 'TAI10' || clean === 'PRIMEIRACOMPRA') {
      setCouponCode(clean);
      setDiscountPct(10);
      showToast('🎉 Cupom de 10% aplicado com sucesso!');
      return { success: true, message: 'Cupom de 10% OFF aplicado!' };
    }
    if (clean === 'GELADA5') {
      setCouponCode(clean);
      setDiscountPct(5);
      showToast('❄️ Cupom de 5% aplicado!');
      return { success: true, message: 'Cupom de 5% OFF aplicado!' };
    }
    return { success: false, message: 'Cupom inválido ou expirado.' };
  };

  const removeCoupon = () => {
    setCouponCode('');
    setDiscountPct(0);
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.product.preco_venda * item.quantity, 0);
  }, [items]);

  const discount = useMemo(() => {
    return (subtotal * discountPct) / 100;
  }, [subtotal, discountPct]);

  const deliveryFee = useMemo(() => {
    if (deliveryType === 'RETIRADA' || subtotal === 0) return 0;
    // Frete grátis para compras acima de R$ 150
    if (subtotal >= 150) return 0;
    return 10.0;
  }, [deliveryType, subtotal]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discount + deliveryFee);
  }, [subtotal, discount, deliveryFee]);

  const totalItemsCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        deliveryType,
        setDeliveryType,
        couponCode,
        discount,
        applyCoupon,
        removeCoupon,
        subtotal,
        deliveryFee,
        total,
        totalItemsCount,
        selectedLocation,
        setSelectedLocation,
        isLocationModalOpen,
        setIsLocationModalOpen,
        quickViewProduct,
        setQuickViewProduct,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        toastMessage,
        showToast,
      }}
    >
      {children}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-slate-900/95 px-5 py-3.5 shadow-2xl backdrop-blur-md transition-all animate-bounce">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-sm font-semibold text-white">{toastMessage}</span>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
