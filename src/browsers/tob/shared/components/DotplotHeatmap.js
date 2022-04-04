import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import { scaleBand, scaleSqrt, scaleSequential, interpolateRgb, extent } from 'd3'

const tileSpacing = 0.05

const DotplotHeatmap = ({
  id,
  data,
  onClick,
  options: { title, width, height, margin, accessors, xScale, yScale, colorScale, sizeScale },
}) => {
  const innerHeight = height - margin.top - margin.bottom
  const innerWidth = width - margin.left - margin.right
  const xScaleLocal = useMemo(
    () =>
      xScale ||
      scaleBand()
        .range([0, innerWidth])
        .domain([...new Set(data.map((item) => accessors.x(item)))])
        .padding(tileSpacing),
    [xScale, data]
  )

  const yScaleLocal = useMemo(
    () =>
      yScale ||
      scaleBand()
        .range([innerHeight, 0])
        .domain([...new Set(data.map((item) => accessors.y(item)))])
        .padding(tileSpacing),
    [yScale, data]
  )

  const colorScaleLocal = useMemo(
    () =>
      colorScale ||
      scaleSequential()
        .interpolator(interpolateRgb('#FFFFFF', '#CC0000'))
        .domain(extent(data, accessors.color))
        .range(['#FFFFFF', '#CC0000'])
        .nice()
  )

  const sizeScaleLocal = useMemo(
    () =>
      sizeScale ||
      scaleSqrt()
        .domain(extent(data, accessors.size).reverse())
        .range([0, Math.min(xScaleLocal.bandwidth() / 2, yScaleLocal.bandwidth() / 2)])
        .nice()
  )

  return (
    <>
      <svg id={id} width={width} height={height}>
        <g transform={`translate(${margin.left}, 40)`}>
          <text> {title} </text>
        </g>
        <defs>
          <pattern
            id="missing-pattern"
            width={4} // hatchsize as a prop?
            height={4} // hatchsize
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width={2} height={4} fill="black" opacity={0.4} />
          </pattern>
          <linearGradient id="linear-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`${colorScaleLocal.range()[0]}`} />
            <stop offset="100%" stopColor={`${colorScaleLocal.range()[1]}`} />
          </linearGradient>
        </defs>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <g id="x-axis">
            <line x2={`${innerWidth}`} stroke="black" />
            <line y1={`${innerHeight}`} y2={`${innerHeight}`} x2={`${innerWidth}`} stroke="black" />
            {xScaleLocal.domain().map((tick) => (
              <g
                key={tick}
                transform={`translate(${
                  xScaleLocal(tick) + xScaleLocal.bandwidth() / 2
                }, ${innerHeight})`}
              >
                <text
                  transform="translate(0, 10)rotate(-90)"
                  style={{ textAnchor: 'end', alignmentBaseline: 'middle' }}
                >
                  {tick}
                </text>
                <line y2={6} stroke="black" />
                <line y2={`-${innerHeight}`} stroke="lightgrey" />
              </g>
            ))}
          </g>
          <g id="y-axis">
            <line y2={`${innerHeight}`} stroke="black" />
            <line x1={`${innerWidth}`} y2={`${innerHeight}`} x2={`${innerWidth}`} stroke="black" />
            {yScaleLocal.domain().map((tick) => (
              <g
                key={tick}
                transform={`translate(0, ${yScaleLocal(tick) + yScaleLocal.bandwidth() / 2})`}
              >
                <text key={tick} style={{ textAnchor: 'end', alignmentBaseline: 'middle' }} x={-6}>
                  {tick}
                </text>
                <line x2={-3} stroke="black" />
                <line x2={`${innerWidth}`} stroke="lightgrey" />
              </g>
            ))}
          </g>
          <g id="tiles">
            {data.length ? (
              data.map((item) => (
                <circle
                  key={`${accessors.x(item)},${accessors.y(item)}`}
                  r={sizeScaleLocal(accessors.size(item))}
                  cx={xScaleLocal(accessors.x(item)) + xScaleLocal.bandwidth() / 2}
                  cy={yScaleLocal(accessors.y(item)) + yScaleLocal.bandwidth() / 2}
                  stroke="black"
                  fill={`${colorScaleLocal(accessors.color(item))}`}
                  onClick={onClick}
                />
              ))
            ) : (
              <g transform={`translate(${innerWidth / 2}, ${innerHeight / 2})`}>
                <text
                  style={{ textAnchor: 'middle', alignmentBaseline: 'middle', fontSize: 'larger' }}
                >
                  No data to display.
                </text>
              </g>
            )}
          </g>
          {data.length && (
            <g
              id="sizeLegend"
              transform={`translate(${
                width - margin.right - margin.left + sizeScaleLocal.range()[1] + 5
              }, 20)`}
            >
              <text fontWeight="bold"> P value </text> <br />
              {sizeScaleLocal
                .ticks(6)
                .filter((size) => size < 1)
                .map((tick, i) => (
                  <g
                    key={`sizeScaleLocal ${tick}`}
                    transform={`translate(0, ${40 + sizeScaleLocal.range()[1] * 2 * i})`}
                  >
                    <circle r={sizeScaleLocal(tick)} stroke="black" fill="none" />
                    <text x={sizeScaleLocal.range()[1] + 5} style={{ alignmentBaseline: 'middle' }}>
                      {tick.toFixed(1)}
                    </text>
                  </g>
                ))}
            </g>
          )}
          {data.length && (
            <g
              id="colourLegend"
              transform={`translate(${
                width - margin.right - margin.left + sizeScaleLocal.range()[1] + 100
              }, 20)`}
            >
              <text fontWeight="bold"> Expression </text> <br />
              <rect
                transform="translate(0, 15)"
                height="240"
                width="40"
                fill="url(#linear-gradient)"
                stroke="black"
              />
              {colorScaleLocal.ticks(6).map((tick, i) => (
                <g
                  key={`colorScaleLocal ${tick}`}
                  transform={`translate(40, ${15 + (i * 240) / 5})`}
                >
                  <line x2={5} stroke="black" />
                  <text dx={7} style={{ alignmentBaseline: 'middle' }}>
                    {tick.toFixed(1)}
                  </text>
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>
    </>
  )
}

DotplotHeatmap.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClick: PropTypes.func,
  options: PropTypes.shape({
    title: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
    margin: PropTypes.shape({
      top: PropTypes.number,
      right: PropTypes.number,
      bottom: PropTypes.number,
      left: PropTypes.number,
    }),
    accessors: PropTypes.shape({
      x: PropTypes.func,
      y: PropTypes.func,
      size: PropTypes.func,
      color: PropTypes.func,
    }),
    toolip: PropTypes.func,
    selected: PropTypes.func,
    xScale: PropTypes.func,
    yScale: PropTypes.func,
    sizeScale: PropTypes.func,
    colorScale: PropTypes.func,
  }),
}

DotplotHeatmap.defaultProps = {
  onClick: () => {},
  options: {
    title: 'Heatmap',
    width: 1000,
    height: 500,
    margin: { top: 50, right: 50, left: 50, bottom: 50 },
    accessors: {
      x: (d) => d.x,
      y: (d) => d.y,
      size: (d) => d.size,
      color: (d) => d.color,
    },
    tooltip: (d) => d.tooltip,
    selected: (d) => d.selected,
  },
}

export default DotplotHeatmap
