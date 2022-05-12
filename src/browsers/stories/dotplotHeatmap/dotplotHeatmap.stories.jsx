import React from 'react'

import DotplotHeatmapTemplate from './DotplotHeatmap.template'

export default {
  title: 'Components/DotplotHeatmap',
  component: DotplotHeatmapTemplate,
}

const Template = (args) => <DotplotHeatmapTemplate {...args} />

export const Main = Template.bind({})
Main.args = {
  numRows: 3,
}

export const oneRow = Template.bind({})
oneRow.args = {
  numRows: 1,
}

export const noRows = Template.bind({})
noRows.args = {
  numRows: 0,
}
