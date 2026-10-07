'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Truck,
  Snowflake,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { useCart } from '../context/CartContext';

const HERO_SLIDES = [
  {
    id: 1,
    tag: 'OFERTA DO FIM DE SEMANA 🔥',
    title: 'COMBOS DE WHISKY & GIN',
    subtitle: 'Garrafa original + 5 Red Bull Tropical + 5 Gelos saborizados de coco.',
    cta: 'Ver Combos',
    category: 'Combos',
    bgGradient: 'from-amber-500/20 via-slate-900 to-slate-950',
    borderColor: 'border-amber-500/30',
    accentColor: 'text-amber-400',
    btnColor: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    image: 'https://admtai.com/wp-content/uploads/2024/08/Combo-Whisky-Black-Label-1.jpeg',
  },
  {
    id: 2,
    tag: 'TRINCANDO DE GELADA ❄️',
    title: 'CERVEJAS PURO MALTE',
    subtitle: 'Heineken, Spaten, Corona e Budweiser no ponto ideal para o seu churrasco.',
    cta: 'Ver Cervejas',
    category: 'Cervejas',
    bgGradient: 'from-emerald-500/20 via-slate-900 to-slate-950',
    borderColor: 'border-emerald-500/30',
    accentColor: 'text-emerald-400',
    btnColor: 'bg-emerald-500 hover:bg-emerald-600 text-slate-950',
    image: 'https://admtai.com/wp-content/uploads/2024/07/Heineken-350-ml-Slim-com-12-un.webp',
  },
  {
    id: 3,
    tag: 'TABACARIA COMPLETA 💨',
    title: 'ESSÊNCIAS, ROSHS & SEDAS',
    subtitle: 'As melhores marcas do mercado: Ziggy, Zomo, Nay, Raw, Squadafum e muito mais.',
    cta: 'Ver Tabacaria',
    category: 'Tabacaria',
    bgGradient: 'from-cyan-500/20 via-slate-900 to-slate-950',
    borderColor: 'border-cyan-500/30',
    accentColor: 'text-cyan-400',
    btnColor: 'bg-cyan-500 hover:bg-cyan-600 text-slate-950',
    image: 'https://admtai.com/wp-content/uploads/2024/10/essencia-ziggy-h-p4ktouwya8.png',
  },
];

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { setActiveCategory } = useCart();

  // Auto avança o banner a cada 6 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = HERO_SLIDES[currentSlide];

  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      {/* Banner Principal com Carrossel */}
      <div
        className={`relative overflow-hidden rounded-3xl border ${slide.borderColor} bg-gradient-to-r ${slide.bgGradient} p-6 sm:p-10 shadow-2xl transition-all duration-700`}
      >
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          {/* Conteúdo textual */}
          <div className="max-w-xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-900/80 px-3 py-1 text-xs font-bold text-white shadow-sm">
              {slide.tag}
            </span>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              {slide.title}
            </h1>
            <p className="text-sm font-medium text-slate-300 sm:text-base">
              {slide.subtitle}
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setActiveCategory(slide.category)}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 ${slide.btnColor}`}
              >
                <span>{slide.cta}</span>
                <ArrowRight size={15} />
              </button>
              <a
                href="https://wa.me/5561999999999?text=Ol%C3%A1%2C%20gostaria%20de%20consultar%20as%20ofertas%20do%20dia!"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-900"
              >
                <MessageCircle size={15} className="text-emerald-400" />
                <span>Pedir no WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Imagem do Produto em Destaque */}
          <div className="flex shrink-0 items-center justify-center md:justify-end">
            <div className="relative flex h-52 w-52 sm:h-64 sm:w-64 items-center justify-center rounded-2xl bg-slate-900/40 p-4 backdrop-blur-md border border-slate-800/80">
              <img
                src={slide.image}
                alt={slide.title}
                className="max-h-full max-w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.6)] transition-transform duration-500 hover:scale-110"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          </div>
        </div>

        {/* Controles de Navegação */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/80 text-slate-300 transition-colors hover:text-white"
            aria-label="Slide anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 px-1">
            {HERO_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentSlide ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-700'
                }`}
                aria-label={`Ir para slide ${idx + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/80 text-slate-300 transition-colors hover:text-white"
            aria-label="Próximo slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Propostas de Valor (Value Props) */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3.5 backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Truck size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Entrega Expressa</div>
            <div className="text-[11px] text-slate-400">35 min em Taguatinga</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3.5 backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <Snowflake size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Trincando de Gelada</div>
            <div className="text-[11px] text-slate-400">Pronta para consumo</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3.5 backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Flame size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Melhor Preço</div>
            <div className="text-[11px] text-slate-400">Direto da distribuidora</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3.5 backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-white">100% Confiável</div>
            <div className="text-[11px] text-slate-400">Loja física e online</div>
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) do WhatsApp */}
      <a
        href="https://wa.me/5561999999999?text=Ol%C3%A1%2C%20gostaria%20de%20fazer%20um%20pedido%20pelo%20WhatsApp!"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-2xl shadow-emerald-500/40 transition-transform hover:scale-110 active:scale-95 animate-glow"
        title="Fale direto conosco no WhatsApp"
      >
        <MessageCircle size={28} />
      </a>
    </section>
  );
}
