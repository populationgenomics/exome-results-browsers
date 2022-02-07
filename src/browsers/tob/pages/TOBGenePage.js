import PropTypes from 'prop-types'
import React from 'react'

const TOBGenePage = ({ match }) => <div>{match.params.gene}</div>

TOBGenePage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  match: PropTypes.object.isRequired,
}

export default TOBGenePage
