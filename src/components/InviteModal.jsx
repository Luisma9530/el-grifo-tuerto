import React, { useState } from 'react';
import { X, Copy, Check, Users, ShieldCheck, Share2 } from 'lucide-react';

export default function InviteModal({ isOpen, onClose, campaignId = 'tavern-alpha-948' }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/#party=${campaignId}`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#141019] border-2 border-amber-600/40 p-6 sm:p-7 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
            🍺
          </div>
          <div>
            <h3 className="font-cinzel text-xl font-bold text-stone-100">
              Invitar Amigos a la Mesa
            </h3>
            <p className="text-xs text-amber-400 font-mono">
              PASE DE AMIGOS: 5 HUECOS DISPONIBLES (GRATIS)
            </p>
          </div>
        </div>

        <p className="text-sm text-stone-300 leading-relaxed mb-6">
          Pasa este enlace a tus compañeros de partida. Pueden abrirlo en cualquier navegador (PC o móvil) y entrarán directamente a tu mesa en El Grifo Tuerto con sus propios personajes <strong>sin pagar absolutamente nada</strong>.
        </p>

        {/* Link input with copy button */}
        <div className="mb-6">
          <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-2">
            Enlace de Invitación de la Campaña:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 bg-[#1c1724] border border-amber-900/50 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-amber-300 select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm flex items-center gap-1.5 transition-all shadow-md shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Party Slots Indicator */}
        <div className="p-4 rounded-xl bg-stone-900/80 border border-stone-800 mb-6">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-3">
            <span>Huecos de la Mesa:</span>
            <span className="text-emerald-400 font-semibold">1 Anfitrión + 5 Amigos</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            <div className="h-10 rounded-lg bg-amber-600/30 border border-amber-500 flex items-center justify-center text-sm font-bold text-amber-300" title="Tú (Anfitrión)">
              👑
            </div>
            {[1, 2, 3, 4, 5].map((slot) => (
              <div
                key={slot}
                className="h-10 rounded-lg bg-stone-850 border border-dashed border-stone-700 flex items-center justify-center text-xs text-stone-500 font-mono"
                title={`Hueco de amigo #${slot} (Gratis)`}
              >
                +{slot}
              </div>
            ))}
          </div>
        </div>

        {/* Benefits notice */}
        <div className="flex items-center gap-2 text-xs text-stone-400 mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>No se requiere registro con tarjeta para los amigos invitados.</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-700 text-stone-200 font-semibold text-sm transition-colors"
        >
          Cerrar y Volver a la Taberna
        </button>

      </div>
    </div>
  );
}
