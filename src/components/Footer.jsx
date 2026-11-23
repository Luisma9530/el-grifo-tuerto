import React from 'react';
import { Dice5, Heart } from 'lucide-react';

/** Page footer: who we are, a single «Jugar» link and the SRD attribution. */
export default function Footer({ onEnterTavern }) {
  return (
    <footer className="bg-[#08070b] border-t border-amber-950/60 pt-16 pb-12 text-stone-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-12">
          
          {/* Brand info */}
          <div>
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

          <button
            onClick={onEnterTavern}
            className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 font-bold text-sm shadow-lg shadow-amber-600/30 hover:brightness-110 active:scale-95 transition-all"
          >
            <Dice5 className="w-4 h-4" />
            <span>Jugar</span>
          </button>
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

        {/* Attribution required by the SRD 5.2.1 licence (CC-BY-4.0) */}
        <p className="mt-6 text-[10px] leading-relaxed text-stone-600 max-w-4xl">
          This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC,
          available at{' '}
          <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer" className="underline hover:text-stone-400">dndbeyond.com/srd</a>.
          The SRD 5.2.1 is licensed under the{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer" className="underline hover:text-stone-400">
            Creative Commons Attribution 4.0 International License
          </a>.
          El Grifo Tuerto no está afiliado a Wizards of the Coast.
        </p>

      </div>
    </footer>
  );
}
