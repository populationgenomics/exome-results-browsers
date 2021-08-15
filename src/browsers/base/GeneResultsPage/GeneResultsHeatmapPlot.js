import React from 'react'
import PropTypes from 'prop-types'

import styled from 'styled-components'
import { withSize } from 'react-sizeme'

import Heatmap from '../components/Heatmap'

const GeneResultsHeatmapPlot = ({ results, ...otherProps }) => {
  return <Heatmap {...otherProps} data={results} />
}

GeneResultsHeatmapPlot.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

export const AutosizedGeneResultsHeatmapPlot = withSize()(({ size, ...otherProps }) => {
  const height = Math.min(800, 240 * (otherProps.rowNames?.length || 1))
  return (
    <Wrapper>
      {Boolean(size.width) && (
        <GeneResultsHeatmapPlot height={height} width={size.width} {...otherProps} />
      )}
    </Wrapper>
  )
})

export default AutosizedGeneResultsHeatmapPlot
