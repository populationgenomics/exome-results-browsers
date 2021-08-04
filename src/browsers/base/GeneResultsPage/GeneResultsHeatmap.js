import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { withSize } from 'react-sizeme'

const GeneResultsHeatmap = ({
  height,
  width,
  id,
  onClickCell,
  columnLabels,
  rowLabels,
  cellData,
}) => {
  const svgRef = useRef()
  const wrapperRef = useRef()

  useEffect(() => {}, [cellData, columnLabels, rowLabels, onClickCell])

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
      </div>
    </>
  )
}

GeneResultsHeatmap.propTypes = {
  height: PropTypes.number,
  width: PropTypes.number,
  id: PropTypes.string,
  onClickCell: PropTypes.func.isRequired,
  columnLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
  rowLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
  cellData: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
}

GeneResultsHeatmap.defaultProps = {
  height: 500,
  width: 500,
  id: 'gene-results-heatmap',
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedGeneResultsHeatmap = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <GeneResultsHeatmap height={500} width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedGeneResultsHeatmap
