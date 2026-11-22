// In a campaign every fight comes from the story: Duncan (Gemini) or the local
// engine starts it; the player cannot open the encounter builder there.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import tavernSource from '../components/TavernApp.jsx?raw';
import storySource from '../components/game/StoryStream.jsx?raw';
import { generateDMResponse } from './gameEngine';
import { tavernAudio } from './audio';
import { encounterCandidates, resolveCombatRequest, getMonster } from './bestiary';
import { createEncounter, runEnemyTurns, playerAction, isPlayerTurn } from './encounter';
import { saveCampaign, getCampaignById } from './campaignStorage';
import { buildCharacter, randomDraft } from './characterBuilder';

const character = { name: 'Kaelen', race: 'Elfo', class: 'Pícaro (Nivel 3)', level: 2, hp: 20, maxHp: 28, gold: 10 };
const world = { id: 'oakhaven', name: 'Oakhaven', genre: 'Fantasía', factions: [] };

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(tavernAudio, 'playDiceRoll').mockImplementation(() => {});
  vi.spyOn(tavernAudio, 'playCritSuccess').mockImplementation(() => {});
  vi.spyOn(tavernAudio, 'playCritFail').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fights in a campaign', () => {
  it('the local engine starts a fight when the hero attacks', async () => {
    const bestiary = encounterCandidates(2);
    const reply = await generateDMResponse({ playerAction: 'Ataco al bandido con mi daga', character, world, bestiary });
    expect(reply.combat?.enemigos?.length).toBeGreaterThan(0);
    expect(resolveCombatRequest(reply.combat, 2).length).toBeGreaterThan(0);
  });

  it('Duncan starts a fight with creatures of the bestiary, elites included', async () => {
    const bestiary = encounterCandidates(2);
    const id = bestiary.creatures[0].id;
    const payload = {
      narracion: 'Un bandido salta del camino.', usaTirada: false, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: ['Luchar'],
      combate: { enemigos: [{ id, cantidad: 1, nombre: 'Grak', elite: true }] }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) }));
    const reply = await generateDMResponse({ playerAction: 'Sigo por el camino', character, world, bestiary, apiKeys: ['clave-de-prueba-123'] });
    const [group] = resolveCombatRequest(reply.combat, 2);
    expect(group).toMatchObject({ name: 'Grak', elite: true, count: 1 });
    expect(group.monster.hp).toBeGreaterThan(getMonster(id).hp);
  });

  it('a fight saved halfway is resumed where it was', () => {
    const hero = buildCharacter(randomDraft());
    let die = 0;
    const rollDie = sides => 1 + (die++ % sides);
    let { encounter, character: h } = runEnemyTurns(createEncounter([{ monster: getMonster('bandit'), count: 2 }], hero, rollDie), hero, rollDie);
    const result = playerAction(encounter, h, { type: 'dodge' }, rollDie);
    ({ encounter, character: h } = result);
    saveCampaign({ id: 'c1', title: 'Valle', world, character: h, messages: [], encounter });
    const stored = getCampaignById('c1');
    expect(stored.encounter.status).toBe(encounter.status);
    expect(stored.encounter.round).toBe(encounter.round);
    expect(stored.encounter.enemies.map(e => e.hp)).toEqual(encounter.enemies.map(e => e.hp));
    if (stored.encounter.status === 'active' && isPlayerTurn(stored.encounter)) {
      expect(playerAction(stored.encounter, stored.character, { type: 'dodge' }, rollDie).ok).toBe(true);
    }
  });

  it('the campaign screen no longer opens the encounter builder', () => {
    expect(tavernSource).not.toMatch(/EncounterBuilder|onStartCombat/);
    expect(storySource).not.toMatch(/onStartCombat/);
  });
});
