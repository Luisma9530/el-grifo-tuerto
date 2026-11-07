import { describe, it, expect } from 'vitest';
import { parseClassAndLevel, getCurrentLocation, formatLastPlayed, stripMarkdown } from './saveSlots';

describe('parseClassAndLevel', () => {
  it('splits class and level from "Clase (Nivel N)"', () => {
    expect(parseClassAndLevel({ class: 'Pícaro (Nivel 3)' })).toEqual({ className: 'Pícaro', level: 3 });
  });
  it('prefers an explicit level field', () => {
    expect(parseClassAndLevel({ class: 'Mago (Nivel 2)', level: 5 })).toEqual({ className: 'Mago', level: 5 });
  });
  it('handles a class without level', () => {
    expect(parseClassAndLevel({ class: 'Bardo' })).toEqual({ className: 'Bardo', level: null });
  });
  it('falls back for missing character', () => {
    expect(parseClassAndLevel(undefined)).toEqual({ className: 'Aventurero', level: null });
  });
});

describe('getCurrentLocation', () => {
  it('returns the current map node', () => {
    const world = { initialLocation: 'Taberna', mapNodes: [{ name: 'Molino', status: 'current' }, { name: 'Taberna', status: 'discovered' }] };
    expect(getCurrentLocation(world)).toBe('Molino');
  });
  it('falls back to initialLocation, then a default', () => {
    expect(getCurrentLocation({ initialLocation: 'Taberna', mapNodes: [] })).toBe('Taberna');
    expect(getCurrentLocation(null)).toBe('Desconocida');
  });
});

describe('formatLastPlayed', () => {
  const now = new Date('2026-11-07T12:00:00Z').getTime();
  it('formats relative times', () => {
    expect(formatLastPlayed('2026-11-07T11:59:40Z', now)).toBe('Hace un momento');
    expect(formatLastPlayed('2026-11-07T11:30:00Z', now)).toBe('Hace 30 min');
    expect(formatLastPlayed('2026-11-07T07:00:00Z', now)).toBe('Hace 5 h');
    expect(formatLastPlayed('2026-11-06T12:00:00Z', now)).toBe('Hace 1 día');
    expect(formatLastPlayed('2026-11-04T12:00:00Z', now)).toBe('Hace 3 días');
  });
  it('handles missing or invalid dates', () => {
    expect(formatLastPlayed(null, now)).toBe('Fecha desconocida');
    expect(formatLastPlayed('nope', now)).toBe('Fecha desconocida');
  });
});

describe('stripMarkdown', () => {
  it('removes markdown markers and collapses whitespace', () => {
    expect(stripMarkdown('**Duncan**  dice:\n*hola*')).toBe('Duncan dice: hola');
  });
});
