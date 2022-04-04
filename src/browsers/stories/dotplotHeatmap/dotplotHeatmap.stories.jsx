import React from 'react'

import { Heatmap } from './dotplotHeatmap'

export default {
  title: 'Heatmap/DotplotHeatmap',
  component: Heatmap,
}

const Template = (args) => <Heatmap {...args} />

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
