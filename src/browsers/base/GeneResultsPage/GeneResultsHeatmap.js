import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { minBy, maxBy } from 'lodash'
import { withSize } from 'react-sizeme'
import {
  scaleBand,
  select,
  axisBottom,
  axisLeft,
  scaleSequential,
  interpolateRgb,
  scaleLinear,
} from 'd3'

const margin = { left: 80, right: 80, top: 40, bottom: 80 }

const GeneResultsHeatmap = ({
  rowLabels,
  columnLabels,
  data,
  onClickTile,
  onHoverTile,
  renderTooltip,
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
}) => {
  const svgRef = useRef()
  const wrapperRef = useRef()

  useEffect(() => {
    const svg = select(svgRef.current)
    const svgContent = svg.select('.content')

    const minScaleValue = minValue == null ? minBy(data, (d) => d.value).value : minValue
    const maxScaleValue = maxValue == null ? maxBy(data, (d) => d.value).value : maxValue

    const xScale = scaleBand()
      .range([margin.left, width - margin.right])
      .domain(columnLabels)
      .padding(tileSpacing)
    const yScale = scaleBand()
      .range([height - margin.bottom, margin.top])
      .domain(rowLabels)
      .padding(tileSpacing)

    const colorScale = scaleSequential()
      .interpolator(interpolateRgb(minValueColor, maxValueColor))
      .domain([minScaleValue, maxScaleValue])
      .range([minValueColor, maxValueColor])

    const Tooltip = select(wrapperRef.current).select('.tooltip')

    Tooltip.style('opacity', 0)
      .attr('class', 'tooltip-active')
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '1px')
      .style('border-radius', '5px')
      .style('padding', '5px')
      .style('position', 'absolute')

    function mouseOver() {
      Tooltip.style('opacity', 1)
      select(this)
        .style('stroke', tileSelectBorderColor)
        .style('stroke-width', `${tileSelectBorderWidth}`)
        .style('opacity', 1)
    }
    function mouseMove(_, d) {
      onHoverTile(d)
      Tooltip.html(renderTooltip(d))
        .style('opacity', 1)
        .style('left', `${xScale(d.col)}px`)
        .style('top', `${yScale(d.row) - 30}px`)
    }
    function mouseLeave() {
      Tooltip.style('opacity', 0)
      select(this).style('stroke', 'none').style('opacity', 0.8)
    }
    function mouseClick(_, d) {
      onClickTile(d)
    }

    // Clear content for re-draw so rectangles aren't drawn over each other.
    svgContent.selectAll('rect').remove()
    svgContent
      .selectAll()
      .data(data, (d) => `${d.col}:${d.row}`)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.col))
      .attr('y', (d) => yScale(d.row))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', (d) => colorScale(d.value))
      .style('stroke-width', 4)
      .style('stroke', 'none')
      .style('opacity', 0.8)
      .on('mouseover', mouseOver)
      .on('mousemove', mouseMove)
      .on('mouseleave', mouseLeave)
      .on('click', mouseClick)

    // Update the legend gradient def
    svg.select('#grad-start').attr('stop-color', colorScale(minScaleValue))
    svg.select('#grad-stop').attr('stop-color', colorScale(maxScaleValue))

    svg
      .select('.legend-content')
      .attr('x', width - margin.right + 8)
      .attr('y', margin.top)
      .attr('width', 40)
      .attr('height', height - margin.bottom * 1.5)
      .style('fill', 'url(#grad)')

    svg
      .select('.legend-content-min-label')
      .attr('font-size', 10)
      .attr('x', width - margin.right + 40 + 10)
      .attr('y', height - margin.bottom)
      .text(minScaleValue)

    svg
      .select('.legend-content-mid-label')
      .attr('font-size', 10)
      .attr('x', width - margin.right + 40 + 10)
      .attr('y', (height - margin.bottom) / 2)
      .text(((minScaleValue + maxScaleValue) / 2).toString())

    svg
      .select('.legend-content-max-label')
      .attr('font-size', 10)
      .attr('x', width - margin.right + 40 + 10)
      .attr('y', margin.top + 10)
      .text(maxScaleValue.toString())

    const xAxis = axisBottom(xScale)
    svg
      .select('.x-axis')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)

    const yAxis = axisLeft(yScale)
    svg.select('.y-axis').attr('transform', `translate(${margin.left}, 0)`).call(yAxis)
  }, [
    rowLabels,
    columnLabels,
    data,
    onClickTile,
    onHoverTile,
    renderTooltip,
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
  ])

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
          </defs>
          <g className="content" clipPath={`url(#${id})`} />
          <g className="x-axis" />
          <g className="y-axis" />
          <g className="legend">
            <rect className="legend-content" />
            <text className="legend-content-min-label" />
            <text className="legend-content-mid-label" />
            <text className="legend-content-max-label" />
          </g>
        </svg>
        <div className="tooltip" />
      </div>
    </>
  )
}

GeneResultsHeatmap.propTypes = {
  columnLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
  rowLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      row: PropTypes.string.isRequired,
      col: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    })
  ).isRequired,
  id: PropTypes.string,
  height: PropTypes.number,
  width: PropTypes.number,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
  minValueColor: PropTypes.string,
  maxValueColor: PropTypes.string,
  onClickTile: PropTypes.func,
  onHoverTile: PropTypes.func,
  renderTooltip: PropTypes.func,
  tileSpacing: PropTypes.number,
  tileSelectBorderWidth: PropTypes.number,
  tileSelectBorderColor: PropTypes.string,
}

GeneResultsHeatmap.defaultProps = {
  height: 800,
  width: 500,
  id: 'gene-results-heatmap',
  minValue: null,
  maxValue: null,
  minValueColor: '#FFFFFF',
  maxValueColor: '#6C010E',
  tileSpacing: 0,
  tileSelectBorderWidth: 4,
  tileSelectBorderColor: '#FF0000',
  onClickTile: () => {},
  onHoverTile: () => {},
  renderTooltip: (d) => d.value.toFixed(4),
}

const Wrapper = styled.div`
  overflow: visible;
  width: 100%;
`

const AutosizedGeneResultsHeatmap = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <GeneResultsHeatmap width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedGeneResultsHeatmap
