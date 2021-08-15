import React, { useState, useCallback } from 'react'

import { debounce } from 'lodash'
import { SearchInput } from '@gnomad/ui'

import StatusMessage from '../base/StatusMessage'
import { TileEventType } from '../base/components/Heatmap'
import AutosizedGeneResultsHeatmap from '../base/GeneResultsPage/GeneResultsHeatmapPlot'
import AutosizedGeneResultsManhattanPlot from '../base/GeneResultsPage/GeneResultsManhattanPlot'
import AutosizedGeneResultsGenesTrack from '../base/GeneResultsPage/GeneResultsGenesTrack'
import Fetch from '../base/Fetch'
import datasetConfig from '../datasetConfig'
import RegionControls from '../base/components/RegionControls'

const TOBAssociationPage = () => {
  const [searchText, setSearchText] = useState('22:37966255-37978623')
  const [requestParams, setRequestParams] = useState({ search: searchText, threshold: null })
  const [selectedTiles, setSelectedTiles] = useState([])

  const debounceSetRequestParams = useCallback(
    debounce((value) => setRequestParams(value), 1000),
    []
  )

  const handleSearchInputChange = (value) => {
    setSearchText(value)
    if (value?.trim()) {
      debounceSetRequestParams({ ...requestParams, search: value.trim() }, 1000)
    }
  }

  const handleRegionChange = ({ chrom, start, stop }) => {
    const text = `${chrom}:${start}-${stop}`
    setSearchText(text)
    debounceSetRequestParams({ ...requestParams, search: text }, 1000)
  }

  /**
   * @param {object} tile
   * @param {TileEventType} eventType
   */
  const handleTileClick = (tile, eventType) => {
    if (eventType === TileEventType.SELECT) {
      setSelectedTiles([...selectedTiles, tile])
    } else {
      setSelectedTiles(selectedTiles.filter((t) => t.gene !== tile.gene && t.cell !== tile.cell))
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

          const associations = data.results.genes
            .map((gene) => {
              return gene.associations.map((a) => {
                return {
                  id: a.id,
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

          return (
            <>
              <div style={{ margin: '1em 0' }}>
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}
                >
                  {Object.keys(datasetConfig.cell_colors).map((cell) => {
                    return (
                      <div
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
                <AutosizedGeneResultsManhattanPlot
                  results={associations}
                  pointColor={(d) => d.color}
                />
              </div>

              <div style={{ margin: '1em 0' }}>
                <div style={{ float: 'right', marginBottom: '2em' }}>
                  <RegionControls region={data.results.regions[0]} onChange={handleRegionChange} />
                </div>
                <AutosizedGeneResultsGenesTrack
                  genes={data.results.genes}
                  regions={[data.results.regions[0]]}
                />
              </div>

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
                        highlightTiles={selectedTiles}
                        tileRowName={(d) => d.gene}
                        tileColName={(d) => d.cell}
                        tileValue={(d) => d.value}
                        tileTooltip={(d) => {
                          return `${d.gene} - ${d.cell}: ${d.value.toFixed(2)}`
                        }}
                      />
                    )
                  }
                  return <StatusMessage>No assoications found</StatusMessage>
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
