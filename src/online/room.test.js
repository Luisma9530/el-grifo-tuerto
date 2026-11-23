import { describe, it, expect } from 'vitest';
import {
  createRoom, joinPlayer, setPresence, claimCharacter, releaseCharacter, castVote, voteTally, breakTie, closeVote,
  restartVotes, controllerOf, ownerOf, canControl, leftoverCharacters, removePlayer, enqueueAction, cancelAction,
  addChat, unreadChatCount, lastChatAt, restoreRoom, roomToSave, newRoomCode, normalizeCode, cleanName, MAX_PLAYERS, MAX_QUEUE_PER_PLAYER
} from './room';

const CHARS = ['brena', 'tobias', 'ilsa', 'garr'];
const base = () => {
  let room = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
  room = joinPlayer(room, { id: 'a', name: 'Ana' }).room;
  room = joinPlayer(room, { id: 'b', name: 'Bea' }).room;
  return room;
};

describe('codes and names', () => {
  it('makes 6-character codes without look-alike characters', () => {
    const code = newRoomCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(normalizeCode(' ab-c 12 ')).toBe('ABC12');
  });
  it('cleans names', () => {
    expect(cleanName('  <Ana>   la   brava\n')).toBe('Ana la brava');
    expect(cleanName('x'.repeat(50))).toHaveLength(20);
  });
});

describe('joining the room', () => {
  it('lets up to four players in and refuses more', () => {
    let room = base();
    room = joinPlayer(room, { id: 'c', name: 'Carla' }).room;
    expect(Object.keys(room.players)).toHaveLength(MAX_PLAYERS);
    const full = joinPlayer(room, { id: 'd', name: 'Dani' });
    expect(full.ok).toBe(false);
    expect(full.error).toMatch(/llena/);
  });
  it('refuses a name already in the room, whatever the case', () => {
    const res = joinPlayer(base(), { id: 'z', name: 'ana' });
    expect(res.ok).toBe(false);
  });
  it('lets the same player back in (same id and name)', () => {
    let room = setPresence(base(), ['h', 'b']);
    expect(room.players.a.connected).toBe(false);
    const res = joinPlayer(room, { id: 'a', name: 'Ana' });
    expect(res.ok).toBe(true);
    expect(res.rejoined).toBe(true);
    expect(res.room.players.a.connected).toBe(true);
  });
  it('does not let an id come back with another name', () => {
    expect(joinPlayer(base(), { id: 'a', name: 'Otra' }).ok).toBe(false);
  });
  it('a disconnected seat does not count for the limit', () => {
    let room = joinPlayer(base(), { id: 'c', name: 'Carla' }).room;
    room = setPresence(room, ['h', 'a', 'b']);
    expect(joinPlayer(room, { id: 'd', name: 'Dani' }).ok).toBe(true);
  });
});

describe('who controls each character', () => {
  it('the host plays everything nobody chose', () => {
    const room = base();
    expect(CHARS.every(c => controllerOf(room, c) === 'h')).toBe(true);
  });
  it('a player chooses one character; choosing another lets the first go', () => {
    let room = claimCharacter(base(), 'a', 'brena', CHARS).room;
    expect(controllerOf(room, 'brena')).toBe('a');
    room = claimCharacter(room, 'a', 'tobias', CHARS).room;
    expect(controllerOf(room, 'brena')).toBe('h');
    expect(controllerOf(room, 'tobias')).toBe('a');
  });
  it('a taken character cannot be chosen by someone else, but the host can give it', () => {
    const room = claimCharacter(base(), 'a', 'brena', CHARS).room;
    expect(claimCharacter(room, 'b', 'brena', CHARS).ok).toBe(false);
    const given = claimCharacter(room, 'b', 'brena', CHARS, { byHost: true });
    expect(given.ok).toBe(true);
    expect(controllerOf(given.room, 'brena')).toBe('b');
  });
  it('only who chose it can let it go', () => {
    const room = claimCharacter(base(), 'a', 'brena', CHARS).room;
    expect(releaseCharacter(room, 'b', 'brena', CHARS).ok).toBe(false);
    expect(controllerOf(releaseCharacter(room, 'a', 'brena', CHARS).room, 'brena')).toBe('h');
  });
  it('the host plays the character of a player who left, and it goes back when they reconnect', () => {
    let room = claimCharacter(base(), 'a', 'brena', CHARS).room;
    room = setPresence(room, ['h', 'b'], CHARS);
    expect(ownerOf(room, 'brena')).toBe('a');
    expect(controllerOf(room, 'brena')).toBe('h');
    expect(canControl(room, 'a', 'brena')).toBe(false);
    room = joinPlayer(room, { id: 'a', name: 'Ana' }).room;
    expect(controllerOf(room, 'brena')).toBe('a');
  });
  it('a removed player gives everything back to the host', () => {
    let room = claimCharacter(base(), 'a', 'brena', CHARS).room;
    room = enqueueAction(room, { playerId: 'a', characterId: 'brena', kind: 'text', payload: { text: 'x' } }).room;
    room = removePlayer(room, 'a');
    expect(room.players.a).toBeUndefined();
    expect(controllerOf(room, 'brena')).toBe('h');
    expect(room.queue).toHaveLength(0);
  });
});

describe('voting the leftover characters', () => {
  const claimed = () => {
    let room = base();
    room = claimCharacter(room, 'h', 'brena', CHARS).room;
    room = claimCharacter(room, 'a', 'tobias', CHARS).room;
    room = claimCharacter(room, 'b', 'ilsa', CHARS).room;
    return room;
  };
  it('the characters nobody chose are the leftover ones', () => {
    expect(leftoverCharacters(claimed(), CHARS)).toEqual(['garr']);
  });
  it('is decided once every connected player voted, by majority', () => {
    let room = claimed();
    room = castVote(room, 'h', 'garr', 'a', CHARS).room;
    room = castVote(room, 'a', 'garr', 'a', CHARS).room;
    expect(controllerOf(room, 'garr')).toBe('h'); // not finished yet
    room = castVote(room, 'b', 'garr', 'b', CHARS).room;
    expect(controllerOf(room, 'garr')).toBe('a');
    expect(voteTally(room, 'garr').complete).toBe(true);
  });
  it('a tie is decided by the host among the tied', () => {
    let room = setPresence(claimed(), ['h', 'a'], CHARS);
    room = castVote(room, 'h', 'garr', 'h', CHARS).room;
    room = castVote(room, 'a', 'garr', 'a', CHARS).room;
    expect(room.ties.garr.sort()).toEqual(['a', 'h']);
    expect(breakTie(room, 'garr', 'b').ok).toBe(false);
    room = breakTie(room, 'garr', 'a').room;
    expect(controllerOf(room, 'garr')).toBe('a');
    expect(room.ties.garr).toBeUndefined();
  });
  it('refuses votes for characters that have a player, or for players who are away', () => {
    let room = claimed();
    expect(castVote(room, 'a', 'brena', 'a', CHARS).ok).toBe(false);
    room = setPresence(room, ['h', 'a'], CHARS);
    expect(castVote(room, 'a', 'garr', 'b', CHARS).ok).toBe(false);
    expect(castVote(room, 'b', 'garr', 'a', CHARS).ok).toBe(false);
  });
  it('is tallied again when someone leaves (only connected players count)', () => {
    let room = claimed();
    room = castVote(room, 'h', 'garr', 'a', CHARS).room;
    room = castVote(room, 'a', 'garr', 'a', CHARS).room;
    expect(controllerOf(room, 'garr')).toBe('h');
    room = setPresence(room, ['h', 'a'], CHARS); // Bea leaves without voting
    expect(ownerOf(room, 'garr')).toBe('a');
  });
  it('can be voted again: the ballots are cleared and the result stays until the new one', () => {
    let room = claimed();
    ['h', 'a', 'b'].forEach(v => { room = castVote(room, v, 'garr', 'b', CHARS).room; });
    expect(ownerOf(room, 'garr')).toBe('b');
    room = restartVotes(room, CHARS);
    expect(room.votes.garr).toBeUndefined();
    expect(ownerOf(room, 'garr')).toBe('b');
    ['h', 'a', 'b'].forEach(v => { room = castVote(room, v, 'garr', 'a', CHARS).room; });
    expect(ownerOf(room, 'garr')).toBe('a');
  });
  it('the host can close a vote early: most voted wins, otherwise the host decides', () => {
    let room = castVote(claimed(), 'a', 'garr', 'b', CHARS).room;
    expect(ownerOf(closeVote(room, 'garr'), 'garr')).toBe('b');
    const empty = closeVote(claimed(), 'garr');
    expect(empty.ties.garr.sort()).toEqual(['a', 'b', 'h']);
  });
  it('choosing a leftover character removes it from the vote', () => {
    let room = castVote(claimed(), 'a', 'garr', 'b', CHARS).room;
    room = releaseCharacter(room, 'b', 'ilsa', CHARS).room;
    room = claimCharacter(room, 'b', 'garr', CHARS).room;
    expect(room.votes.garr).toBeUndefined();
    expect(leftoverCharacters(room, CHARS)).toEqual(['ilsa']);
  });
  it('forgets characters that left the party', () => {
    let room = claimCharacter(base(), 'a', 'garr', CHARS).room;
    room = setPresence(room, ['h', 'a', 'b'], ['brena']);
    expect(room.claims.garr).toBeUndefined();
  });
});

describe('queue and chat', () => {
  it('keeps the order and limits each player', () => {
    let room = base();
    for (let i = 0; i < MAX_QUEUE_PER_PLAYER; i++) {
      room = enqueueAction(room, { playerId: 'a', characterId: 'brena', kind: 'text', payload: { text: `a${i}` } }).room;
    }
    expect(enqueueAction(room, { playerId: 'a', characterId: 'brena', kind: 'text', payload: { text: 'más' } }).ok).toBe(false);
    room = enqueueAction(room, { playerId: 'b', characterId: 'ilsa', kind: 'text', payload: { text: 'b' } }).room;
    expect(room.queue.map(q => q.payload.text)).toEqual(['a0', 'a1', 'b']);
  });
  it('lets a player take back their own action, and the host any', () => {
    let room = enqueueAction(base(), { playerId: 'a', characterId: 'brena', kind: 'text', payload: { text: 'x' } }).room;
    const id = room.queue[0].id;
    expect(cancelAction(room, 'b', id).ok).toBe(false);
    expect(cancelAction(room, 'h', id).room.queue).toHaveLength(0);
  });
  it('counts the new lines from the others since the last one seen', () => {
    let room = addChat(base(), 'a', 'hola', 100);
    room = addChat(room, 'b', 'buenas', 200);
    room = addChat(room, 'a', 'vamos', 300);
    expect(unreadChatCount(room.chat, 'a', 0)).toBe(1);
    expect(unreadChatCount(room.chat, 'b', 0)).toBe(2);
    expect(unreadChatCount(room.chat, 'b', 100)).toBe(1);
    expect(unreadChatCount(room.chat, 'b', lastChatAt(room.chat))).toBe(0);
    expect(lastChatAt([])).toBe(0);
    expect(unreadChatCount(undefined, 'a')).toBe(0);
  });
  it('chat lines carry the name', () => {
    const room = addChat(base(), 'a', 'hola');
    expect(room.chat[0]).toMatchObject({ playerId: 'a', name: 'Ana', text: 'hola' });
  });
});

describe('saving the room', () => {
  it('comes back with everyone but the host disconnected and an empty queue', () => {
    let room = claimCharacter(base(), 'a', 'brena', CHARS).room;
    room = enqueueAction(room, { playerId: 'a', characterId: 'brena', kind: 'text', payload: { text: 'x' } }).room;
    const back = restoreRoom(JSON.parse(JSON.stringify(roomToSave(room))), { hostName: 'Luisma' });
    expect(back.players.a.connected).toBe(false);
    expect(back.players.h.connected).toBe(true);
    expect(back.queue).toEqual([]);
    expect(ownerOf(back, 'brena')).toBe('a');
    expect(controllerOf(back, 'brena')).toBe('h');
  });
});
