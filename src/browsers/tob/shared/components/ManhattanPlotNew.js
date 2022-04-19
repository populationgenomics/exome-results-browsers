import React, { useRef, useMemo } from 'react'
import PropTypes from 'prop-types'

import { scaleLinear, extent } from 'd3'
// import { useNavigate } from 'react-router-dom'

import { defaultCellTypeColors } from '../utilities/constants'

const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const ManhattanPlotNew = ({
  id,
  data,
  thresholds,
  onClick,
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
  const brushRef = useRef()

  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const xScaleLocal = useMemo(
    () => xScale || scaleLinear().domain(extent(data, accessors.x)).range([0, innerWidth]),
    [(xScale, data, accessors.x)]
  )

  const yScaleLocal = useMemo(
    () => yScale || scaleLinear().domain(extent(data, accessors.y)).range([innerHeight, 0]).nice(),
    [(yScale, data, accessors.y)]
  )

  // useEffect(() => {
  //   function updateChart(e) {
  //     setInnerRegion({
  //       chrom: innerRegion.chrom,
  //       start: e.transform.rescaleX(xScale).domain()[0],
  //       stop: e.transform.rescaleX(xScale).domain()[1],
  //     })
  //   }

  //   function Emit(e) {
  //     onChange({
  //       chrom: innerRegion.chrom,
  //       start: Math.round(e.transform.rescaleX(xScale).domain()[0]),
  //       stop: Math.round(e.transform.rescaleX(xScale).domain()[1]),
  //     })
  //   }

  //   function updateBrush(e) {
  //     if (e.selection) {
  //       setInnerRegion({
  //         chrom: innerRegion.chrom,
  //         start: Math.round(xScale.invert(e.selection[0])),
  //         stop: Math.round(xScale.invert(e.selection[1])),
  //       })
  //       onChange({
  //         chrom: innerRegion.chrom,
  //         start: Math.round(xScale.invert(e.selection[0])),
  //         stop: Math.round(xScale.invert(e.selection[1])),
  //       })
  //       // eslint-disable-next-line no-use-before-define
  //       select(brushRef.current).call(brushBehaviour.move, null)
  //     }
  //   }

  //   const zoomBehaviour = zoom()
  //     // FIXME: Zooming disabled until we fix responsiveness
  //     .scaleExtent([1, 1]) // This control how much you can unzoom (x0.5) and zoom (x20)
  //     .on('zoom', (e) => updateChart(e))
  //     .on('end', (e) => Emit(e)) // emit region update here
  //   zoomBehaviour(select(svg.current))

  //   const brushBehaviour = brushX()
  //     .extent([
  //       [0, 0],
  //       [innerWidth, innerHeight],
  //     ])
  //     .on('end', (e) => updateBrush(e))
  //   brushBehaviour(select(brushRef.current))
  // }, [xScale])

  // function onMouseOver() {
  //   select('.manhattanTooltip').style('opacity', 1)
  // }

  // function onMouseMove(e, d) {
  //   select('.manhattanTooltip')
  //     .html(
  //       `<table>
  //         <tr>
  //           <td><b>Id: </b></td>
  //           <td>${d.chrom}:${d.bp}:${d.a1}:${d.a2}</td>
  //         </tr>
  //         <tr>
  //           <td><b>Gene: </b></td>
  //           <td>${d.gene} </td>
  //         </tr>
  //         <tr>
  //           <td><b>Cell type: </b></td>
  //           <td>${accessors.color(d)} </td>
  //         </tr>
  //         <tr>
  //           <td><b>P-value: </b></td>
  //           <td>${accessors.y(d).toPrecision(2)} </td>
  //         </tr>
  //         <tr>
  //           <td><b>-log\u2081\u2080(p): </b></td>
  //           <td> ${-Math.log10(accessors.y(d)).toFixed(2)} </td>
  //         </tr>
  //         </tr>
  //         <tr>
  //           <td><b>Functional annotation: </b></td>
  //           <td> ${d.functional_annotation ?? '?'} </td>
  //         </tr>
  //       </table>`
  //     )
  //     .style('left', `${pointer(e)[0] + 70}px`)
  //     .style('top', `${pointer(e)[1]}px`)
  // }

  // function onMouseLeave() {
  //   select('.manhattanTooltip')
  //     .style('opacity', 0)
  //     .style('left', `0px`)
  //     .style('top', `0px`)
  //     .html('')
  // }

  return (
    <>
      {data.length ? (
        <>
          <svg id={id} width={width} height={height}>
            {title && (
              <g transform={`translate(${margin.left}, 40)`}>
                <text style={{ fontSize: 12, textAnchor: 'left' }}>{title}</text>
              </g>
            )}
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

                {xScaleLocal.ticks(6).map((tick) => (
                  <g key={tick} transform={`translate(${xScaleLocal(tick)}, 0)`}>
                    <text style={{ textAnchor: 'middle' }} dy=".71em" y={9}>
                      {numberWithCommas(tick)}
                    </text>
                    <line y2={6} stroke="black" />
                  </g>
                ))}
              </g>
              <line y2={`${innerHeight}`} stroke="black" />
              {yScaleLocal.ticks(4).map((tick) => (
                <g key={tick} transform={`translate(0, ${yScaleLocal(tick)})`}>
                  <text key={tick} style={{ textAnchor: 'end' }} x={-6} dy=".32em">
                    {tick}
                  </text>
                  <line x2={-3} stroke="black" />
                  <line
                    x2={innerWidth}
                    stroke={yScaleLocal(tick) === innerHeight ? 'none' : 'lightgrey'}
                  />
                </g>
              ))}
              <g ref={brushRef} />
              <g clipPath="url(#clipManhattanPlot)">
                {data.map((d) => (
                  <React.Fragment key={`${accessors.x(d)},${accessors.y(d)},${accessors.color(d)}`}>
                    {(accessors.isSelected(d) || accessors.isReference(d)) && (
                      <line
                        key={`${accessors.x(d)},${accessors.y(d)},${accessors.color(
                          d
                        )}SelectedLine`}
                        x1={xScaleLocal(accessors.x(d))}
                        x2={xScaleLocal(accessors.x(d))}
                        y1={0}
                        y2={innerHeight}
                        strokeDasharray={12}
                        stroke="black"
                        opacity="0.5"
                      />
                    )}
                    {accessors.isReference(d) ? (
                      <g
                        transform={`translate(${xScaleLocal(accessors.x(d))}, ${yScaleLocal(
                          accessors.y(d)
                        )}),rotate(45)`}
                      >
                        <rect
                          key={`${accessors.x(d)},${accessors.y(d)},${accessors.color(d)}`}
                          width={10}
                          height={10}
                          fill={defaultCellTypeColors()[accessors.color(d)]}
                          onClick={onClick}
                          // onMouseOver={() => onMouseOver()}
                          // onFocus={() => onMouseOver()}
                          // onMouseMove={(e) => onMouseMove(e, d)}
                          // onMouseLeave={() => onMouseLeave()}
                        />
                      </g>
                    ) : (
                      <circle
                        key={`${accessors.x(d)},${accessors.y(d)},${accessors.color(d)}`}
                        cx={xScaleLocal(accessors.x(d))}
                        cy={yScaleLocal(Math.min(4, -Math.log10(accessors.y(d))))}
                        r={accessors.isSelected(d) ? 6 : 3}
                        fill={defaultCellTypeColors()[accessors.color(d)]}
                        // fill={accessors.isSelected(d) ? 'black' : 'none'}
                        // stroke="none"
                        onClick={onClick}
                        // onMouseOver={() => onMouseOver()}
                        // onFocus={() => onMouseOver()}
                        // onMouseMove={(e) => onMouseMove(e, d)}
                        // onMouseLeave={() => onMouseLeave()}
                      />
                    )}
                  </React.Fragment>
                ))}
              </g>
              {thresholds.map((item) => (
                <React.Fragment key={item}>
                  {/* FDR line */}
                  <text
                    x={innerWidth}
                    y={yScaleLocal(-Math.log10(item)) - 4}
                    stroke="black"
                    opacity="0.5"
                    fontSize={12}
                  >{`FDR < ${item}`}</text>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yScaleLocal(-Math.log10(item))}
                    y2={yScaleLocal(-Math.log10(item))}
                    strokeDasharray={12}
                    stroke="black"
                    opacity="0.5"
                  />
                </React.Fragment>
              ))}
              <text x={innerWidth / 2} y={innerHeight + 50} textAnchor="middle">
                {xLabel}
              </text>
              <g transform={`rotate(-90) translate(-${innerHeight / 2}, -40)`}>
                <text textAnchor="middle">{yLabel}</text>
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
      ) : (
        <svg id={id} width={width} height={height}>
          <g
            transform={`translate(${margin.left + innerWidth / 2}, ${
              margin.top + innerHeight / 2
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

ManhattanPlotNew.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  thresholds: PropTypes.arrayOf(PropTypes.number).isRequired,
  onClick: PropTypes.func,
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
    color: PropTypes.func,
    opacity: PropTypes.func,
    tooltip: PropTypes.func,
    isSelected: PropTypes.func,
    isReference: PropTypes.func,
  }),
  xScale: PropTypes.func,
  yScale: PropTypes.func,
}

ManhattanPlotNew.defaultProps = {
  onClick: () => {},
  title: 'ManhattanPlot',
  xLabel: 'Chromosomal Position',
  yLabel: '-log\u2081\u2080(p)',
  height: 500,
  width: 500,
  margin: { left: 60, right: 40, top: 20, bottom: 60 },
  accessors: {
    id: (d) => d.id,
    x: (d) => d.x,
    y: (d) => d.y,
    color: (d) => d.color,
    opacity: (d) => d.opacity,
    tooltip: (d) => d.tooltip,
    isSelected: (d) => d.isSelected,
    isReference: (d) => d.isReference,
  },
  xScale: null,
  yScale: null,
}

export default ManhattanPlotNew
