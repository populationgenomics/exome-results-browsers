import React from 'react'

import EffectGridTemplate from './EffectGrid.template'

export default {
  title: 'Components/EffectGrid',
  component: EffectGridTemplate,
}

const Template = (args) => <EffectGridTemplate {...args} />

export const gridLayout = Template.bind({})
gridLayout.args = {}
