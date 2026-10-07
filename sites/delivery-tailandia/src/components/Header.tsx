'use client';

import React from 'react';
import { ShoppingBag, MapPin, Search, Instagram, PhoneCall, Sparkles, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatBRL } from '../services/cart';

export default function Header() {
  const {
    totalItemsCount,
    subtotal,
    setIsCartOpen,
    selectedLocation,
    setIsLocationModalOpen,
    searchQuery,
    setSearchQuery,
  } = useCart();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      {/* Top Banner Informativo */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-1.5 text-center text-xs font-semibold text-white shadow-inner">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={13} className="animate-spin text-amber-300" />
          ⚡ <strong>ENTREGA EXPRESSA EM TAGUATINGA & CEILÂNDIA</strong> • Peça agora e receba trincando de gelada! • Frete Grátis acima de R$ 150
        </span>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* LOGO */}
        <div className="flex items-center gap-3">
          <a href="#" className="group flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-500/20 transition-transform group-hover:scale-105">
              <span className="text-xl font-black tracking-tighter text-slate-950">TL</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-wider text-white">TAILÂNDIA</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">24H</span>
              </div>
              <span className="text-[10px] font-medium tracking-widest text-emerald-400 uppercase">
                Tabacaria & Bebidas
              </span>
            </div>
          </a>
        </div>

        {/* SELETOR DE LOCALIZAÇÃO */}
        <button
          onClick={() => setIsLocationModalOpen(true)}
          className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-left text-xs transition-colors hover:border-emerald-500/50 hover:bg-slate-900"
          title="Alterar local de entrega"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <MapPin size={15} />
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-400">Entregar em:</div>
            <div className="max-w-[150px] truncate font-semibold text-slate-200 lg:max-w-[200px]">
              {selectedLocation}
            </div>
          </div>
        </button>

        {/* BARRA DE PESQUISA GLOBAL */}
        <div className="relative flex-1 max-w-md mx-2">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar whisky, cerveja, essência, sedas, combos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-9 text-xs text-white placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* LINKS SOCIAIS & CARRINHO */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Instagram */}
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 transition-colors hover:border-pink-500/40 hover:text-pink-400"
            title="Siga a Tailândia no Instagram"
          >
            <Instagram size={17} />
          </a>

          {/* WhatsApp Direto */}
          <a
            href="https://wa.me/5561999999999?text=Ol%C3%A1%2C%20gostaria%20de%20fazer%20um%20pedido%20pelo%20WhatsApp!"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <PhoneCall size={14} />
            <span>WhatsApp</span>
          </a>

          {/* BOTÃO DO CARRINHO */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:brightness-110 active:scale-95"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag size={17} />
            <span className="hidden sm:inline">
              {subtotal > 0 ? formatBRL(subtotal) : 'Carrinho'}
            </span>
            {totalItemsCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-emerald-400 shadow-md">
                {totalItemsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
