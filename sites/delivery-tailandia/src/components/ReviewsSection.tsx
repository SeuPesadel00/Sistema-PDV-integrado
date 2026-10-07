'use client';

import React from 'react';
import { Star, ShieldCheck, ThumbsUp, CheckCircle2 } from 'lucide-react';

const REVIEWS = [
  {
    id: 1,
    name: 'Lucas Ferreira',
    location: 'Taguatinga Norte / DF',
    rating: 5,
    date: 'Ontem',
    text: 'Melhor delivery de bebidas de Brasília sem dúvidas. Pedi um combo de Black Label e cerveja Heineken num sábado à noite, chegou em 22 minutos e a cerveja tava literalmente trincando de gelada!',
  },
  {
    id: 2,
    name: 'Camila Albuquerque',
    location: 'Águas Claras / DF',
    rating: 5,
    date: 'Há 2 dias',
    text: 'A jantinha do Tailândia Grill é surreal de gostosa! Tropeiro no ponto certo e o espetinho macio. Além disso comprei pods e essências de tabacaria tudo no mesmo pedido.',
  },
  {
    id: 3,
    name: 'Rodrigo Medeiros',
    location: 'Ceilândia Sul / DF',
    rating: 5,
    date: 'Há 4 dias',
    text: 'Preço honesto de distribuidora e atendimento super educado pelo WhatsApp. Salvaram nosso churrasco no domingo quando o gelo e o carvão acabaram. Recomendo demais!',
  },
];

export default function ReviewsSection() {
  return (
    <section className="py-12 border-t border-slate-800/80 bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabeçalho */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300 mb-3">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>4.9 de 5 estrelas • Mais de 3.200 clientes atendidos</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Quem pede na Tailândia, <span className="text-amber-400">recomenda!</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Veja a opinião de clientes que confiam na rapidez, qualidade e preços da nossa distribuidora.
          </p>
        </div>

        {/* Grid de Avaliações */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REVIEWS.map((review) => (
            <div
              key={review.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg transition-all hover:border-slate-700 hover:bg-slate-900/90"
            >
              <div>
                {/* Estrelas */}
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-2 text-xs font-bold text-slate-300">5.0</span>
                </div>

                {/* Comentário */}
                <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed italic mb-4">
                  "{review.text}"
                </p>
              </div>

              {/* Autor */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    {review.name}
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  </h4>
                  <span className="text-[11px] text-slate-400">{review.location}</span>
                </div>
                <span className="text-[10px] text-slate-500">{review.date}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Faixa de Garantia / Benefícios */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <div className="text-xl font-black text-amber-400 mb-0.5">25 - 45 min</div>
            <div className="text-xs text-slate-400">Tempo médio de entrega</div>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <div className="text-xl font-black text-emerald-400 mb-0.5">-2°C a 0°C</div>
            <div className="text-xs text-slate-400">Bebidas trincando de geladas</div>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <div className="text-xl font-black text-amber-400 mb-0.5">+2.000 Itens</div>
            <div className="text-xs text-slate-400">Maior catálogo da região</div>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <div className="text-xl font-black text-emerald-400 mb-0.5">24 Horas</div>
            <div className="text-xs text-slate-400">Atendimento aos fins de semana</div>
          </div>
        </div>

      </div>
    </section>
  );
}
