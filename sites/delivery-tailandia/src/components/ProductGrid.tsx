'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { REAL_TAILANDIA_PRODUCTS } from '../services/products';
import { Product } from '../types';
import ProductCard from './ProductCard';
import { SlidersHorizontal, ArrowUpDown, Filter, Sparkles, X, PackageOpen } from 'lucide-react';

export default function ProductGrid() {
  const { activeCategory, searchQuery, setSearchQuery } = useCart();

  const [sortBy, setSortBy] = useState<'destaque' | 'menor-preco' | 'maior-preco' | 'alfabetica'>('destaque');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('TODAS');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('TODOS');
  const [visibleCount, setVisibleCount] = useState<number>(16);

  // Subcategorias disponíveis para a categoria atual
  const availableSubcategories = useMemo(() => {
    const productsInCat = activeCategory === 'TODAS'
      ? REAL_TAILANDIA_PRODUCTS
      : REAL_TAILANDIA_PRODUCTS.filter(p => p.categoria.toLowerCase() === activeCategory.toLowerCase());
    
    const subs = new Set<string>();
    productsInCat.forEach(p => {
      if (p.subcategoria) subs.add(p.subcategoria);
    });
    return Array.from(subs);
  }, [activeCategory]);

  // Reseta filtros secundários quando mudar de categoria principal
  useEffect(() => {
    setSelectedSubcategory('TODAS');
    setVisibleCount(16);
  }, [activeCategory]);

  // Filtragem e Ordenação
  const filteredProducts = useMemo(() => {
    let result = [...REAL_TAILANDIA_PRODUCTS];

    // Categoria
    if (activeCategory !== 'TODAS') {
      result = result.filter(p => p.categoria.toLowerCase() === activeCategory.toLowerCase());
    }

    // Subcategoria
    if (selectedSubcategory !== 'TODAS') {
      result = result.filter(p => p.subcategoria === selectedSubcategory);
    }

    // Busca textual
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        p.descricao?.toLowerCase().includes(q) ||
        p.ean?.toLowerCase().includes(q) ||
        p.subcategoria?.toLowerCase().includes(q) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Faixa de Preço
    if (selectedPriceRange === 'ate25') {
      result = result.filter(p => (p.preco_promocional || p.preco_venda) <= 25);
    } else if (selectedPriceRange === '25a60') {
      result = result.filter(p => {
        const price = p.preco_promocional || p.preco_venda;
        return price > 25 && price <= 60;
      });
    } else if (selectedPriceRange === '60a120') {
      result = result.filter(p => {
        const price = p.preco_promocional || p.preco_venda;
        return price > 60 && price <= 120;
      });
    } else if (selectedPriceRange === '120mais') {
      result = result.filter(p => (p.preco_promocional || p.preco_venda) > 120);
    }

    // Ordenação
    if (sortBy === 'menor-preco') {
      result.sort((a, b) => (a.preco_promocional || a.preco_venda) - (b.preco_promocional || b.preco_venda));
    } else if (sortBy === 'maior-preco') {
      result.sort((a, b) => (b.preco_promocional || b.preco_venda) - (a.preco_promocional || a.preco_venda));
    } else if (sortBy === 'alfabetica') {
      result.sort((a, b) => a.nome.localeCompare(b.nome));
    } else {
      // Destaque: Combos, Mais Vendidos e Destaque_Home primeiro
      result.sort((a, b) => {
        const scoreA = (a.destaque_home ? 2 : 0) + (a.selo_especial ? 1 : 0);
        const scoreB = (b.destaque_home ? 2 : 0) + (b.selo_especial ? 1 : 0);
        return scoreB - scoreA;
      });
    }

    return result;
  }, [activeCategory, selectedSubcategory, searchQuery, selectedPriceRange, sortBy]);

  const displayedProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  return (
    <section className="py-8" id="catalogo">
      {/* Barra de Filtros e Ordenação Superior */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
        
        {/* Título & Contador */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2">
              {activeCategory === 'TODAS' ? 'Todos os Produtos' : activeCategory}
              <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                {filteredProducts.length} itens
              </span>
            </h2>
            {searchQuery && (
              <p className="text-xs text-amber-400">
                Buscando por: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-2 text-slate-400 hover:text-white underline"
                >
                  limpar
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Controles de Filtros e Ordenação */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Ordenar por */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-300">
            <ArrowUpDown className="h-3.5 w-3.5 text-amber-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="destaque" className="bg-slate-900 text-white">Mais Populares</option>
              <option value="menor-preco" className="bg-slate-900 text-white">Menor Preço</option>
              <option value="maior-preco" className="bg-slate-900 text-white">Maior Preço</option>
              <option value="alfabetica" className="bg-slate-900 text-white">A - Z</option>
            </select>
          </div>

          {/* Faixa de Preço */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
            <select
              value={selectedPriceRange}
              onChange={(e) => setSelectedPriceRange(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todas as faixas</option>
              <option value="ate25" className="bg-slate-900 text-white">Até R$ 25</option>
              <option value="25a60" className="bg-slate-900 text-white">R$ 25 a R$ 60</option>
              <option value="60a120" className="bg-slate-900 text-white">R$ 60 a R$ 120</option>
              <option value="120mais" className="bg-slate-900 text-white">Acima de R$ 120</option>
            </select>
          </div>
        </div>

      </div>

      {/* Subcategorias Chips (quando houver mais de 1) */}
      {availableSubcategories.length > 1 && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button
            onClick={() => setSelectedSubcategory('TODAS')}
            className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedSubcategory === 'TODAS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            Todas as Subcategorias
          </button>
          {availableSubcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubcategory(sub)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedSubcategory === sub
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Grid de Produtos */}
      {displayedProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {displayedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        /* Estado Vazio */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500 mb-4">
            <PackageOpen className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Nenhum produto encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-5">
            Não encontramos nenhum item correspondente aos filtros ou busca selecionada. Tente ajustar os termos.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSubcategory('TODAS');
              setSelectedPriceRange('TODOS');
            }}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition"
          >
            Limpar Filtros de Busca
          </button>
        </div>
      )}

      {/* Botão Carregar Mais */}
      {hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 16)}
            className="group flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-xs font-bold text-slate-200 shadow-lg hover:border-amber-500 hover:bg-slate-800 hover:text-amber-400 transition"
          >
            <span>Ver mais produtos</span>
            <span className="text-slate-500 group-hover:text-amber-400">
              ({filteredProducts.length - visibleCount} restantes)
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
