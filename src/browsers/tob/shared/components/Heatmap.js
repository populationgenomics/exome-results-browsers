import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { minBy, maxBy } from 'lodash'

import { scaleBand, select, axisTop, axisLeft, scaleSequential, interpolateRgb, pointer } from 'd3'

export const TileEventType = {
  SELECT: 'select',
  DESELECT: 'deselect',
}

const Heatmap = ({
  data,
  title,
  tileTooltip,
  tileValue,
  tileRowName,
  tileColName,
  tileIsDefined,
  rowNames,
  colNames,
  selectedTiles,
  onClickTile,
  onHoverTile,
  id,
  height,
  width,
  minValue,
  minValueColor,
  maxValue,
  maxValueColor,
  tileSpacing,
  tileSelectBorderColor,
  tileSelectBorderWidth,
  margin,
}) => {
  const svgRef = useRef()
  const wrapperRef = useRef()
  const hatchPatternThickness = 4

  useEffect(() => {
    const svg = select(svgRef.current)
    const svgContent = svg.select('.content')

    const minScaleValue = minValue == null ? minBy(data, (d) => d.value).value : minValue
    const maxScaleValue = maxValue == null ? maxBy(data, (d) => d.value).value : maxValue

    const colNamesOrdered = colNames?.length
      ? colNames
      : Array.from(new Set(data.map((d) => tileColName(d)))).sort()

    const xScale = scaleBand()
      .range([margin.left, width - margin.right])
      .domain(colNamesOrdered)
      .padding(tileSpacing)

    const rowNamesOrdered = rowNames?.length
      ? rowNames
      : Array.from(new Set(data.map((d) => tileRowName(d)))).sort()

    const yScale = scaleBand()
      .range([height - margin.bottom, margin.top])
      .domain(rowNamesOrdered.reverse())
      .padding(tileSpacing)

    const xAxis = axisTop(xScale).tickSize(0)
    svg
      .select('.x-axis')
      .attr('transform', `translate(0, ${margin.top - 5})`)
      .call(xAxis)
      .select('.domain')
      .remove()

    svg
      .select('.x-axis')
      .selectAll('text')
      .style('text-anchor', 'start')
      .attr('transform', 'rotate(-45)')

    const yAxis = axisLeft(yScale).tickSize(0)
    svg
      .select('.y-axis')
      .attr('transform', `translate(${margin.left - 5}, 0)`)
      .call(yAxis)
      .select('.domain')
      .remove()

    svg
      .selectAll('.y-axis .tick > text')
      .on('mouseover', (e) => {
        const element = select(e.target)
        element.style('font-size', '12px').style('font-weight', '800').style('cursor', 'pointer')
      })
      .on('mouseleave', (e) => {
        const element = select(e.target)
        element.style('font-size', '10px').style('font-weight', '400').style('cursor', 'default')
      })
      .on('click', (e) => {
        const element = select(e.target)
        const tiles = data.filter((d) => tileRowName(d) === element.text() && tileIsDefined(d))
        onClickTile(tiles, TileEventType.SELECT)
      })

    const colorScale = scaleSequential()
      .interpolator(interpolateRgb(minValueColor, maxValueColor))
      .domain([minScaleValue, maxScaleValue])
      .range([minValueColor, maxValueColor])

    const Tooltip = select(wrapperRef.current)
      .select('.tooltip')
      .style('opacity', 0)
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '1px')
      .style('border-radius', '5px')
      .style('padding', '5px')
      .style('position', 'absolute')

    // Clear content for re-draw so rectangles aren't drawn over each other.
    svgContent.selectAll('rect').remove()
    svgContent
      .selectAll()
      .data(data, (d) => `${d.col}:${d.row}`)
      .enter()
      .append('rect')
      .attr('type', 'tile')
      .attr('x', (d) => xScale(tileColName(d)))
      .attr('y', (d) => yScale(tileRowName(d)))
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', (d) => {
        if (tileIsDefined(d)) {
          return colorScale(tileValue(d))
        }
        return 'url(#missing-pattern)'
      })
      .style('opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mouseover', (e, d) => {
        onHoverTile(d)
        Tooltip.style('opacity', 1)

        const element = select(e.target)

        if (!tileIsDefined(d)) {
          element.style('cursor', 'not-allowed')
        }

        if (!element.attr('class')?.includes('selected')) {
          element
            .style('stroke', tileSelectBorderColor)
            .style('stroke-width', `${tileSelectBorderWidth}`)
            .style('opacity', 1)
        }
      })
      .on('mousemove', (e, d) => {
        Tooltip.html(tileTooltip(d))
          .style('left', `${pointer(e)[0] + 20}px`)
          .style('top', `${pointer(e)[1]}px`)
      })
      .on('mouseleave', (e) => {
        Tooltip.style('opacity', 0)

        const element = select(e.target)
        if (!element.attr('class')?.includes('selected')) {
          element.style('stroke', null).style('stroke-width', null).style('opacity', 0.8)
        }
      })
      .on('click', (e, d) => {
        if (!tileIsDefined(d)) return

        const element = select(e.target)
        if (element.attr('class')?.includes('selected')) {
          onClickTile([d], TileEventType.DESELECT)
        } else {
          onClickTile([d], TileEventType.SELECT)
        }
      })

    // Update the legend gradient def
    svg.select('#grad-start').attr('stop-color', colorScale(minScaleValue))
    svg.select('#grad-stop').attr('stop-color', colorScale(maxScaleValue))

    svg
      .select('.legend-content')
      .attr('x', width - margin.right + 8)
      .attr('y', margin.top)
      .attr('width', 40)
      .attr('height', height - margin.bottom - margin.top)
      .style('fill', 'url(#grad)')

    svg
      .select('.legend-content-min-label')
      .attr('font-size', 10)
      .attr('x', width - margin.right + 40 + 10)
      .attr('y', height - margin.bottom)
      .text(minScaleValue)

    svg
      .select('.legend-content-max-label')
      .attr('font-size', 10)
      .attr('x', width - margin.right + 40 + 10)
      .attr('y', margin.top + 10)
      .text(maxScaleValue.toString())

    // Title
    svg
      .select('.title')
      .attr('font-size', 16)
      .attr('x', '50%')
      .attr('y', margin.top - 75)
      .attr('text-anchor', 'middle')
      .text(title)
  }, [
    rowNames,
    colNames,
    data,
    title,
    onClickTile,
    onHoverTile,
    tileTooltip,
    tileRowName,
    tileColName,
    tileValue,
    tileIsDefined,
    height,
    width,
    minValue,
    minValueColor,
    maxValue,
    maxValueColor,
    tileSpacing,
    tileSelectBorderColor,
    tileSelectBorderWidth,
    margin,
  ])

  useEffect(() => {
    const svg = select(svgRef.current)
    const svgContent = svg.select('.content')

    const tileId = (t) => `${tileRowName(t)}:${tileColName(t)}`
    const ids = new Set(selectedTiles.map(tileId))

    svgContent
      .selectAll('rect')
      .attr('class', (d) => (ids.has(tileId(d)) ? 'selected' : null))
      .style('stroke', (d) => (ids.has(tileId(d)) ? tileSelectBorderColor : null))
      .style('stroke-width', (d) => (ids.has(tileId(d)) ? `${tileSelectBorderWidth}` : null))
      .style('opacity', (d) => (ids.has(tileId(d)) ? 1.0 : 0.8))
  }, [selectedTiles, tileSelectBorderColor, tileSelectBorderWidth, tileRowName, tileColName])

  return (
    <>
      <div ref={wrapperRef}>
        <svg ref={svgRef} height={height} width={width}>
          <defs>
            <clipPath id={id}>
              <rect x="0" y="0" width="100%" height="100%" />
            </clipPath>
            <linearGradient id="grad" x1="0%" x2="0%" y1="100%" y2="0%">
              <stop id="grad-start" offset="0%" />
              <stop id="grad-stop" offset="100%" />
            </linearGradient>
            <pattern
              id="missing-pattern"
              width={hatchPatternThickness}
              height={hatchPatternThickness}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect
                width={hatchPatternThickness / 2}
                height={hatchPatternThickness}
                fill="#2B2D2F"
                opacity={0.05}
              />
            </pattern>
          </defs>
          <text className="title" />
          <g className="content" clipPath={`url(#${id})`} />
          <g className="x-axis" />
          <g className="y-axis" />
          <g className="legend">
            <rect className="legend-content" />
            <text className="legend-content-min-label" />
            <text className="legend-content-max-label" />
          </g>
        </svg>
        <div className="tooltip" />
      </div>
    </>
  )
}

Heatmap.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  rowNames: PropTypes.arrayOf(PropTypes.string),
  colNames: PropTypes.arrayOf(PropTypes.string),
  selectedTiles: PropTypes.arrayOf(PropTypes.object),
  id: PropTypes.string,
  title: PropTypes.string,
  height: PropTypes.number,
  width: PropTypes.number,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
  minValueColor: PropTypes.string,
  maxValueColor: PropTypes.string,
  onClickTile: PropTypes.func,
  onHoverTile: PropTypes.func,
  tileTooltip: PropTypes.func,
  tileRowName: PropTypes.func,
  tileColName: PropTypes.func,
  tileIsDefined: PropTypes.func,
  tileValue: PropTypes.func,
  tileSpacing: PropTypes.number, // d3 expects a proportion between 0 and 1
  tileSelectBorderWidth: PropTypes.number,
  tileSelectBorderColor: PropTypes.string,
  margin: PropTypes.shape({
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    bottom: PropTypes.number,
  }),
}

Heatmap.defaultProps = {
  width: 500,
  height: 500,
  title: null,
  colNames: [],
  rowNames: [],
  selectedTiles: [],
  id: 'heatmap',
  minValue: null,
  maxValue: null,
  minValueColor: '#FFFFFF',
  maxValueColor: '#cc0000',
  tileSpacing: 0.01,
  tileSelectBorderWidth: 1,
  tileSelectBorderColor: '#1e1e1e',
  margin: { left: 100, right: 80, top: 100, bottom: 80 },
  onClickTile: () => {},
  onHoverTile: () => {},
  tileTooltip: (d) => d.value,
  tileRowName: (d) => d.row,
  tileColName: (d) => d.col,
  tileValue: (d) => d.value,
  tileIsDefined: () => true,
}

export default Heatmap
