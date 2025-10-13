import { useEffect, useRef } from 'preact/hooks';
import { Chart, ArcElement, Tooltip } from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';

Chart.register(ArcElement, Tooltip);

type ScoreDonutProps = {
  value: number;
  max?: number;
  label?: string;
  ariaLabel?: string;
  size?: number;
};

/**
 * Minimal doughnut chart wrapper around Chart.js.
 * Intended for score gauges in analysis results.
 */
export default function ScoreDonut({
  value,
  max = 100,
  label = 'Fit score',
  ariaLabel = 'Fit score donut chart',
  size = 180,
}: ScoreDonutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const normalized = Math.max(0, Math.min(value, max));
    const remainder = Math.max(0, max - normalized);

    const data: ChartData<'doughnut'> = {
      labels: [label, 'Remaining'],
      datasets: [
        {
          data: [normalized, remainder],
          backgroundColor: [
            'var(--color-accent, #0f766e)',
            'var(--color-muted, #e5e7eb)',
          ],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };

    const options: ChartOptions<'doughnut'> = {
      cutout: '68%',
      responsive: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
    };

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data,
      options,
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [value, max, label]);

  return (
    <figure
      class="chart chart--donut"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <figcaption class="chart__title">{label}</figcaption>
      <div class="chart__canvas chart__canvas--centered" role="img" aria-label={ariaLabel}>
        <canvas ref={canvasRef} width={size} height={size} />
        <span class="chart__value">
          {Math.round((value / max) * 100)}
          <span class="chart__value-suffix">%</span>
        </span>
      </div>
    </figure>
  );
}
