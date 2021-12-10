import PropTypes from 'prop-types'
import React from 'react'

const TOBVariantPage = ({ variant }) => <div>{variant}</div>

TOBVariantPage.propTypes = {
  variant: PropTypes.string.isRequired,
}

export default TOBVariantPage
