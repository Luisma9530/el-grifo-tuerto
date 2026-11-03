import React from 'react';
import { Star, Quote, MessageSquare } from 'lucide-react';
import { TESTIMONIALS, FAQS } from '../data/gameData';

export default function Testimonials() {
  return (
    <section className="py-20 bg-[#0a080e] relative border-t border-amber-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Testimonials Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Historias de Taberna</span>
          </div>
          <h2 className="font-cinzel text-3xl sm:text-5xl font-extrabold text-stone-100">
            Lo que Dicen los Aventureros
          </h2>
          <p className="mt-3 text-stone-300 text-base">
            Cientos de miles de aventureros ya han tomado asiento en la barra de El Grifo Tuerto.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {TESTIMONIALS.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-[#141019] border border-amber-900/30 p-6 flex flex-col justify-between hover:border-amber-600/40 transition-colors shadow-lg"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-stone-300 leading-relaxed italic mb-6">
                  "{item.comment}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-stone-800/80">
                <div className="w-10 h-10 rounded-full bg-stone-850 border border-amber-500/30 flex items-center justify-center text-xl">
                  {item.avatar}
                </div>
                <div>
                  <h4 className="font-cinzel text-sm font-bold text-stone-100">
                    {item.name}
                  </h4>
                  <p className="text-xs text-amber-400/80 font-mono">
                    {item.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="font-cinzel text-2xl sm:text-3xl font-bold text-stone-100">
              Preguntas Frecuentes
            </h3>
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
                <h4 className="font-cinzel font-bold text-stone-100 text-base flex items-center gap-2">
                  <span className="text-amber-500 font-mono">Q.</span>
                  {faq.q}
                </h4>
                <p className="text-stone-300 text-sm mt-2 pl-6 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
