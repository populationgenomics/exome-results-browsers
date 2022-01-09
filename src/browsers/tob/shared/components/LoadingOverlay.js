import React from 'react'
import PropTypes from 'prop-types'

import ReactLoadingOverlay from 'react-loading-overlay'

const LoadingOverlay = ({ active, text, children }) => {
  return (
    <ReactLoadingOverlay
      active={active}
      spinner
      text={text}
      styles={{
        overlay: (base) => ({
          ...base,
          color: '#1e1e1e',
          background: 'none',
        }),
        spinner: (base) => ({
          ...base,
          width: '100px',
          '& svg circle': {
            stroke: 'rgba(30, 30, 30, 0.5)',
          },
        }),
      }}
    >
      <div style={{ filter: active ? 'blur(2px)' : 'none' }}>{children}</div>
    </ReactLoadingOverlay>
  )
}

LoadingOverlay.propTypes = {
  active: PropTypes.bool,
  text: PropTypes.string,
  children: PropTypes.node,
}

LoadingOverlay.defaultProps = {
  active: false,
  text: null,
  children: null,
}

export default LoadingOverlay
