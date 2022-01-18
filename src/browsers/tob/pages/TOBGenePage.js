import PropTypes from 'prop-types'
import React from 'react'

const TOBGenePage = ({ gene }) => <div>{gene}</div>

TOBGenePage.propTypes = {
  gene: PropTypes.string.isRequired,
}

export default TOBGenePage
