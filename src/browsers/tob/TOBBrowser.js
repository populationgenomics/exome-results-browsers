import React from 'react'

import Browser from '../base/Browser'
import Fetch from '../base/Fetch'
import AutosizedGeneResultsUmapPlot from '../base/GeneResultsPage/GeneResultsUmapPlot'
import StatusMessage from '../base/StatusMessage'
import { renderCount } from '../base/tableCells'
import datasetConfig from '../datasetConfig'

import TOBHomePage from './TOBHomePage'

const TOBBrowser = () => (
  <Browser
    browserTitle="Tasmanian Ophthalmic Biobank Project"
    navBarBackgroundColor="#23509c"
    homePage={TOBHomePage}
    geneResultsPageHeading="Results"
    geneResultAnalysisGroupOptions={['All']}
    defaultGeneResultAnalysisGroup="All"
    geneResultColumns={datasetConfig.gene_group_result_field_names.map((cellLabel) => {
      const humanReadable = datasetConfig.gene_results_table_headings[cellLabel]
      return {
        key: cellLabel,
        heading: humanReadable,
        tooltip: `Number of eQTL variants associated with cells labelled '${humanReadable}'`,
        minWidth: 75,
        render: renderCount,
      }
    })}
    geneResultTabs={[
      {
        id: 'umap-plot',
        label: 'UMAP Plot',
        render: () => (
          <Fetch path="/umap">
            {({ data, error, loading }) => {
              if (loading) {
                return <StatusMessage>Loading results...</StatusMessage>
              }

              if (error || !(data || {}).results) {
                return <StatusMessage>Unable to load results</StatusMessage>
              }

              return (
                <AutosizedGeneResultsUmapPlot
                  id="gene-results-umap-plot"
                  embedding={data.results.embedding}
                  labels={data.results.labels}
                />
              )
            }}
          </Fetch>
        ),
      },
    ]}
  />
)

export default TOBBrowser
