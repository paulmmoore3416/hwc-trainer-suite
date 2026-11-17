import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Table2 } from 'lucide-react';
import { downloadCsv } from '../lib/csv';
import { fmtNum } from '../lib/format';
import { cx } from './ui';
import { useColorMode } from '../lib/theme';

/** Validated categorical palette (fixed order — never cycled) and reserved status colours. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
/** Same eight hues stepped for the dark surface (validated reference palette). */
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
const toDark = (c: string) => {
  const i = SERIES.indexOf(c);
  return i >= 0 ? SERIES_DARK[i] : c;
};
function useChartColors() {
  const { isDark } = useColorMode();
  return {
    axis: { fontSize: 11, fill: isDark ? '#a8b0bd' : '#52514e' },
    grid: isDark ? '#243049' : '#e8e8e4',
    legend: isDark ? '#a8b0bd' : '#52514e',
    color: (c: string) => (isDark ? toDark(c) : c),
    surface: isDark ? '#111a2e' : '#ffffff',
  };
}
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b', neutral: '#a3a8b3' };


export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

function TooltipBox({ active, payload, label, labelFormatter }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">{labelFormatter ? labelFormatter(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-slate-900">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Card wrapper with CSV export and an accessible table view for every chart. */
export function ChartCard({
  title,
  subtitle,
  rows: rowsIn,
  columns,
  filename,
  children,
  className,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  rows: object[];
  columns: { key: string; label: string }[];
  filename: string;
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  const [table, setTable] = useState(false);
  const rows = rowsIn as Record<string, unknown>[];
  const empty = !rows.length || rows.every((r) => columns.slice(1).every((c) => !Number(r[c.key])));
  return (
    <section className={cx('card flex flex-col', className)}>
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="no-print flex gap-1">
          <button className={cx('rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700', table && 'bg-slate-100 text-slate-700')} onClick={() => setTable((t) => !t)} title="Table view" aria-label="Toggle table view">
            <Table2 className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => downloadCsv(filename, rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, r[c.key]]))))}
            title="Download CSV"
            aria-label="Download CSV"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 px-3 pt-3 pb-4">
        {empty ? (
          <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
            No data for this period yet
          </div>
        ) : table ? (
          <div className="overflow-auto px-2" style={{ maxHeight: height + 40 }}>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="border-b border-slate-200 py-1.5 pr-3 text-left font-semibold text-slate-600">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {columns.map((c, j) => (
                      <td key={c.key} className={cx('py-1.5 pr-3 text-slate-700', j > 0 && 'tabular-nums')}>
                        {j === 0 ? String(r[c.key] ?? '—') : fmtNum(r[c.key] as number)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
    </section>
  );
}

export function TrendLines({ data, x, series, xFormatter }: { data: object[]; x: string; series: SeriesDef[]; xFormatter?: (v: string) => string }) {
  const { axis: AXIS, grid: GRID, legend, color, surface } = useChartColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={xFormatter} minTickGap={12} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip content={<TooltipBox labelFormatter={xFormatter} />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: legend }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color(s.color ?? SERIES[i])} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: color(s.color ?? SERIES[i]) }} activeDot={{ r: 5, stroke: surface, strokeWidth: 2 }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Bars({
  data,
  x,
  series,
  horizontal,
  stacked,
  xFormatter,
}: {
  data: object[];
  x: string;
  series: SeriesDef[];
  horizontal?: boolean;
  stacked?: boolean;
  xFormatter?: (v: string) => string;
}) {
  const radius: [number, number, number, number] = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  const { axis: AXIS, grid: GRID, legend, color, surface } = useChartColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, left: horizontal ? 8 : -8, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid stroke={GRID} horizontal={!horizontal} vertical={!!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey={x} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} width={150} interval={0} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={xFormatter} minTickGap={8} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          </>
        )}
        <Tooltip content={<TooltipBox labelFormatter={xFormatter} />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: legend }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={color(s.color ?? SERIES[i])}
            stackId={stacked ? 'a' : undefined}
            radius={stacked ? (i === series.length - 1 ? radius : [0, 0, 0, 0]) : radius}
            stroke={surface}
            strokeWidth={stacked ? 1 : 0}
            maxBarSize={36}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal meter — used for single proportions such as compliance %. */
export function Meter({ value, label, tone }: { value: number | null; label: string; tone: 'good' | 'warning' | 'critical' }) {
  const color = STATUS[tone];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{value == null ? '—' : `${value}%`}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value ?? 0)}%`, background: color }} />
      </div>
    </div>
  );
}
