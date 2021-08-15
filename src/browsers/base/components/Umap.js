import PropTypes from 'prop-types'
import React, { useEffect, useState, useRef } from 'react'

import { scaleLinear, extent, zoom, interpolateRound, select, axisBottom, axisLeft } from 'd3'

const DEFAULT_COLORS = [
  '#332288',
  '#6699cc',
  '#88ccee',
  '#44aa99',
  '#117733',
  '#999933',
  '#ddcc77',
  '#661100',
  '#cc6677',
  '#aa4466',
  '#882255',
  '#aa4499',
]

const Umap = ({
  height,
  width,
  id,
  data,
  pointColor,
  pointLabel,
  pointX,
  pointY,
  labelColors,
  margin,
}) => {
  const svgRef = useRef()
  const wrapperRef = useRef()

  const [plotNodes, setPlotNodes] = useState(null)
  const [highlightLabel, setHighlightLabel] = useState(null)

  useEffect(() => {
    const svg = select(svgRef.current)
    const svgContent = svg.select('.content')

    const newXScale = scaleLinear()
      .domain(extent(data.map(pointX)))
      .range([margin.left, width - margin.right])
      .nice()

    const newYScale = scaleLinear()
      .domain(extent(data.map(pointY)))
      .range([margin.top, height - margin.bottom])
      .nice()

    const allLabels = Array.from(new Set(data.map(pointLabel)))
    const labelToColor = allLabels.reduce((map, label, index) => {
      const color = index < labelColors.length ? labelColors[index] : '#1e1e1e'
      return { ...map, [label]: color }
    })

    const Tooltip = select(wrapperRef.current).select('.tooltip')

    Tooltip.style('opacity', 0)
      .attr('class', 'tooltip')
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '1px')
      .style('border-radius', '5px')
      .style('padding', '5px')
      .style('position', 'absolute')

    svgContent.selectAll('.point').remove() // Clear canvas
    const nodes = svgContent
      .selectAll('.point')
      .data(data)
      .join('circle')
      .attr('class', '.point')
      .attr('r', 5)
      .attr('cx', (d) => newXScale(pointX(d)))
      .attr('cy', (d) => newYScale(pointY(d)))
      .attr('fill', (d) => (pointColor ? pointColor(d) : labelToColor[pointLabel(d)]))
      .attr('fill-opacity', (d) => (pointLabel(d) === highlightLabel ? 1 : 0.3))
      .on('mouseover', (_, d) => {
        setHighlightLabel(pointLabel(d))
        Tooltip.style('opacity', 1)
      })
      .on('mouseleave', () => {
        setHighlightLabel(null)
        Tooltip.style('opacity', 0)
      })
      .on('mousemove', (_, d) => {
        Tooltip.html(pointLabel(d))
          .style('opacity', 1)
          .style('left', `${newXScale(pointX(d))}px`)
          .style('top', `${newYScale(pointY(d)) + 10}px`)
      })
    setPlotNodes(nodes)

    // see https://observablehq.com/@d3/zoomable-scatterplot

    const newXAxis = axisBottom(newXScale)
    svg
      .select('.x-axis')
      .attr('transform', `translate(0, ${height - margin.top + 5})`)
      .call(newXAxis)

    const newYAxis = axisLeft(newYScale)
    svg
      .select('.y-axis')
      .attr('transform', `translate(${margin.left + 5}, 0)`)
      .call(newYAxis)

    const zoomBehaviour = zoom()
      .scaleExtent([0.5, 5])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (e) => {
        const zx = e.transform.rescaleX(newXScale).interpolate(interpolateRound)
        const zy = e.transform.rescaleY(newYScale).interpolate(interpolateRound)
        svg
          .select('.x-axis')
          .attr('transform', `translate(0, ${height - margin.top + 5})`)
          .call(zx)
        svg
          .select('.y-axis')
          .attr('transform', `translate(${margin.left + 5}, 0)`)
          .call(zy)
      })
    svg.call(zoomBehaviour)
  }, [data, pointX, pointY, pointColor, pointLabel])

  useEffect(() => {
    if (plotNodes) {
      plotNodes.style('fill-opacity', (d) => (pointLabel(d) === highlightLabel ? 1 : 0.3))
    }
  }, [highlightLabel, plotNodes])

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
        </svg>
        <div className="tooltip" />
      </div>
    </>
  )
}

Umap.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  pointColor: PropTypes.func,
  pointX: PropTypes.func,
  pointY: PropTypes.func,
  pointLabel: PropTypes.func,
  labelColors: PropTypes.arrayOf(PropTypes.string),
  height: PropTypes.number,
  width: PropTypes.number,
  id: PropTypes.string,
  margin: PropTypes.shape({
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    bottom: PropTypes.number,
  }),
}

Umap.defaultProps = {
  height: 500,
  width: 500,
  id: 'umap',
  labelColors: [...DEFAULT_COLORS],
  margin: { left: 40, right: 40, top: 40, bottom: 40 },
  pointColor: null,
  pointX: (d) => d.x,
  pointY: (d) => d.y,
  pointLabel: (d) => d.label,
}

export default Umap
