import React, { useState, useCallback } from 'react'

import { debounce } from 'lodash'
import { SearchInput } from '@gnomad/ui'
import { isRegionId, isVariantId, parseRegionId } from '@gnomad/identifiers'

import StatusMessage from '../base/StatusMessage'
import { TileEventType } from '../base/components/Heatmap'
import AutosizedGeneResultsHeatmap from '../base/GeneResultsPage/GeneResultsHeatmapPlot'
import AutosizedGeneResultsManhattanPlot from '../base/GeneResultsPage/GeneResultsManhattanPlot'
import AutosizedGeneResultsGenesTrack from '../base/GeneResultsPage/GeneResultsGenesTrack'
import Fetch from '../base/Fetch'
import datasetConfig from '../datasetConfig'
import RegionControls from '../base/components/RegionControls'
import LocusZoomPlot from '../base/components/LocusZoomPlot'

const TOBAssociationPage = () => {
  const [searchText, setSearchText] = useState('22:37966255-37978623')
  const [requestParams, setRequestParams] = useState({ search: searchText, threshold: null })
  const [selectedTiles, setSelectedTiles] = useState([])
  const [region, setRegion] = useState({
    chrom: '22',
    start: 37966255,
    stop: 37978623,
    feature_type: 'region',
  })

  const debounceSetRequestParams = useCallback(
    debounce((value) => setRequestParams(value), 1000),
    []
  )

  const handleSearchInputChange = (value) => {
    setSearchText(value)
    setSelectedTiles([])
    if (isRegionId(value)) {
      setRegion({ ...region, ...parseRegionId(value) })
    }
    if (value?.trim()) {
      debounceSetRequestParams({ ...requestParams, search: value.trim() }, 1000)
    }
  }

  const handleRegionChange = ({ chrom, start, stop }) => {
    const text = `${chrom}:${start}-${stop}`
    setSearchText(text)
    setSelectedTiles([])
    setRegion({ ...region, chrom, start, stop })
    debounceSetRequestParams({ ...requestParams, search: text }, 1000)
  }

  /**
   * @param {object} tile
   * @param {TileEventType} eventType
   */
  const handleTileClick = (tile, eventType) => {
    if (eventType === TileEventType.SELECT) {
      // Only allow one gene to be selected at a time.
      setSelectedTiles([...selectedTiles, tile].filter((t) => t.gene === tile.gene))
    } else {
      setSelectedTiles(selectedTiles.filter((t) => t.gene !== tile.gene || t.cell !== tile.cell))
    }
  }

  // ===============================================================================================
  // Rendering
  // ===============================================================================================
  return (
    <>
      <SearchInput
        id="association-search"
        placeholder="1-55039774-C-T or 1:55505221-55530525"
        value={searchText}
        onChange={handleSearchInputChange}
      />
      <Fetch path={`/associations/?${new URLSearchParams(requestParams).toString()}`}>
        {({ data, error, loading }) => {
          if (loading) {
            return <StatusMessage>Loading associations...</StatusMessage>
          }

          if (error || !(data || {}).results) {
            return (
              <>
                <StatusMessage>Unable to load heatmap</StatusMessage>
                <StatusMessage>{error.message}</StatusMessage>
              </>
            )
          }

          const selectedCells = selectedTiles.length
            ? Array.from(new Set(selectedTiles.map((tile) => tile.cell)))
            : Object.keys(datasetConfig.cell_colors)

          let associations = selectedTiles
            .map((tile) => {
              return data.results.genes
                .filter((gene) => gene.symbol === tile.gene)
                .map((gene) => {
                  return gene.associations
                    .filter((a) => a.cell === tile.cell)
                    .map((a) => {
                      return {
                        id: a.id,
                        cell: a.cell,
                        gene_id: gene.gene_id,
                        gene_symbol: gene.symbol,
                        chrom: a.chr,
                        pos: a.bp,
                        pval: a.p_value,
                        color: datasetConfig.cell_colors[a.cell] || '#1e1e1e',
                      }
                    })
                })
                .flat()
            })
            .flat()

          // Fixme: 22:36044442-36064456 APOL6 variants are outside this gene's region:
          //    Have we got the wrong transcript?
          //    Variants not CIS?
          const renderRegion = isVariantId(searchText) ? data.results.regions[0] : region
          associations = associations.filter(
            (a) => a.pos >= renderRegion.start && a.pos <= renderRegion.stop
          )

          associations.push({
            id: `anchor-${region.start}`,
            cell: '',
            gene_id: '',
            gene_symbol: '',
            chrom: renderRegion.chrom,
            pos: renderRegion.start,
            pval: 1,
            color: 'transparent',
          })
          associations.push({
            id: `anchor-${region.stop}`,
            cell: '',
            gene_id: '',
            gene_symbol: '',
            chrom: renderRegion.chrom,
            pos: renderRegion.stop,
            pval: 10 ** -(data.results.maxValue + 1),
            color: 'transparent',
          })

          return (
            <>
              <div style={{ margin: '1em 0' }}>
                <div style={{ textAlign: 'center' }}>
                  {region.chrom}, {region.start}, {region.stop}
                </div>
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}
                >
                  {selectedCells.map((cell) => {
                    return (
                      <div
                        key={cell}
                        style={{
                          textAlign: 'center',
                          margin: '1em 1em',
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            backgroundColor: datasetConfig.cell_colors[cell],
                            borderRadius: '50%',
                            marginBottom: 4,
                            position: 'relative',
                            left: 'calc(50% - 0.4em)',
                          }}
                        />
                        <span style={{ display: 'block' }}>{cell}</span>
                      </div>
                    )
                  })}
                </div>
                <LocusZoomPlot
                  results={associations}
                  pointColor={(d) => d.color}
                  region={renderRegion}
                  genes={data.results.genes}
                  onChange={handleRegionChange}
                />
                {/* <AutosizedGeneResultsManhattanPlot
                  // chromosomes={Array.from(
                  //   new Set([
                  //     region.chrom,
                  //     ...selectedTiles
                  //       .map((tile) => {
                  //         return data.results.genes.filter((gene) => gene.symbol === tile.gene)
                  //       })
                  //       .flat()
                  //       .map((gene) => gene.chrom),
                  //   ])
                  // )}
                  results={associations}
                  pointColor={(d) => d.color}
                  region={renderRegion}
                  onChange={handleRegionChange}
                /> */}
              </div>

              {/* <div style={{ margin: '1em 0' }}>
                <div style={{ float: 'right', marginBottom: '2em' }}>
                  <RegionControls region={renderRegion} onChange={handleRegionChange} />
                </div>
                <AutosizedGeneResultsGenesTrack
                  genes={data.results.genes}
                  region={renderRegion}
                  onChange={handleRegionChange}
                />
              </div> */}

              <div style={{ margin: '1em 0' }}>
                {(() => {
                  if (data.results.heatmap.length) {
                    return (
                      <AutosizedGeneResultsHeatmap
                        results={data.results.heatmap}
                        id="gene-results-heatmap"
                        title={'Maximum -log\u2081\u2080(p) variant association'}
                        colNames={data.results.cellNames}
                        rowNames={data.results.geneNames}
                        minValue={data.results.minValue}
                        maxValue={data.results.maxValue}
                        tileSpacing={0.01}
                        onClickTile={handleTileClick}
                        selectedTiles={selectedTiles}
                        tileRowName={(d) => d.gene}
                        tileColName={(d) => d.cell}
                        tileValue={(d) => d.value}
                        tileTooltip={(d) => {
                          return `${d.gene} - ${d.cell}: ${d.value.toFixed(2)}`
                        }}
                      />
                    )
                  }
                  return <StatusMessage>No associations found</StatusMessage>
                })()}
              </div>
            </>
          )
        }}
      </Fetch>
    </>
  )
}

export default TOBAssociationPage
