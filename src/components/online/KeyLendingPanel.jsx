import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { playerName } from '../../online/room';
import { isPlausibleGeminiKey, MAX_LENT_PER_PLAYER } from '../../online/keyLending';

const QUOTA_NOTE = 'Cada clave suma cuota solo si es de una cuenta de Google distinta: varias claves de la misma cuenta comparten el mismo límite.';

const keysWord = n => (n === 1 ? 'su clave' : `${n} claves`);

/**
 * Gemini keys in the online room (never shown: only who lent how many).
 *  - Host: its own keys, who lent theirs and which keys each scene uses (`scenes`).
 *  - Player: lend one or more keys to the host for the session, and take them back.
 *
 * lenders: ids of the players who lent keys; counts: { [playerId]: how many }.
 * Host: hostKeysCount, scenes ([{ id, label, lenderIds, withHost }] while the party is apart, else null).
 * Player: lending { ready, lent, sending, mine: [{ slot, label, confirmed }] }, storedKeys ([{ id, label, key }]),
 *   onLend(key, label) → Promise<{ ok, error, slot }>, onWithdraw(slot?).
 */
export default function KeyLendingPanel({
  room, me, isHost = false, lenders = [], counts = {}, hostKeysCount = 0, scenes = null,
  lending = null, storedKeys = [], onLend = null, onWithdraw = null
}) {
  const [choice, setChoice] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  // Which stored key went in each slot (to offer only the ones not lent yet)
  const [storedBySlot, setStoredBySlot] = useState({});
  const others = lenders.filter(id => id !== room.hostId);
  const countOf = id => counts[id] || 1;
  const lentTotal = others.reduce((sum, id) => sum + countOf(id), 0);

  const mine = lending?.mine || [];
  const lentStored = new Set(mine.map(m => storedBySlot[m.slot]).filter(Boolean));
  const available = storedKeys.filter(k => !lentStored.has(k.id));
  const full = mine.length >= MAX_LENT_PER_PLAYER;
  const picked = available.find(k => k.id === choice) || available[0] || null;

  const lend = async e => {
    e.preventDefault();
    const fromStore = available.length > 0;
    const key = fromStore ? picked.key : typed.trim();
    if (!isPlausibleGeminiKey(key)) {
      setError('Eso no parece una clave de Gemini (empiezan por «AIza…»).');
      return;
    }
    setError('');
    const res = await onLend(key, fromStore ? picked.label : '');
    if (!res?.ok) {
      setError(res?.error || 'No se pudo prestar la clave.');
      return;
    }
    if (fromStore) setStoredBySlot(m => ({ ...m, [res.slot]: picked.id }));
    setTyped('');
    setChoice('');
  };

  return (
    <section className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 space-y-2" aria-label="Claves de Gemini">
      <h4 className="font-cinzel font-bold text-amber-200 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Claves de Gemini</h4>

      {others.length > 0 ? (
        <ul className="space-y-0.5">
          {others.map(id => (
            <li key={id} className="text-[11px] text-stone-200">
              🔑 {id === me
                ? `Has prestado ${countOf(id) === 1 ? 'tu clave' : `${countOf(id)} claves`}`
                : `${playerName(room, id)} ha prestado ${keysWord(countOf(id))}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-stone-500">Nadie ha prestado su clave: Duncan usa las del anfitrión.</p>
      )}

      {isHost && (
        <div className="text-[11px] text-stone-300 space-y-1">
          <p>
            Duncan tiene <strong className="text-amber-200">{hostKeysCount + lentTotal}</strong> {hostKeysCount + lentTotal === 1 ? 'clave' : 'claves'}:
            {' '}{hostKeysCount} {hostKeysCount === 1 ? 'tuya' : 'tuyas'}{lentTotal ? ` y ${lentTotal} ${lentTotal === 1 ? 'prestada' : 'prestadas'}` : ''}.
            {' '}Se turnan cuando una llega a su límite.
          </p>
          {scenes && (
            <ul className="space-y-0.5 pl-2 border-l border-amber-900/50">
              {scenes.map(s => {
                const n = s.lenderIds.reduce((sum, id) => sum + countOf(id), 0);
                return (
                  <li key={s.id}>
                    <span className="text-stone-200">{s.label}</span>:{' '}
                    {s.lenderIds.length
                      ? `${n === 1 ? 'la clave' : `las ${n} claves`} de ${s.lenderIds.map(id => playerName(room, id)).join(' y ')}${s.withHost ? ' y las tuyas' : hostKeysCount ? ' (y las tuyas de reserva)' : ''}`
                      : 'tus claves'}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[10px] text-stone-500">Las claves prestadas solo viven en la memoria de esta pestaña: nunca se guardan ni se envían a nadie, y se retiran solas cuando su dueño sale de la sala.</p>
        </div>
      )}

      {!isHost && lending && (
        <div className="space-y-2">
          {mine.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-emerald-200">
                El anfitrión usa {mine.length === 1 ? 'tu clave' : 'tus claves'} para llamar a Duncan durante esta sesión
                (mientras estés separado del grupo, para tu escena{mine.length > 1 ? ', turnándolas por cuota' : ''}).
              </p>
              <ul className="space-y-1">
                {mine.map(m => (
                  <li key={m.slot} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 min-w-0 truncate text-stone-200">🔑 {m.label}</span>
                    <span className={m.confirmed ? 'text-emerald-300' : 'text-stone-500'}>{m.confirmed ? 'prestada' : 'enviando…'}</span>
                    <button onClick={() => onWithdraw?.(m.slot)} aria-label={`Retirar ${m.label}`}
                      className="px-1.5 py-0.5 rounded border border-stone-700 hover:bg-stone-800 text-stone-300 flex items-center gap-1">
                      <X className="w-3 h-3" /> Retirar
                    </button>
                  </li>
                ))}
              </ul>
              {mine.length > 1 && (
                <button onClick={() => onWithdraw?.()} className="text-[10px] text-stone-400 hover:text-red-300 hover:underline">Retirar todas</button>
              )}
            </div>
          )}

          {!full && (
            <form onSubmit={lend} className="space-y-1.5">
              {mine.length === 0 && (
                <p className="text-[11px] text-stone-300">
                  ¿Tienes clave de Gemini? Préstasela al anfitrión: <strong>la usará el anfitrión para llamar a Duncan</strong> mientras
                  estés en la sala (viaja cifrada solo para el anfitrión y no se guarda en ningún sitio). Se retira sola al salir.
                  Si tienes varias cuentas de Google, puedes prestar una clave de cada una.
                </p>
              )}
              {available.length > 1 && (
                <select value={picked?.id || ''} onChange={e => setChoice(e.target.value)} aria-label="Clave que prestas"
                  className="w-full bg-[#1a1523] border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200">
                  {available.map(k => <option key={k.id} value={k.id}>{k.label || 'Clave'}</option>)}
                </select>
              )}
              {available.length === 0 && (
                <input type="password" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Pega una clave (AIza…)" autoComplete="off"
                  aria-label="Clave de Gemini que prestas" spellCheck={false}
                  className="w-full bg-[#1a1523] border border-stone-700 focus:border-amber-500 rounded px-2 py-1 font-mono text-[11px] text-stone-100 focus:outline-none" />
              )}
              <button type="submit" disabled={!lending.ready || lending.sending || (!available.length && !typed.trim())}
                className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-[11px] font-bold">
                {lending.sending ? 'Prestando…'
                  : !lending.ready ? 'Esperando al anfitrión…'
                    : mine.length ? 'Prestar otra clave'
                      : available.length ? 'Prestar mi clave al anfitrión' : 'Prestar esta clave al anfitrión'}
              </button>
            </form>
          )}
          {full && <p className="text-[10px] text-stone-500">Como mucho {MAX_LENT_PER_PLAYER} claves por jugador.</p>}
          {error && <p className="text-[11px] text-red-300" role="alert">{error}</p>}
        </div>
      )}

      <p className="text-[10px] text-stone-500">{QUOTA_NOTE}</p>
    </section>
  );
}
