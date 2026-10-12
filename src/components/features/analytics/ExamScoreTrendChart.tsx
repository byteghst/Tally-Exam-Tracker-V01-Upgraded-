import { useState } from 'react';
import { Share2, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/Badge';
import { computeExamTrendPoints } from '@/lib/examTrend';
import { useChartColors } from '@/lib/chartTheme';
import { formatDate } from '@/lib/dates';
import { ShareableExamCard } from './ShareableExamCard';
import type { Exam } from '@/types';

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

export function ExamScoreTrendChart({ exams }: { exams: Exam[] }) {
  const [shareOpen, setShareOpen] = useState(false);
  const points = computeExamTrendPoints(exams);
  const c = useChartColors();

  // Highest and lowest exam (first one if several tie). They get their own
  // marker and label on the line, so the extremes are obvious at a glance.
  let highIndex = -1;
  let lowIndex = -1;
  points.forEach((p, i) => {
    if (highIndex === -1 || p.percentage > points[highIndex].percentage) highIndex = i;
    if (lowIndex === -1 || p.percentage < points[lowIndex].percentage) lowIndex = i;
  });
  const hasSpread = points.length >= 2 && highIndex !== lowIndex;
  const high = hasSpread ? points[highIndex] : null;
  const low = hasSpread ? points[lowIndex] : null;

  function renderDot(props: DotProps) {
    const { cx, cy, index } = props;
    if (cx === undefined || cy === undefined || index === undefined) return <g key={`dot-${index}`} />;

    const isHigh = hasSpread && index === highIndex;
    const isLow = hasSpread && index === lowIndex;

    if (!isHigh && !isLow) {
      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3.5} fill={c.accent} />;
    }

    const color = isHigh ? c.forest : c.rose;
    const value = points[index].percentage;
    // keep the label inside the chart near the left and right edges
    const anchor = index >= points.length * 0.75 ? 'end' : index <= points.length * 0.15 ? 'start' : 'middle';
    return (
      <g key={`dot-${index}`}>
        <circle cx={cx} cy={cy} r={11} fill={color} opacity={0.18} />
        <circle cx={cx} cy={cy} r={6} fill={color} stroke={c.surface} strokeWidth={2} />
        <text
          x={cx}
          y={isHigh ? cy - 16 : cy + 26}
          textAnchor={anchor}
          fontSize={12}
          fontWeight={700}
          fill={color}
        >
          {isHigh ? 'High' : 'Low'} {value}%
        </text>
      </g>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="eyebrow">Exam score trend</p>
        {points.length >= 2 && (
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10"
          >
            <Share2 size={14} />
            Share
          </button>
        )}
      </div>

      {points.length < 2 ? (
        <EmptyState
          title="Not enough data yet"
          description="Add a couple more completed exams with total marks set to see a trend line."
          icon={TrendingUp}
        />
      ) : (
        <>
          {/* Explicit, plain-language axis key — in addition to the chart's
              own axis labels below, since small on-screen axis titles are
              easy to miss. */}
          <p className="mb-2 text-xs text-ink-faint">
            X-axis: exam date (chronological) · Y-axis: score as a percentage
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points} margin={{ top: 26, right: 24, left: 4, bottom: 20 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={c.border} vertical={false} />
              <XAxis
                dataKey="label"
                stroke={c.faint}
                fontSize={12}
                tickLine={false}
                label={{ value: 'Exam date', position: 'insideBottom', offset: -12, fill: c.faint, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 100]}
                stroke={c.faint}
                fontSize={12}
                tickLine={false}
                width={44}
                label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', fill: c.faint, fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Score']}
                labelFormatter={(_: unknown, payload: unknown) => {
                  const items = payload as Array<{ payload?: { name?: string } }> | undefined;
                  return items?.[0]?.payload?.name ?? '';
                }}
                contentStyle={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: c.ink
                }}
              />
              <Line type="monotone" dataKey="percentage" stroke={c.accent} strokeWidth={2.5} dot={renderDot} />
            </LineChart>
          </ResponsiveContainer>

          {high && low && (
            <div className="mt-3 grid grid-cols-2 divide-x divide-border border-t border-border pt-3">
              <Extreme label="Highest" color={c.forest} percentage={high.percentage} name={high.name} date={high.date} />
              <Extreme
                label="Lowest"
                color={c.rose}
                percentage={low.percentage}
                name={low.name}
                date={low.date}
                className="pl-4"
              />
            </div>
          )}
        </>
      )}

      <ShareableExamCard open={shareOpen} onClose={() => setShareOpen(false)} points={points} />
    </GlassCard>
  );
}

function Extreme({
  label,
  color,
  percentage,
  name,
  date,
  className
}: {
  label: string;
  color: string;
  percentage: number;
  name: string;
  date: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-1 font-serif text-4xl leading-none tracking-tight" style={{ color }}>
        {percentage}%
      </p>
      <p className="mt-1 truncate text-xs text-ink-muted">
        {name} · {formatDate(date)}
      </p>
    </div>
  );
}
