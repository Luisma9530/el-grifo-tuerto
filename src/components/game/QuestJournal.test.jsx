import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import QuestJournal from './QuestJournal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const quest = (extra = {}) => ({
  id: 'm1', title: 'Lobos en el molino', giver: 'Marta', place: 'Molino', objective: 'Ahuyentar a los lobos.',
  reward: { gold: 30, itemKey: null, itemName: null, xp: 60 }, status: 'active', started: { scene: 3 }, closed: null,
  notes: [{ text: 'Huellas al norte', scene: 4 }], unseen: 'new', ...extra
});

let root;
let container;
const render = element => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(element));
};
const buttons = () => [...container.querySelectorAll('button')];
const click = label => act(() => buttons().find(b => b.textContent.includes(label)).click());

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('QuestJournal', () => {
  it('shows active and finished quests in tabs, with a mark for news', () => {
    render(<QuestJournal quests={[quest(), quest({ id: 'm2', title: 'Carta', status: 'completed', unseen: false })]} />);
    expect(container.textContent).toContain('1 novedad');
    expect(container.textContent).toContain('Nueva');
    expect(container.textContent).toContain('Lobos en el molino');
    expect(container.textContent).not.toContain('Carta');
    click('Terminadas (1)');
    expect(container.textContent).toContain('Carta');
    expect(container.textContent).toContain('Cumplida');
  });

  it('opens the detail and marks it as seen', () => {
    const onSeen = vi.fn();
    render(<QuestJournal quests={[quest()]} onSeen={onSeen} />);
    click('Lobos en el molino');
    expect(onSeen).toHaveBeenCalledWith('m1');
    expect(container.textContent).toContain('Encargo de: Marta');
    expect(container.textContent).toContain('30 po y 60 PX');
    expect(container.textContent).toContain('Huellas al norte');
  });

  it('lets the player abandon after confirming, but never create or complete', () => {
    const onAbandon = vi.fn();
    render(<QuestJournal quests={[quest({ unseen: false })]} onAbandon={onAbandon} />);
    click('Lobos en el molino');
    const labels = buttons().map(b => b.textContent.toLowerCase());
    expect(labels.some(l => l.includes('cumplir') || l.includes('completar') || l.includes('nueva misión'))).toBe(false);
    click('Abandonar misión');
    expect(onAbandon).not.toHaveBeenCalled();
    click('Sí');
    expect(onAbandon).toHaveBeenCalledWith('m1');
  });

  it('explains that quests come from the story when there are none', () => {
    render(<QuestJournal quests={[]} />);
    expect(container.textContent).toContain('Las misiones llegan con la historia');
  });
});
