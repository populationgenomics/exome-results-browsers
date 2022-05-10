import React from 'react'

import ManhattanPlotTemplate from './ManhattanPlot.template'

export default {
  title: 'Components/ManhattanPlot',
  component: ManhattanPlotTemplate,
}

const Template = (args) => <ManhattanPlotTemplate {...args} />

export const someSelected = Template.bind({})
someSelected.args = {
  numCellLines: 3,
  selected: true,
  referenced: false,
}

export const someReferenced = Template.bind({})
someReferenced.args = {
  numCellLines: 3,
  selected: false,
  referenced: true,
}

export const selectedReferenced = Template.bind({})
selectedReferenced.args = {
  numCellLines: 3,
  selected: true,
  referenced: true,
}

export const noneSelectedReferenced = Template.bind({})
noneSelectedReferenced.args = {
  numCellLines: 3,
  selected: false,
  referenced: false,
}

export const noData = Template.bind({})
noData.args = {
  numCellLines: 0,
  selected: false,
  referenced: false,
}
