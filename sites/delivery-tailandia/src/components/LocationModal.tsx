'use client';

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { MapPin, X, Check, Search, Clock, Bike } from 'lucide-react';

const REGIONS = [
  { name: 'Taguatinga Norte / DF', time: '20-35 min', fee: 'R$ 8,00', popular: true },
  { name: 'Taguatinga Sul / DF', time: '25-40 min', fee: 'R$ 10,00', popular: true },
  { name: 'Ceilândia (Norte / Sul / Centro)', time: '30-45 min', fee: 'R$ 12,00', popular: true },
  { name: 'Vicente Pires / DF', time: '25-40 min', fee: 'R$ 10,00', popular: false },
  { name: 'Águas Claras / Areal', time: '25-40 min', fee: 'R$ 12,00', popular: true },
  { name: 'Samambaia Norte / Sul', time: '35-50 min', fee: 'R$ 14,00', popular: false },
  { name: 'Guará I e II', time: '35-50 min', fee: 'R$ 15,00', popular: false },
  { name: 'Asa Norte & Asa Sul (Plano Piloto)', time: '40-60 min', fee: 'R$ 18,00', popular: false },
  { name: 'Sudoeste & Octogonal', time: '40-55 min', fee: 'R$ 18,00', popular: false },
];

export default function LocationModal() {
  const { isLocationModalOpen, setIsLocationModalOpen, selectedLocation, setSelectedLocation, showToast } = useCart();
  const [cepInput, setCepInput] = useState('');
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  if (!isLocationModalOpen) return null;

  const handleSelectRegion = (regionName: string) => {
    setSelectedLocation(regionName);
    showToast(`📍 Região selecionada: ${regionName}`);
    setIsLocationModalOpen(false);
  };

  const handleCepSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cepInput.trim()) return;
    setIsSearchingCep(true);

    setTimeout(() => {
      setIsSearchingCep(false);
      const cleanCep = cepInput.replace(/\D/g, '');
      const formatted = cleanCep.length === 8 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : cleanCep;
      setSelectedLocation(`CEP ${formatted} - Taguatinga / Região DF`);
      showToast(`📍 Endereço localizado via CEP: ${formatted}`);
      setIsLocationModalOpen(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsLocationModalOpen(false)}
          className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white transition"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Onde você quer receber?</h3>
            <p className="text-xs text-slate-400">
              Entregamos bebidas trincando e tabacaria com velocidade recorde no DF.
            </p>
          </div>
        </div>

        {/* Busca por CEP */}
        <form onSubmit={handleCepSearch} className="mb-5 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Digite seu CEP (ex: 72000-000)"
              value={cepInput}
              onChange={(e) => setCepInput(e.target.value)}
              maxLength={9}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 pl-9 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          </div>
          <button
            type="submit"
            disabled={isSearchingCep}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition disabled:opacity-50"
          >
            {isSearchingCep ? 'Buscando...' : 'Consultar'}
          </button>
        </form>

        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Ou selecione sua região no DF:
        </div>

        {/* Lista de Regiões */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {REGIONS.map((region) => {
            const isSelected = selectedLocation.includes(region.name) || selectedLocation === region.name;
            return (
              <button
                key={region.name}
                type="button"
                onClick={() => handleSelectRegion(region.name)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <Bike className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-2">
                      {region.name}
                      {region.popular && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-300 font-semibold">
                          Mais rápida
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {region.time}
                      </span>
                      <span>•</span>
                      <span>Taxa: {region.fee}</span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="h-6 w-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
