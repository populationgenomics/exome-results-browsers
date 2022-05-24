import React, { useState } from 'react'
import PropTypes from 'prop-types'

import EffectGrid from '../../tob/shared/components/EffectGrid'

const EffectGridTemplate = ({ isEmpty }) => {
  const [hovered, setHovered] = useState(false)

  const [rows, setRows] = useState([
    {
      key: '17-123456-A-G',
      help: null,
      content: '17-123456-A-G',
      onClear: () => {
        setRows(rows.filter((r) => r.key !== '17-123456-A-G'))
      },
    },
    { key: '17-123457-G-A', help: null, content: '17-123457-G-A', onClear: null },
    { key: '17-123458-T-C', help: null, content: '17-123458-T-C', onClear: null },
  ])

  const [columns, setColumns] = useState([
    { key: 'variant', help: null, content: 'Variant', onClear: null },
    {
      key: 'bin',
      help: 'B Memory Cells',
      content: 'bin',
      onClear: () => {
        setColumns(columns.filter((c) => c.key !== 'bin'))
      },
    },
    { key: 'cd8', help: 'CD8 Cells', content: 'cd8', onClear: null },
    { key: 'cd4', help: 'CD4 Cells', content: 'cd4', onClear: null },
  ])

  const data = [
    {
      row: '17-123457-G-A',
      column: 'bin',
      content: (
        <div
          style={{
            border: hovered ? '1px solid black' : null,
            width: 'calc(100% - 2px)',
            height: 'calc(100% - 2px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          Hello, world
        </div>
      ),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  ]

  return <EffectGrid columns={isEmpty ? [] : columns} rows={isEmpty ? [] : rows} data={data} />
}

EffectGridTemplate.propTypes = {
  isEmpty: PropTypes.bool,
}

EffectGridTemplate.defaultProps = {
  isEmpty: false,
}

export default EffectGridTemplate
