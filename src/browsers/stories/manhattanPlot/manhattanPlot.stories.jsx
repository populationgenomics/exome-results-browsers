import React from 'react'

import ManhattanPlotTemplate from './ManhattanPlot.template'

export default {
  title: 'Components/ManhattanPlot',
  component: ManhattanPlotTemplate,
}

const Template = (args) => <ManhattanPlotTemplate {...args} />

export const randomData = Template.bind({})
randomData.args = {
  numCellLines: 5,
}

export const noData = Template.bind({})
noData.args = {
  numCellLines: 0,
}
