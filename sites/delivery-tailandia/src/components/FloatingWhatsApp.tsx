'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function FloatingWhatsApp() {
  const handleClick = () => {
    const text = encodeURIComponent('Olá, Tailândia Distribuidora! Gostaria de tirar uma dúvida ou fazer um pedido.');
    window.open(`https://wa.me/5561999999999?text=${text}`, '_blank');
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        onClick={handleClick}
        className="group relative flex items-center gap-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 p-3.5 text-slate-950 font-bold shadow-2xl shadow-emerald-500/40 transition-all duration-300 hover:scale-105 active:scale-95"
        aria-label="Atendimento via WhatsApp"
      >
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-slate-900"></span>
        </span>
        
        <MessageSquare className="h-6 w-6 stroke-[2.2]" />
        
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-black uppercase tracking-wider transition-all duration-300 group-hover:max-w-xs group-hover:pr-1">
          Pedir no Zap
        </span>
      </button>
    </div>
  );
}
