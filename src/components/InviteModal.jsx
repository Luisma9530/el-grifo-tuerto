import React, { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { X, Copy, Check, Download } from 'lucide-react';

/**
 * Share the tavern with friends: everyone can play their own adventure, or join
 * an online room (see src/online); a campaign can be passed on as a .json file.
 */
export default function InviteModal({ isOpen, onClose, onOpenCampaigns }) {
  useEscapeKey(isOpen, onClose);
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.origin;

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable (permissions / insecure context): the link can still be selected by hand
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#141019] border-2 border-amber-600/40 p-6 sm:p-7 shadow-2xl relative">

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
            🍺
          </div>
          <div>
            <h3 className="font-cinzel text-xl font-bold text-stone-100">
              Compartir la Taberna
            </h3>
            <p className="text-xs text-amber-400 font-mono">
              GRATIS Y SIN REGISTRO PARA TODOS
            </p>
          </div>
        </div>

        <p className="text-sm text-stone-300 leading-relaxed mb-6">
          Pasa este enlace a tus amigos para que cada uno juegue <strong>su propia aventura</strong> en su navegador.
          ¿Queréis jugar juntos? Abre tu campaña y pulsa <strong>«Online»</strong>: tendrás un código de sala para que
          entren con su nombre (botón «Unirse» de la portada), cada uno con un personaje del grupo.
        </p>

        <div className="mb-6">
          <label htmlFor="share-url" className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-2">
            Enlace de la taberna:
          </label>
          <div className="flex items-center gap-2">
            <input
              id="share-url"
              type="text"
              readOnly
              value={shareUrl}
              onFocus={e => e.target.select()}
              className="flex-1 min-w-0 bg-[#1c1724] border border-amber-900/50 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-amber-300 select-all focus:outline-none"
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

        <div className="p-4 rounded-xl bg-stone-900/80 border border-stone-800 mb-6">
          <div className="flex items-start gap-3">
            <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-300 leading-relaxed">
              <p>
                <strong className="text-stone-100">¿Quieres pasarle tu aventura a alguien?</strong> Exporta la campaña
                a un archivo .json desde el Grimorio y envíaselo: podrá importarla y continuarla por su cuenta.
              </p>
              {onOpenCampaigns && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCampaigns();
                  }}
                  className="mt-2 text-amber-400 hover:text-amber-300 font-semibold underline"
                >
                  Abrir el Grimorio de Campañas
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-700 text-stone-200 font-semibold text-sm transition-colors"
        >
          Cerrar
        </button>

      </div>
    </div>
  );
}
