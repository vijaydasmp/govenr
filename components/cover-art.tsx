/**
 * components/cover-art.tsx
 *
 * Deterministic generative cover art — the magazine "cover plate" for a
 * proposal. Seeded from the proposal hash: the same proposal always
 * renders the same cover, on every device, forever. No images are fetched,
 * nothing external — in the spirit of the wireframe note "charts are
 * never images": art here is generated, never hosted.
 *
 * Server component (pure SVG).
 */

const SLATE = '#1e3a5f';
const SLATE_DEEP = '#16304f';
const GOLD = '#a4762a';
const GOLD_BRIGHT = '#c99b4a';

function diamond(cx: number, cy: number, s: number) {
  return `M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`;
}

export default function CoverArt({
  hash,
  className,
}: {
  hash: string;
  className?: string;
}) {
  const h = (hash || '0').toLowerCase().replace(/[^0-9a-f]/g, '') || '0';
  const nib = (i: number) => parseInt(h[i % h.length], 16);

  const W = 400;
  const H = 240;

  // Diamond lattice — staggered rows, one cell per hash nibble.
  const cols = 8;
  const stepX = W / (cols + 1);
  const stepY = 52;
  const cells: React.ReactElement[] = [];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < cols; col++) {
      const v = nib(row * cols + col);
      const cx = stepX * (col + 1) + (row % 2 === 0 ? 0 : stepX / 2);
      const cy = 30 + row * stepY;
      const s = 13;
      if (v >= 14) {
        // rare gold accent
        cells.push(
          <path
            key={`c${row}-${col}`}
            d={diamond(cx, cy, s)}
            fill={v === 15 ? GOLD_BRIGHT : GOLD}
            opacity={0.85}
          />,
        );
      } else if (v >= 9) {
        // mid slate
        cells.push(
          <path
            key={`c${row}-${col}`}
            d={diamond(cx, cy, s)}
            fill={SLATE}
            opacity={0.55}
          />,
        );
      } else if (v >= 4) {
        // faint slate
        cells.push(
          <path
            key={`c${row}-${col}`}
            d={diamond(cx, cy, s)}
            fill={SLATE}
            opacity={0.25}
          />,
        );
      }
      // v < 4: empty — the plate breathes
    }
  }

  // Anchor: one large gold diamond, position chosen by the first two
  // nibbles — the proposal's "monogram".
  const ax = stepX * (1 + (nib(0) % cols));
  const ay = 40 + (nib(1) % 4) * stepY;
  const anchorSize = 26 + (nib(2) % 3) * 5;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Generative cover art derived from the proposal hash"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width={W} height={H} fill={SLATE_DEEP} />
      {cells}
      <path d={diamond(ax, ay, anchorSize)} fill="none" stroke={GOLD} strokeWidth={1.5} />
      <path d={diamond(ax, ay, anchorSize - 7)} fill={GOLD} opacity={0.9} />
    </svg>
  );
}
