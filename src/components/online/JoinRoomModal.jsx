import React, { useState } from 'react';
import { X, Wifi } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { normalizeCode, cleanName } from '../../online/room';

/** Enter a friend's room with a name and the room code (no account). */
export default function JoinRoomModal({ isOpen, onClose, onJoin, kind, initialCode = '', initialName = '' }) {
  useEscapeKey(isOpen, onClose);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  if (!isOpen) return null;
  const ready = cleanName(name) && normalizeCode(code).length >= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#141019] border-2 border-sky-700/40 p-6 shadow-2xl relative">
        <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800">
          <X className="w-5 h-5" />
        </button>
        <h3 className="font-cinzel text-xl font-bold text-stone-100 flex items-center gap-2 mb-1"><Wifi className="w-5 h-5 text-sky-300" /> Unirse a una partida</h3>
        <p className="text-xs text-stone-400 mb-4">Sin cuentas: tu nombre y el código que te pase quien abre la sala.</p>

        {!kind ? (
          <p className="text-sm text-stone-300">
            El juego online aún no está configurado en este sitio (falta conectar Supabase). Puedes seguir jugando en solitario o con tu grupo en esta pantalla.
          </p>
        ) : (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (ready) onJoin({ code: normalizeCode(code), name: cleanName(name) }); }}>
            <label className="block">
              <span className="text-xs text-stone-400">Tu nombre</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={20} autoFocus={!initialName}
                className="mt-1 w-full bg-[#1a1523] border border-stone-700 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs text-stone-400">Código de sala</span>
              <input value={code} onChange={e => setCode(normalizeCode(e.target.value))} maxLength={12} placeholder="Ej: K7RM2Q"
                className="mt-1 w-full bg-[#1a1523] border border-stone-700 focus:border-sky-500 rounded-lg px-3 py-2 text-lg font-mono tracking-[0.2em] text-sky-100 focus:outline-none" />
            </label>
            {kind === 'local' && <p className="text-[11px] text-amber-200">Modo de prueba: solo conecta pestañas de este navegador.</p>}
            <p className="text-[11px] text-stone-500">Para volver a tu personaje si te desconectas, entra con el mismo nombre desde este mismo navegador.</p>
            <button type="submit" disabled={!ready} className="w-full py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold">
              Entrar en la sala
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
