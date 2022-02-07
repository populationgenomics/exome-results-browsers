import PropTypes from 'prop-types'
import React from 'react'

const TOBVariantPage = ({ match }) => <div>{match.params.variant}</div>

TOBVariantPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  match: PropTypes.object.isRequired,
}

export default TOBVariantPage
