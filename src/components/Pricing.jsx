import React from 'react';
import { Check, Sparkles, Users, Shield, Zap } from 'lucide-react';
import { PRICING_TIERS } from '../data/gameData';

export default function Pricing({ onSelectPlan }) {
  return (
    <section id="pricing" className="py-20 bg-[#0d0b11] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pases de Aventurero</span>
          </div>
          <h2 className="font-cinzel text-3xl sm:text-5xl font-extrabold text-stone-100">
            Paga Solo Uno. <br />
            <span className="text-amber-400">Juega Toda la Mesa Gratis.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-stone-300">
            Sin suscripciones forzosas para tus amigos. Con que un miembro de tu grupo tenga el Pase de Héroe, hasta 5 acompañantes juegan sin pagar un céntimo.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 relative ${
                tier.popular
                  ? 'bg-gradient-to-b from-[#241a24] to-[#16101c] border-2 border-amber-500 shadow-2xl shadow-amber-600/20 scale-[1.03] z-10'
                  : 'bg-[#14101a] border border-amber-950/60 hover:border-amber-700/40'
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-600 to-yellow-500 text-stone-950 text-xs font-bold font-mono uppercase tracking-wider shadow-md whitespace-nowrap">
                  {tier.badge}
                </div>
              )}

              <div>
                <h3 className="font-cinzel text-xl font-bold text-stone-100">
                  {tier.name}
                </h3>
                <p className="text-xs text-stone-400 mt-1 min-h-[32px]">
                  {tier.description}
                </p>

                <div className="mt-6 mb-6">
                  <span className="font-cinzel text-4xl font-extrabold text-amber-400">
                    {tier.price}
                  </span>
                  <span className="text-xs text-stone-400 ml-2 font-mono">
                    /{tier.period}
                  </span>
                </div>

                <div className="space-y-3 mb-8">
                  {tier.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onSelectPlan(tier)}
                className={`w-full py-3 px-4 rounded-xl font-cinzel font-bold text-sm transition-all shadow-md ${
                  tier.popular
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 hover:brightness-110 shadow-amber-500/30'
                    : 'bg-stone-850 hover:bg-amber-600/30 text-amber-200 hover:text-amber-100 border border-stone-700/80 hover:border-amber-500/60'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Friend Pass Banner */}
        <div className="mt-14 max-w-4xl mx-auto rounded-2xl bg-gradient-to-r from-amber-950/40 via-stone-900/80 to-amber-950/40 border border-amber-600/30 p-6 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shrink-0">
            🤝
          </div>
          <div className="flex-1">
            <h4 className="font-cinzel text-lg font-bold text-amber-200">
              Pase de Amigos Incluido en Todos los Planes
            </h4>
            <p className="text-xs sm:text-sm text-stone-300 mt-1">
              No dejes a ningún compañero fuera. Con un simple clic copias el enlace de invitación de tu campaña y tus amigos entran directamente al navegador, en PC, móvil o tablet.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
