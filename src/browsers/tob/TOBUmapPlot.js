import React, { useEffect, useState } from 'react'

import { Button } from '@gnomad/ui'
import Select from 'react-select'

import Fetch from '../base/Fetch'
import AutosizedGeneResultsUmapPlot from '../base/GeneResultsPage/GeneResultsUmapPlot'
import StatusMessage from '../base/StatusMessage'
import datasetConfig from '../datasetConfig'

const geneSelectionOptions = datasetConfig.gene_symbols.map((n) => {
  return { value: n, label: n }
})

const cellLabelOptions = datasetConfig.gene_group_result_field_names.map((n) => {
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
            <div style={{ margin: '1em' }} />
            <p>Compute UMAP embedding across genes:</p>
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
            <div style={{ margin: '1em' }} />
            <p>Include the following cell labels in UMAP embedding computation:</p>
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
            <AutosizedGeneResultsUmapPlot
              id="gene-results-umap-plot"
              embedding={data.results.embedding}
              labels={data.results.labels}
            />
            <div style={{ margin: '1em', float: 'right' }}>
              <Button
                onClick={() =>
                  setRequestParams({ geneSymbols: selectedGenes, cellLabels: selectedCellLabels })
                }
              >
                Run UMAP embeddding
              </Button>
            </div>
          </>
        )
      }}
    </Fetch>
  )
}

export default TOBUmapPlot
