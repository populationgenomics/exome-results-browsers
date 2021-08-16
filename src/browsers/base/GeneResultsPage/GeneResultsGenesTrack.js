import React from 'react'
import PropTypes from 'prop-types'

import { withSize } from 'react-sizeme'
import styled from 'styled-components'

import { ExternalLink } from '@gnomad/ui'

import { RegionViewer } from '@gnomad/region-viewer'
import { GenesTrack } from '@gnomad/track-genes'

const GeneResultsGenesTrack = ({ genes, regions, ...otherProps }) => (
  <RegionViewer padding={0} regions={regions} {...otherProps}>
    <GenesTrack
      title={null}
      genes={genes}
      renderGeneLabel={(gene) => (
        <ExternalLink href={`https://gnomad.broadinstitute.org/gene/${gene.symbol}`}>
          <text fill="#1173bb" textAnchor="middle">
            {gene.symbol}
          </text>
        </ExternalLink>
      )}
    />
  </RegionViewer>
)

GeneResultsGenesTrack.propTypes = {
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
  regions: PropTypes.arrayOf(
    PropTypes.shape({
      chrom: PropTypes.string,
      start: PropTypes.number,
      stop: PropTypes.number,
      feature_type: PropTypes.string,
    })
  ).isRequired,
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedGeneResultsGenesTrack = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && (
      <GeneResultsGenesTrack height={500} width={size.width} {...otherProps} />
    )}
  </Wrapper>
))

export default AutosizedGeneResultsGenesTrack
