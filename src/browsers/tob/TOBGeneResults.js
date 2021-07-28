import PropTypes from 'prop-types'
import React from 'react'

const TOBGeneResults = ({ result }) => <div>{result}</div>

TOBGeneResults.propTypes = {
  result: PropTypes.any.isRequired, // eslint-disable-line react/forbid-prop-types
}

export default TOBGeneResults
