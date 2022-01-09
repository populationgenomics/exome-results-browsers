import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

import { scaleLinear, extent, zoom, select, pointer, brushX } from 'd3'

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

const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const ManhattanPlot = ({ data, margin, height, width, onChange, innerRegion, setInnerRegion }) => {
  // console.log(innerRegion)
  const xAccessor = (d) => d.bp
  const yAccessor = (d) => d.p_value
  const keyAccessor = (_, i) => i

  const svg = useRef()
  const brushRef = useRef()

  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const xScale = scaleLinear().domain([innerRegion.start, innerRegion.stop]).range([0, innerWidth])

  const yScale = scaleLinear()
    .domain(
      extent(data, yAccessor)
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

    function updateBrush(e) {
      if (e.selection) {
        setInnerRegion({
          chrom: innerRegion.chrom,
          start: Math.round(xScale.invert(e.selection[0])),
          stop: Math.round(xScale.invert(e.selection[1])),
        })
        onChange({
          chrom: innerRegion.chrom,
          start: Math.round(xScale.invert(e.selection[0])),
          stop: Math.round(xScale.invert(e.selection[1])),
        })
        // eslint-disable-next-line no-use-before-define
        select(brushRef.current).call(brushBehaviour.move, null)
      }
    }

    const zoomBehaviour = zoom()
      // FIXME: Zooming disabled until we fix responsiveness
      .scaleExtent([1, 1]) // This control how much you can unzoom (x0.5) and zoom (x20)
      .on('zoom', (e) => updateChart(e))
      .on('end', (e) => Emit(e)) // emit region update here
    zoomBehaviour(select(svg.current))

    const brushBehaviour = brushX()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on('end', (e) => updateBrush(e))
    brushBehaviour(select(brushRef.current))
  }, [xScale])

  function onMouseOver() {
    select('.manhattanTooltip').style('opacity', 1)
  }

  function onMouseMove(e, d) {
    select('.manhattanTooltip')
      .html(
        `<table>
          <tr>
            <td><b>Id: </b></td> 
            <td>${d.chrom}:${d.bp}:${d.a1}:${d.a2}</td>
          </tr>
          <tr>
            <td><b>Gene: </b></td>
            <td>${d.gene} </td>
          </tr>
          <tr>
            <td><b>Cell type: </b></td>
            <td>${d.cell_type_name} </td>
          </tr>
          <tr>
            <td><b>P-value: </b></td>
            <td>${yAccessor(d).toPrecision(2)} </td>
          </tr>
          <tr>
            <td><b>-log\u2081\u2080(p): </b></td>
            <td> ${-Math.log10(yAccessor(d)).toFixed(2)} </td>
          </tr>
        </table>`
      )
      .style('left', `${pointer(e)[0] + 70}px`)
      .style('top', `${pointer(e)[1]}px`)
  }

  function onMouseLeave() {
    select('.manhattanTooltip')
      .style('opacity', 0)
      .style('left', `0px`)
      .style('top', `0px`)
      .html('')
  }

  return (
    <>
      <svg width={width} height={height} style={{ cursor: 'move' }}>
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
                  {numberWithCommas(tick)}
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
          <g ref={brushRef} />
          <g clipPath="url(#clip)">
            {data.map((d, i) => (
              <circle
                key={keyAccessor(d, i)}
                cx={xScale(xAccessor(d))}
                cy={yScale(-Math.log10(yAccessor(d)))}
                r={5}
                fill={CELL_COLOURS[d.cell_type_id]}
                onMouseOver={() => onMouseOver()}
                onFocus={() => onMouseOver()}
                onMouseMove={(e) => onMouseMove(e, d)}
                onMouseLeave={() => onMouseLeave()}
                style={{ cursor: 'pointer' }}
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
          <rect
            transform={`translate(0, ${innerHeight})`}
            width={innerWidth}
            height={margin.bottom}
            fill="none"
            // stroke="black"
            ref={svg}
            pointerEvents="all"
          />
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
          zIndex: 1,
        }}
      >
        HI
      </div>
    </>
  )
}

ManhattanPlot.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
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
