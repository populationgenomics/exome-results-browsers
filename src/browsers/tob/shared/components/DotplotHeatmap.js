import React from 'react'
import PropTypes from 'prop-types'

const DotplotHeatmap = ({
  id,
  data,
  onClickFunction,
  options: {
    title,
    width,
    height,
    innerHeight,
    innerWidth,
    margin,
    accessors,
    xScale,
    yScale,
    colorScale,
    sizeScale,
  },
}) => {
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
            <stop offset="0%" stopColor={`${colorScale.range()[0]}`} />
            <stop offset="100%" stopColor={`${colorScale.range()[1]}`} />
          </linearGradient>
        </defs>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <g id="x-axis">
            <line x2={`${innerWidth}`} stroke="black" />
            <line y1={`${innerHeight}`} y2={`${innerHeight}`} x2={`${innerWidth}`} stroke="black" />
            {xScale.domain().map((tick) => (
              <g
                key={tick}
                transform={`translate(${xScale(tick) + xScale.bandwidth() / 2}, ${innerHeight})`}
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
            {yScale.domain().map((tick) => (
              <g key={tick} transform={`translate(0, ${yScale(tick) + yScale.bandwidth() / 2})`}>
                <text key={tick} style={{ textAnchor: 'end', alignmentBaseline: 'middle' }} x={-6}>
                  {tick}
                </text>
                <line x2={-3} stroke="black" />
                <line x2={`${innerWidth}`} stroke="lightgrey" />
              </g>
            ))}
          </g>
          <g id="tiles">
            {data.map((item) => (
              <circle
                key={`${accessors.x(item)},${accessors.y(item)}`}
                r={sizeScale(accessors.size(item))}
                cx={xScale(accessors.x(item)) + xScale.bandwidth() / 2}
                cy={yScale(accessors.y(item)) + yScale.bandwidth() / 2}
                stroke="black"
                fill={`${colorScale(accessors.color(item))}`}
                onClick={onClickFunction}
              />
            ))}
          </g>
          <g
            id="sizeLegend"
            transform={`translate(${
              width - margin.right - margin.left + sizeScale.range()[1] + 5
            }, 20)`}
          >
            <text fontWeight="bold"> P value </text> <br />
            {sizeScale
              .ticks(6)
              .filter((size) => size < 1)
              .map((tick, i) => (
                <g
                  key={`sizeScale ${tick}`}
                  transform={`translate(0, ${40 + sizeScale.range()[1] * 2 * i})`}
                >
                  <circle r={sizeScale(tick)} stroke="black" fill="none" />
                  <text x={sizeScale.range()[1] + 5} style={{ alignmentBaseline: 'middle' }}>
                    {tick.toFixed(1)}
                  </text>
                </g>
              ))}
          </g>
          <g
            id="colourLegend"
            transform={`translate(${
              width - margin.right - margin.left + sizeScale.range()[1] + 100
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
            {colorScale.ticks(6).map((tick, i) => (
              <g key={`colorScale ${tick}`} transform={`translate(40, ${15 + (i * 240) / 5})`}>
                <line x2={5} stroke="black" />
                <text dx={7} style={{ alignmentBaseline: 'middle' }}>
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </>
  )
}

DotplotHeatmap.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClickFunction: PropTypes.func,
  options: PropTypes.shape({
    title: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
    innerHeight: PropTypes.number,
    innerWidth: PropTypes.number,
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
  onClickFunction: () => {},
  options: {
    title: 'Heatmap',
    width: 1000,
    height: 500,
    margin: { top: 50, right: 50, left: 50, bottom: 50 },
    innerWidth: 900,
    innerHeight: 400,
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
