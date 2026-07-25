/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Gráficos SVG sin dependencias externas. Se dibujan con `viewBox` y ancho 100%,
 * por lo que son responsivos y no desbordan en móvil. Los colores usan las
 * variables de tema del proyecto. Todo valor proviene de datos reales del
 * servidor; no se inventan series.
 */
import type { ReactNode } from "react";

const numeric = (value: string | number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
};

/** Tendencia mensual como área + línea. */
export function TrendChart({
  points,
  height = 132
}: {
  points: Array<{ label: string; value: string | number }>;
  height?: number;
}) {
  const width = 320;
  const padX = 6;
  const padY = 12;
  const values = points.map((p) => numeric(p.value));
  const max = Math.max(1, ...values);
  const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const y = (v: number) => height - padY - (v / max) * (height - padY * 2);
  const coords = values.map((v, i) => [padX + i * stepX, y(v)] as const);
  const line = coords.map(([cx, cy], i) => `${i === 0 ? "M" : "L"}${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
  const area = `${line} L${(padX + (points.length - 1) * stepX).toFixed(1)},${height - padY} L${padX},${height - padY} Z`;
  const last = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? 0;
  const delta = prev === 0 ? null : ((last - prev) / prev) * 100;
  return (
    <figure className="chart chart-trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" preserveAspectRatio="none"
        aria-label={`Tendencia de ${points.length} periodos, último valor ${compact(last)}`}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue-600)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--blue-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="var(--blue-600)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {coords.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i === coords.length - 1 ? 3.5 : 2}
            fill={i === coords.length - 1 ? "var(--blue-600)" : "var(--white)"}
            stroke="var(--blue-600)" strokeWidth="1.5" />
        ))}
      </svg>
      <figcaption className="chart-axis">
        {points.map((p, i) => (
          <span key={i} className={i === points.length - 1 ? "is-current" : ""}>{p.label}</span>
        ))}
      </figcaption>
      {delta !== null ? (
        <span className={`chart-delta ${delta >= 0 ? "up" : "down"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
        </span>
      ) : null}
    </figure>
  );
}

/** Barras horizontales para rankings (p. ej. productos más vendidos). */
export function BarChart({
  bars,
  format = compact
}: {
  bars: Array<{ label: string; value: string | number; hint?: string }>;
  format?: (value: number) => string;
}) {
  const values = bars.map((b) => numeric(b.value));
  const max = Math.max(1, ...values);
  return (
    <div className="chart chart-bars" role="list">
      {bars.map((bar, i) => {
        const v = values[i]!;
        return (
          <div className="chart-bar-row" role="listitem" key={i}>
            <span className="chart-bar-label" title={bar.label}>{bar.label}</span>
            <span className="chart-bar-track">
              <span className="chart-bar-fill" style={{ width: `${Math.max(3, (v / max) * 100)}%` }} />
            </span>
            <b className="chart-bar-value">{bar.hint ?? format(v)}</b>
          </div>
        );
      })}
    </div>
  );
}

/** Dona de composición (segmentos con leyenda). */
export function DonutChart({
  segments,
  centerLabel,
  centerValue
}: {
  segments: Array<{ label: string; value: string | number; color: string }>;
  centerLabel?: string;
  centerValue?: ReactNode;
}) {
  const values = segments.map((s) => numeric(s.value));
  const total = values.reduce((sum, v) => sum + v, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="chart chart-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={`Composición de ${segments.length} categorías`}>
        <g transform="translate(70,70) rotate(-90)">
          <circle r={radius} fill="none" stroke="var(--slate-200)" strokeWidth="16" />
          {total > 0 && values.map((v, i) => {
            const fraction = v / total;
            const dash = fraction * circumference;
            const seg = (
              <circle key={i} r={radius} fill="none" stroke={segments[i]!.color} strokeWidth="16"
                strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
                strokeLinecap="butt" />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="chart-donut-value">{centerValue}</text>
        <text x="70" y="84" textAnchor="middle" className="chart-donut-label">{centerLabel}</text>
      </svg>
      <ul className="chart-legend">
        {segments.map((s, i) => (
          <li key={i}>
            <span className="chart-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{total > 0 ? `${Math.round((values[i]! / total) * 100)}%` : "—"}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barra de progreso (p. ej. stock vs mínimo). */
export function ProgressBar({ value, max, tone = "amber" }: { value: number; max: number; tone?: "amber" | "danger" | "blue" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span className={`chart-progress tone-${tone}`}>
      <span className="chart-progress-fill" style={{ width: `${Math.max(4, pct)}%` }} />
    </span>
  );
}

/** Par de barras comparativas (p. ej. mes actual vs anterior). */
export function ComparisonBars({
  a,
  b,
  format = compact
}: {
  a: { label: string; value: string | number };
  b: { label: string; value: string | number };
  format?: (value: number) => string;
}) {
  const va = numeric(a.value);
  const vb = numeric(b.value);
  const max = Math.max(1, va, vb);
  return (
    <div className="chart chart-compare">
      {[{ ...a, v: va, key: "a" }, { ...b, v: vb, key: "b" }].map((item) => (
        <div className="chart-compare-col" key={item.key}>
          <span className="chart-compare-track">
            <span className={`chart-compare-fill ${item.key === "a" ? "current" : ""}`}
              style={{ height: `${Math.max(6, (item.v / max) * 100)}%` }} />
          </span>
          <b>{format(item.v)}</b>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}
