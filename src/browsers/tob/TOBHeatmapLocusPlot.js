import React, { useEffect, useState, useCallback } from 'react'

import { debounce } from 'lodash'
import { SearchInput } from '@gnomad/ui'

import Fetch from '../base/Fetch'
import StatusMessage from '../base/StatusMessage'
import AutosizedGeneResultsHeatmap from '../base/GeneResultsPage/GeneResultsHeatmap'
import AutosizedGeneResultsManhattanPlot from '../base/GeneResultsPage/GeneResultsManhattanPlot'

const TOBHeatmapLocusPlot = () => {
  const [apiPath, setApiPath] = useState('/heatmap/')
  const [searchText, setSearchText] = useState('')
  const [requestParams, setRequestParams] = useState({ search: '' })

  useEffect(() => {
    if (requestParams.search?.trim()?.length > 0) {
      setApiPath(`/heatmap/?search=${requestParams.search.trim()}`)
    }
  }, [requestParams])

  const debounceSetRequestParams = useCallback(
    debounce((value) => setRequestParams(value), 1000),
    []
  )
  const handleSearchInputChange = (value) => {
    setSearchText(value)
    debounceSetRequestParams({ ...requestParams, search: value?.trim() })
  }

  return (
    <>
      <Fetch path="/locus-plot" params>
        {({ data, error, loading }) => {
          if (loading) {
            return <StatusMessage>Loading locus-plot...</StatusMessage>
          }

          if (error || !(data || {}).results) {
            return <StatusMessage>Unable to load locus-plot</StatusMessage>
          }

          return (
            <>
              <SearchInput
                id="heatmap-search"
                placeholder="rs45448095, 1-55039774-C-T, 1:55505221-55530525"
                isDisabled={loading || error}
                value={searchText}
                onChange={handleSearchInputChange}
              />
              <AutosizedGeneResultsManhattanPlot results={data.results.data} />
            </>
          )
        }}
      </Fetch>
      <Fetch path={apiPath} params>
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
              onTileClick={() => {}}
              onTileHover={() => {}}
              renderTooltip={(d) => {
                return `${d.col} - ${d.row}: ${d.value.toFixed(4)}`
              }}
            />
          )
        }}
      </Fetch>
    </>
  )
}

export default TOBHeatmapLocusPlot
