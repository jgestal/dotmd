import { describe, expect, it } from 'vitest';
import { computeStats, countWords, formatMinutes, guessLang, toPlain } from '../stats';

describe('toPlain', () => {
  it('strips Markdown syntax but keeps the prose', () => {
    const md = '---\ntitle: x\n---\n# Title\n\nSome **bold** and [a link](http://x.y) and `code`.\n\n```js\nconst hidden = 1;\n```\n- [x] done';
    const plain = toPlain(md);
    expect(plain).toContain('Title');
    expect(plain).toContain('Some bold and a link and code.');
    expect(plain).not.toContain('hidden');
    expect(plain).not.toContain('title: x');
    expect(plain).not.toContain('[x]');
  });
});

describe('computeStats', () => {
  it('counts words, letters and sentences', () => {
    const s = computeStats('Hola mundo. Esto es una prueba.', false, 'es');
    expect(s.words).toBe(6);
    expect(s.sentences).toBe(2);
    expect(s.letters).toBe(24);
    expect(s.chars).toBe(31);
    expect(s.charsNoSpaces).toBe(26);
  });

  it('counts Markdown structure', () => {
    const s = computeStats('# A\n\ntext [l](u) ![i](p)\n\n## B\n\nmore', true, 'en');
    expect(s.headings).toBe(2);
    expect(s.links).toBe(1);
    expect(s.images).toBe(1);
    expect(s.paragraphs).toBe(4);
  });

  it('gives a readability score only for long enough text', () => {
    expect(computeStats('Short text.', false, 'en').readability).toBeNull();
    const long = 'The cat sat on the mat. It was a sunny day. '.repeat(10);
    const r = computeStats(long, false, 'en').readability!;
    expect(r).toBeGreaterThan(70); // very easy English
  });

  it('handles empty documents', () => {
    const s = computeStats('', true, 'en');
    expect(s.words).toBe(0);
    expect(s.lines).toBe(0);
  });
});

describe('helpers', () => {
  it('counts words with accents and apostrophes', () => {
    expect(countWords("l'été est très beau, n'est-ce pas?")).toBeGreaterThanOrEqual(5);
  });
  it('guesses the language', () => {
    expect(guessLang('El perro de la casa es grande y los gatos son de la vecina.', 'en')).toBe('es');
    expect(guessLang('The dog of the house is big and the cats are on the roof with it.', 'es')).toBe('en');
    expect(guessLang('ok', 'es')).toBe('es');
    expect(guessLang('Le chat est dans la maison et les enfants sont avec une amie qui ne parle pas pour le moment.', 'en')).toBe('fr');
    expect(guessLang('Der Hund und die Katze sind nicht im Haus, das ist auch mit einer Frau von hier und sich selbst.', 'en')).toBe('de');
    expect(guessLang('O can non está na casa, xa saíu coma sempre e tamén unha nena vai polo camiño ao río, moi cedo.', 'en')).toBe('gl');
    expect(guessLang('El gos i els gats són amb la mare, això és perquè aquest matí molt d’hora van sortir dels camps.', 'en')).toBe('ca');
  });
  it('formats reading time', () => {
    expect(formatMinutes(100, 230)).toBe('<1');
    expect(formatMinutes(690, 230)).toBe('3');
  });
});
