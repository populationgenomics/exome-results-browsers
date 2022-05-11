import React from 'react'

import ViolinPlotTemplate from './ViolinPlot.template'

export default {
  title: 'Components/ViolinPlot',
  component: ViolinPlotTemplate,
}

const Template = (args) => <ViolinPlotTemplate {...args} />

export const geneQuery = Template.bind({})
geneQuery.args = {
  query: 'IL7',
}

export const eqtlQuery = Template.bind({})
eqtlQuery.args = {
  query: '17:41216206:T:C:ENSG00000012048:nk:1',
}

export const geneDoesNotExist = Template.bind({})
geneDoesNotExist.args = {
  query: 'aaa',
}

export const invalidEqtlId = Template.bind({})
invalidEqtlId.args = {
  query: '17:41216206:T:C:gene:nk:1',
}

export const noData = Template.bind({})
noData.args = {
  query: null,
  data: { histograms: [], bins: [] },
}
