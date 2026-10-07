'use client';

import React from 'react';
import { Plus, Minus, ShoppingBag, Eye, Snowflake, Flame, Tag } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { formatBRL } from '../services/cart';

export default function ProductCard({ product }: { product: Product }) {
  const { items, addItem, updateQuantity, setQuickViewProduct } = useCart();

  const cartItem = items.find((i) => i.product.id === product.id);
  const inCartQty = cartItem ? cartItem.quantity : 0;
  const isOutOfStock = product.estoque_atual <= 0;

  const getSeloBadge = () => {
    if (isOutOfStock) {
      return (
        <span className="flex items-center gap-1 rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-700">
          Esgotado
        </span>
      );
    }
    if (product.selo_especial === 'Gelada') {
      return (
        <span className="flex items-center gap-1 rounded-md bg-cyan-950/80 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/40">
          <Snowflake size={11} /> Gelada
        </span>
      );
    }
    if (product.selo_especial === 'Mais Vendido') {
      return (
        <span className="flex items-center gap-1 rounded-md bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40">
          <Flame size={11} /> Mais Vendido
        </span>
      );
    }
    if (product.preco_promocional || product.selo_especial === 'Promoção') {
      return (
        <span className="flex items-center gap-1 rounded-md bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
          <Tag size={11} /> Oferta
        </span>
      );
    }
    if (product.categoria === 'Combos') {
      return (
        <span className="flex items-center gap-1 rounded-md bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/40">
          Combo
        </span>
      );
    }
    return null;
  };

  const precoFinal = product.preco_promocional || product.preco_venda;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3.5 transition-all duration-300 hover:border-emerald-500/40 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-emerald-950/20">
      <div>
        {/* Container da Imagem com Botão de Visualização Rápida */}
        <div className="relative mb-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950/50 p-2 border border-slate-800/50">
          {/* Selos / Badges */}
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            {getSeloBadge()}
          </div>

          {/* Botão Quick View no Hover */}
          <button
            onClick={() => setQuickViewProduct(product)}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/80 text-slate-300 opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-emerald-500 hover:text-slate-950"
            title="Ver detalhes"
          >
            <Eye size={14} />
          </button>

          {/* Imagem do Produto */}
          {product.imagem_url ? (
            <img
              src={product.imagem_url}
              alt={product.nome}
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
              {product.nome.slice(0, 3).toUpperCase()}
            </div>
          )}
        </div>

        {/* Categoria & Volume */}
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-semibold text-emerald-400/90">{product.categoria}</span>
          {product.volume && <span>{product.volume}</span>}
        </div>

        {/* Título */}
        <h3
          onClick={() => setQuickViewProduct(product)}
          className="line-clamp-2 cursor-pointer text-xs font-bold text-white transition-colors hover:text-emerald-400 sm:text-sm"
        >
          {product.nome}
        </h3>
      </div>

      {/* Preço & Controles de Compra */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/50">
        <div className="mb-2 flex items-baseline gap-1.5">
          <span className="text-sm font-black text-white sm:text-base">
            {formatBRL(precoFinal)}
          </span>
          {product.preco_promocional && product.preco_promocional < product.preco_venda && (
            <span className="text-[11px] text-slate-500 line-through">
              {formatBRL(product.preco_venda)}
            </span>
          )}
        </div>

        {/* Ações de Carrinho */}
        {isOutOfStock ? (
          <button
            disabled
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2 text-center text-xs font-semibold text-slate-500 cursor-not-allowed"
          >
            Indisponível
          </button>
        ) : inCartQty > 0 ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-400">
            <button
              onClick={() => updateQuantity(product.id, -1)}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-slate-200 transition-colors hover:bg-slate-800"
              aria-label="Diminuir"
            >
              <Minus size={13} />
            </button>
            <span className="font-bold text-white">{inCartQty}</span>
            <button
              onClick={() => updateQuantity(product.id, 1)}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 transition-colors hover:bg-emerald-400"
              aria-label="Aumentar"
            >
              <Plus size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => addItem(product, 1)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:border-emerald-500 hover:bg-emerald-500 hover:text-slate-950 active:scale-95"
          >
            <ShoppingBag size={14} />
            <span>Adicionar</span>
          </button>
        )}
      </div>
    </div>
  );
}
