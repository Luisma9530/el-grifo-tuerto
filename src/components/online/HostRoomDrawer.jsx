import React, { useState } from 'react';
import { X, Wifi } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import RoomPanel from './RoomPanel';

/**
 * The host's side panel: open a room for this campaign (name), then the room itself.
 * Without Supabase configured it explains what is missing.
 */
export default function HostRoomDrawer({ isOpen, onClose, kind, online, defaultName = '', onOpenRoom, ...panel }) {
  useEscapeKey(isOpen, onClose);
  const [name, setName] = useState(defaultName);
  if (!isOpen) return null;
  const room = online.status === 'open' ? online.room : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <aside className="w-full sm:w-[26rem] h-full bg-[#120f18] border-l border-sky-900/60 shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()} aria-label="Sala online">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#14101c] border-b border-sky-950">
          <h3 className="font-cinzel font-bold text-sky-100 flex items-center gap-2"><Wifi className="w-4 h-4 text-sky-300" /> Partida online</h3>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"><X className="w-4 h-4" /></button>
        </div>

        {room ? (
          <RoomPanel room={room} isHost {...panel} />
        ) : !kind ? (
          <div className="p-4 text-sm text-stone-300 space-y-3">
            <p>El juego online aún no está configurado en este sitio.</p>
            <p className="text-xs text-stone-400">
              Quien lo despliega tiene que crear un proyecto gratuito de Supabase y poner sus variables
              <code className="mx-1 text-sky-300">VITE_SUPABASE_URL</code> y <code className="mx-1 text-sky-300">VITE_SUPABASE_ANON_KEY</code>
              en Vercel (y volver a desplegar). Mientras tanto la taberna funciona igual que siempre, en solitario o con tu grupo en esta pantalla.
            </p>
          </div>
        ) : (
          <form className="p-4 space-y-3 text-sm text-stone-300" onSubmit={e => { e.preventDefault(); onOpenRoom(name); }}>
            <p>
              Abre una sala para esta campaña: tus amigos entran con su nombre y el código (hasta 4 jugadores) y cada uno
              juega con un personaje del grupo. Tu navegador lleva la partida: Duncan usa <strong>tu</strong> clave de Gemini,
              que nunca se envía a nadie, y la campaña se sigue guardando aquí. Si un amigo tiene clave, puede prestártela
              para la sesión y Duncan tendrá más cuota.
            </p>
            {kind === 'local' && (
              <p className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/50 rounded-lg p-2">
                Modo de prueba: la sala solo conecta pestañas de este mismo navegador.
              </p>
            )}
            <label className="block">
              <span className="text-xs text-stone-400">Tu nombre en la mesa</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={20} required
                className="mt-1 w-full bg-[#1a1523] border border-stone-700 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none" />
            </label>
            {online.error && <p className="text-xs text-red-300">{online.error}</p>}
            <button type="submit" disabled={!name.trim() || online.status === 'opening'}
              className="w-full py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold">
              {online.status === 'opening' ? 'Abriendo la sala…' : 'Abrir sala online'}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
