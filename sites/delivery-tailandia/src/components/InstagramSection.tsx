'use client';

import React from 'react';
import { Instagram, ExternalLink, Heart, MessageCircle } from 'lucide-react';

const INSTAGRAM_POSTS = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
    title: 'Sextou com a cerveja trincando!',
    likes: '482',
    comments: '34',
    tag: '#SextouTailandia',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=600&auto=format&fit=crop&q=80',
    title: 'Combos de Gin & Whisky com entrega em 30 min',
    likes: '729',
    comments: '58',
    tag: '#CombosDF',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
    title: 'Jantinha com espetinho na brasa e tropeiro quentinho',
    likes: '614',
    comments: '42',
    tag: '#TailandiaGrill',
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1574096079513-d8259312b785?w=600&auto=format&fit=crop&q=80',
    title: 'Linha completa de Essências & Carvão de Coco',
    likes: '512',
    comments: '29',
    tag: '#TabacariaDF',
  },
];

export default function InstagramSection() {
  return (
    <section className="py-12 border-t border-slate-800/80 bg-slate-950/40" id="instagram">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Instagram className="h-4 w-4" />
              Siga no Instagram
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              @tailandia.<span className="text-amber-400">distribuidora</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Acompanhe novidades, bastidores das entregas e promoções relâmpago de fim de semana!
            </p>
          </div>

          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:opacity-90 transition active:scale-95 self-start sm:self-auto"
          >
            <Instagram className="h-4 w-4" />
            <span>Seguir no Instagram</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Grid de Posts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {INSTAGRAM_POSTS.map((post) => (
            <a
              key={post.id}
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-md transition-all hover:border-pink-500/50 hover:shadow-pink-500/10"
            >
              <img
                src={post.image}
                alt={post.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* Overlay Escuro com Likes e Texto no Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end">
                <span className="text-[11px] font-bold text-amber-400 mb-1">{post.tag}</span>
                <p className="text-xs font-semibold text-white line-clamp-2 mb-3">
                  {post.title}
                </p>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
                    {post.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
                    {post.comments}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}
