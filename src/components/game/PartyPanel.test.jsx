import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import PartyPanel from './PartyPanel';
import { PRESET_CHARACTERS } from '../../data/gameData';
import { normalizeEquipment } from '../../utils/equipment';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const heroes = PRESET_CHARACTERS.slice(0, 2).map((c, i) => normalizeEquipment({ ...c, id: `h${i}` }));

let root;
let container;
const render = props => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(
    <PartyPanel
      character={heroes[0]}
      party={heroes}
      purse={50}
      onUpdateCharacter={() => {}}
      onOrderDrink={() => {}}
      onRollCheck={() => {}}
      onCastSpell={() => {}}
      onRest={() => {}}
      onLevelUp={() => {}}
      onUseItem={() => {}}
      {...props}
    />
  ));
};
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.textContent.includes(text));
const click = el => act(() => el.click());

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('PartyPanel', () => {
  it('has no attack buttons outside a fight (attacks are made in the combat view)', () => {
    render();
    expect(container.textContent).not.toMatch(/Objetivo/);
    expect([...container.querySelectorAll('button')].some(b => b.textContent.trim() === 'Atacar')).toBe(false);
  });

  it('only offers the menu of Duncan at the tavern; rests are always there', () => {
    render({ atTavern: false });
    click(button('Descanso'));
    expect(container.textContent).toMatch(/Descanso corto/);
    expect(container.textContent).toMatch(/solo se sirve en la taberna/);
    expect(container.textContent).not.toMatch(/Cerveza Negra/);
    act(() => root.unmount());
    container.remove();

    render({ atTavern: true });
    click(button('Descanso'));
    expect(container.textContent).toMatch(/Cerveza Negra/);
  });

  it('in a fight only the party shows; the sheet opens on demand', () => {
    render({ inCombat: true });
    expect(container.querySelector('[aria-label="Miembros del grupo"]')).not.toBeNull();
    expect(button('Ficha')).toBeUndefined();
    click(button(`Ver la ficha de ${heroes[0].name}`));
    expect(button('Ficha')).toBeDefined();
  });
});
