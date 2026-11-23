import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import StoryStream from './StoryStream';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

let root;
let container;
const render = props => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(
    <StoryStream
      messages={[{ sender: 'duncan', text: 'Bienvenido.', timestamp: 'Inicio' }]}
      isGenerating={false}
      suggestedActions={['Mirar']}
      character={{ id: 'a', name: 'Aria', hp: 10, maxHp: 10, inventory: [], stats: {} }}
      world={{ name: 'Valle', initialLocation: 'Taberna', mapNodes: [{ id: 'm', name: 'Molino', status: 'current' }] }}
      onSendAction={() => {}}
      {...props}
    />
  ));
};
const labels = () => [...container.querySelectorAll('button')].map(b => b.textContent.trim());
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text) || b.getAttribute('aria-label')?.includes(text));
const click = el => act(() => el.click());

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('StoryStream', () => {
  it('has no button to start a fight or force a scene (fights come from the story)', () => {
    render();
    expect(labels().length).toBeGreaterThan(0);
    expect(labels()).not.toContain('Combate');
    expect(labels().some(l => /^Atacar$/.test(l))).toBe(false);
    expect(labels().some(l => /Ronda en la Barra/.test(l))).toBe(false);
  });

  it('shows where the party is now, not where the campaign began', () => {
    render();
    expect(container.textContent).toContain('Molino');
  });

  it('the 🎲 button offers checks with the sheet and the dice tray', () => {
    const onQuickCheck = vi.fn();
    render({ onQuickCheck, onDiceRoll: () => {} });
    click(button('Tiradas'));
    click(button('Tirada de Percepción'));
    expect(onQuickCheck).toHaveBeenCalledWith('perception');

    click(button('Tiradas'));
    click(button('Bandeja de dados'));
    expect(container.querySelector('[role="dialog"][aria-label="Bandeja de dados"]')).not.toBeNull();
    click(button('Cerrar la bandeja'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('while the box is locked the checks are not offered, but free dice still are', () => {
    render({ onQuickCheck: () => {}, onDiceRoll: () => {}, inputLocked: true });
    click(button('Tiradas'));
    expect(button('Tirada de Percepción')).toBeUndefined();
    expect(button('Bandeja de dados')).toBeDefined();
  });
});
