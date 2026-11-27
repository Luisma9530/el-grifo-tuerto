import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, afterEach, vi } from 'vitest';
import PartySetup from './PartySetup';
import { PRESET_WORLDS } from '../../data/gameData';

// The setup closes while the creation wizard is open: the choice of how the story
// starts (and the zones chosen) must survive it

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const hero = (id, backgroundId, speciesId) => ({ id, name: id, race: 'Humano', class: 'Guerrero', maxHp: 10, ac: 12, gold: 10, inventory: [], stats: {}, backgroundId, speciesId });
const members = [hero('Durin', 'smith', 'dwarf'), hero('Ana', 'acolyte', 'human')];

let root;
let container;
const mount = props => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<PartySetup world={PRESET_WORLDS[0]} members={members} onAddWithWizard={() => {}} onChange={() => {}} onStart={() => {}} onCancel={() => {}} {...props} />));
};
const unmount = () => {
  act(() => root.unmount());
  container.remove();
};
const radio = text => [...container.querySelectorAll('[role=radio]')].find(r => r.textContent.includes(text));
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));
afterEach(() => {
  if (container?.isConnected) unmount();
});

describe('PartySetup: cómo empieza la historia', () => {
  it('la elección y las zonas se guardan fuera y sobreviven al asistente', () => {
    let start = null;
    const onStartChange = patch => { start = { ...(start || {}), ...patch }; };
    mount({ start, onStartChange });
    act(() => radio('Cada uno').click());
    expect(start.mode).toBe('origins');
    unmount(); // se abre el asistente para crear otro personaje

    const onStart = vi.fn();
    mount({ start, onStartChange, onStart });
    expect(radio('Cada uno').getAttribute('aria-checked')).toBe('true');
    const selects = container.querySelectorAll('select[aria-label^="Zona de inicio"]');
    expect([...selects].map(s => s.value)).toEqual(['zone-hierro', 'zone-campana']);
    // elegir otra zona para Ana
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(selects[1], 'zone-puente');
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(start.picked).toEqual({ Ana: 'zone-puente' });
    unmount();

    mount({ start, onStartChange, onStart });
    act(() => button('Comenzar la aventura').click());
    expect(onStart).toHaveBeenCalledWith(members, expect.objectContaining({ mode: 'origins', choices: ['zone-hierro', 'zone-puente'] }));
  });

  it('por defecto, empezar juntos', () => {
    const onStart = vi.fn();
    mount({ onStart });
    act(() => button('Comenzar la aventura').click());
    expect(onStart).toHaveBeenCalledWith(members, { mode: 'together' });
  });
});
