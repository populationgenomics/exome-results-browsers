import React from 'react'
import PropTypes from 'prop-types'

const TOBVariantFilter = ({ value, onChange }) => <div>{onChange(value)}</div>

TOBVariantFilter.propTypes = {
  value: PropTypes.any.isRequired, // eslint-disable-line react/forbid-prop-types
  onChange: PropTypes.func.isRequired,
}

export default TOBVariantFilter
