import React from 'react'
import PropTypes from 'prop-types'

import { withSize } from 'react-sizeme'
import styled from 'styled-components'

// import { ExternalLink } from '@gnomad/ui'

// import { RegionViewer } from '@gnomad/region-viewer'
// import { GenesTrack } from '@gnomad/track-genes'

import GenesTrack from './GenesTrack'

const GenesTrackWrapper = ({ genes, region, ...otherProps }) => {
  return <GenesTrack genes={genes} region={region} {...otherProps} />
}

GenesTrackWrapper.propTypes = {
  genes: PropTypes.arrayOf(
    PropTypes.shape({
      geneId: PropTypes.string,
      symbol: PropTypes.string,
      chrom: PropTypes.string,
      start: PropTypes.number,
      stop: PropTypes.number,
      exons: PropTypes.arrayOf(
        PropTypes.shape({
          start: PropTypes.number,
          stop: PropTypes.number,
          feature_type: PropTypes.string,
        })
      ),
    })
  ).isRequired,
  region: PropTypes.shape({
    chrom: PropTypes.string.isRequired,
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }).isRequired,
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedGenesTrack = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <GenesTrackWrapper width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedGenesTrack
