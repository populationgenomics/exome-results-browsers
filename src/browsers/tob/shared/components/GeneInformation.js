import React from 'react'
import PropTypes from 'prop-types'

const GeneInformation = ({ data }) => {
  return (
    data && (
      <>
        <ul style={{ listStyleType: 'none' }}>
          <li>
            <b>Genome Build</b> GRCh37 | hg19
          </li>
          <li>
            <b>Ensembl Gene ID</b> {data.gene_id}
          </li>
          <li>
            <b>Ensembl canonical transcript</b> {data.canonical_transcript_id}
          </li>
          <li>
            <b>Other transcripts</b> ?
          </li>
          <li>
            <b>Region</b> {data.chrom}:{data.start}-{data.stop}
          </li>
          <li>
            <b>External Resources</b>{' '}
            <a
              href={`https://grch37.ensembl.org/id/${data.gene_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Ensembl
            </a>{' '}
            <a
              href={`http://genome.ucsc.edu/cgi-bin/hgTracks?db=hg19&position=chr${data.chrom}:${data.start}-${data.stop}`}
              target="_blank"
              rel="noreferrer"
            >
              USCS Browser
            </a>
          </li>
        </ul>
      </>
    )
  )
}

GeneInformation.propTypes = {
  data: PropTypes.shape({
    gene_id: PropTypes.string,
    canonical_transcript_id: PropTypes.string,
    chrom: PropTypes.string,
    start: PropTypes.number,
    stop: PropTypes.number,
  }).isRequired,
}

export default GeneInformation
