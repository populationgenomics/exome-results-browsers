import React, { useMemo } from 'react'
import PropTypes from 'prop-types'

import { Link } from '@gnomad/ui'

import { scaleLinear } from 'd3'

const DEFAULT_MARGIN = { left: 10, right: 10, top: 10, bottom: 10 }

const layoutRows = (genes, scalePosition) => {
  if (genes.length === 0) {
    return []
  }

  const sortedGenes = [...genes].sort((gene1, gene2) => gene1.start - gene2.start)

  const rows = [[sortedGenes[0]]]

  for (let i = 1; i < sortedGenes.length; i += 1) {
    const gene = sortedGenes[i]

    let newRow = true
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const lastGeneInRow = rows[rowIndex][rows[rowIndex].length - 1]
      if (scalePosition(gene.start) - scalePosition(lastGeneInRow.stop) > 100) {
        //! Change this number to increase spacing between gene track elements.
        rows[rowIndex].push(gene)
        newRow = false
        break
      }
    }

    if (newRow) {
      rows.push([gene])
    }
  }

  return rows
}

const featureAttributes = {
  exon: {
    fill: '#bdbdbd',
    height: 6,
  },
  CDS: {
    fill: '#424242',
    height: 16,
  },
  UTR: {
    fill: '#424242',
    height: 6,
  },
  start_codon: {
    fill: '#424242',
    height: 4,
  },
  stop_codon: {
    fill: '#424242',
    height: 4,
  },
}

const featureTypeOrder = {
  exon: 0,
  UTR: 1,
  CDS: 2,
  start_codon: 3,
  stop_codon: 4,
}

const featureTypeCompareFn = (r1, r2) =>
  featureTypeOrder[r1.feature_type] - featureTypeOrder[r2.feature_type]

const renderGeneLabel = (gene) => (
  <Link href={`/gene/${gene.gene_id}`}>
    <text fill="#1173bb" textAnchor="middle">
      {gene.symbol}
    </text>
  </Link>
)

const GenesTrack = ({ region, genes, width, rowHeight, margin }) => {
  const _margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...margin }), [margin])
  const innerWidth = useMemo(
    () => width - _margin.left - _margin.right,
    [width, _margin.left, _margin.right]
  )

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([region.start, region.stop])
        .range([0, width - _margin.left - _margin.right]),
    [region.start, region.stop, width, _margin.left, _margin.right]
  )

  const rows = layoutRows(genes, xScale)
  const innerHeight = rows.length * rowHeight + _margin.top
  const height = innerHeight + _margin.top + _margin.bottom

  return (
    <svg width={width} height={height}>
      {/* <rect width={width} height={height} fill="none" stroke="black" /> */}
      <g transform={`translate(${_margin.left}, ${_margin.top})`}>
        <defs>
          <clipPath id="clipGeneTrack">
            <rect width={innerWidth} height={innerHeight} fill="none" pointerEvents="all" />
          </clipPath>
        </defs>
        {/* <rect width={innerWidth} height={innerHeight} fill="none" stroke="black" /> */}
        <g clipPath="url(#clipGeneTrack)">
          {rows.map((track, trackNumber) =>
            track.map((gene) => {
              const labelY = rowHeight * trackNumber + 33
              const featuresYPosition = rowHeight * trackNumber + 8
              const geneStart = xScale(gene.start)
              const geneStop = xScale(gene.stop)
              return (
                <g key={gene.gene_id} transform={`translate(0, ${_margin.top})`}>
                  <g transform={`translate(${(geneStart + geneStop) / 2},${labelY})`}>
                    {renderGeneLabel(gene)}
                  </g>
                  <line
                    x1={geneStart}
                    x2={geneStop}
                    y1={featuresYPosition}
                    y2={featuresYPosition}
                    stroke="#424242"
                    strokeWidth={1}
                  />
                  {[...(gene.canonical_transcript?.features || [])]
                    .sort(featureTypeCompareFn)
                    .map((f) => {
                      const featureStart = xScale(f.start)
                      const featureStop = xScale(f.stop)
                      const { fill, height: featureHeight } = featureAttributes[f.feature_type]
                      return (
                        <rect
                          key={`${gene.gene_id}-${f.feature_type}-${f.start}-${f.stop}`}
                          x={featureStart}
                          y={rowHeight * trackNumber + (16 - featureHeight) / 2}
                          width={featureStop - featureStart}
                          height={featureHeight}
                          fill={fill}
                          stroke={fill}
                        />
                      )
                    })}
                </g>
              )
            })
          )}
        </g>
      </g>
    </svg>
  )
}

GenesTrack.propTypes = {
  genes: PropTypes.arrayOf(PropTypes.object).isRequired,
  margin: PropTypes.shape({
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    bottom: PropTypes.number,
  }),
  region: PropTypes.shape({
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }).isRequired,
  width: PropTypes.number,
  rowHeight: PropTypes.number,
}

GenesTrack.defaultProps = {
  width: 1000,
  rowHeight: 60,
  margin: { ...DEFAULT_MARGIN },
}

export default GenesTrack
