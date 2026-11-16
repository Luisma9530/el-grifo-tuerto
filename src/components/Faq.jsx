import React from 'react';
import { FAQS } from '../data/gameData';

export default function Faq() {
  return (
    <section id="faq" className="py-20 bg-[#0a080e] relative border-t border-amber-950/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="font-cinzel text-2xl sm:text-3xl font-bold text-stone-100">
            Preguntas Frecuentes
          </h2>
          <p className="text-stone-400 text-sm mt-1">
            Todo lo que necesitas saber antes de pedir la primera ronda
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl bg-[#120f18] border border-amber-900/30 p-5 hover:border-amber-700/40 transition-colors"
            >
              <h3 className="font-cinzel font-bold text-stone-100 text-base flex items-center gap-2">
                <span className="text-amber-500 font-mono">Q.</span>
                {faq.q}
              </h3>
              <p className="text-stone-300 text-sm mt-2 pl-6 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
