import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
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
  height,
  width,
  id,
  onClickCell,
  columnLabels,
  rowLabels,
  cellData,
  minValue,
  minValueColor,
  maxValue,
  maxValueColor,
  tileSpacing,
  tileSelectBorderColor,
  tileSelectBorderWidth,
}) => {
  const newCellData = cellData
    .map((d, i) => {
      return d.map((e, j) => {
        return { xValue: columnLabels[j], yValue: rowLabels[i], pValue: e }
      })
    })
    .flat()
  const svgRef = useRef()
  const wrapperRef = useRef()

  useEffect(() => {
    const svg = select(svgRef.current)
    const svgContent = svg.select('.content')

    const xScale = scaleBand()
      .range([margin.left, width - margin.right])
      .domain(columnLabels)
      .padding(tileSpacing)
    const yScale = scaleBand()
      .range([height - margin.bottom, margin.top])
      .domain(rowLabels)
      .padding(tileSpacing)

    const legendScale = scaleLinear().domain([minValue, maxValue])

    const colourScale = scaleSequential()
      .interpolator(interpolateRgb(minValueColor, maxValueColor))
      .domain([minValue, maxValue])

    const Tooltip = select(wrapperRef.current).select('.tooltip')

    Tooltip.style('opacity', 0)
      .attr('class', 'tooltip')
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '2px')
      .style('border-radius', '5px')
      .style('padding', '5px')
      .style('position', 'absolute')

    const mouseover = function MouseOver() {
      Tooltip.style('opacity', 1)
      select(this)
        .style('stroke', tileSelectBorderColor)
        .style('stroke-width', `${tileSelectBorderWidth}`)
        .style('opacity', 1)
    }
    const mousemove = function mouseMove(e, d) {
      Tooltip.html(+d.pValue.toFixed(10))
        .style('opacity', 1)
        .style('left', `${xScale(d.xValue)}px`)
        .style('top', `${yScale(d.yValue) - 30}px`)
    }
    const mouseleave = function MouseLeave() {
      Tooltip.style('opacity', 0)
      select(this).style('stroke', 'none').style('opacity', 0.8)
    }

    svgContent
      .selectAll()
      .data(newCellData, (d) => `${d.xValue}:${d.yValue}`)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.xValue))
      .attr('y', (d) => yScale(d.yValue))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', (d) => colourScale(d.pValue))
      .style('stroke-width', 4)
      .style('stroke', 'none')
      .style('opacity', 0.8)
      .on('mouseover', mouseover)
      .on('mousemove', mousemove)
      .on('mouseleave', mouseleave)

    const legend = svg
      .select('.legend')
      .selectAll()
      .data(legendScale.ticks())
      .enter()
      .append('g')
      .attr(
        'transform',
        (d, i) => `translate(${width - margin.right + 10}, ${margin.top + i * 20})`
      )

    legend
      .append('rect')
      .attr('width', 40)
      .attr('height', 20)
      .attr('fill', (d) => colourScale(legendScale(d)))

    legend
      .append('text')
      .attr('font-size', 10)
      .attr('x', 45)
      .attr('y', 10)
      .text(String)
      .attr('alignment-baseline', 'middle')

    const xAxis = axisBottom(xScale)
    svg
      .select('.x-axis')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)

    const yAxis = axisLeft(yScale)
    svg.select('.y-axis').attr('transform', `translate(${margin.left}, 0)`).call(yAxis)
  }, [cellData, columnLabels, rowLabels, onClickCell])

  return (
    <>
      <div ref={wrapperRef}>
        <svg ref={svgRef} height={height} width={width}>
          <defs>
            <clipPath id={id}>
              <rect x="0" y="0" width="100%" height="100%" />
            </clipPath>
          </defs>
          <g className="content" clipPath={`url(#${id})`} />
          <g className="x-axis" />
          <g className="y-axis" />
          <g className="legend" />
        </svg>
        <div className="tooltip" />
      </div>
    </>
  )
}

GeneResultsHeatmap.propTypes = {
  height: PropTypes.number,
  width: PropTypes.number,
  id: PropTypes.string,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
  minValueColor: PropTypes.string,
  maxValueColor: PropTypes.string,
  onClickCell: PropTypes.func.isRequired,
  columnLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
  rowLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
  cellData: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  tileSpacing: PropTypes.number,
  tileSelectBorderWidth: PropTypes.number,
  tileSelectBorderColor: PropTypes.string,
}

GeneResultsHeatmap.defaultProps = {
  height: 800,
  width: 500,
  id: 'gene-results-heatmap',
  minValue: 0,
  maxValue: 1,
  minValueColor: '#FFFFFF',
  maxValueColor: '#6C010E',
  tileSpacing: 0,
  tileSelectBorderWidth: 1,
  tileSelectBorderColor: '#FF0000',
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedGeneResultsHeatmap = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <GeneResultsHeatmap height={800} width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedGeneResultsHeatmap
