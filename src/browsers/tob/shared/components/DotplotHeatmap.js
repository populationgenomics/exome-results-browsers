import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import { scaleBand, scaleLinear, scaleSequential, interpolateRgb, extent } from 'd3'
import { TooltipAnchor } from '@gnomad/ui'

const tileSpacing = 0.05
const rowHeight = 60

const DEFAULT_MARGINS = { left: 80, right: 220, top: 80, bottom: 80 }
const DEFAULT_ACCESSORS = {
  x: (d) => d.x,
  y: (d) => d.y,
  size: (d) => d.size,
  color: (d) => d.color,
  tooltip: (d) => d.tooltip,
  selected: (d) => d.selected,
}

const DotplotHeatmap = ({
  id,
  data,
  onClick,
  title,
  width,
  margins,
  accessors,
  xScale,
  yScale,
  colorScale,
  sizeScale,
}) => {
  // eslint-disable-next-line no-underscore-dangle
  const _margins = { ...DEFAULT_MARGINS, ...margins }
  // eslint-disable-next-line no-underscore-dangle
  const _accessors = { ...DEFAULT_ACCESSORS, ...accessors }
  const height = useMemo(
    () =>
      [...new Set(data.map((item) => _accessors.y(item)))].length * rowHeight +
      _margins.top +
      _margins.bottom,
    [data]
  )
  const innerHeight = height - _margins.top - _margins.bottom
  const innerWidth = width - _margins.left - _margins.right
  const xScaleLocal = useMemo(
    () =>
      xScale ||
      scaleBand()
        .range([0, innerWidth])
        .domain([...new Set(data.map((item) => _accessors.x(item)))])
        .padding(tileSpacing),
    [xScale, data, _accessors.x]
  )

  const yScaleLocal = useMemo(
    () =>
      yScale ||
      scaleBand()
        .range([innerHeight, 0])
        .domain([...new Set(data.map((item) => _accessors.y(item)))])
        .padding(tileSpacing),
    [yScale, data, _accessors.y]
  )

  const colorScaleLocal = useMemo(
    () =>
      colorScale ||
      scaleSequential()
        .interpolator(interpolateRgb('#FFFFFF', '#CC0000'))
        .domain(extent(data, _accessors.color))
        .range(['#FFFFFF', '#CC0000'])
        .nice(),
    [colorScale, data, _accessors.color]
  )

  const sizeScaleLocal = useMemo(
    () => sizeScale || scaleLinear().domain(extent(data, _accessors.size)).range([0, 20]).nice(),
    [sizeScale, data, _accessors.size, xScaleLocal, yScaleLocal]
  )

  const renderTooltip = ({ item }) => {
    if (_accessors?.tooltip(item)) {
      if (React.isValidElement(_accessors.tooltip(item))) {
        return _accessors.tooltip(item)
      }
      return <div>{_accessors.tooltip(item)}</div>
    }
    return null
  }

  return (
    <>
      {data.length ? (
        <svg id={id} width={width} height={height}>
          {title && (
            <g transform={`translate(${_margins.left}, 40)`}>
              <text style={{ fontWeight: 'bold', fontSize: 12, textAnchor: 'start' }}>{title}</text>
            </g>
          )}
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
            <linearGradient id="linear-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={`${colorScaleLocal.range()[0]}`} />
              <stop offset="100%" stopColor={`${colorScaleLocal.range()[1]}`} />
            </linearGradient>
          </defs>
          <g transform={`translate(${_margins.left}, ${_margins.top})`}>
            <g id="x-axis">
              <line x2={`${innerWidth}`} stroke="black" />
              <line
                y1={`${innerHeight}`}
                y2={`${innerHeight}`}
                x2={`${innerWidth}`}
                stroke="black"
              />
              {xScaleLocal.domain().map((tick) => (
                <g
                  key={tick}
                  transform={`translate(${
                    xScaleLocal(tick) + xScaleLocal.bandwidth() / 2
                  }, ${innerHeight})`}
                >
                  <text
                    transform="translate(0, 10)rotate(-45)"
                    style={{ textAnchor: 'end', alignmentBaseline: 'middle', fontSize: 12 }}
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
              <line
                x1={`${innerWidth}`}
                y2={`${innerHeight}`}
                x2={`${innerWidth}`}
                stroke="black"
              />
              {yScaleLocal.domain().map((tick) => (
                <g
                  key={tick}
                  transform={`translate(0, ${yScaleLocal(tick) + yScaleLocal.bandwidth() / 2})`}
                >
                  <text
                    key={tick}
                    style={{ textAnchor: 'end', alignmentBaseline: 'middle', fontSize: 12 }}
                    x={-6}
                  >
                    {tick}
                  </text>
                  <line x2={-3} stroke="black" />
                  <line x2={`${innerWidth}`} stroke="lightgrey" />
                </g>
              ))}
            </g>
            <g id="tiles">
              {data.map((item, index) => (
                <TooltipAnchor
                  key={`${_accessors?.x(item) - _accessors?.y(item) || index}-tooltip`}
                  tooltipComponent={renderTooltip}
                  item={item}
                >
                  <circle
                    key={`${_accessors.x(item)},${_accessors.y(item)}`}
                    r={sizeScaleLocal(_accessors.size(item))}
                    cx={xScaleLocal(_accessors.x(item)) + xScaleLocal.bandwidth() / 2}
                    cy={yScaleLocal(_accessors.y(item)) + yScaleLocal.bandwidth() / 2}
                    stroke="black"
                    fill={`${colorScaleLocal(_accessors.color(item))}`}
                    onClick={onClick}
                  />
                </TooltipAnchor>
              ))}
            </g>
          </g>
          {data.length > 1 && (
            <g
              id="sizeLegend"
              transform={`translate(${
                width - _margins.right + sizeScaleLocal.range()[1] + 15
              }, 40)`}
            >
              <text fontSize={12} fontWeight="bold">
                Max -log
                <tspan dy="+1ex">
                  <tspan style={{ fontSize: 'smaller' }}>10</tspan>
                </tspan>
                <tspan dy="-1ex">(p)</tspan>
              </text>
              {sizeScaleLocal.ticks(3).map((tick, i) => (
                <g
                  key={`sizeScaleLocal ${tick}`}
                  transform={`translate(0, ${
                    _margins.top - 40 + sizeScaleLocal.range()[1] * 2 * i
                  })`}
                >
                  <circle r={sizeScaleLocal(tick)} stroke="black" fill="none" />
                  <text
                    x={sizeScaleLocal.range()[1] + 5}
                    style={{ alignmentBaseline: 'middle', fontSize: 10 }}
                  >
                    {tick.toFixed(1)}
                  </text>
                </g>
              ))}
            </g>
          )}
          {data.length > 1 && (
            <g
              id="colourLegend"
              transform={`translate(${
                width - _margins.right + sizeScaleLocal.range()[1] + 100
              }, 40)`}
            >
              <text fontSize={12} fontWeight="bold">
                Mean logCPM
              </text>
              <text y="1.5em" fontSize={12} fontWeight="bold">
                expression
              </text>
              <rect
                transform={`translate(0, ${_margins.top - 40})`}
                height={innerHeight}
                width="40"
                fill="url(#linear-gradient)"
                stroke="black"
              />
              <g
                key={`colorScaleLocal ${colorScaleLocal.domain()[1]}`}
                transform={`translate(40, ${_margins.top - 40})`}
              >
                <line x2={5} stroke="black" />
                <text dx={7} style={{ alignmentBaseline: 'middle' }}>
                  {colorScaleLocal.domain()[1].toFixed(1)}
                </text>
              </g>
              <g
                key={`colorScaleLocal ${colorScaleLocal.domain()[0]}`}
                transform={`translate(40, ${_margins.top - 40 + innerHeight})`}
              >
                <line x2={5} stroke="black" />
                <text dx={7} style={{ alignmentBaseline: 'middle' }}>
                  {colorScaleLocal.domain()[0].toFixed(1)}
                </text>
              </g>
            </g>
          )}
        </svg>
      ) : (
        <svg id={id} width={width} height={height}>
          <g
            transform={`translate(${_margins.left + innerWidth / 2}, ${
              _margins.top + innerHeight / 2
            })`}
          >
            <text style={{ textAnchor: 'middle', alignmentBaseline: 'middle', fontSize: 'larger' }}>
              No data to display.
            </text>
          </g>
        </svg>
      )}
    </>
  )
}

DotplotHeatmap.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClick: PropTypes.func,
  title: PropTypes.string,
  width: PropTypes.number,
  margins: PropTypes.shape({
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
    tooltip: PropTypes.func,
    selected: PropTypes.func,
  }),
  xScale: PropTypes.func,
  yScale: PropTypes.func,
  sizeScale: PropTypes.func,
  colorScale: PropTypes.func,
}

DotplotHeatmap.defaultProps = {
  onClick: () => {},
  title: 'Heatmap',
  width: 1000,
  margins: { left: 80, right: 220, top: 80, bottom: 80 },
  accessors: {
    x: (d) => d.x,
    y: (d) => d.y,
    size: (d) => d.size,
    color: (d) => d.color,
    tooltip: (d) => d.tooltip,
    selected: (d) => d.selected,
  },
  xScale: null,
  yScale: null,
  sizeScale: null,
  colorScale: null,
}

export default DotplotHeatmap
