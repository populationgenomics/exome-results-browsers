import PropTypes from 'prop-types'
import React, { useEffect, useState, useRef } from 'react'
import { withSize } from 'react-sizeme'
import styled from 'styled-components'
import { TooltipAnchor } from '@gnomad/ui'

import lodash from 'lodash'
import { scaleLinear, extent, zoom, select, axisBottom, axisLeft } from 'd3'
import { border, margin } from 'polished'

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

const margins = { left: 20, right: 20, top: 20, bottom: 20 }

const GeneResultsUmapPlot = ({
  height,
  width,
  id,
  embedding,
  labels,
  labelColors,
  ...otherProps
}) => {
  const svgRef = useRef()
  const wrapperRef = useRef()
  const [currentZoomState, setCurrentZoomState] = useState()
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const svg = select(svgRef.current)
    const svgContent = svg.select('.content')

    const xScale = scaleLinear()
      .domain(extent(embedding.map((d) => d[0])))
      .range([margins.left, width - margins.right])
      .nice()
    const yScale = scaleLinear()
      .domain(extent(embedding.map((d) => d[1])))
      .range([margins.top, height - margins.bottom])
      .nice()

    if (currentZoomState) {
      xScale.domain(currentZoomState.rescaleX(xScale).domain())
      yScale.domain(currentZoomState.rescaleY(yScale).domain())
    }

    const datasets = lodash.groupBy(lodash.zip(labels, embedding), (tuple) => tuple[0])
    const colourKeys = lodash.keys(datasets)

    const Tooltip = select(wrapperRef.current).select('.tooltip')

    Tooltip.style('opacity', 0)
      .attr('class', 'tooltip')
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '2px')
      .style('border-radius', '5px')
      .style('padding', '5px')
      .style('position', 'absolute')

    svgContent
      .selectAll('.mydot')
      .data(embedding)
      .join('circle')
      .attr('class', 'mydot')
      .attr('r', 5)
      .attr('cx', (d) => xScale(d[0]))
      .attr('cy', (d) => yScale(d[1]))
      .attr('fill-opacity', (d, i) => (labels[i] === hover ? 1 : 0.3))
      .attr('fill', (d, i) => labelColors[colourKeys.indexOf(labels[i])])
      .on('mouseover', (e, d) => {
        setHover(labels[embedding.indexOf(d)])
        Tooltip.style('opacity', 1)
      })
      .on('mouseleave', () => {
        setHover(null)
        Tooltip.style('opacity', 0)
      })
      .on('mousemove', (e, d) => {
        Tooltip.html(labels[embedding.indexOf(d)])
          .style('opacity', 1)
          .style('left', `${xScale(d[0])}px`)
          .style('top', `${yScale(d[1]) + 10}px`)
      })

    const xAxis = axisBottom(xScale)
    svg
      .select('.x-axis')
      .attr('transform', `translate(0, ${height - 30})`)
      .call(xAxis)

    const yAxis = axisLeft(yScale)
    svg.select('.y-axis').attr('transform', `translate(30, 0)`).call(yAxis)

    // zoom
    const zoomBehaviour = zoom()
      .scaleExtent([0.5, 5])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (e) => {
        setCurrentZoomState(e.transform)
      })
    svg.call(zoomBehaviour)
  }, [currentZoomState, embedding, labels, hover])

  return (
    <>
      <div ref={wrapperRef}>
        <svg ref={svgRef} height={height} width={width} style={{ border: '1px solid black' }}>
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

GeneResultsUmapPlot.propTypes = {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  id: PropTypes.string,
  embedding: PropTypes.arrayOf(PropTypes.array).isRequired,
  labels: PropTypes.arrayOf(PropTypes.string).isRequired,
  labelColors: PropTypes.arrayOf(PropTypes.string),
}

GeneResultsUmapPlot.defaultProps = {
  id: 'gene-results-umap-plot',
  labelColors: [...DEFAULT_COLORS],
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedGeneResultsUmapPlot = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <GeneResultsUmapPlot height={500} width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedGeneResultsUmapPlot
