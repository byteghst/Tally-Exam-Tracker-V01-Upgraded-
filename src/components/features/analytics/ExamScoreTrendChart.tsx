import { useState } from 'react';
import { Share2, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/Badge';
import { computeExamTrendPoints } from '@/lib/examTrend';
import { useChartColors } from '@/lib/chartTheme';
import { ShareableExamCard } from './ShareableExamCard';
import type { Exam } from '@/types';

export function ExamScoreTrendChart({ exams }: { exams: Exam[] }) {
  const [shareOpen, setShareOpen] = useState(false);
  const points = computeExamTrendPoints(exams);
  const c = useChartColors();

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
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={points} margin={{ top: 5, right: 10, left: 4, bottom: 20 }}>
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
              <Line
                type="monotone"
                dataKey="percentage"
                stroke={c.accent}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: c.accent, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      <ShareableExamCard open={shareOpen} onClose={() => setShareOpen(false)} points={points} />
    </GlassCard>
  );
}
