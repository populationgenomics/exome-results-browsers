import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

import { scaleLinear, extent, zoom, select, pointer } from 'd3'

const ManhattanPlot = ({
  dataPoints,
  margin,
  height,
  width,
  onChange,
  innerRegion,
  setInnerRegion,
}) => {
  const xAccessor = (d) => d.pos
  const yAccessor = (d) => d.pval
  const keyAccessor = (_, i) => i
  // const [innerRegion, setInnerRegion] = useState(region)
  const svg = useRef()

  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const xScale = scaleLinear()
    .domain([innerRegion.start, innerRegion.stop])
    .range([0, width - margin.left - margin.right])

  const yScale = scaleLinear()
    .domain(
      extent(dataPoints, yAccessor)
        .map((p) => -Math.log10(p))
        .reverse()
    )
    .range([height - margin.bottom - margin.top, 0])
    .nice()

  useEffect(() => {
    function updateChart(e) {
      setInnerRegion({
        chrom: innerRegion.chrom,
        start: e.transform.rescaleX(xScale).domain()[0],
        stop: e.transform.rescaleX(xScale).domain()[1],
      })
    }

    function Emit(e) {
      onChange({
        chrom: innerRegion.chrom,
        start: Math.round(e.transform.rescaleX(xScale).domain()[0]),
        stop: Math.round(e.transform.rescaleX(xScale).domain()[1]),
      })
    }

    const zoomBehaviour = zoom()
      .scaleExtent([0.5, 20]) // This control how much you can unzoom (x0.5) and zoom (x20)
      .on('zoom', (e) => updateChart(e))
      .on('end', (e) => Emit(e)) // emit region update here

    zoomBehaviour(select(svg.current))
  }, [])

  function onMouseOver() {
    select('.manhattanTooltip').style('opacity', 1)
  }

  function onMouseMove(e, d) {
    select('.manhattanTooltip')
      .html(
        `<table>
          <tr>
            <td><b>ID: </b></td> 
            <td> ${d.id} </td>
          </tr>
          <tr>
            <td><b>Gene ID: </b></td>
            <td>${d.gene_id} </td>
          </tr>
          <tr>
            <td><b>P-value: </b></td>
            <td>${d.pval} </td>
          </tr>
          <tr>
            <td><b>-log10 P-value: </b></td>
            <td> ${-Math.log10(yAccessor(d)).toFixed(5)} </td>
          </tr>
        </table>`
      )
      .style('left', `${pointer(e)[0] + 70}px`)
      .style('top', `${pointer(e)[1]}px`)
  }

  function onMouseLeave() {
    select('.manhattanTooltip').style('opacity', 0).style('left', `0px`).style('top', `0px`)
  }

  return (
    <>
      <svg width={width} height={height} ref={svg}>
        {/* <rect width={width} height={height} fill="none" stroke="black" /> */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <defs>
            <clipPath id="clip">
              <rect width={innerWidth} height={innerHeight} fill="none" pointerEvents="all" />
            </clipPath>
          </defs>
          {/* <rect width={innerWidth} height={innerHeight} fill="none" stroke="black" /> */}
          <g transform={`translate(0, ${innerHeight})`}>
            <line x2={`${innerWidth}`} stroke="black" />

            {xScale.ticks().map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick)}, 0)`}>
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
          <g clipPath="url(#clip)">
            {dataPoints.map((d, i) => (
              <circle
                key={keyAccessor(d, i)}
                cx={xScale(xAccessor(d))}
                cy={yScale(-Math.log10(yAccessor(d)))}
                r={5}
                fill={d.color}
                onMouseOver={() => onMouseOver()}
                onFocus={() => onMouseOver()}
                onMouseMove={(e) => onMouseMove(e, d)}
                onMouseLeave={() => onMouseLeave()}
              />
            ))}
          </g>
          <text x={innerWidth / 2} y={innerHeight + 50} textAnchor="middle">
            Chromosomal Position
          </text>
          <g transform={`rotate(-90) translate(-${innerHeight / 2}, -40)`}>
            <text textAnchor="middle">
              -log<tspan baselineShift="sub">10</tspan>(p)
            </text>
          </g>
        </g>
      </svg>
      <div
        className="manhattanTooltip"
        style={{
          opacity: 0,
          backgroundColor: 'white',
          border: 'solid',
          borderWidth: '1px',
          borderRadius: '5px',
          padding: '5px',
          position: 'absolute',
        }}
      >
        HI
      </div>
    </>
  )
}

ManhattanPlot.propTypes = {
  dataPoints: PropTypes.arrayOf(PropTypes.object).isRequired,
  margin: PropTypes.shape({
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    bottom: PropTypes.number,
  }),
  height: PropTypes.number,
  width: PropTypes.number,
  innerRegion: PropTypes.shape({
    chrom: PropTypes.string.isRequired,
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  setInnerRegion: PropTypes.func.isRequired,
}

ManhattanPlot.defaultProps = {
  width: 500,
  height: 500,
  margin: { left: 60, right: 40, top: 20, bottom: 60 },
}

export default ManhattanPlot
