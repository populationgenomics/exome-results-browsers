import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react'
import PropTypes from 'prop-types'

import { uniqBy } from 'lodash'
import { scaleLinear, extent, brush, select, sort } from 'd3'

import { TooltipAnchor } from '@gnomad/ui'

const renderNumber = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const DEFAULT_MARGIN = { left: 80, right: 80, top: 80, bottom: 80 }
const DEFAULT_ACCESSORS = {
  id: (d) => d.id,
  x: (d) => d.x,
  y: (d) => d.y,
  color: (d) => d.color,
  opacity: (d) => d.opacity,
  tooltip: (d) => d.tooltip,
  isSelected: (d) => d.isSelected,
  isReference: (d) => d.isReference,
  isHighlighted: (d) => d.isHighlighted,
}

const ManhattanPlotNew = ({
  id,
  data,
  thresholds,
  markers,
  onClick,
  onDoubleClick,
  onShiftClick,
  onBrush,
  title,
  xLabel,
  yLabel,
  width,
  height,
  margin,
  accessors,
  xScale,
  xDomain,
  yScale,
  yDomain,
}) => {
  const svg = useRef()
  const brushRef = useRef()

  const _margin = { ...DEFAULT_MARGIN, ...margin }
  const _accessors = { ...DEFAULT_ACCESSORS, ...accessors }

  const innerWidth = width - _margin.left - _margin.right
  const innerHeight = height - _margin.top - _margin.bottom

  const [fallbackRegion, setFallbackRegion] = useState({ x: xDomain, y: yDomain })

  const xScaleLocal = useMemo(() => {
    const _extent = extent(data, _accessors.x)
    const domain = [xDomain?.start ?? _extent[0], xDomain?.stop ?? _extent[1]]

    if (!Number.isFinite(domain[0])) domain[0] = fallbackRegion?.x?.start ?? 0
    if (!Number.isFinite(domain[1])) domain[1] = fallbackRegion?.x?.stop ?? 1

    return xScale || scaleLinear().domain(domain).range([0, innerWidth]).nice()
  }, [
    xScale,
    data,
    xDomain?.start,
    xDomain?.stop,
    innerWidth,
    _accessors.x,
    fallbackRegion?.x?.start,
    fallbackRegion?.x?.stop,
  ])

  const yScaleLocal = useMemo(() => {
    const _extent = extent(data, _accessors.y)
    const domain = [yDomain?.start ?? _extent[0], yDomain?.stop ?? _extent[1]]

    if (!Number.isFinite(domain[0])) domain[0] = fallbackRegion?.y?.start ?? 0
    if (!Number.isFinite(domain[1])) domain[1] = fallbackRegion?.y?.stop ?? 1

    return yScale || scaleLinear().domain([domain[0], domain[1]]).range([innerHeight, 0]).nice()
  }, [
    yScale,
    data,
    yDomain?.start,
    yDomain?.stop,
    innerHeight,
    _accessors.y,
    fallbackRegion?.y?.start,
    fallbackRegion?.y?.stop,
  ])

  useEffect(() => {
    const brushBehaviour = brush()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on('end', ({ selection }) => {
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection
          const x = sort([xScaleLocal.invert(x0), xScaleLocal.invert(x1)])
          const y = sort([yScaleLocal.invert(y0), yScaleLocal.invert(y1)])

          const xy = {
            x: { start: Math.floor(x[0]), stop: Math.ceil(x[1]) },
            y: { start: y[0], stop: y[1] },
          }

          setFallbackRegion(xy)
          onBrush(xy)

          // eslint-disable-next-line no-use-before-define
          select(brushRef.current).call(brushBehaviour.move, null)
        }
      })

    // Apply new brush behaviour to the brush DOM element
    brushBehaviour(select(brushRef.current))
  }, [xScaleLocal, yScaleLocal, brushRef, onBrush, innerHeight, innerWidth])

  const renderTooltip = useCallback(
    ({ d }) => {
      const tooltipFunc = _accessors?.tooltip
      const tooltip = tooltipFunc && tooltipFunc(d)
      if (tooltip) {
        if (React.isValidElement(tooltip)) {
          return tooltip
        }
        return <div>{tooltip}</div>
      }
      return null
    },
    [_accessors.tooltip]
  )

  if (data == null) {
    return (
      <svg id={id} width={width} height={height}>
        <g
          transform={`translate(${_margin.left + innerWidth / 2}, ${
            _margin.top + innerHeight / 2
          })`}
        >
          <text style={{ textAnchor: 'middle', alignmentBaseline: 'middle', fontSize: 'larger' }}>
            No data to display
          </text>
        </g>
      </svg>
    )
  }

  return (
    <svg id={id} width={width} height={height} onDoubleClick={onDoubleClick}>
      {/* Title */}
      {title && (
        <g id={`${id}-title`} transform={`translate(${_margin.left}, 40)`}>
          <text style={{ fontSize: 16, textAnchor: 'start' }}>{title}</text>
        </g>
      )}

      <defs>
        <clipPath id="clipManhattanPlot">
          <rect width={innerWidth} height={innerHeight} fill="none" pointerEvents="all" />
        </clipPath>
      </defs>

      {/* Main plot */}
      <g transform={`translate(${_margin.left}, ${_margin.top})`}>
        <rect
          transform={`translate(0, ${innerHeight})`}
          width={innerWidth}
          height={_margin.bottom}
          fill="none"
          ref={svg}
          pointerEvents="all"
        />

        {/* x-axis */}
        <g id={`${id}-x-axis`} transform={`translate(0, ${innerHeight})`}>
          <line x2={`${innerWidth}`} stroke="black" />
          {uniqBy(xScaleLocal.ticks(6).map((t) => Math.round(t))).map((tick) => (
            <g key={tick} transform={`translate(${xScaleLocal(tick)}, 0)`}>
              {/* <text style={{ textAnchor: 'middle' }} dy=".71em" y={9}> */}
              <text
                transform="translate(0, 10)rotate(-45)"
                y={8}
                textAnchor="end"
                alignmentBaseline="middle"
                fontSize={14}
              >
                {renderNumber(tick)}
              </text>
              <line y2={6} stroke="black" />
            </g>
          ))}
        </g>

        {/* y-axis */}
        <g id={`${id}-y-axis`}>
          <line y2={`${innerHeight}`} stroke="black" />
          {yScaleLocal.ticks(4).map((tick) => (
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

        {/* Annotations for threshold lines */}
        <g id={`${id}-thresholds`}>
          {thresholds
            .filter((item) => {
              return (
                (item?.value ?? item) >= yScaleLocal.domain()[0] &&
                (item?.value ?? item) <= yScaleLocal.domain()[1]
              )
            })
            .map((item) => (
              <React.Fragment key={item?.label ?? item}>
                <text
                  x={innerWidth + 8}
                  y={yScaleLocal(item?.value ?? item) + 4}
                  stroke={item.color ?? 'black'}
                  opacity="0.5"
                  fontSize={12}
                >
                  {item?.label ?? item}
                </text>
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={yScaleLocal(item?.value ?? item)}
                  y2={yScaleLocal(item?.value ?? item)}
                  strokeDasharray={12}
                  stroke={item.color ?? 'black'}
                  opacity="0.5"
                />
              </React.Fragment>
            ))}
        </g>

        {/* Vertical marker lines */}
        <g id={`${id}-markers`}>
          {markers
            .filter((item) => {
              return (
                (item?.value ?? item) >= xScaleLocal.domain()[0] &&
                (item?.value ?? item) <= xScaleLocal.domain()[1]
              )
            })
            .map((item) => (
              <React.Fragment key={item?.label ?? item}>
                <text
                  x={xScaleLocal(item?.value ?? item) + 8}
                  y={_margin.top}
                  stroke={item.color ?? 'black'}
                  opacity="0.5"
                  fontSize={12}
                >
                  {item?.label ?? item}
                </text>
                <line
                  x1={xScaleLocal(item?.value ?? item)}
                  x2={xScaleLocal(item?.value ?? item)}
                  y1={0}
                  y2={innerHeight}
                  strokeDasharray={12}
                  stroke={item.color ?? 'black'}
                  opacity="0.5"
                />
              </React.Fragment>
            ))}
        </g>

        {/* Brush box */}
        <g ref={brushRef} />

        {/* Data points */}
        <g id={`${id}-data`} clipPath="url(#clipManhattanPlot)">
          {data.map((d, index) => (
            <React.Fragment key={`${_accessors?.id(d) || index}-fragment`}>
              {_accessors.isReference(d) ? (
                <text
                  x={xScaleLocal(_accessors.x(d)) + 8}
                  y={_margin.top}
                  stroke="black"
                  opacity="0.5"
                  fontSize={12}
                >
                  LD reference
                </text>
              ) : null}
              {(_accessors.isSelected(d) || _accessors.isReference(d)) && (
                <line
                  key={`${_accessors?.id(d) || index}-selected-line`}
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
                      key={`${_accessors.id(d) || index}-reference`}
                      width={20}
                      height={20}
                      fill={_accessors.color(d)}
                      opacity={_accessors.opacity(d) || 0}
                      stroke={_accessors.isHighlighted(d) ? 'red' : null}
                      strokeWidth={_accessors.isHighlighted(d) ? 2 : 0}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          onShiftClick(d)
                        }
                        onClick(d)
                      }}
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
                    key={`${_accessors.id(d) || index}-point`}
                    cx={xScaleLocal(_accessors.x(d))}
                    cy={yScaleLocal(_accessors.y(d))}
                    r={_accessors.isSelected(d) ? 12 : 3}
                    fill={_accessors.color(d)}
                    stroke={_accessors.isHighlighted(d) ? 'red' : null}
                    strokeWidth={_accessors.isHighlighted(d) ? 2 : 0}
                    opacity={_accessors.opacity(d) || 0}
                    onClick={(e) => (e.shiftKey ? onShiftClick(d) : onClick(d))}
                    cursor={onClick ? 'pointer' : null}
                  />
                </TooltipAnchor>
              )}
            </React.Fragment>
          ))}
        </g>

        {/* x-axis label */}
        <text
          id={`${id}-x-axis-label`}
          x={innerWidth / 2}
          y={innerHeight + 100}
          fontSize={16}
          textAnchor="middle"
        >
          {xLabel}
        </text>

        {/* y-axis label */}
        <g id={`${id}-y-axis-label`} transform={`rotate(-90) translate(-${innerHeight / 2}, -40)`}>
          <text fontSize={16} textAnchor="middle">
            {yLabel}
          </text>
        </g>
      </g>
    </svg>
  )
}

ManhattanPlotNew.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  thresholds: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      color: PropTypes.number,
    })
  ),
  markers: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      color: PropTypes.number,
    })
  ),
  onClick: PropTypes.func,
  onBrush: PropTypes.func,
  onDoubleClick: PropTypes.func,
  onShiftClick: PropTypes.func,
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
  xDomain: PropTypes.shape({
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }),
  yScale: PropTypes.func,
  yDomain: PropTypes.shape({
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }),
}

ManhattanPlotNew.defaultProps = {
  onClick: () => {},
  onBrush: () => {},
  onDoubleClick: () => {},
  onShiftClick: () => {},
  title: null,
  xLabel: 'Chromosomal Position (Mb)',
  yLabel: '-log\u2081\u2080(p)',
  markers: [],
  thresholds: [],
  height: 500,
  width: 1000,
  margin: { ...DEFAULT_MARGIN },
  accessors: { ...DEFAULT_ACCESSORS },
  xScale: null,
  xDomain: null,
  yScale: null,
  yDomain: null,
}

export default ManhattanPlotNew
