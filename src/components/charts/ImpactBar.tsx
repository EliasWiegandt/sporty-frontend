import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import * as Plot from '@observablehq/plot';

type Datum = {
  label: string;
  value: number;
};

type ImpactBarProps = {
  data: Datum[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  ariaLabel?: string;
  children?: ComponentChildren;
};

/**
 * Horizontal bar chart scaffold backed by Observable Plot.
 * Renders to SVG for crisp output and removes the plot on unmount.
 */
export default function ImpactBar({
  data,
  title,
  xLabel = 'Contribution',
  yLabel = 'Component',
  ariaLabel = 'Impact breakdown by component',
  children,
}: ImpactBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = Plot.plot({
      marginLeft: 120,
      marginRight: 24,
      width: containerRef.current.clientWidth || 640,
      height: 48 * data.length + 32,
      x: {
        label: xLabel,
        domain: [0, Math.max(...data.map((d) => d.value), 1)],
      },
      y: {
        label: yLabel,
        domain: data.map((d) => d.label).reverse(),
      },
      color: {
        range: ['var(--color-accent, #0f766e)'],
      },
      marks: [
        Plot.ruleX([0], { stroke: '#d4d4d8' }),
        Plot.barX(data, {
          x: 'value',
          y: 'label',
          fill: 'var(--color-accent, #0f766e)',
        }),
        Plot.text(
          data,
          Plot.selectLast({
            x: 'value',
            y: 'label',
            text: (d) => `${Math.round(d.value * 10) / 10}`,
            dx: 6,
            dy: 4,
            fill: '#111827',
            fontSize: 12,
            textAnchor: 'start',
          }),
        ),
      ],
    });

    containerRef.current.innerHTML = '';
    containerRef.current.append(chart);

    return () => {
      chart.remove();
    };
  }, [data, xLabel, yLabel]);

  return (
    <figure class="chart chart--impact">
      {title && <figcaption class="chart__title">{title}</figcaption>}
      <div
        ref={containerRef}
        class="chart__canvas"
        role="img"
        aria-label={ariaLabel}
      />
      {children}
    </figure>
  );
}
