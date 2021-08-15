import React, { useState, useCallback } from 'react'

import { debounce, maxBy, minBy } from 'lodash'
import { SearchInput } from '@gnomad/ui'

import StatusMessage from '../base/StatusMessage'
import { TileEventType } from '../base/components/Heatmap'
import AutosizedGeneResultsHeatmap from '../base/GeneResultsPage/GeneResultsHeatmapPlot'
import AutosizedGeneResultsManhattanPlot from '../base/GeneResultsPage/GeneResultsManhattanPlot'
import AutosizedGeneResultsGenesTrack from '../base/GeneResultsPage/GeneResultsGenesTrack'
import Fetch from '../base/Fetch'

const TOBAssociationPage = () => {
  const [searchText, setSearchText] = useState('22:37966255-37978623')
  const [requestParams, setRequestParams] = useState({ search: searchText, threshold: null })
  const [selectedTiles, setSelectedTiles] = useState([])

  const debounceSetRequestParams = useCallback(
    debounce((value) => setRequestParams(value), 1000),
    []
  )

  /**
   * @param {string} value
   */
  const handleSearchInputChange = (value) => {
    setSearchText(value)
    if (value?.trim()) {
      debounceSetRequestParams({ ...requestParams, search: value.trim() }, 1000)
    }
  }

  /**
   * @param {{row: string, col: string, data: object}} tile
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
        id="heatmap-search"
        placeholder="rs45448095, 1-55039774-C-T, 1:55505221-55530525"
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
                  color: '#1e1e1e',
                }
              })
            })
            .flat()

          return (
            <>
              <div style={{ margin: '1em 0' }}>
                <AutosizedGeneResultsManhattanPlot
                  results={associations}
                  pointColor={(d) => d.color}
                />
              </div>

              <div style={{ margin: '1em 0' }}>
                <AutosizedGeneResultsGenesTrack
                  genes={data.results.genes}
                  regions={data.results.regions}
                />
              </div>

              <div style={{ margin: '1em 0' }}>
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
              </div>
            </>
          )
        }}
      </Fetch>
    </>
  )
}

export default TOBAssociationPage
