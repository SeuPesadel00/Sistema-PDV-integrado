'use client';

import React from 'react';
import { 
  MapPin, 
  Clock, 
  Phone, 
  Instagram, 
  MessageSquare, 
  ShieldAlert, 
  CreditCard, 
  ExternalLink,
  Flame,
  Heart
} from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400 text-xs">
      
      {/* Faixa de Aviso Legal +18 */}
      <div className="bg-rose-950/40 border-b border-rose-900/40 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-rose-300 font-bold text-center text-xs">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>
            PROIBIDA A VENDA E O CONSUMO DE BEBIDAS ALCOÓLICAS E PRODUTOS DE TABACARIA PARA MENORES DE 18 ANOS (LEI Nº 8.069/1990). APRECIE COM MODERAÇÃO. SE BEBER, NÃO DIRIJA.
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Coluna 1: Sobre & Marca */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Flame className="h-5 w-5" />
              </div>
              <span className="text-lg font-black tracking-tight text-white uppercase">
                TAILÂNDIA
                <span className="block text-[10px] tracking-widest text-amber-400 font-bold">
                  DISTRIBUIDORA & TABACARIA
                </span>
              </span>
            </div>

            <p className="text-slate-400 leading-relaxed text-xs">
              A melhor e mais completa distribuidora de bebidas, combos de destilados, tabacaria e jantinhas na brasa de Taguatinga e região. Entregas expressas e bebidas trincando de geladas.
            </p>

            {/* Redes Sociais */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-pink-500 hover:bg-pink-500/10 hover:text-pink-400 transition"
                title="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/5561999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                title="WhatsApp"
              >
                <MessageSquare className="h-4 w-4" />
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-400 transition"
                title="TikTok"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Coluna 2: Horários de Funcionamento */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Horário de Atendimento
            </h3>
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between border-b border-slate-900 pb-1.5">
                <span>Segunda a Quarta:</span>
                <span className="font-semibold text-slate-200">10:00 às 02:00</span>
              </li>
              <li className="flex justify-between border-b border-slate-900 pb-1.5">
                <span>Quinta-feira:</span>
                <span className="font-semibold text-slate-200">10:00 às 04:00</span>
              </li>
              <li className="flex justify-between border-b border-slate-900 pb-1.5 text-amber-400 font-bold">
                <span>Sexta e Sábado:</span>
                <span>24 HORAS</span>
              </li>
              <li className="flex justify-between">
                <span>Domingo:</span>
                <span className="font-semibold text-slate-200">10:00 às 02:00</span>
              </li>
            </ul>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-300">
              ⚡ Entregas rápidas durante toda a madrugada no fim de semana!
            </div>
          </div>

          {/* Coluna 3: Localização & Atendimento */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-400" />
              Unidade & Retirada
            </h3>
            <p className="text-xs leading-relaxed">
              <strong className="text-white">Loja Matriz Taguatinga:</strong><br />
              QNL / QNJ - Taguatinga Norte<br />
              Brasília - DF, CEP 72150-000
            </p>
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              <span>Ver rota no Google Maps</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <div className="pt-2">
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Central de Pedidos:</div>
              <a
                href="https://wa.me/5561999999999"
                className="text-sm font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 mt-0.5"
              >
                <Phone className="h-3.5 w-3.5" /> (61) 99999-9999
              </a>
            </div>
          </div>

          {/* Coluna 4: Formas de Pagamento & Segurança */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-400" />
              Formas de Pagamento
            </h3>
            <p className="text-xs text-slate-400">
              Pague com praticidade no momento da entrega ou retirada:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-200">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-center">
                ✨ PIX (Instantâneo)
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-center">
                💳 Cartão Crédito
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-center">
                💳 Cartão Débito
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-center">
                💵 Dinheiro (com troco)
              </div>
            </div>
            <div className="pt-1 text-[11px] text-slate-500">
              * Maquininha sem fio levada até você pelos nossos motoboys.
            </div>
          </div>

        </div>

        {/* Rodapé Inferior */}
        <div className="mt-12 border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} Tailândia Distribuidora & Tabacaria. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-slate-300">Termos de Uso</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-300">Privacidade</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-300">Dúvidas Frequentes</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
