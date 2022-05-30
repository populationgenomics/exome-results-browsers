import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

import { useMargin } from '../hooks'
import StatusMessage from './StatusMessage'

const TableColumn = styled.th``

const ColumnDefinition = styled.div`
  cursor: ${(props) => (props.title ? 'help' : 'initial')};
  font-size: 12px;
  margin-left: 40px;
  text-align: left;
`

const RowDefinition = styled.td`
  cursor: ${(props) => (props.title ? 'help' : 'initial')};
  font-size: 12px;
  text-align: left;
  width: 150px;
`

const ClearButton = styled.button`
  margin-top: 2px;
  font-size: 12px;
  float: left;
`

const TableRow = styled.tr`
  height: 200px;
  text-align: left;
`

const TableCell = styled.td`
  text-align: left;
  width: 250px;
  min-width: 250px;
  max-width: 250px;
  height: 200px;
`

const EffectGrid = ({ columns, rows, data, missing, width, height, margin }) => {
  const _margin = useMargin(margin, { top: 4, bottom: 4 })

  const validCellTypes = useMemo(() => {
    return ['variant', ...new Set(data.map((a) => a.column))]
  }, [data])

  const tableStyle = useMemo(() => {
    return {
      width: width ?? (validCellTypes?.length ?? 0) * 250,
      height: height ?? (rows?.length ?? 0) * 250,
      marginTop: _margin.top,
      marginRight: _margin.right,
      marginBottom: _margin.bottom,
      marginLeft: _margin.left,
    }
  }, [
    _margin?.top,
    _margin?.right,
    _margin?.bottom,
    _margin?.left,
    width,
    height,
    rows?.length,
    validCellTypes.length,
  ])

  const tableHeader = useMemo(() => {
    return (
      <tr>
        {columns
          .filter((a) => validCellTypes.includes(a.key))
          .map(({ key, help, content, onClear }) => {
            return (
              <TableColumn key={key}>
                <ColumnDefinition title={help}>{content}</ColumnDefinition>
                {onClear ? (
                  <ClearButton type="button" onClick={onClear}>
                    Clear
                  </ClearButton>
                ) : null}
              </TableColumn>
            )
          })}
      </tr>
    )
  }, [columns, validCellTypes])

  const tableBody = useMemo(() => {
    return rows.map((row) => {
      return (
        <TableRow key={row.key}>
          <RowDefinition>
            <div title={row.help}>{row.content}</div>
            {row.onClear ? (
              <ClearButton type="button" onClick={row.onClear}>
                Clear
              </ClearButton>
            ) : null}
          </RowDefinition>
          {columns
            .filter((a) => validCellTypes.includes(a.key))
            .slice(1)
            .map((column) => {
              const cell = data.find((d) => d.row === row.key && d.column === column.key)
              return (
                <TableCell
                  key={`${row.key}-${column.key}-cell`}
                  onMouseEnter={cell?.onMouseEnter}
                  onMouseLeave={cell?.onMouseLeave}
                >
                  {cell?.content ?? missing}
                </TableCell>
              )
            })}
        </TableRow>
      )
    })
  }, [rows, columns, data, missing, validCellTypes])

  if (!rows?.length && !columns?.length) {
    return <StatusMessage style={{ fontSize: 16 }}>No data to display</StatusMessage>
  }

  return (
    <table style={tableStyle}>
      <thead>{tableHeader}</thead>
      <tbody>{tableBody}</tbody>
    </table>
  )
}

EffectGrid.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      help: PropTypes.string,
      content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      onClear: PropTypes.func,
    })
  ),
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      help: PropTypes.string,
      content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      onClear: PropTypes.func,
    })
  ),
  data: PropTypes.arrayOf(
    PropTypes.shape({
      row: PropTypes.string.isRequired,
      column: PropTypes.string.isRequired,
      content: PropTypes.any, // eslint-disable-line react/forbid-prop-types
      onMouseEnter: PropTypes.func,
      onMouseLeave: PropTypes.func,
    })
  ),
  missing: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  width: PropTypes.number,
  height: PropTypes.number,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
}

EffectGrid.defaultProps = {
  columns: [],
  rows: [],
  data: [],
  missing: <div style={{ textAlign: 'left' }}>¯\_(ツ)_/¯</div>,
  width: null,
  height: null,
  margin: {},
}

export default EffectGrid
