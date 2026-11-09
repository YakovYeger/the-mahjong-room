import type { HandDefinition } from '../game/types';

const inks = {
  bamboo: { ink: 'jade', name: 'Bams' },
  characters: { ink: 'red', name: 'Craks' },
  dots: { ink: 'ink', name: 'Dots' },
} as const;

function groupNotation(key: string, count: number) {
  const [family, value] = key.split('-');
  if (family === 'bamboo' || family === 'characters' || family === 'dots') return { text: value.repeat(count), ...inks[family] };
  if (family === 'dragon') {
    const cue = value === 'green' ? inks.bamboo : value === 'red' ? inks.characters : inks.dots;
    return { ...cue, text: 'D'.repeat(count), name: `${value} Dragon` };
  }
  return { text: (family === 'wind' ? value[0].toUpperCase() : 'F').repeat(count), ink: 'ink', name: family === 'wind' ? `${value} Wind` : 'Flowers' };
}

export function TrainingCardLine({ hand }: { hand: HandDefinition }) {
  return <div className="daily-card-line">
    <div className="daily-card-pattern" aria-label="Card pattern">
      {hand.groups.map(group => {
        const token = groupNotation(group.tileKey, group.count);
        return <strong className={`card-ink-${token.ink}`} key={group.id} aria-label={`${token.text}, ${token.name}`}>{token.text}</strong>;
      })}
      <span className="daily-card-exposure" aria-label={hand.exposure === 'concealed' ? 'Concealed' : 'Exposures allowed'}>{hand.exposure === 'concealed' ? 'C' : 'X'}</span>
    </div>
    <details className="daily-card-key">
      <summary>Symbols &amp; suit colors</summary>
      <p><b className="card-ink-jade">Green: Bams</b> · <b className="card-ink-red">Red: Craks</b> · <b>Black: Dots</b> on this Training Card line.</p>
      <p><b>F</b> Flowers · <b>N/E/W/S</b> Winds · <b>D</b> Dragons: Green, Red, White.</p>
      <p><b>C</b> Concealed · <b>X</b> Exposures allowed. On the full card, colors indicate relative suits; read the note to assign them.</p>
    </details>
  </div>;
}
