import React from 'react'
import PropTypes from 'prop-types'

import { withSize } from 'react-sizeme'
import styled from 'styled-components'

import Umap from './Umap'

const UmapPlotWrapper = ({ results, ...otherProps }) => {
  return <Umap data={results} {...otherProps} />
}

UmapPlotWrapper.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedUmapPlot = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <UmapPlotWrapper height={800} width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedUmapPlot
