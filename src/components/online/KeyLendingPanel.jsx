import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { playerName } from '../../online/room';
import { isPlausibleGeminiKey } from '../../online/keyLending';

const QUOTA_NOTE = 'Cada clave suma cuota solo si es de una cuenta de Google distinta: varias claves de la misma cuenta comparten el mismo límite.';

/**
 * Gemini keys in the online room (never shown, only who lent one).
 *  - Host: its own keys, who lent theirs and which keys each scene uses (`scenes`).
 *  - Player: lend their key to the host for the session, or take it back.
 *
 * lenders: ids of the players who lent a key.
 * Host: hostKeysCount, scenes ([{ id, label, lenderIds }] while the party is apart, else null).
 * Player: lending { ready, lent, sending }, storedKeys ([{ id, label, key }]), onLend(key) → Promise<{ ok, error }>, onWithdraw().
 */
export default function KeyLendingPanel({
  room, me, isHost = false, lenders = [], hostKeysCount = 0, scenes = null,
  lending = null, storedKeys = [], onLend = null, onWithdraw = null
}) {
  const [choice, setChoice] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const others = lenders.filter(id => id !== room.hostId);

  const lend = async e => {
    e.preventDefault();
    const key = storedKeys.length ? (storedKeys.find(k => k.id === choice) || storedKeys[0]).key : typed.trim();
    if (!isPlausibleGeminiKey(key)) {
      setError('Eso no parece una clave de Gemini (empiezan por «AIza…»).');
      return;
    }
    setError('');
    const res = await onLend(key);
    if (!res?.ok) setError(res?.error || 'No se pudo prestar la clave.');
    else setTyped('');
  };

  return (
    <section className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 space-y-2" aria-label="Claves de Gemini">
      <h4 className="font-cinzel font-bold text-amber-200 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Claves de Gemini</h4>

      {others.length > 0 ? (
        <ul className="space-y-0.5">
          {others.map(id => (
            <li key={id} className="text-[11px] text-stone-200">🔑 {id === me ? 'Has prestado tu clave' : `${playerName(room, id)} ha prestado su clave`}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-stone-500">Nadie ha prestado su clave: Duncan usa las del anfitrión.</p>
      )}

      {isHost && (
        <div className="text-[11px] text-stone-300 space-y-1">
          <p>
            Duncan tiene <strong className="text-amber-200">{hostKeysCount + others.length}</strong> {hostKeysCount + others.length === 1 ? 'clave' : 'claves'}:
            {' '}{hostKeysCount} {hostKeysCount === 1 ? 'tuya' : 'tuyas'}{others.length ? ` y ${others.length} ${others.length === 1 ? 'prestada' : 'prestadas'}` : ''}.
            {' '}Se turnan cuando una llega a su límite.
          </p>
          {scenes && (
            <ul className="space-y-0.5 pl-2 border-l border-amber-900/50">
              {scenes.map(s => (
                <li key={s.id}>
                  <span className="text-stone-200">{s.label}</span>:{' '}
                  {s.lenderIds.length
                    ? `la clave de ${s.lenderIds.map(id => playerName(room, id)).join(' y ')}${s.withHost ? ' y las tuyas' : ''}`
                    : 'tus claves'}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-stone-500">Las claves prestadas solo viven en la memoria de esta pestaña: nunca se guardan ni se envían a nadie, y se retiran solas cuando su dueño sale de la sala.</p>
        </div>
      )}

      {!isHost && lending && (
        lending.lent ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-emerald-200">El anfitrión usa tu clave para llamar a Duncan durante esta sesión (mientras estés separado del grupo, para tu escena).</p>
            <button onClick={() => onWithdraw?.()} className="text-[11px] px-2.5 py-1 rounded-lg border border-stone-700 hover:bg-stone-800">Retirar mi clave</button>
          </div>
        ) : (
          <form onSubmit={lend} className="space-y-1.5">
            <p className="text-[11px] text-stone-300">
              ¿Tienes clave de Gemini? Préstasela al anfitrión: <strong>la usará el anfitrión para llamar a Duncan</strong> mientras
              estés en la sala (viaja cifrada solo para el anfitrión y no se guarda en ningún sitio). Se retira sola al salir.
            </p>
            {storedKeys.length > 1 && (
              <select value={choice || storedKeys[0].id} onChange={e => setChoice(e.target.value)} aria-label="Clave que prestas"
                className="w-full bg-[#1a1523] border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200">
                {storedKeys.map(k => <option key={k.id} value={k.id}>{k.label || 'Clave'}</option>)}
              </select>
            )}
            {storedKeys.length === 0 && (
              <input type="password" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Pega tu clave (AIza…)" autoComplete="off"
                aria-label="Tu clave de Gemini" spellCheck={false}
                className="w-full bg-[#1a1523] border border-stone-700 focus:border-amber-500 rounded px-2 py-1 font-mono text-[11px] text-stone-100 focus:outline-none" />
            )}
            <button type="submit" disabled={!lending.ready || lending.sending || (!storedKeys.length && !typed.trim())}
              className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-[11px] font-bold">
              {lending.sending ? 'Prestando…' : !lending.ready ? 'Esperando al anfitrión…' : storedKeys.length ? 'Prestar mi clave al anfitrión' : 'Prestar esta clave al anfitrión'}
            </button>
            {error && <p className="text-[11px] text-red-300" role="alert">{error}</p>}
          </form>
        )
      )}

      <p className="text-[10px] text-stone-500">{QUOTA_NOTE}</p>
    </section>
  );
}
