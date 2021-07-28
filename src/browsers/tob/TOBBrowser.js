import React from 'react'

import Browser from '../base/Browser'
import { renderCount } from '../base/tableCells'
import datasetConfig from '../datasetConfig'

import TOBHomePage from './TOBHomePage'
import TOBUmapPlot from './TOBUmapPlot'

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
        render: () => <TOBUmapPlot />,
      },
    ]}
  />
)

export default TOBBrowser
