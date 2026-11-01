import { useState, type ReactNode } from 'react'
import { formatShort } from '../lib/dates'
import { useWidth } from '../lib/hooks'
import { AVERAGE_DAYS, type Analytics } from '../lib/stats'

const PLOT_HEIGHT = 150
const AXIS_BAND = 24
const LEFT = 26
const RIGHT = 22
const TOP = 12

// Whole-number ticks only: a task count is never fractional.
function ticks(max: number): number[] {
  const top = Math.max(max, 1)
  const step = top <= 4 ? 1 : Math.ceil(top / 4)
  const values: number[] = []
  for (let v = 0; v < top + step; v += step) values.push(v)
  return values
}

function ChartTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="chart-table">
      <summary>View as table</summary>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const flip = x > width / 2
  return (
    <div className="tooltip" style={flip ? { right: width - x + 10 } : { left: x + 10 }}>
      {children}
    </div>
  )
}

function Axis({ width, y, values }: { width: number; y: (v: number) => number; values: number[] }) {
  return (
    <>
      {values.map((value) => (
        <g key={value}>
          <line className="grid" x1={LEFT} x2={width - RIGHT} y1={y(value)} y2={y(value)} />
          <text className="tick" x={LEFT - 8} y={y(value) + 4} textAnchor="end">
            {value}
          </text>
        </g>
      ))}
    </>
  )
}

export function CategoryBars({ data }: { data: Analytics['byLabel'] }) {
  const max = Math.max(...data.map((row) => row.count), 1)
  return (
    <section className="chart" aria-labelledby="chart-category">
      <h3 id="chart-category">Accomplished by category</h3>
      <ul className="bars">
        {data.map((row) => (
          <li key={row.label.key}>
            <span className="bar-name">{row.label.name}</span>
            <span className="bar-track">
              <span
                className={`bar series-${row.label.series}`}
                style={{ width: row.count ? `${Math.max((row.count / max) * 100, 2)}%` : 0 }}
              />
              <span className="bar-value">{row.count}</span>
            </span>
          </li>
        ))}
      </ul>
      <ChartTable
        headers={['Category', 'Accomplished']}
        rows={data.map((row) => [row.label.name, row.count])}
      />
    </section>
  )
}

export function TrendLine({ data }: { data: Analytics['trend'] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  // Over longer ranges raw daily counts are too jagged to read as a trend, so they
  // recede to thin columns and the line carries a 7-day average.
  const smooth = data.length > AVERAGE_DAYS
  const value = (point: Analytics['trend'][number]) => (smooth ? point.average : point.count)
  const format = (v: number) => (smooth ? v.toFixed(1) : String(v))

  const axis = ticks(Math.max(...data.map((point) => point.count)))
  const top = axis[axis.length - 1]
  const x = (i: number) => LEFT + (i / Math.max(data.length - 1, 1)) * (width - LEFT - RIGHT)
  const y = (v: number) => TOP + PLOT_HEIGHT - (v / top) * PLOT_HEIGHT
  const path = data.map((point, i) => `${i ? 'L' : 'M'}${x(i)},${y(value(point))}`).join('')
  const baseline = TOP + PLOT_HEIGHT
  const last = data.length - 1
  const columnWidth = Math.max(1, Math.min(6, (width - LEFT - RIGHT) / data.length - 2))

  const pick = (clientX: number, box: DOMRect) => {
    const ratio = (clientX - box.left - LEFT) / (width - LEFT - RIGHT)
    setActive(Math.min(last, Math.max(0, Math.round(ratio * last))))
  }

  return (
    <section className="chart" aria-labelledby="chart-trend">
      <h3 id="chart-trend">Accomplished per day</h3>
      {smooth && (
        <ul className="legend">
          <li>
            <span className="swatch daily-swatch" aria-hidden="true" />
            Daily count
          </li>
          <li>
            <span className="line-key trend-key" aria-hidden="true" />
            {AVERAGE_DAYS}-day average
          </li>
        </ul>
      )}
      <div className="plot" ref={ref}>
        {width > 0 && (
          <svg
            width={width}
            height={baseline + AXIS_BAND}
            role="img"
            tabIndex={0}
            aria-label={`Trend line of tasks accomplished per day from ${formatShort(data[0].date)} to ${formatShort(data[last].date)}. Use the arrow keys to read each day.`}
            onPointerMove={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
            onPointerDown={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? last) - 1))
              if (event.key === 'ArrowRight') setActive((i) => Math.min(last, (i ?? -1) + 1))
            }}
          >
            <Axis width={width} y={y} values={axis} />
            {smooth &&
              data.map((point, i) =>
                point.count > 0 ? (
                  <rect
                    key={point.date}
                    className="daily-column"
                    x={x(i) - columnWidth / 2}
                    y={y(point.count)}
                    width={columnWidth}
                    height={baseline - y(point.count)}
                  />
                ) : null,
              )}
            {!smooth && <path className="trend-area" d={`${path}L${x(last)},${baseline}L${x(0)},${baseline}Z`} />}
            <path className="trend-line" d={path} pathLength={1} />
            <circle className="trend-dot" cx={x(last)} cy={y(value(data[last]))} r={4} />
            <text className="end-label" x={x(last) + 8} y={y(value(data[last])) + 4}>
              {format(value(data[last]))}
            </text>
            <text className="tick" x={LEFT} y={baseline + 18}>
              {formatShort(data[0].date)}
            </text>
            <text className="tick" x={width - RIGHT} y={baseline + 18} textAnchor="end">
              {formatShort(data[last].date)}
            </text>
            {active !== null && (
              <>
                <line className="crosshair" x1={x(active)} x2={x(active)} y1={TOP} y2={baseline} />
                <circle className="trend-dot" cx={x(active)} cy={y(value(data[active]))} r={4} />
              </>
            )}
          </svg>
        )}
        {active !== null && width > 0 && (
          <Tooltip x={x(active)} width={width}>
            <span className="tooltip-sub">{formatShort(data[active].date)}</span>
            <span>
              <strong>{data[active].count}</strong> accomplished
            </span>
            {smooth && (
              <span>
                <strong>{data[active].average.toFixed(1)}</strong> {AVERAGE_DAYS}-day average
              </span>
            )}
          </Tooltip>
        )}
      </div>
      <ChartTable
        headers={['Date', 'Accomplished', `${AVERAGE_DAYS}-day average`]}
        rows={data.map((point) => [formatShort(point.date), point.count, point.average.toFixed(1)])}
      />
    </section>
  )
}

export function WeeklyStack({ data, series }: { data: Analytics['weekly']; series: Analytics['series'] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const axis = ticks(Math.max(...data.map((week) => week.total)))
  const top = axis[axis.length - 1]
  const baseline = TOP + PLOT_HEIGHT
  const band = (width - LEFT - RIGHT) / data.length
  const barWidth = Math.min(24, Math.max(band - 4, 4))
  const y = (v: number) => baseline - (v / top) * PLOT_HEIGHT
  const center = (i: number) => LEFT + band * (i + 0.5)
  const everyNth = Math.ceil(data.length / 4)

  return (
    <section className="chart" aria-labelledby="chart-weekly">
      <h3 id="chart-weekly">Category mix by week</h3>
      <ul className="legend">
        {series.map((label) => (
          <li key={label.key}>
            <span className={`swatch series-${label.series}`} aria-hidden="true" />
            {label.name}
          </li>
        ))}
      </ul>
      <div className="plot" ref={ref}>
        {width > 0 && (
          <svg width={width} height={baseline + AXIS_BAND} role="group" aria-label="Tasks accomplished per week, stacked by category">
            <Axis width={width} y={y} values={axis} />
            {data.map((week, i) => {
              let running = 0
              const parts = series.filter((label) => week.counts[label.series] > 0)
              const summary = parts.map((label) => `${label.name} ${week.counts[label.series]}`).join(', ')
              return (
                <g
                  key={week.week}
                  tabIndex={0}
                  role="img"
                  aria-label={`Week of ${formatShort(week.week)}: ${week.total} accomplished${summary ? `. ${summary}` : ''}`}
                  className={active === i ? 'column is-active' : 'column'}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <rect className="hit" x={LEFT + band * i} y={TOP} width={band} height={PLOT_HEIGHT} />
                  {parts.map((label, p) => {
                    const start = running
                    running += week.counts[label.series]
                    const gap = p < parts.length - 1 ? 2 : 0
                    const h = Math.max(((running - start) / top) * PLOT_HEIGHT - gap, 1)
                    const left = center(i) - barWidth / 2
                    const yTop = y(running) + gap
                    const isTop = p === parts.length - 1
                    const r = Math.min(4, h, barWidth / 2)
                    const d = isTop
                      ? `M${left},${yTop + h}V${yTop + r}Q${left},${yTop} ${left + r},${yTop}H${left + barWidth - r}Q${left + barWidth},${yTop} ${left + barWidth},${yTop + r}V${yTop + h}Z`
                      : `M${left},${yTop}h${barWidth}v${h}h${-barWidth}Z`
                    return <path key={label.key} className={`fill-${label.series}`} d={d} />
                  })}
                  {i % everyNth === 0 && (
                    <text className="tick" x={center(i)} y={baseline + 18} textAnchor="middle">
                      {formatShort(week.week)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
        {active !== null && width > 0 && (
          <Tooltip x={center(active)} width={width}>
            <span className="tooltip-sub">Week of {formatShort(data[active].week)}</span>
            <span>
              <strong>{data[active].total}</strong> accomplished
            </span>
            {series
              .filter((label) => data[active].counts[label.series] > 0)
              .map((label) => (
                <span className="tooltip-row" key={label.key}>
                  <span className={`line-key series-${label.series}`} aria-hidden="true" />
                  <strong>{data[active].counts[label.series]}</strong> {label.name}
                </span>
              ))}
          </Tooltip>
        )}
      </div>
      <ChartTable
        headers={['Week of', ...series.map((label) => label.name), 'Total']}
        rows={data.map((week) => [
          formatShort(week.week),
          ...series.map((label) => week.counts[label.series]),
          week.total,
        ])}
      />
    </section>
  )
}
