import React from 'react'
import PropTypes from 'prop-types'

import { ExternalLink } from '@gnomad/ui'

import AttributeList from './AttributeList'

const GeneInformation = ({ gene, referenceGenome }) => {
  const ensemblGeneUrl = `https://${
    referenceGenome?.toLowerCase() === 'grch37' ? 'grch37.' : ''
  }ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.gene_id}`

  const ucscReferenceGenomeId = referenceGenome?.toLowerCase() === 'grch37' ? 'hg19' : 'hg38'
  const ucscUrl = `https://genome.ucsc.edu/cgi-bin/hgTracks?db=${ucscReferenceGenomeId}&position=chr${gene.chrom}%3A${gene.start}-${gene.stop}`

  return (
    gene && (
      <AttributeList style={{ marginTop: '1.25em' }}>
        <AttributeList.Item label="Genome Build">{referenceGenome}</AttributeList.Item>

        <AttributeList.Item label="Ensembl Gene ID">{gene.gene_id}</AttributeList.Item>

        <AttributeList.Item label="Ensembl canonical transcript">
          {gene.canonical_transcript_id}
        </AttributeList.Item>

        <AttributeList.Item label="Region">
          {gene.chrom}:{gene.start}-{gene.stop}
        </AttributeList.Item>

        <AttributeList.Item label="External resources">
          <ExternalLink href={ensemblGeneUrl}>Ensembl</ExternalLink>,{' '}
          <ExternalLink href={ucscUrl}>UCSC Browser</ExternalLink>,{' '}
          <ExternalLink href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene.symbol}`}>
            GeneCards
          </ExternalLink>
        </AttributeList.Item>
      </AttributeList>
    )
  )
}

GeneInformation.propTypes = {
  gene: PropTypes.shape({
    gene_id: PropTypes.string,
    symbol: PropTypes.string,
    canonical_transcript_id: PropTypes.string,
    chrom: PropTypes.string,
    start: PropTypes.number,
    stop: PropTypes.number,
  }).isRequired,
  referenceGenome: PropTypes.string,
}

GeneInformation.defaultProps = {
  referenceGenome: 'GRCh37',
}

export default GeneInformation
