import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EncounterBuilder from './EncounterBuilder';
import { getMonster, eliteVersion } from '../../utils/bestiary';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const bandit = getMonster('bandit');
const hero = { name: 'Aria', level: 3 };
let container;
let root;

const render = props => act(() => {
  root.render(<EncounterBuilder character={hero} world={null} onClose={() => {}} {...props} />);
});
const eliteButtons = () => [...container.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Élite');
const startButton = label => [...container.querySelectorAll('button')].find(b => b.textContent.includes(label));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('EncounterBuilder', () => {
  it('in a campaign the player cannot make enemies elite', () => {
    const onStart = vi.fn();
    render({ onStart, initialGroups: [{ monster: bandit, count: 2 }] });
    expect(eliteButtons()).toHaveLength(0);
    act(() => startButton('¡A luchar!').click());
    expect(onStart.mock.calls[0][0]).toEqual([{ monster: bandit, count: 2, elite: false }]);
  });

  it('in the simulator any group can be made elite', () => {
    const onStart = vi.fn();
    render({ onStart, allowElite: true, startLabel: 'Usar estos enemigos', initialGroups: [{ monster: bandit, count: 2 }] });
    expect(eliteButtons()).toHaveLength(1);
    act(() => eliteButtons()[0].click());
    act(() => startButton('Usar estos enemigos').click());
    expect(onStart.mock.calls[0][0]).toEqual([{ monster: eliteVersion(bandit), count: 2, elite: true }]);
  });

  it('keeps the elites Duncan created when they come in (simulator replay)', () => {
    const onStart = vi.fn();
    render({ onStart, allowElite: true, initialGroups: [{ monster: eliteVersion(bandit), count: 1, name: 'Grak', elite: true }] });
    act(() => startButton('¡A luchar!').click());
    expect(onStart.mock.calls[0][0][0]).toMatchObject({ monster: eliteVersion(bandit), name: 'Grak', elite: true });
  });
});
