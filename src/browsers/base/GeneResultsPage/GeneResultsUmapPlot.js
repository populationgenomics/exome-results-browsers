import React from 'react'
import PropTypes from 'prop-types'

import { withSize } from 'react-sizeme'
import styled from 'styled-components'

import Umap from '../components/Umap'

const GeneResultsUmapPlot = ({ results, ...otherProps }) => {
  return <Umap data={results} {...otherProps} />
}

GeneResultsUmapPlot.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedGeneResultsUmapPlot = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <GeneResultsUmapPlot height={800} width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedGeneResultsUmapPlot
