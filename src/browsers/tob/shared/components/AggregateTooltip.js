import React from 'react'
import PropTypes from 'prop-types'

const AggregateTooltip = ({ data }) => {
  const fields = [
    {
      label: 'Gene symbol',
      attr: 'gene_symbol',
      render: (v) => v,
    },
    {
      label: 'Gene ID',
      attr: 'gene_id',
      render: (v) => v,
    },
    {
      label: 'Cell type',
      attr: 'cell_type_id',
      render: (v) => v,
    },
    {
      label: 'Expression (log CPM)',
      attr: 'mean_log_cpm',
      render: (v) => v.toPrecision(2),
    },
    {
      label: 'Association strength (-log10p)',
      attr: 'min_p_value',
      render: (v) => -1 * Math.log10(v).toPrecision(2),
    },
  ]

  return (
    <table>
      <tbody>
        {fields.map(({ label, attr, render }) => {
          return (
            <tr key={`tooltip-item-${attr}`}>
              <td>
                <b>{label}: </b>
              </td>
              <td>{render(data[attr])} </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// eslint-disable-next-line react/forbid-prop-types
AggregateTooltip.propTypes = { data: PropTypes.object.isRequired }

export default AggregateTooltip
