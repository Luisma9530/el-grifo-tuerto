import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeAll } from 'vitest';
import StoryStream from './StoryStream';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

describe('StoryStream', () => {
  it('has no button to start a fight by hand (fights come from the story)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <StoryStream
        messages={[{ sender: 'duncan', text: 'Bienvenido.', timestamp: 'Inicio' }]}
        isGenerating={false}
        suggestedActions={['Mirar']}
        character={{ name: 'Aria', hp: 10, maxHp: 10, inventory: [], stats: {} }}
        world={{ name: 'Valle' }}
        onSendAction={() => {}}
      />
    ));
    const labels = [...container.querySelectorAll('button')].map(b => b.textContent.trim());
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).not.toContain('Combate');
    act(() => root.unmount());
    container.remove();
  });
});
