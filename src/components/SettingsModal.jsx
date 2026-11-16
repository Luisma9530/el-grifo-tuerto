import React, { useState, useEffect } from 'react';
import { X, Key, Volume2, Trash2, Check, Sparkles, BookOpen, Dice5 } from 'lucide-react';
import { is3DDiceEnabled, set3DDiceEnabled } from '../dice3d/controller';

export default function SettingsModal({ isOpen, onClose, onClearData, onOpenGeminiConnect, onOpenCampaigns }) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [dice3D, setDice3D] = useState(() => is3DDiceEnabled());

  useEffect(() => {
    const stored = localStorage.getItem('tavern_gemini_key') || '';
    setApiKey(stored);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = (e) => {
    e.preventDefault();
    localStorage.setItem('tavern_gemini_key', apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#141019] border-2 border-stone-700 p-6 sm:p-7 shadow-2xl relative">
        
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-2xl">
            ⚙️
          </div>
          <div>
            <h3 className="font-cinzel text-xl font-bold text-stone-100">
              Ajustes de la Taberna
            </h3>
            <p className="text-xs text-stone-400 font-mono">
              CONFIGURACIÓN DEL MOTOR DE JUEGO & IA
            </p>
          </div>
        </div>

        {/* API Key section */}
        <div className="p-4 rounded-xl bg-[#1a1522] border border-amber-900/30 mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <h4 className="font-cinzel text-sm font-bold text-stone-100">
                Clave de API de Gemini (Google AI Studio)
              </h4>
            </div>
            {onOpenGeminiConnect && (
              <button
                type="button"
                onClick={onOpenGeminiConnect}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Asistente Paso a Paso & Party Pool</span>
              </button>
            )}
          </div>
          <p className="text-xs text-stone-400 mb-3 leading-relaxed">
            Puedes gestionar tus claves con el asistente guiado o pegar tu clave directa de Google AI Studio aquí:
          </p>

          <form onSubmit={handleSaveKey} className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 bg-[#120f18] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1 transition-colors"
            >
              {saved ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{saved ? 'Guardada' : 'Guardar'}</span>
            </button>
          </form>
          {apiKey && (
            <p className="text-[11px] text-emerald-400 mt-2 font-mono flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Modo Gemini activado para respuestas en vivo.</span>
            </p>
          )}
        </div>

        {/* 3D dice */}
        <div className="p-4 rounded-xl bg-[#1a1522] border border-amber-900/30 mb-6">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-2">
              <Dice5 className="w-4 h-4 text-amber-400" />
              <span className="font-cinzel text-sm font-bold text-stone-100">Dados en 3D</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={dice3D}
              onChange={(e) => {
                setDice3D(e.target.checked);
                set3DDiceEnabled(e.target.checked);
              }}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
          </label>
          <p className="text-xs text-stone-400 leading-relaxed mt-2">
            Lanza dados con físicas reales que ruedan y rebotan por la pantalla. Desactívalo si tu dispositivo va justo
            de potencia: las tiradas se resolverán al instante.
          </p>
        </div>

        {/* Campaigns Manager */}
        {onOpenCampaigns && (
          <div className="p-4 rounded-xl bg-[#1a1522] border border-amber-900/30 mb-6">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h4 className="font-cinzel text-sm font-bold text-stone-100">
                  Grimorio de Campañas
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCampaigns();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <span>Abrir Gestor</span>
              </button>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Gestiona todas tus partidas guardadas, exporta copias en formato .json o importa aventuras de otros dispositivos.
            </p>
          </div>
        )}

        {/* Reset Cache / Data */}
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="w-4 h-4 text-red-400" />
            <h4 className="font-cinzel text-sm font-bold text-red-200">
              Reiniciar Partida y Crónica
            </h4>
          </div>
          <p className="text-xs text-stone-400 mb-3">
            Borra la partida activa (crónica, personaje y mapa). Tus claves de Gemini y el resto de partidas del Grimorio se conservan.
          </p>
          <button
            onClick={() => {
              if (window.confirm('¿Seguro que deseas reiniciar tu progreso en esta taberna?')) {
                onClearData();
                onClose();
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800 text-red-200 text-xs font-semibold border border-red-700/50 transition-colors"
          >
            Reiniciar Progreso
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-200 font-semibold text-xs border border-stone-700 transition-colors"
        >
          Listo
        </button>

      </div>
    </div>
  );
}
