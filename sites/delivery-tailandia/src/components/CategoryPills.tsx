'use client';

import React from 'react';
import {
  Sparkles,
  Flame,
  Beer,
  Wine,
  Cigarette,
  Snowflake,
  Utensils,
  Cookie,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { CATEGORIES_LIST } from '../services/products';

export default function CategoryPills() {
  const { activeCategory, setActiveCategory } = useCart();

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles': return <Sparkles size={15} />;
      case 'Flame': return <Flame size={15} />;
      case 'Beer': return <Beer size={15} />;
      case 'Wine': return <Wine size={15} />;
      case 'Cigarette': return <Cigarette size={15} />;
      case 'Snowflake': return <Snowflake size={15} />;
      case 'Utensils': return <Utensils size={15} />;
      case 'Cookie': return <Cookie size={15} />;
      default: return <Sparkles size={15} />;
    }
  };

  return (
    <div className="w-full border-b border-slate-800/60 bg-slate-950/60 py-3 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES_LIST.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-400 shadow-md shadow-emerald-500/10'
                    : 'border border-slate-800/80 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                  {getIcon(cat.icon)}
                </span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
