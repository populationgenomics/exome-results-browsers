import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

import { ExternalLink } from '@gnomad/ui'

import { scaleLinear, zoom, select } from 'd3'

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
      if (scalePosition(gene.start) - scalePosition(lastGeneInRow.stop) > 30) {
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
  <ExternalLink href={`https://gnomad.broadinstitute.org/gene/${gene.symbol}`}>
    <text fill="#1173bb" textAnchor="middle">
      {gene.symbol}
    </text>
  </ExternalLink>
)

const GenesTrack = ({
  genes,
  margin,
  rowHeight,
  width,
  innerRegion,
  setInnerRegion,
  onChange,
  topPadding,
}) => {
  const svgGenes = useRef()

  const xScale = scaleLinear()
    .domain([innerRegion.start, innerRegion.stop])
    .range([0, width - margin.left - margin.right])

  const rows = layoutRows(genes, xScale)
  const innerHeight = rows.length * rowHeight + topPadding

  const innerWidth = width - margin.left - margin.right
  const height = innerHeight + margin.top + margin.bottom

  useEffect(() => {
    function updateChart(e) {
      setInnerRegion({
        chrom: innerRegion.chrom,
        start: e.transform.rescaleX(xScale).domain()[0],
        stop: e.transform.rescaleX(xScale).domain()[1],
      })
    }

    function Emit(e) {
      onChange({
        chrom: innerRegion.chrom,
        start: Math.round(e.transform.rescaleX(xScale).domain()[0]),
        stop: Math.round(e.transform.rescaleX(xScale).domain()[1]),
      })
    }

    const zoomBehaviour = zoom()
      // .scaleExtent([0.5, 20]) // This control how much you can unzoom (x0.5) and zoom (x20)
      .on('zoom', (e) => updateChart(e))
      .on('end', (e) => Emit(e)) // emit region update here

    zoomBehaviour(select(svgGenes.current))
  }, [xScale])

  return (
    <>
      <svg width={width} height={height} ref={svgGenes} style={{ cursor: 'move' }}>
        {/* <rect width={width} height={height} fill="none" stroke="black" /> */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <defs>
            <clipPath id="clip">
              <rect width={innerWidth} height={innerHeight} fill="none" pointerEvents="all" />
            </clipPath>
          </defs>
          {/* <rect width={innerWidth} height={innerHeight} fill="none" stroke="black" /> */}
          <g clipPath="url(#clip)">
            {rows.map((track, trackNumber) =>
              track.map((gene) => {
                const labelY = rowHeight * trackNumber + 33
                const featuresYPosition = rowHeight * trackNumber + 8
                const geneStart = xScale(gene.start)
                const geneStop = xScale(gene.stop)
                return (
                  <g key={gene.gene_id} transform={`translate(0, ${topPadding})`}>
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
    </>
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
  rowHeight: PropTypes.number,
  width: PropTypes.number,
  innerRegion: PropTypes.shape({
    chrom: PropTypes.string.isRequired,
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  topPadding: PropTypes.number,
  setInnerRegion: PropTypes.func.isRequired,
}

GenesTrack.defaultProps = {
  topPadding: 20,
  width: 200,
  rowHeight: 50,
  margin: { left: 60, right: 40, top: 20, bottom: 60 },
}

export default GenesTrack
