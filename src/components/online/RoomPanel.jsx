import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Send, Crown, Vote, X, RotateCcw, Hourglass } from 'lucide-react';
import {
  playerList, ownerOf, controllerOf, claimOf, leftoverCharacters, voteTally, isConnected, playerName
} from '../../online/room';
import { MAX_CHAT_TEXT } from '../../online/protocol';

/**
 * The online room, for the host and the players alike: code and link, who is
 * connected, who plays each character (choosing, voting the leftover ones), the
 * queue of actions waiting for Duncan and the players' chat (Duncan never reads it).
 *
 * onIntent(intent): what this player asks (the host's own go through the same checks).
 * hostOps (host only): { assign(characterId, playerId|null), breakTie, closeVote, remove(playerId), closeRoom() }
 */
export default function RoomPanel({ room, me, isHost = false, characters = [], link = '', onIntent, hostOps = null, compact = false }) {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const chatEnd = useRef(null);
  const chatLength = room?.chat?.length || 0;
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [chatLength]);
  if (!room) return null;

  const ids = characters.map(c => c.id);
  const players = playerList(room).sort((a, b) => Number(b.isHost) - Number(a.isHost));
  const connected = players.filter(p => p.connected);
  const myClaim = claimOf(room, me);
  const leftovers = new Set(leftoverCharacters(room, ids));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the link can be selected by hand */ }
  };
  const sendChat = e => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onIntent({ type: 'chat', text: clean });
    setText('');
  };

  return (
    <div className={`flex flex-col gap-3 text-xs text-stone-200 ${compact ? '' : 'p-4'}`}>
      {/* Code and link */}
      <section className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-300/80 font-mono">Código de sala</p>
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-sky-100 select-all">{room.code}</p>
          </div>
          {link && (
            <button onClick={copy} className="px-2.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold flex items-center gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
          )}
        </div>
        {link && <input readOnly value={link} onFocus={e => e.target.select()} aria-label="Enlace de la sala"
          className="mt-2 w-full bg-black/30 border border-sky-900/50 rounded-lg px-2 py-1 font-mono text-[10px] text-sky-200" />}
      </section>

      {/* Players */}
      <section>
        <h4 className="font-cinzel font-bold text-amber-200 mb-1.5">Jugadores ({connected.length}/4)</h4>
        <ul className="space-y-1">
          {players.map(p => (
            <li key={p.id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-stone-600'}`} aria-hidden="true" />
              <span className={p.connected ? 'text-stone-100' : 'text-stone-500'}>{p.name}{p.id === me ? ' (tú)' : ''}</span>
              {p.isHost && <Crown className="w-3 h-3 text-amber-400" aria-label="anfitrión" />}
              {!p.connected && <span className="text-[10px] text-stone-500">sin conexión</span>}
              {hostOps && !p.isHost && !p.connected && (
                <button onClick={() => hostOps.remove(p.id)} className="ml-auto text-[10px] text-red-300 hover:underline">Quitar</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Characters */}
      <section>
        <h4 className="font-cinzel font-bold text-amber-200 mb-1.5">Personajes</h4>
        <ul className="space-y-2">
          {characters.map(c => {
            const owner = ownerOf(room, c.id);
            const controller = controllerOf(room, c.id);
            const claimed = room.claims[c.id];
            const away = owner !== controller;
            const tally = leftovers.has(c.id) ? voteTally(room, c.id) : null;
            const myVote = room.votes[c.id]?.[me];
            const tie = room.ties[c.id];
            return (
              <li key={c.id} className="rounded-lg border border-stone-800 bg-[#17131f] p-2">
                <div className="flex items-center gap-2">
                  <span className="text-base" aria-hidden="true">{c.avatar || '🛡️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-100 truncate">{c.name}</p>
                    <p className="text-[10px] text-stone-400">
                      Lo juega <strong className={controller === me ? 'text-amber-300' : 'text-stone-200'}>{controller === me ? 'tú' : playerName(room, controller)}</strong>
                      {away && ` (${playerName(room, owner)} se ha desconectado)`}
                      {!claimed && room.voted[c.id] && ' · por votación'}
                    </p>
                  </div>
                  {claimed === me && (
                    <button onClick={() => onIntent({ type: 'release', characterId: c.id })} className="text-[10px] px-2 py-1 rounded border border-stone-700 hover:bg-stone-800">Soltar</button>
                  )}
                  {!claimed && (
                    <button onClick={() => onIntent({ type: 'claim', characterId: c.id })}
                      className="text-[10px] px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold"
                      title={myClaim ? 'Cambiar a este personaje (sueltas el que tenías)' : 'Jugar con este personaje'}>
                      {myClaim ? 'Cambiar a este' : 'Elegir'}
                    </button>
                  )}
                </div>

                {hostOps && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-stone-400">
                    Asignar a:
                    <select value={claimed || ''} onChange={e => hostOps.assign(c.id, e.target.value || null)}
                      className="bg-[#1a1523] border border-stone-700 rounded px-1 py-0.5 text-stone-200">
                      <option value="">— nadie (votación) —</option>
                      {players.map(p => <option key={p.id} value={p.id}>{p.name}{p.connected ? '' : ' (sin conexión)'}</option>)}
                    </select>
                  </label>
                )}

                {/* Leftover character: the room votes who plays it */}
                {tally && connected.length > 1 && (
                  <div className="mt-2 pt-2 border-t border-stone-800">
                    <p className="text-[10px] text-stone-400 flex items-center gap-1 mb-1">
                      <Vote className="w-3 h-3" /> Nadie lo ha elegido: votad quién lo juega ({tally.cast}/{tally.voters} votos)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {connected.map(p => (
                        <button key={p.id} onClick={() => onIntent({ type: 'vote', characterId: c.id, candidateId: p.id })}
                          aria-pressed={myVote === p.id}
                          className={`px-2 py-0.5 rounded border text-[10px] ${myVote === p.id ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-stone-700 text-stone-300 hover:bg-stone-800'}`}>
                          {p.id === me ? 'Yo' : p.name} · {tally.counts[p.id] || 0}
                        </button>
                      ))}
                    </div>
                    {tie && (
                      <div className="mt-1.5 text-[10px] text-amber-200">
                        Empate entre {tie.map(id => playerName(room, id)).join(' y ')}: decide el anfitrión.
                        {hostOps && (
                          <span className="ml-1 inline-flex flex-wrap gap-1">
                            {tie.map(id => (
                              <button key={id} onClick={() => hostOps.breakTie(c.id, id)} className="px-1.5 py-0.5 rounded bg-amber-600 text-stone-950 font-bold">{playerName(room, id)}</button>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-1.5 flex gap-2">
                      {hostOps && !tie && !tally.complete && (
                        <button onClick={() => hostOps.closeVote(c.id)} className="text-[10px] text-sky-300 hover:underline">Cerrar votación</button>
                      )}
                      {Object.keys(room.votes[c.id] || {}).length > 0 && (
                        <button onClick={() => onIntent({ type: 'revote' })} className="text-[10px] text-stone-400 hover:text-stone-200 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Volver a votar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Queue */}
      <section>
        <h4 className="font-cinzel font-bold text-amber-200 mb-1.5 flex items-center gap-1.5"><Hourglass className="w-3.5 h-3.5" /> Esperando a Duncan</h4>
        {room.queue.length === 0 ? (
          <p className="text-[11px] text-stone-500">No hay acciones en cola.</p>
        ) : (
          <ol className="space-y-1 list-decimal list-inside">
            {room.queue.map(q => (
              <li key={q.id} className="text-[11px] text-stone-300">
                <span>{q.label}</span>
                <span className="text-stone-500"> · {playerName(room, q.playerId)}</span>
                {(q.playerId === me || isHost) && (
                  <button onClick={() => onIntent({ type: 'cancel', queueId: q.id })} className="ml-1 text-stone-500 hover:text-red-300" aria-label="Retirar la acción">
                    <X className="w-3 h-3 inline" />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Chat */}
      <section className="flex flex-col min-h-0">
        <h4 className="font-cinzel font-bold text-amber-200 mb-1.5">Chat de la mesa <span className="font-sans font-normal text-[10px] text-stone-500">(Duncan no lo lee)</span></h4>
        <div className="rounded-lg border border-stone-800 bg-black/30 p-2 h-40 overflow-y-auto space-y-1" aria-live="polite">
          {room.chat.length === 0 && <p className="text-[11px] text-stone-500">Aún no hay mensajes.</p>}
          {room.chat.map(line => (
            <p key={line.id} className="text-[11px] break-words">
              <strong className={line.playerId === me ? 'text-amber-300' : isConnected(room, line.playerId) ? 'text-sky-200' : 'text-stone-400'}>{line.name}:</strong>{' '}
              <span className="text-stone-200">{line.text}</span>
            </p>
          ))}
          <div ref={chatEnd} />
        </div>
        <form onSubmit={sendChat} className="mt-1.5 flex gap-1.5">
          <input value={text} onChange={e => setText(e.target.value)} maxLength={MAX_CHAT_TEXT} placeholder="Escribe a la mesa…" aria-label="Mensaje para los jugadores"
            className="flex-1 min-w-0 bg-[#1a1523] border border-stone-700 focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
          <button type="submit" disabled={!text.trim()} className="px-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950" aria-label="Enviar al chat">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </section>

      {hostOps?.closeRoom && (
        <button onClick={hostOps.closeRoom} className="mt-1 py-2 rounded-lg border border-red-900/60 text-red-200 hover:bg-red-950/40 text-xs font-semibold">
          Cerrar la sala (seguir jugando solo)
        </button>
      )}
    </div>
  );
}
