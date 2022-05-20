import React, { useRef, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'

import { scaleLinear, scaleBand, area, select, curveCatmullRom } from 'd3'

import { TooltipAnchor } from '@gnomad/ui'

const DEFAULT_MARGIN = { left: 60, right: 40, top: 20, bottom: 60 }
const DEFAULT_ACCESSORS = {
  id: (d) => d.id,
  x: (d) => d.x,
  y: (d) => d.y,
  q1: (d) => d.q1,
  median: (d) => d.median,
  mean: (d) => d.mean,
  q3: (d) => d.q3,
  iqr: (d) => d.iqr,
  min: (d) => d.min,
  max: (d) => d.max,
  color: (d) => d.color,
}

const ViolinPlot = ({
  id,
  data,
  title,
  xLabel,
  yLabel,
  width,
  height,
  margin,
  accessors,
  xScale,
  yScale,
}) => {
  const svg = useRef()

  const _margin = { ...DEFAULT_MARGIN, ...margin }
  const _accessors = { ...DEFAULT_ACCESSORS, ...accessors }

  const innerWidth = width - _margin.left - _margin.right
  const innerHeight = height - _margin.top - _margin.bottom

  const bins = useMemo(() => data?.bins ?? [], [data])
  const max = useMemo(() => Math.max(...bins.map((item) => item.max)), [bins])
  const histograms = useMemo(() => data?.histograms ?? [], [data])

  // Compute plot scales and render
  const xScaleLocal = useMemo(
    () =>
      xScale ||
      scaleBand().domain(histograms.map(_accessors.x)).range([0, innerWidth]).padding(0.25),
    [xScale, histograms, _accessors.x, innerWidth]
  )

  const yScaleLocal = useMemo(
    () => yScale || scaleLinear().domain([0, max]).range([innerHeight, 0]).nice(),
    [yScale, innerHeight, max]
  )

  const maxCount = useMemo(
    () => Math.max(...histograms.flatMap(_accessors.y)),
    [_accessors.y, histograms]
  )

  const binHeightScale = useMemo(
    () => scaleLinear().range([0, xScaleLocal.bandwidth()]).domain([-maxCount, maxCount]),
    [xScaleLocal, maxCount]
  )

  // Function to generate mirrored violin curves over histogram counts
  const linesGenerator = useMemo(
    () =>
      area()
        .x0((bin) => binHeightScale(-bin.count))
        .x1((bin) => binHeightScale(bin.count))
        .y((bin) => yScaleLocal(bin.min))
        // .y1((bin) => yScaleLocal(bin.max))
        .curve(curveCatmullRom),
    [binHeightScale, yScaleLocal]
  )

  const renderTooltip = useCallback(
    ({ d }) => {
      // eslint-disable-next-line prefer-destructuring
      const tooltip = _accessors.tooltip
      if (tooltip != null) {
        if (React.isValidElement(d)) {
          return tooltip(d)
        }
        return <div>{tooltip(d)}</div>
      }
      return null
    },
    [_accessors.tooltip]
  )

  // Guard clause for empty data
  if (!histograms?.length) {
    return (
      <svg id={id} width={width} height={height}>
        <g
          transform={`translate(${_margin.left + innerWidth / 2}, ${
            _margin.top + innerHeight / 2
          })`}
        >
          <text textAnchor="middle" alignmentBaseline="middle" fontSize={16}>
            No data to display
          </text>
        </g>
      </svg>
    )
  }

  return (
    <>
      <svg ref={svg} id={id} width={width} height={height}>
        {/* Title */}
        {title && (
          <g id={`${id}-title`} transform={`translate(${_margin.left}, 40)`}>
            <text textAnchor="start" fontSize={16}>
              {title}
            </text>
          </g>
        )}

        {/* defs  */}
        <defs>
          <clipPath id="clipViolinPlot">
            <rect width={innerWidth} height={innerHeight} fill="none" pointerEvents="all" />
          </clipPath>
        </defs>

        {/* Main plot */}
        <g transform={`translate(${_margin.left}, ${_margin.top})`}>
          {/* x-axis */}
          <g id={`${id}_x-axis`} transform={`translate(0, ${innerHeight})`}>
            <line x2={`${innerWidth}`} stroke="black" />
            {xScaleLocal.domain().map((tick) => (
              <g
                key={tick}
                transform={`translate(${xScaleLocal(tick) + xScaleLocal.bandwidth() / 2}, 0)`}
              >
                <text
                  transform="translate(0, 10)rotate(-45)"
                  y={8}
                  textAnchor="end"
                  alignmentBaseline="middle"
                  fontSize={14}
                >
                  {tick}
                </text>
                <line y2={6} stroke="black" />
              </g>
            ))}
          </g>

          {/* y-axis */}
          <g id={`${id}_y-axis`}>
            <line y2={`${innerHeight}`} stroke="black" />
            {yScaleLocal.ticks().map((tick) => (
              <g key={tick} transform={`translate(0, ${yScaleLocal(tick)})`}>
                <text
                  key={tick}
                  textAnchor="end"
                  alignmentBaseline="middle"
                  fontSize={14}
                  x={-8}
                  y={3}
                >
                  {tick}
                </text>
                <line x2={-3} stroke="black" />
                <line
                  x2={innerWidth}
                  stroke={yScaleLocal(tick) === innerHeight ? 'none' : 'lightgrey'}
                />
              </g>
            ))}
          </g>

          {/* violin plots with box plot tooltip */}
          <g id={`${id}-data`} clipPath="url(#clipViolinPlot)">
            {histograms.map((d) => {
              return (
                <g
                  key={`violin-${_accessors.id(d)}`}
                  transform={`translate(${xScaleLocal(_accessors.id(d))}, 0)`}
                >
                  <path
                    d={linesGenerator(bins.map((b, i) => ({ ...b, count: _accessors.y(d)[i] })))}
                    style={{
                      fill: _accessors.color(d),
                      fillOpacity: 0.5,
                    }}
                  />
                </g>
              )
            })}
            {histograms.map((d) => (
              <g
                key={`box-${_accessors.id(d)}`}
                transform={`translate(${xScaleLocal(_accessors.id(d))}, 0)`}
                onMouseEnter={(e) => {
                  select(e.target.parentNode).selectChildren().attr('stroke-width', 1.5)
                }}
                onMouseLeave={(e) => {
                  select(e.target.parentNode).selectChildren().attr('stroke-width', 1)
                }}
              >
                <line
                  x1={xScaleLocal.bandwidth() / 2}
                  x2={xScaleLocal.bandwidth() / 2}
                  y1={yScaleLocal(_accessors.min(d))}
                  y2={yScaleLocal(_accessors.max(d))}
                  stroke="#333333"
                />
                <TooltipAnchor
                  key={`box-tooltip-${_accessors.id(d)}`}
                  tooltipComponent={renderTooltip}
                  d={d}
                >
                  <rect
                    x={(xScaleLocal.bandwidth() * 7) / 16}
                    y={yScaleLocal(_accessors.q3(d))}
                    height={yScaleLocal(_accessors.q1(d)) - yScaleLocal(_accessors.q3(d))}
                    width={xScaleLocal.bandwidth() / 8}
                    fill="white"
                    stroke="#333333"
                  />
                </TooltipAnchor>
                <line
                  x1={(xScaleLocal.bandwidth() * 7) / 16}
                  x2={(xScaleLocal.bandwidth() * 9) / 16}
                  y1={yScaleLocal(_accessors.median(d))}
                  y2={yScaleLocal(_accessors.median(d))}
                  stroke="#333333"
                />
                <line
                  x1={(xScaleLocal.bandwidth() * 7) / 16}
                  x2={(xScaleLocal.bandwidth() * 9) / 16}
                  y1={yScaleLocal(_accessors.q1(d))}
                  y2={yScaleLocal(_accessors.q1(d))}
                  stroke="#333333"
                />
                <line
                  x1={(xScaleLocal.bandwidth() * 7) / 16}
                  x2={(xScaleLocal.bandwidth() * 9) / 16}
                  y1={yScaleLocal(_accessors.q3(d))}
                  y2={yScaleLocal(_accessors.q3(d))}
                  stroke="#333333"
                />
              </g>
            ))}
          </g>

          {/* x-axis label */}
          <g id={`${id}-x-axis-label`}>
            <text x={innerWidth / 2} y={innerHeight + 80} textAnchor="middle">
              {xLabel}
            </text>
          </g>

          {/* y-axis label */}
          <g
            id={`${id}-y-axis-label`}
            transform={`rotate(-90) translate(-${innerHeight / 2}, -40)`}
          >
            <text textAnchor="middle">{yLabel}</text>
          </g>
        </g>
      </svg>
    </>
  )
}

ViolinPlot.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.shape({
    histograms: PropTypes.arrayOf(PropTypes.object),
    bins: PropTypes.arrayOf(
      PropTypes.shape({
        min: PropTypes.number.isRequired,
        max: PropTypes.number.isRequired,
      })
    ),
  }).isRequired,
  title: PropTypes.string,
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
  accessors: PropTypes.shape({
    id: PropTypes.func,
    x: PropTypes.func,
    y: PropTypes.func,
    q1: PropTypes.func,
    median: PropTypes.func,
    mean: PropTypes.func,
    q3: PropTypes.func,
    iqr: PropTypes.func,
    max: PropTypes.func,
    min: PropTypes.func,
    color: PropTypes.func,
    tooltip: PropTypes.func,
  }),
  xScale: PropTypes.func,
  yScale: PropTypes.func,
}

ViolinPlot.defaultProps = {
  title: null,
  xLabel: null,
  yLabel: null,
  height: 500,
  width: 500,
  margin: { ...DEFAULT_MARGIN },
  accessors: { ...DEFAULT_ACCESSORS },
  xScale: null,
  yScale: null,
}

export default ViolinPlot
