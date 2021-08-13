import React, { useEffect, useState, useCallback } from 'react'

import { debounce } from 'lodash'
import { SearchInput } from '@gnomad/ui'

import Fetch from '../base/Fetch'
import StatusMessage from '../base/StatusMessage'
import {
  AutosizedGeneResultsHeatmap,
  TileEventType,
} from '../base/GeneResultsPage/GeneResultsHeatmap'
import AutosizedGeneResultsManhattanPlot from '../base/GeneResultsPage/GeneResultsManhattanPlot'

const TOBHeatmapLocusPlot = () => {
  // ===============================================================================================
  // Heatmap state management
  // ===============================================================================================
  const [searchText, setSearchText] = useState('')
  const [heatmapApiPath, setHeatmapApiPath] = useState('/heatmap/')
  const [heatmapRequestParams, setheatmapRequestParams] = useState({ search: '', pValMax: null })

  const debounceSetHeatmapRequestParams = useCallback(
    debounce((value) => setheatmapRequestParams(value), 1000),
    []
  )

  /**
   * @param {string} value
   */
  const handleSearchInputChange = (value) => {
    setSearchText(value)
    if (value?.trim()) {
      debounceSetHeatmapRequestParams({ ...heatmapRequestParams, search: value.trim() }, 1000)
    }
  }

  useEffect(() => {
    setHeatmapApiPath(`/heatmap/?${new URLSearchParams(heatmapRequestParams).toString()}`)
  }, [heatmapRequestParams])

  // ===============================================================================================
  // Locus plot state management
  // ===============================================================================================
  // Keep track of selected heatmap tiles and which ones we have already fetched locus plot data for
  // const [selectedTiles, setSelectedTiles] = useState(new Map())
  const [locusPlotApiPath, setLocusPlotApiPath] = useState('/locus-plot/')
  const [locusPlotRequestParams, setLocusPlotRequestParams] = useState({
    geneCellPairs: [],
    pValMax: null,
  })

  const debounceSetLocusPlotRequestParams = useCallback(
    debounce((value) => setLocusPlotRequestParams(value), 1000),
    []
  )

  /**
   * @param {{row: string, col: string, value: number}} tile
   * @param {TileEventType} eventType
   */
  const handleTileClick = (tile, eventType) => {
    if (eventType === 'select') {
      debounceSetLocusPlotRequestParams({
        geneCellPairs: [...locusPlotRequestParams.geneCellPairs, [tile.row, tile.col]],
        pValMax: null,
      })
    }
    console.log(`${eventType} tile Tile(${tile.row}, ${tile.col}, ${tile.value})`)
  }

  useEffect(() => {
    const params = new URLSearchParams({ delimiter: '|' })

    if (locusPlotRequestParams.pValMax != null) {
      params.append('pValMax', locusPlotRequestParams.pValMax)
    }
    if (locusPlotRequestParams.geneCellPairs.length > 0) {
      locusPlotRequestParams.geneCellPairs.forEach((pair) => {
        params.append('geneCellPair', pair.join('|'))
      })
    }

    setLocusPlotApiPath(`/locus-plot/?${params.toString()}`)
  }, [locusPlotRequestParams])

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
      <div style={{ margin: '1em 0' }}>
        <Fetch path={locusPlotApiPath}>
          {({ data, error, loading }) => {
            if (loading) {
              return <StatusMessage>Loading locus plot...</StatusMessage>
            }

            if (error || !(data || {}).results) {
              return <StatusMessage>Unable to load locus plot</StatusMessage>
            }
            return <AutosizedGeneResultsManhattanPlot results={data.results.data} />
          }}
        </Fetch>
      </div>
      <div style={{ margin: '1em 0' }}>
        <Fetch path={heatmapApiPath}>
          {({ data, error, loading }) => {
            if (loading) {
              return <StatusMessage>Loading heatmap...</StatusMessage>
            }

            if (error || !(data || {}).results) {
              return <StatusMessage>Unable to load heatmap</StatusMessage>
            }

            return (
              <AutosizedGeneResultsHeatmap
                id="gene-results-heatmap"
                height={1200}
                columnLabels={data.results.columnLabels}
                rowLabels={data.results.rowLabels}
                data={data.results.data}
                minValue={data.results.minValue}
                maxValue={data.results.maxValue}
                tileSpacing={0.01}
                onClickTile={handleTileClick}
                renderTooltip={(d) => {
                  return `${d.col} - ${d.row}: ${d.value.toFixed(4)}`
                }}
              />
            )
          }}
        </Fetch>
      </div>
    </>
  )
}

export default TOBHeatmapLocusPlot
