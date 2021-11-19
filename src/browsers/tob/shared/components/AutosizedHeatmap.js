import React from 'react'
import PropTypes from 'prop-types'

import styled from 'styled-components'
import { withSize } from 'react-sizeme'

import Heatmap from './Heatmap'

const HeatmapWrapper = ({ results, ...otherProps }) => {
  return <Heatmap {...otherProps} data={results} />
}

HeatmapWrapper.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedHeatmap = withSize()(({ size, ...otherProps }) => {
  const height = Math.min(800, 2 * (otherProps.rowNames?.length || 1))
  return (
    <Wrapper>
      {Boolean(size.width) && <HeatmapWrapper height={height} width={size.width} {...otherProps} />}
    </Wrapper>
  )
})

export { TileEventType } from './Heatmap'
export default AutosizedHeatmap
