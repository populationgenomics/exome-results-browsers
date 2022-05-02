import React, { useRef, useMemo, useEffect } from 'react'
import PropTypes from 'prop-types'

import { scaleLinear, extent, brushX, select } from 'd3'

import { TooltipAnchor } from '@gnomad/ui'

const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const DEFAULT_MARGIN = { left: 60, right: 40, top: 20, bottom: 60 }
const DEFAULT_ACCESSORS = {
  id: (d) => d.id,
  x: (d) => d.x,
  y: (d) => d.y,
  color: (d) => d.color,
  cellLine: (d) => d.cellLine,
  opacity: (d) => d.opacity,
  tooltip: (d) => d.tooltip,
  isSelected: (d) => d.isSelected,
  isReference: (d) => d.isReference,
}

const ManhattanPlotNew = ({
  id,
  data,
  thresholds,
  onClick,
  onBrush,
  title,
  xLabel,
  yLabel,
  width,
  height,
  margins,
  accessors,
  xScale,
  yScale,
}) => {
  const svg = useRef()
  const brushRef = useRef()
  // eslint-disable-next-line no-underscore-dangle
  const _margins = { ...DEFAULT_MARGIN, ...margins }
  // eslint-disable-next-line no-underscore-dangle
  const _accessors = { ...DEFAULT_ACCESSORS, ...accessors }
  const innerWidth = width - _margins.left - _margins.right
  const innerHeight = height - _margins.top - _margins.bottom

  const xScaleLocal = useMemo(
    () => xScale || scaleLinear().domain(extent(data, _accessors.x)).range([0, innerWidth]).nice(),
    [(xScale, data, _accessors.x)]
  )

  const yScaleLocal = useMemo(
    () => yScale || scaleLinear().domain(extent(data, _accessors.y)).range([innerHeight, 0]).nice(),
    [(yScale, data, _accessors.y)]
  )

  useEffect(() => {
    function updateBrush(e) {
      if (e.selection) {
        onBrush(xScaleLocal.invert(e.selection[0]), xScaleLocal.invert(e.selection[1]))
        // eslint-disable-next-line no-use-before-define
        select(brushRef.current).call(brushBehaviour.move, null)
      }
    }

    const brushBehaviour = brushX()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on('end', (e) => updateBrush(e))
    brushBehaviour(select(brushRef.current))
  }, [xScaleLocal])

  const renderTooltip = ({ d }) => {
    if (_accessors?.tooltip(d)) {
      if (React.isValidElement(_accessors.tooltip(d))) {
        return _accessors.tooltip(d)
      }
      return <div>{_accessors.tooltip(d)}</div>
    }
    return null
  }

  return (
    <>
      {data.length ? (
        <>
          <svg id={id} width={width} height={height}>
            {title && (
              <g transform={`translate(${_margins.left}, 40)`}>
                <text style={{ fontSize: 12, textAnchor: 'left' }}>{title}</text>
              </g>
            )}
            {/* <rect width={width} height={height} fill="none" stroke="black" /> */}
            <g transform={`translate(${_margins.left}, ${_margins.top})`}>
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
                {data.map((d, index) => (
                  <React.Fragment
                    key={`${_accessors.x(d)},${_accessors.y(d)},${_accessors.color(d)}`}
                  >
                    {(_accessors.isSelected(d) || _accessors.isReference(d)) && (
                      <line
                        key={`${_accessors.x(d)},${_accessors.y(d)},${_accessors.color(
                          d
                        )}SelectedLine`}
                        x1={xScaleLocal(_accessors.x(d))}
                        x2={xScaleLocal(_accessors.x(d))}
                        y1={0}
                        y2={innerHeight}
                        strokeDasharray={12}
                        stroke="black"
                        opacity="0.5"
                      />
                    )}
                    {_accessors.isReference(d) ? (
                      <TooltipAnchor
                        key={`${_accessors?.id(d) || index}-tooltip`}
                        tooltipComponent={renderTooltip}
                        d={d}
                      >
                        <g
                          transform={`translate(${xScaleLocal(_accessors.x(d))}, ${yScaleLocal(
                            _accessors.y(d)
                          )}),rotate(45)`}
                        >
                          <rect
                            key={`${_accessors.x(d)},${_accessors.y(d)},${_accessors.color(d)}`}
                            width={10}
                            height={10}
                            fill={_accessors.color(d)}
                            onClick={onClick}
                            opacity={_accessors.opacity(d) || 0}
                          />
                        </g>
                      </TooltipAnchor>
                    ) : (
                      <TooltipAnchor
                        key={`${_accessors.id(d) || index}-tooltip`}
                        tooltipComponent={renderTooltip}
                        d={d}
                      >
                        <circle
                          key={`${_accessors.x(d)},${_accessors.y(d)},${_accessors.color(d)}`}
                          cx={xScaleLocal(_accessors.x(d))}
                          cy={yScaleLocal(_accessors.y(d))}
                          r={_accessors.isSelected(d) ? 6 : 3}
                          fill={_accessors.color(d)}
                          opacity={_accessors.opacity(d) || 0}
                          onClick={onClick}
                        />
                      </TooltipAnchor>
                    )}
                  </React.Fragment>
                ))}
              </g>
              {thresholds.map((item) => (
                <React.Fragment key={item}>
                  {/* FDR line */}
                  <text
                    x={innerWidth}
                    y={yScaleLocal(item) - 4}
                    stroke="black"
                    opacity="0.5"
                    fontSize={12}
                  >{`FDR < ${item.toPrecision(4)}`}</text>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yScaleLocal(item)}
                    y2={yScaleLocal(item)}
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
                height={_margins.bottom}
                fill="none"
                // stroke="black"
                ref={svg}
                pointerEvents="all"
              />
            </g>
          </svg>
        </>
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

ManhattanPlotNew.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  thresholds: PropTypes.arrayOf(PropTypes.number).isRequired,
  onClick: PropTypes.func,
  onBrush: PropTypes.func,
  title: PropTypes.string,
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  margins: PropTypes.shape({
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
    cellLine: PropTypes.func,
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
  onBrush: () => {},
  title: 'ManhattanPlot',
  xLabel: 'Chromosomal Position',
  yLabel: '-log\u2081\u2080(p)',
  height: 500,
  width: 500,
  margins: { left: 60, right: 40, top: 20, bottom: 60 },
  accessors: {
    id: (d) => d.id,
    x: (d) => d.x,
    y: (d) => d.y,
    color: (d) => d.color,
    cellLine: (d) => d.cellLine,
    opacity: (d) => d.opacity,
    tooltip: (d) => d.tooltip,
    isSelected: (d) => d.isSelected,
    isReference: (d) => d.isReference,
  },
  xScale: null,
  yScale: null,
}

export default ManhattanPlotNew
