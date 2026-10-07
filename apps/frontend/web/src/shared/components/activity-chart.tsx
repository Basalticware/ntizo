import { useState } from "react";
import { ChartColumn } from "lucide-react";
import type { ProviderBookingStatsDayDTO } from "@ntizo/shared/read-models";
import {
  CHART,
  barPath,
  chartGeometry,
  chartTicks,
  denseChartTicks,
  seriesTotals,
  tooltipPlacement,
  valueTicks,
} from "@/shared/domain/activity-chart";
import { CAPTION, IconDisc } from "./stat-card";

/**
 * Thirty days of two counts, drawn rather than imported: a charting library
 * would be the largest package in this app for one figure.
 *
 * Two blues, one a tint of the other: requests in the zone's primary,
 * confirmations in `--color-blue-outline`, as the October admin mockup draws
 * them. On the dark card that token is nearly as bright as the primary, so
 * dark mode takes `--color-blue-line` instead — the pair must differ in
 * lightness, not only in hue. The light one sits under the 3:1 floor on
 * white, which is legal only with secondary encoding, so three things here
 * are load-bearing and not decoration: the legend is always drawn, both series carry their total as a
 * direct label, and the two bars of a day keep a fixed order — the dark one
 * first — held apart by a gap of surface. The SVG itself is `aria-hidden`;
 * the table below it is the real content for a screen reader, and the relief
 * the contrast check asks for.
 *
 * The y-axis's last tick is what the top of the plot stands for, so the
 * gridlines and the bars share one scale: a bar that reaches a line is that
 * many bookings.
 *
 * `preserveAspectRatio="none"` is deliberate: the bars are rectangles whose
 * meaning is their height, and letting them stretch horizontally is what keeps
 * thirty days legible at 390px; the rounded shoulders distort by a hair and
 * nothing else does. The gridlines keep a 1px stroke through the stretch with
 * `vector-effect`.
 */

/** The chart's own words, handed in: the provider's namespace and the admin's differ, the figure does not. */
export interface ActivityChartLabels {
  title: string;
  range: string;
  requests: string;
  confirmed: string;
  empty: string;
  /** The accessible table's first column header. */
  day: string;
}

export function ActivityChart({
  days,
  locale,
  labels,
  dayLabel,
}: {
  days: readonly ProviderBookingStatsDayDTO[];
  locale: string;
  labels: ActivityChartLabels;
  /** The tooltip's sentence for one day; `date` is already formatted for the reader. */
  dayLabel: (date: string, day: ProviderBookingStatsDayDTO) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const totals = seriesTotals(days);
  const yTicks = valueTicks(Math.max(0, ...days.flatMap((d) => [d.requests, d.confirmed])));
  const top = yTicks.at(-1)!;
  const { bars, groups } = chartGeometry(days, top);
  const plot = CHART.height - CHART.padTop - CHART.padBottom;
  const yOf = (value: number) => CHART.padTop + plot - (value / top) * plot;
  const empty = totals.requests === 0 && totals.confirmed === 0;
  const formatDay = (d: ProviderBookingStatsDayDTO) =>
    dayLabel(
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(
        new Date(`${d.date}T00:00:00.000Z`),
      ),
      d,
    );
  // Two axes, one shown: a label every other day where fifteen fit, the
  // window's ends and middle where only three do.
  const axes = [
    { key: "dense", ticks: denseChartTicks(days, locale), className: "hidden md:block" },
    { key: "sparse", ticks: chartTicks(days, locale), className: "md:hidden" },
  ];

  return (
    <section
      className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 [--chart-confirmed:var(--color-blue-outline)] dark:[--chart-confirmed:var(--color-blue-line)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          <IconDisc icon={ChartColumn} />
          <div className="min-w-0">
            <h2 className={CAPTION}>{labels.title}</h2>
            <p className="type-caption text-[var(--color-muted-foreground)]">{labels.range}</p>
          </div>
        </div>
        <ul className="flex list-none gap-5 p-0">
          {(
            [
              ["requests", "var(--color-primary)", totals.requests, labels.requests],
              ["confirmed", "var(--chart-confirmed)", totals.confirmed, labels.confirmed],
            ] as const
          ).map(([key, colour, total, label]) => (
            <li key={key} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
              <span className="type-caption text-[var(--color-muted-foreground)]">{label}</span>
              <span className="type-body-medium font-semibold text-[var(--color-headline)] tabular-nums">
                {total}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {empty ? (
        <p className="type-body mt-6 mb-2 text-[var(--color-muted-foreground)]">
          {labels.empty}
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
          {/* The y labels are HTML, so they keep their size when the drawing
              shrinks; each is centred on its gridline's height. */}
          <div aria-hidden="true" className="relative h-[176px] min-w-3">
            {yTicks.map((value) => (
              <span
                key={value}
                className="type-caption absolute right-0 -translate-y-1/2 leading-none text-[var(--color-muted-foreground)] tabular-nums"
                style={{ top: `${(yOf(value) / CHART.height) * 100}%` }}
              >
                {value}
              </span>
            ))}
          </div>

          <div className="relative">
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${CHART.width} ${CHART.height}`}
              preserveAspectRatio="none"
              className="block h-[176px] w-full"
              onMouseLeave={() => setHovered(null)}
            >
              {yTicks.map((value) => (
                <line
                  key={value}
                  x1={0}
                  x2={CHART.width}
                  y1={yOf(value)}
                  y2={yOf(value)}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                  strokeDasharray={value === 0 ? undefined : "4 4"}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {bars.map((bar) => (
                <path
                  key={bar.key}
                  d={barPath(bar.x, bar.y, bar.width, bar.height, CHART.radius)}
                  fill={bar.series === "requests" ? "var(--color-primary)" : "var(--chart-confirmed)"}
                />
              ))}
              {groups.map((group, i) => (
                <rect
                  key={group.day.date}
                  x={group.x}
                  y={0}
                  width={group.width}
                  height={CHART.height}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                />
              ))}
              {hovered !== null && (
                <rect
                  x={groups[hovered]!.x}
                  y={0}
                  width={groups[hovered]!.width}
                  height={CHART.height}
                  fill="color-mix(in srgb, var(--color-foreground) 6%, transparent)"
                />
              )}
            </svg>

            {hovered !== null && (
              <p
                // `max-w-full` and the placement together are what keep the
                // label on the card: the shift is only guaranteed to contain a
                // tooltip no wider than the plot it sits over.
                //
                // `whitespace-nowrap` because an absolutely positioned box is
                // shrink-to-fit: near the last days `left` sits close to 100%,
                // the width left of the edge collapses, and the label folded
                // onto four lines. The containment arithmetic is untouched — it
                // only ever required the label be no wider than the plot.
                className="type-caption pointer-events-none absolute -top-1 max-w-full whitespace-nowrap rounded-[var(--radius-field)] bg-[var(--color-foreground)] px-2 py-1 text-[var(--color-background)]"
                style={tooltipPlacement(groups[hovered]!.x, groups[hovered]!.width)}
              >
                {formatDay(groups[hovered]!.day)}
              </p>
            )}

            {/* Each date under its own day, held inside the plot the way the
                tooltip is: the first and the last lean inwards. */}
            {axes.map((axis) => (
              <div key={axis.key} aria-hidden="true" className={`relative mt-2 h-4 ${axis.className}`}>
                {axis.ticks.map((tick) => (
                  <span
                    key={tick.index}
                    className="type-caption absolute top-0 leading-none whitespace-nowrap text-[var(--color-muted-foreground)]"
                    style={tooltipPlacement(groups[tick.index]!.x, groups[tick.index]!.width)}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* `sr-only` on a wrapper, not the table: a table ignores the 1px
          width, and its full width reached past a phone's edge as scroll. */}
      <div className="sr-only">
        <table>
          <caption>{`${labels.title} — ${labels.range}`}</caption>
          <thead>
            <tr>
              <th scope="col">{labels.day}</th>
              <th scope="col">{labels.requests}</th>
              <th scope="col">{labels.confirmed}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{d.date}</th>
                <td>{d.requests}</td>
                <td>{d.confirmed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
