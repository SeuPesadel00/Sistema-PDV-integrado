'use client';

import React from 'react';
import Header from '../components/Header';
import CategoryPills from '../components/CategoryPills';
import HeroSection from '../components/HeroSection';
import ProductGrid from '../components/ProductGrid';
import InstagramSection from '../components/InstagramSection';
import ReviewsSection from '../components/ReviewsSection';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col text-slate-100">
      {/* Header Sticky */}
      <Header />

      {/* Barra de Categorias */}
      <CategoryPills />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Hero & Banners Promocionais */}
        <HeroSection />

        {/* Catálogo de Produtos com Filtros e Ordenação */}
        <ProductGrid />
      </main>

      {/* Redes Sociais / Instagram Feed */}
      <InstagramSection />

      {/* Prova Social & Avaliações */}
      <ReviewsSection />

      {/* Rodapé Institucional */}
      <Footer />
    </div>
  );
}
