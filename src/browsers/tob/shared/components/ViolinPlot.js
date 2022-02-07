import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  scaleLinear,
  extent,
  scaleBand,
  bin,
  area,
  curveCatmullRom,
  ascending,
  quantile,
  max,
  pointer,
} from 'd3'

const CELL_COLOURS = {
  bin: '#332288',
  bmem: '#6699cc',
  cd4et: '#88ccee',
  cd4nc: '#44aa99',
  cd4sox4: '#117733',
  cd8nc: '#999933',
  cd8et: '#ddcc77',
  cd8s100b: '#661100',
  plasma: '#cc6677',
  dc: '#aa4466',
  nk: '#882255',
  nkr: '#aa4499',
  monoc: '#1e1e1e',
  mononc: '#cc0000',
}

const ViolinPlot = ({ width, data, height, margin }) => {
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const padding = 0.05
  const numBins = 30
  const [hoveredData, setHoveredData] = useState(null)

  const cellLines = Object.keys(data)

  const boxplotStats = Object.values(data).map((item) => {
    const q1 = quantile(item.sort(ascending), 0.25)
    const median = quantile(item.sort(ascending), 0.5)
    const q3 = quantile(item.sort(ascending), 0.75)
    const interQuantileRange = q3 - q1
    const minimum = q1 - 1.5 * interQuantileRange
    const maximum = q3 + 1.5 * interQuantileRange
    return {
      q1,
      median,
      q3,
      interQuantileRange,
      minimum,
      maximum,
    }
  })

  const globalMax = Math.max(...boxplotStats.map((item) => item.maximum))
  const globalMin = Math.min(...boxplotStats.map((item) => item.minimum))

  const dataExtent = extent(Object.values(data).flat())

  const yScale = scaleLinear()
    .domain([Math.min(dataExtent[0], globalMin), Math.max(dataExtent[1], globalMax)])
    .range([innerHeight, 0])
    .nice()

  const xScale = scaleBand().range([0, innerWidth]).domain(cellLines).padding(padding)

  const histogram = bin()
    .domain(yScale.domain())
    .thresholds(yScale.ticks(numBins))
    .value((d) => d)

  const sumstat = Object.values(data).map((value) => histogram(value))

  const maxNum = max(sumstat.map((i) => max(i.map((j) => j.length))))

  const xNum = scaleLinear().range([0, xScale.bandwidth()]).domain([-maxNum, maxNum])

  const linesGenerator = area()
    .x0((d) => xNum(-d.length))
    .x1((d) => xNum(d.length))
    .y((d) => yScale(d.x0))
    .curve(curveCatmullRom)

  return (
    <>
      <svg width={width} height={height}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <g transform={`translate(0, ${innerHeight})`}>
            <line x2={`${innerWidth}`} stroke="black" />
            {xScale.domain().map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick) + xScale.bandwidth() / 2}, 0)`}>
                <text style={{ textAnchor: 'middle' }} dy=".71em" y={9}>
                  {tick}
                </text>
                <line y2={6} stroke="black" />
              </g>
            ))}
          </g>
          <line y2={`${innerHeight}`} stroke="black" />
          {yScale.ticks().map((tick) => (
            <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
              <text key={tick} style={{ textAnchor: 'end' }} x={-6} dy=".32em">
                {tick}
              </text>
              <line x2={-3} stroke="black" />
              <line x2={innerWidth} stroke={yScale(tick) === innerHeight ? 'none' : 'lightgrey'} />
            </g>
          ))}
          {sumstat.map((item, i) => (
            <g key={`SumStat${cellLines[i]}`} transform={`translate(${xScale(cellLines[i])}, 0)`}>
              <path
                d={linesGenerator(item)}
                style={{
                  // stroke: CELL_COLOURS[cellLines[i]],
                  fill: CELL_COLOURS[cellLines[i]],
                  fillOpacity: 0.5,
                }}
              />
            </g>
          ))}
          {boxplotStats.map((item, i) => (
            <g key={`BoxStat${cellLines[i]}`} transform={`translate(${xScale(cellLines[i])}, 0)`}>
              <line
                x1={xScale.bandwidth() / 2}
                x2={xScale.bandwidth() / 2}
                y1={yScale(item.minimum)}
                y2={yScale(item.maximum)}
                stroke="black"
              />
              <rect
                x={(xScale.bandwidth() * 7) / 16}
                y={yScale(item.q3)}
                height={yScale(item.q1) - yScale(item.q3)}
                width={xScale.bandwidth() / 8}
                style={{ stroke: 'black', fill: 'white' }}
              />
              <line
                x1={(xScale.bandwidth() * 7) / 16}
                x2={(xScale.bandwidth() * 9) / 16}
                y1={yScale(item.median)}
                y2={yScale(item.median)}
                stroke="black"
                onMouseOver={(e) => {
                  setHoveredData({
                    value: item.median.toFixed(3),
                    x: xScale(cellLines[i]) + margin.left,
                    y: pointer(e)[1],
                  })
                }}
                onMouseLeave={() => setHoveredData(null)}
              />
              <line
                x1={(xScale.bandwidth() * 7) / 16}
                x2={(xScale.bandwidth() * 9) / 16}
                y1={yScale(item.q1)}
                y2={yScale(item.q1)}
                onMouseOver={(e) => {
                  setHoveredData({
                    value: item.q1.toFixed(3),
                    x: xScale(cellLines[i]) + margin.left,
                    y: pointer(e)[1],
                  })
                }}
                onMouseLeave={() => setHoveredData(null)}
                stroke="black"
              />
              <line
                x1={(xScale.bandwidth() * 7) / 16}
                x2={(xScale.bandwidth() * 9) / 16}
                y1={yScale(item.q3)}
                y2={yScale(item.q3)}
                onMouseOver={(e) => {
                  setHoveredData({
                    value: item.q3.toFixed(3),
                    x: xScale(cellLines[i]) + margin.left,
                    y: pointer(e)[1],
                  })
                }}
                onMouseLeave={() => setHoveredData(null)}
                stroke="black"
              />
            </g>
          ))}
        </g>
      </svg>
      {hoveredData && (
        <div
          style={{
            left: hoveredData.x,
            top: hoveredData.y,
            backgroundColor: 'white',
            border: 'solid',
            borderWidth: 1,
            borderRadius: 5,
            padding: 5,
            position: 'absolute',
          }}
        >
          {hoveredData.value}
        </div>
      )}
    </>
  )
}

ViolinPlot.propTypes = {
  data: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  margin: PropTypes.shape({
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    bottom: PropTypes.number,
  }),
  height: PropTypes.number,
  width: PropTypes.number,
}

ViolinPlot.defaultProps = {
  width: 500,
  height: 500,
  margin: { left: 60, right: 40, top: 20, bottom: 60 },
}

export default ViolinPlot
