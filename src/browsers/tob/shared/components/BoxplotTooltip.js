import React from 'react'
import PropTypes from 'prop-types'

const BoxplotTooltip = ({ statistics }) => (
  <table>
    <tbody>
      {['median', 'mean', 'min', 'max', 'q1', 'q3', 'iqr'].map((key, i) => {
        return (
          // eslint-disable-next-line react/no-array-index-key
          <tr key={`${i}-${key}`}>
            <td>
              <b>{key}: </b>
            </td>
            <td>{statistics[key].toPrecision(4)} </td>
          </tr>
        )
      })}
    </tbody>
  </table>
)

// eslint-disable-next-line react/forbid-prop-types
BoxplotTooltip.propTypes = { statistics: PropTypes.object.isRequired }

export default BoxplotTooltip
