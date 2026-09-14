import { useState } from "react";

type Datum = { label: string; value: number };

/**
 * Single-series column chart: one hue (#3D5A99, validated), thin columns with a 2px gap,
 * 4px rounded tops anchored to the baseline, recessive grid, hover tooltip, table fallback.
 */
export function BarChart({ title, data, format, height = 180 }: { title: string; data: Datum[]; format: (v: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const top = niceMax(max);
  const W = 640;
  const H = height;
  const pad = { left: 44, right: 8, top: 12, bottom: 24 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(2, slot - 2);
  const ticks = [0, top / 2, top];
  const labelEvery = Math.ceil(data.length / 7);
  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="grid gap-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="label text-ink">{title}</span>
        <span className="num text-[13px] text-muted">{active ? `${active.label}: ${format(active.value)}` : `Total ${format(data.reduce((s, d) => s + d.value, 0))}`}</span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]" role="img" aria-label={`${title}, ${data.length} days`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => {
            const y = pad.top + plotH - (top ? (t / top) * plotH : 0);
            return (
              <g key={t}>
                <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#E4E2DC" strokeWidth={1} />
                <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#686868" fontFamily="IBM Plex Mono, monospace">
                  {format(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = top ? (d.value / top) * plotH : 0;
            const x = pad.left + i * slot + 1;
            const y = pad.top + plotH - h;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={d.label}>
                {h > 0 && (
                  <path
                    d={`M${x},${pad.top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${pad.top + plotH} Z`}
                    fill="#3D5A99"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)}>
                  <title>{`${d.label}: ${format(d.value)}`}</title>
                </rect>
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#686868" fontFamily="IBM Plex Mono, monospace">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#AEAEAE" strokeWidth={1} />
        </svg>
      </div>
      <details className="text-[13px]">
        <summary className="label cursor-pointer">Table</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-rule">
                <td className="py-1">{d.label}</td>
                <td className="num py-1 text-right">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}
