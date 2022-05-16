import React from 'react'
import PropTypes from 'prop-types'

import { ExternalLink } from '@gnomad/ui'

import AttributeList from './AttributeList'

const VariantInformation = ({ variant, referenceGenome }) => {
  const ucscReferenceGenomeId = referenceGenome?.toLowerCase() === 'grch37' ? 'hg19' : 'hg38'
  const ucscUrl = `https://genome.ucsc.edu/cgi-bin/hgTracks?db=${ucscReferenceGenomeId}&position=chr${
    variant.chrom
  }%3A${variant.bp - 100}-${variant.bp + 100}`

  const gnomadUrl = `https://gnomad.broadinstitute.org/variant/${variant.chrom}-${variant.bp}-${variant.a1}-${variant.a2}?dataset=gnomad_r3`
  const dbsnpUrl = `https://www.ncbi.nlm.nih.gov/snp/${variant.rsid}`

  return (
    variant && (
      <AttributeList style={{ marginTop: '1.25em' }}>
        <AttributeList.Item label="Genome Build">{referenceGenome}</AttributeList.Item>
        <AttributeList.Item label="Variant ID">{variant.variant_id}</AttributeList.Item>
        <AttributeList.Item label="Reference allele">{variant.a1}</AttributeList.Item>
        <AttributeList.Item label="Alternative allele">{variant.a2}</AttributeList.Item>
        <AttributeList.Item label="Frequency in Onek1k">
          {variant.a2_freq_onek1k}
        </AttributeList.Item>
        <AttributeList.Item label="Frequency in HRC">{variant.a2_freq_hrc}</AttributeList.Item>
        <AttributeList.Item label="Region">
          {variant.chrom}:{Math.max(1, variant.bp - 1e6)}-{variant.bp + 1e6}
        </AttributeList.Item>
        <AttributeList.Item label="External resources">
          <ExternalLink href={ucscUrl}>UCSC Browser</ExternalLink>,{' '}
          <ExternalLink href={gnomadUrl}>gnomAD</ExternalLink>,{' '}
          <ExternalLink href={dbsnpUrl}>dbSNP</ExternalLink>
        </AttributeList.Item>
      </AttributeList>
    )
  )
}

VariantInformation.propTypes = {
  variant: PropTypes.shape({
    variant_id: PropTypes.string,
    rsid: PropTypes.string,
    chrom: PropTypes.string,
    bp: PropTypes.number,
    a1: PropTypes.string,
    a2: PropTypes.string,
    a2_freq_onek1k: PropTypes.number,
    a2_freq_hrc: PropTypes.number,
  }).isRequired,
  referenceGenome: PropTypes.string,
}

VariantInformation.defaultProps = { referenceGenome: 'GRCh37' }

export default VariantInformation
