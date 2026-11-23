import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Map as MapIcon } from 'lucide-react';
import { MobileTabBar, SideColumn } from './GameLayout';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

describe('MobileTabBar', () => {
  it('marks the current tab and changes it', () => {
    const onChange = vi.fn();
    render(<MobileTabBar active="story" onChange={onChange} tabs={[
      { id: 'story', label: 'Crónica', icon: MapIcon },
      { id: 'map', label: 'Mapa', icon: MapIcon, badge: 2 }
    ]} />);
    const [story, map] = container.querySelectorAll('button');
    expect(story.getAttribute('aria-current')).toBe('page');
    expect(map.textContent).toContain('2');
    act(() => map.click());
    expect(onChange).toHaveBeenCalledWith('map');
  });
});

describe('SideColumn', () => {
  it('outside a fight it just shows its content', () => {
    render(<SideColumn><p>mapa</p></SideColumn>);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('p').parentElement.className).not.toMatch(/lg:hidden/);
  });

  it('in a fight it folds into a rail that opens it over the screen', () => {
    const view = collapsed => <SideColumn collapsed={collapsed} railIcons={[MapIcon]}><p>mapa</p></SideColumn>;
    render(view(true));
    const rail = container.querySelector('button');
    const box = () => container.querySelector('p').parentElement;
    expect(rail.getAttribute('aria-expanded')).toBe('false');
    expect(box().className).toMatch(/lg:hidden/);
    act(() => rail.click());
    expect(box().className).toMatch(/lg:absolute/);
    // the fight ends: back to a normal column, and the next fight starts folded
    act(() => root.render(view(false)));
    act(() => root.render(view(true)));
    expect(box().className).toMatch(/lg:hidden/);
  });
});
