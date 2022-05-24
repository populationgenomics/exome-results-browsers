import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

import { scaleLinear, zoom, select, pointer, brushX } from 'd3'
import { useNavigate } from 'react-router-dom'

const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const ManhattanPlot = ({
  data,
  margin,
  height,
  width,
  onChange,
  innerRegion,
  setInnerRegion,
  categoryColors,
}) => {
  const navigate = useNavigate()

  // console.log(innerRegion)
  const xAccessor = (d) => d.bp
  const yAccessor = (d) => d.p_value
  const keyAccessor = (_, i) => i

  const svg = useRef()
  const brushRef = useRef()

  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const FDR = 0.05
  const xScale = scaleLinear().domain([innerRegion.start, innerRegion.stop]).range([0, innerWidth])

  const yScale = scaleLinear()
    .domain(
      [0, 4.5]
      // data?.length
      //   ? extent(data, yAccessor)
      //       .map((p) => -Math.log10(p))
      //       .reverse()
      //   : [0, 4]
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
  }, [xScale, innerWidth, innerHeight, innerRegion.chrom, onChange, setInnerRegion])

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
          </tr>
          <tr>
            <td><b>Functional annotation: </b></td>
            <td> ${d.functional_annotation ?? '?'} </td>
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
            <clipPath id="clipManhattanPlot">
              <rect width={innerWidth} height={innerHeight} fill="none" pointerEvents="all" />
            </clipPath>
          </defs>
          {/* <rect width={innerWidth} height={innerHeight} fill="none" stroke="black" /> */}
          <g transform={`translate(0, ${innerHeight})`}>
            <line x2={`${innerWidth}`} stroke="black" />

            {xScale.ticks(6).map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick)}, 0)`}>
                <text style={{ textAnchor: 'middle' }} dy=".71em" y={9}>
                  {numberWithCommas(tick)}
                </text>
                <line y2={6} stroke="black" />
              </g>
            ))}
          </g>
          <line y2={`${innerHeight}`} stroke="black" />
          {yScale.ticks(4).map((tick) => (
            <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
              <text key={tick} style={{ textAnchor: 'end' }} x={-6} dy=".32em">
                {tick}
              </text>
              <line x2={-3} stroke="black" />
              <line x2={innerWidth} stroke={yScale(tick) === innerHeight ? 'none' : 'lightgrey'} />
            </g>
          ))}
          <g ref={brushRef} />
          <g clipPath="url(#clipManhattanPlot)">
            {data.map((d, i) => (
              <circle
                key={keyAccessor(d, i)}
                cx={xScale(xAccessor(d))}
                cy={yScale(Math.min(4, -Math.log10(yAccessor(d))))}
                r={3}
                fill={categoryColors[d.cell_type_id]}
                onClick={() => navigate(`/results/${d.chrom}-${d.bp}-${d.a1}-${d.a2}`)}
                onMouseOver={() => onMouseOver()}
                onFocus={() => onMouseOver()}
                onMouseMove={(e) => onMouseMove(e, d)}
                onMouseLeave={() => onMouseLeave()}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </g>
          {/* FDR line */}
          <text
            x={4}
            y={yScale(-Math.log10(FDR)) - 4}
            stroke="black"
            opacity="0.5"
            fontSize={12}
          >{`FDR < ${FDR}`}</text>
          <line
            x1={0}
            x2={innerWidth}
            y1={yScale(-Math.log10(FDR))}
            y2={yScale(-Math.log10(FDR))}
            strokeDasharray={12}
            stroke="black"
            opacity="0.5"
          />
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
  categoryColors: PropTypes.shape({ [PropTypes.symbol]: PropTypes.string }),
}

ManhattanPlot.defaultProps = {
  width: 500,
  height: 500,
  margin: { left: 60, right: 40, top: 20, bottom: 60 },
  categoryColors: {},
}

export default ManhattanPlot
