import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, afterEach, vi } from 'vitest';
import CombatView from './CombatView';
import { createEncounter, addOpening } from '../../utils/encounter';
import { detectOpeningStrike } from '../../utils/surprise';
import { isAggressive } from '../../utils/combatNarration';
import { quickHero } from '../../utils/simulator';
import { getMonster } from '../../utils/bestiary';
import { attackOptions } from '../../utils/combat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

let root;
let container;
const render = element => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(element));
};
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const dice = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const seeded = seed => {
  let a = seed;
  return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
};
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));

describe('CombatView: the opening strike', () => {
  const hero = { ...quickHero({ classId: 'fighter', level: 2, rng: seeded(5) }), id: 'brena' };
  const start = (text, surprise = { side: 'enemies' }) => {
    const enc = createEncounter([{ monster: getMonster('bandit') }, { monster: getMonster('cultist') }], [hero], dice(10), { surprise });
    return addOpening(enc, [hero], detectOpeningStrike(text, hero, enc.enemies));
  };

  it('asks for the target when the words did not name one, and plays the weapon on it', () => {
    const onAction = vi.fn();
    render(<CombatView encounter={start('¡Ataco!')} heroes={[hero]} onAction={onAction} busy={false} />);
    expect(container.textContent).toContain('Golpe de apertura');
    expect(container.textContent).toContain('Elige a qué enemigo atacas');
    expect(container.textContent).toContain('Contra un enemigo sorprendido tiene ventaja');
    expect(container.textContent).toContain('Sorprendido');
    // Only attacks and spells: no gear, potions or fleeing before the initiative
    expect(button('Equipo')).toBeUndefined();
    expect(button('Otras')).toBeUndefined();
    const weapon = attackOptions(hero).find(o => o.weapon);
    const attack = button(weapon.itemName);
    expect(attack.disabled).toBe(true);
    act(() => button('Sectario').click());
    expect(attack.disabled).toBe(false);
    act(() => attack.click());
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'attack', optionId: weapon.id, targetUid: 'cultist-2' }));
  });

  it('a target named is already selected; the player may give the strike up', () => {
    const onAction = vi.fn();
    render(<CombatView encounter={start('Ataco al bandido', null)} heroes={[hero]} onAction={onAction} busy={false} />);
    expect(container.textContent).not.toContain('Elige a qué enemigo');
    expect(container.textContent).not.toContain('ventaja');
    act(() => button('No atacar').click());
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'endTurn' }));
  });

  it('an online guest watching sees whose strike it is', () => {
    render(<CombatView encounter={start('Ataco al bandido')} heroes={[hero]} onAction={vi.fn()} busy={false} waitingFor="Ana" />);
    expect(container.textContent).toContain('lo juega Ana');
    expect(button('No atacar')).toBeUndefined();
  });
});

describe('aggressive words start a fight', () => {
  it('weapons and spells thrown at someone', () => {
    ['le clavo la daga al tabernero', 'le lanzo un rayo de escarcha al guardia', 'le doy un tajo', 'le asesto un puñetazo'].forEach(t => expect(isAggressive(t)).toBe(true));
    ['clavo un cartel en la puerta', 'le tiro una moneda al mendigo', 'pido una cerveza'].forEach(t => expect(isAggressive(t)).toBe(false));
  });
});
