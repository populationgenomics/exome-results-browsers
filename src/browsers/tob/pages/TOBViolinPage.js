import React from 'react'
import PropTypes from 'prop-types'

import TOBViolinPlot from '../shared/TOBViolinPlot'

const TOBViolinPage = ({ match }) => {
  return <TOBViolinPlot gene={match.params.gene} />
}

TOBViolinPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  match: PropTypes.object.isRequired,
}

export default TOBViolinPage
