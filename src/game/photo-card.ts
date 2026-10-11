import { referenceHands, patternTokens } from './reference-card';
import { createCardProvider } from './training-card';
import type { HandDefinition, HandGroup, Suit } from './types';

const suits: Suit[] = ['bamboo', 'characters', 'dots'];
const palettes = suits.flatMap(a => suits.filter(b => b !== a).map(b => [a, b, suits.find(c => c !== a && c !== b)!]));
const dragon = (suit: Suit) => `dragon-${suit === 'bamboo' ? 'green' : suit === 'characters' ? 'red' : 'white'}`;
const kinds = ['single', 'pair', 'pung', 'kong', 'quint', 'sextet'] as const;

export function expandPhotoHands(): HandDefinition[] {
  const result: HandDefinition[] = [];
  const seen = new Set<string>();
  for (const row of referenceHands) {
    const sectionIndex = referenceHands.filter(r => r.section === row.section).indexOf(row) + 1;
    for (const pattern of row.patterns) {
      const tokens = patternTokens(pattern).filter(t => !['+', '='].includes(t.text));
      const ranks = tokens.flatMap(t => [...t.text].filter(c => /[1-9]/.test(c)).map(Number));
      const min = Math.min(...ranks), max = Math.max(...ranks);
      const consecutive = /consecutive/.test(row.note);
      const shifts = consecutive ? Array.from({length: 10 - (max - min + 1)}, (_, i) => i + 1 - min) : [0];
      const like = row.section === 'Any Like Numbers' || row.note.includes('any like numbers');
      const likeRanks = row.id === 'photo-2025-1' ? [2,5] : row.id === 'photo-2025-52' ? [3,6,9] : row.id === 'photo-2025-54' ? [1,3,5,7,9] : like ? [1,2,3,4,5,6,7,8,9] : (row.note.includes('any even number') || row.note.includes('any like even')) ? [2,4,6,8] : row.note.includes('any like odd') ? [1,3,5,7,9] : row.note.includes('like kongs of 3') ? [3,6,9] : [0];
      const winds = row.note.includes('any wind') ? ['N','E','W','S'] : ['N'];
      for (const palette of palettes) for (const shift of shifts) for (const likeRank of likeRanks) for (const wind of winds) {
        const groups: HandGroup[] = [];
        for (const token of tokens) {
          const suit = palette[token.ink === 'jade' ? 0 : token.ink === 'red' ? 1 : 2];
          const runs = token.text.match(/(.)\1*/g) ?? [];
          for (const run of runs) {
            let symbol = run[0];
            if (row.note.includes('any wind') && symbol === 'N') symbol = wind;
            let key: string;
            if (symbol === 'F') key = 'flower-any';
            else if (symbol === 'D') key = dragon(suit);
            else if ('NEWS'.includes(symbol)) key = `wind-${({N:'north', E:'east', W:'west', S:'south'} as Record<string,string>)[symbol]}`;
            else if (symbol === '0') key = 'dragon-white';
            else {
              let rank = Number(symbol) + shift;
              if (like) rank = likeRank;
              else if (row.id === 'photo-2025-1' && token.text === '222') rank = likeRank;
              else if (row.id === 'photo-2025-52' && token.text === '33') rank = likeRank;
              else if (row.id === 'photo-2025-54') rank = token.ink !== 'jade' ? likeRank : rank;
              else if (row.note.includes('any even number') && token.text === '222') rank = likeRank;
              else if (row.note.includes('any even number') && token.text === '2222') rank = likeRank;
              else if (row.note.includes('any like odd') || row.note.includes('any like even')) rank = likeRank || rank;
              else if (row.note.includes('like kongs of 3') && run.length === 4) rank = likeRank;
              key = `${suit}-${rank}`;
            }
            groups.push({ id: `g${groups.length}`, tileKey: key, count: run.length, kind: kinds[run.length - 1], jokerAllowed: run.length >= 3 });
          }
        }
        if (groups.reduce((n,g) => n + g.count, 0) !== 14) throw new Error(`Invalid transcription: ${row.id}`);
        if (row.id === 'photo-2025-25') {
          const start = 1 + shift;
          for (let pairRank = start; pairRank < start + 5; pairRank += 1) {
            const variant = groups.map(g => ({ ...g }));
            variant[0].count = 1; variant[0].kind = 'single';
            const pair = variant.find(g => g.tileKey === `${palette[0]}-${pairRank}`)!;
            pair.count = 2; pair.kind = 'pair';
            for (const g of variant.filter(g => g.count === 4)) g.tileKey = g.tileKey.replace(/-\d+$/, `-${pairRank}`);
            const id = `${row.id}:${variant.map(g => `${g.tileKey}:${g.count}`).join('/')}`;
            if (!seen.has(id)) { seen.add(id); result.push({ id, section: row.section, name: `${row.section} · ${sectionIndex}`, description: row.note, exposure: 'exposed', teachingPoint: '30 points · Both kongs match the pair in the run.', groups: variant, value: row.value }); }
          }
          continue;
        }
        const signature = `${row.id}:${groups.map(g => `${g.tileKey}:${g.count}`).join('/')}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        result.push({ id: signature, section: row.section, name: `${row.section} · ${sectionIndex}`, description: row.note || 'Follow the printed wind and dragon groups.', exposure: row.exposure === 'C' ? 'concealed' : 'exposed', teachingPoint: `${row.value} points · ${row.exposure === 'C' ? 'Keep this hand concealed.' : 'Pungs, kongs and quints may be exposed.'} Singles and pairs must be natural.`, groups, value: row.value });
      }
    }
  }
  return result;
}
const provider = createCardProvider('photo-2025', 'Your 2025 Card', expandPhotoHands());
export const PhotoCardProvider = { ...provider, analyzeCandidates: (...args: Parameters<typeof provider.analyzeCandidates>) => {
  const seen = new Set<string>();
  return provider.analyzeCandidates(...args).filter(candidate => { if (seen.has(candidate.name)) return false; seen.add(candidate.name); return true; });
} };
