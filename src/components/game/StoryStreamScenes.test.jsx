import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import StoryStream from './StoryStream';

// A party apart: the scenes this screen follows and the prologues kept as history

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
      messages={[{ sender: 'duncan', text: 'Escena de Ana en las minas.', timestamp: 'Inicio' }]}
      isGenerating={false}
      suggestedActions={['Bajar a la galería']}
      character={{ id: 'a', name: 'Ana', hp: 10, maxHp: 10, inventory: [], stats: {} }}
      party={[{ id: 'a', name: 'Ana', hp: 10 }, { id: 'b', name: 'Bruno', hp: 10 }]}
      memberPlaces={{ a: 'Minas', b: 'Monasterio' }}
      world={{ name: 'Valle', initialLocation: 'Taberna', mapNodes: [{ id: 'z1', name: 'Minas', status: 'current' }] }}
      onSendAction={() => {}}
      {...props}
    />
  ));
};
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('StoryStream con la party separada', () => {
  it('muestra las escenas y cambia de escena al elegir otra', () => {
    const onSelectScene = vi.fn();
    render({ scenes: [{ id: 'g1', label: 'Ana', place: 'Minas', active: true }, { id: 'g2', label: 'Bruno', place: 'Monasterio', active: false, spotlight: true }], onSelectScene });
    expect(button('Bruno').getAttribute('aria-selected')).toBe('false');
    act(() => button('Bruno').click());
    expect(onSelectScene).toHaveBeenCalledWith('g2');
    // el selector de quién actúa dice dónde está cada uno
    expect(container.querySelector('select').textContent).toContain('Bruno · Monasterio');
  });

  it('los prólogos se leen como historial, sin poder actuar en ellos', () => {
    render({ prologues: [{ id: 'p1', label: 'Prólogo de Bruno (Monasterio)', messages: [{ sender: 'duncan', text: 'La campana sonó sola.', timestamp: 'x' }] }] });
    expect(container.textContent).toContain('Escena de Ana');
    act(() => button('Prólogo de Bruno').click());
    expect(container.textContent).toContain('La campana sonó sola.');
    expect(container.textContent).not.toContain('Escena de Ana');
    expect(container.textContent).not.toContain('Bajar a la galería');
    expect(container.querySelector('input[type=text]').disabled).toBe(true);
    act(() => button('Volver a la escena').click());
    expect(container.textContent).toContain('Escena de Ana');
  });

  it('juntos no hay barra de escenas', () => {
    render({});
    expect(container.querySelector('[aria-label="Escenas y prólogos"]')).toBeNull();
  });
});
