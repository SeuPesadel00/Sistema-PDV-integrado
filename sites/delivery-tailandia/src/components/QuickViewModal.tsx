'use client';

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { formatBRL } from '../services/cart';
import { X, Plus, Minus, ShoppingBag, Flame, Sparkles, Check, AlertCircle } from 'lucide-react';

export default function QuickViewModal() {
  const { quickViewProduct, setQuickViewProduct, addItem, setIsCartOpen } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!quickViewProduct) return null;

  const product = quickViewProduct;
  const isOutOfStock = product.estoque_atual <= 0;
  const hasPromo = !!product.preco_promocional && product.preco_promocional < product.preco_venda;
  const currentPrice = hasPromo ? product.preco_promocional! : product.preco_venda;

  const handleClose = () => {
    setQuickViewProduct(null);
    setQuantity(1);
    setAdded(false);
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      handleClose();
      setIsCartOpen(true);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Imagem do Produto com Badge */}
          <div className="relative flex items-center justify-center rounded-xl bg-slate-950/80 p-4 border border-slate-800/80 h-64 md:h-80">
            {product.selo_especial && (
              <span className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Sparkles className="h-3 w-3" />
                {product.selo_especial}
              </span>
            )}
            {hasPromo && (
              <span className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-xs font-bold text-rose-300">
                <Flame className="h-3 w-3" /> OFERTA
              </span>
            )}
            
            <img
              src={product.imagem_url}
              alt={product.nome}
              className="h-full w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] transition-transform duration-300 hover:scale-105"
              onError={(e) => {
                // Fallback elegante se a imagem do WP falhar
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          {/* Informações e Detalhes */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
                  {product.categoria}
                </span>
                {product.volume && (
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    {product.volume}
                  </span>
                )}
              </div>

              <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-2">
                {product.nome}
              </h2>

              <p className="text-sm text-slate-300/90 mb-4 line-clamp-3">
                {product.descricao_completa || product.descricao || 'Item premium disponível para entrega rápida em Taguatinga e região.'}
              </p>

              {/* Status do Estoque */}
              <div className="flex items-center gap-2 mb-4 text-xs font-medium">
                {isOutOfStock ? (
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5" /> Esgotado no momento
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Em estoque ({product.estoque_atual} unidades prontas para envio)
                  </span>
                )}
              </div>

              {/* Preço */}
              <div className="mb-6 rounded-xl bg-slate-800/40 p-3.5 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Preço unitário:</div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl md:text-3xl font-black text-amber-400">
                    {formatBRL(currentPrice)}
                  </span>
                  {hasPromo && (
                    <span className="text-sm text-slate-500 line-through">
                      {formatBRL(product.preco_venda)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações: Quantidade e Botão Adicionar */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Quantidade:</span>
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/70 p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || isOutOfStock}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 transition"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-white">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.estoque_atual, q + 1))}
                    disabled={quantity >= product.estoque_atual || isOutOfStock}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 font-bold text-slate-950 shadow-lg transition-all ${
                  isOutOfStock
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : added
                    ? 'bg-emerald-400 text-slate-950 scale-[0.98]'
                    : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 hover:shadow-amber-500/20 active:scale-[0.98]'
                }`}
              >
                {added ? (
                  <>
                    <Check className="h-5 w-5" /> Adicionado ao Carrinho!
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-5 w-5" />
                    {isOutOfStock ? 'Indisponível' : `Adicionar • ${formatBRL(currentPrice * quantity)}`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
