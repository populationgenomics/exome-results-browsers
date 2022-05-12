import React from 'react'
import PropTypes from 'prop-types'

const AssociationTooltip = ({ association }) => {
  return (
    <table>
      <tbody>
        <tr>
          <td>
            <b>Id: </b>
          </td>
          <td>{association.association_id}</td>
        </tr>
        <tr>
          <td>
            <b>Gene ID: </b>
          </td>
          <td>{association.gene_id} </td>
        </tr>
        <tr>
          <td>
            <b>Gene symbol: </b>
          </td>
          <td>{association.gene_symbol} </td>
        </tr>
        <tr>
          <td>
            <b>Cell type: </b>
          </td>
          <td>{association.cell_type_name} </td>
        </tr>
        <tr>
          <td>
            <b>P-value: </b>
          </td>
          <td>{association.p_value.toExponential(2)} </td>
        </tr>
        <tr>
          <td>
            <b>-log10(p): </b>
          </td>
          <td> {-1 * Math.log10(association.p_value).toFixed(2)} </td>
        </tr>
        <tr>
          <td>
            <b>Beta: </b>
          </td>
          <td>{association.beta ?? '?'} </td>
        </tr>
        <tr>
          <td>
            <b>Functional annotation: </b>
          </td>
          <td>{association.functional_annotation ?? '?'} </td>
        </tr>
      </tbody>
    </table>
  )
}

// eslint-disable-next-line react/forbid-prop-types
AssociationTooltip.propTypes = { association: PropTypes.object.isRequired }
AssociationTooltip.defaultProps = {}

export default AssociationTooltip
