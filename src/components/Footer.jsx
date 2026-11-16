import React from 'react';
import { Dice5, Shield, Github, Heart } from 'lucide-react';

export default function Footer({ onEnterTavern, onOpenInvite }) {
  return (
    <footer className="bg-[#08070b] border-t border-amber-950/60 pt-16 pb-12 text-stone-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          {/* Brand info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-500/50 flex items-center justify-center text-xl">
                🦅
              </div>
              <span className="font-cinzel text-xl font-bold text-stone-100">
                EL GRIFO TUERTO
              </span>
            </div>
            <p className="text-stone-300 text-sm max-w-sm leading-relaxed mb-4">
              Rol de mesa estilo D&D en solitario, con Maese Duncan como Dungeon Master. Las aventuras nunca se cancelan: gratis, sin registro y en tu navegador.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Sin servidores: tus partidas se guardan en tu navegador</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-cinzel text-sm font-bold text-amber-200 uppercase tracking-wider mb-4">
              La Taberna
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button onClick={onEnterTavern} className="hover:text-amber-400 transition-colors">
                  Iniciar Campaña
                </button>
              </li>
              <li>
                <button onClick={onOpenInvite} className="hover:text-amber-400 transition-colors">
                  Compartir la Taberna
                </button>
              </li>
              <li>
                <a href="#worlds" className="hover:text-amber-400 transition-colors">
                  Biblioteca de Mundos
                </a>
              </li>
            </ul>
          </div>

          {/* Apps & Platforms */}
          <div>
            <h4 className="font-cinzel text-sm font-bold text-amber-200 uppercase tracking-wider mb-4">
              Disponibilidad
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 flex items-center gap-2 text-stone-300">
                <span>🌐</span>
                <span>Navegador Web (PC / Mac / Linux)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 flex items-center gap-2 text-stone-300">
                <span>📱</span>
                <span>Móvil y tablet, desde el navegador</span>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 flex items-center gap-2 text-stone-300">
                <span>🔓</span>
                <span>Sin instalación ni registro</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>© {new Date().getFullYear()} El Grifo Tuerto. Inspirado en el juego de rol de mesa más famoso del mundo.</p>
          <div className="flex items-center gap-1">
            <span>Hecho con</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>y mucha hidromiel en la posada</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
