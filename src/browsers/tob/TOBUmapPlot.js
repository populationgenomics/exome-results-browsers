import React, { useEffect, useState } from 'react'

import { Button, TooltipAnchor, TooltipHint } from '@gnomad/ui'
import Select from 'react-select'

import Fetch from '../base/Fetch'
import AutosizedGeneResultsUmapPlot from '../base/GeneResultsPage/GeneResultsUmapPlot'
import StatusMessage from '../base/StatusMessage'
import { TooltipWrapper, PlotWrapper } from './utilities/styling'
import { cellLabels, geneSymbols } from './utilities/config'

const geneSelectionOptions = geneSymbols().map((n) => {
  return { value: n, label: n }
})

const cellLabelOptions = cellLabels().map((n) => {
  return { value: n, label: n }
})

const TOBUmapPlot = () => {
  const [apiPath, setApiPath] = useState(null)
  const [selectedGenes, setSelectedGenes] = useState([...geneSelectionOptions])
  const [selectedCellLabels, setSelectedCellLabels] = useState([...cellLabelOptions])
  const [requestParams, setRequestParams] = useState({
    geneSymbols: selectedGenes,
    cellLabels: selectedCellLabels,
  })

  useEffect(() => {
    const queries = []
    if (requestParams.geneSymbols) {
      queries.push(`geneSymbols=${requestParams.geneSymbols.map((d) => d.value).join(',')}`)
    }
    if (requestParams.cellLabels) {
      queries.push(`cellLabels=${requestParams.cellLabels.map((d) => d.value).join(',')}`)
    }

    setApiPath(`/umap/?${queries.join('&')}`)
  }, [requestParams])

  if (!apiPath) {
    return <></>
  }

  return (
    <Fetch path={apiPath} params>
      {({ data, error, loading }) => {
        if (loading) {
          return <StatusMessage>Loading results...</StatusMessage>
        }

        if (error || !(data || {}).results) {
          return <StatusMessage>Unable to load results</StatusMessage>
        }

        return (
          <>
            <TooltipWrapper>
              <TooltipAnchor tooltip="Add genes to include in UMAP embedding computation">
                <TooltipHint>Genes</TooltipHint>
              </TooltipAnchor>
            </TooltipWrapper>
            <Select
              id="umap-genes"
              isMulti
              isDisabled={loading || error}
              value={selectedGenes}
              options={[...geneSelectionOptions]}
              onChange={(selection) => {
                setSelectedGenes([...selection] || [])
              }}
            />
            <TooltipWrapper>
              <TooltipAnchor tooltip="Add cell labels to include in UMAP embedding computation">
                <TooltipHint>Cell labels</TooltipHint>
              </TooltipAnchor>
            </TooltipWrapper>
            <Select
              id="umap-cell-labels"
              isMulti
              isDisabled={loading || error}
              value={selectedCellLabels}
              options={[...cellLabelOptions]}
              onChange={(selection) => {
                setSelectedCellLabels([...selection] || [])
              }}
            />
            <PlotWrapper>
              <AutosizedGeneResultsUmapPlot
                id="gene-results-umap-plot"
                results={data.results.data}
              />
            </PlotWrapper>
            <Button
              style={{ margin: '1em', float: 'right' }}
              onClick={() =>
                setRequestParams({ geneSymbols: selectedGenes, cellLabels: selectedCellLabels })
              }
            >
              Run UMAP embeddding
            </Button>
          </>
        )
      }}
    </Fetch>
  )
}

export default TOBUmapPlot
