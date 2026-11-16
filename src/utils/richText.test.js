import { describe, it, expect } from 'vitest';
import { parseInline } from './richText';

describe('parseInline', () => {
  it('returns plain text untouched', () => {
    expect(parseInline('Hola, forastero.')).toEqual([{ type: 'text', text: 'Hola, forastero.' }]);
    expect(parseInline('')).toEqual([]);
    expect(parseInline(undefined)).toEqual([]);
  });

  it('parses bold and italic segments', () => {
    expect(parseInline('[🎲 D20: **8 (Fallo)**] —*¡Cuidado!* —grita')).toEqual([
      { type: 'text', text: '[🎲 D20: ' },
      { type: 'bold', text: '8 (Fallo)' },
      { type: 'text', text: '] —' },
      { type: 'italic', text: '¡Cuidado!' },
      { type: 'text', text: ' —grita' }
    ]);
  });

  it('leaves unbalanced asterisks and multi-line spans as text', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ type: 'text', text: '2 * 3 = 6' }]);
    expect(parseInline('*abre\ncierra*')).toEqual([{ type: 'text', text: '*abre\ncierra*' }]);
  });

  it('never produces markup from HTML-looking text', () => {
    const tokens = parseInline('**<img src=x onerror=alert(1)>**');
    expect(tokens).toEqual([{ type: 'bold', text: '<img src=x onerror=alert(1)>' }]);
  });
});
