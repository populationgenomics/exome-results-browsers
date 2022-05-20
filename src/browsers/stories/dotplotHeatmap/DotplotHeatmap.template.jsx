import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'

import DotplotHeatmap from '../../tob/shared/components/DotplotHeatmap'
import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'
import { useChartDimensions } from '../../tob/shared/hooks'

const cellLines = Object.keys(defaultCellTypeColors())

const DotplotHeatmapTooltip = ({ d }) => (
  <table>
    <tbody>
      {['x', 'y', 'expression', 'pvalue'].map((key) => {
        return (
          <tr key={`dotplotheatmap-tooltip-item-${key}`}>
            <td>
              <b>{key}: </b>
            </td>
            <td>{Number.isFinite(d[key]) ? d[key].toPrecision(4) : d[key]} </td>
          </tr>
        )
      })}
    </tbody>
  </table>
)

// eslint-disable-next-line react/forbid-prop-types
DotplotHeatmapTooltip.propTypes = { d: PropTypes.object.isRequired }

const DotplotHeatmapTemplate = ({ numRows }) => {
  const [ref, dimensions] = useChartDimensions()
  const [selected, setSelected] = useState(null)

  const rowNames = useMemo(() => Array.from({ length: numRows }, (_, i) => `Gene${i}`), [numRows])
  const data = useMemo(() => {
    return Array.from({ length: 14 * numRows }, (_, i) => ({
      pvalue: -1 * Math.log(Math.random()),
      expression: Math.random(),
      x: cellLines[i % 14],
      y: rowNames[Math.floor(i / 14)],
    }))
  }, [numRows, rowNames])

  const accessors = useMemo(() => {
    return {
      id: (d) => `${d.x}-${d.y}`,
      x: (d) => d.x,
      y: (d) => d.y,
      color: (d) => d.expression,
      size: (d) => d.pvalue,
      isSelected: (d) => `${d.x}-${d.y}` === `${selected?.x}-${selected?.y}`,
      tooltip: (d) => <DotplotHeatmapTooltip d={d} />,
    }
  }, [selected])

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <DotplotHeatmap
        id="my-dotplot"
        data={data}
        title="My Big Title Here"
        width={dimensions.boundedWidth}
        margin={{ left: 80, right: 220, top: 80, bottom: 80 }}
        accessors={accessors}
        onClick={(d) => {
          if (`${d.x}-${d.y}` === `${selected?.x}-${selected?.y}`) {
            setSelected(null)
          } else {
            setSelected(d)
          }
        }}
      />
    </div>
  )
}

DotplotHeatmapTemplate.propTypes = {
  numRows: PropTypes.number,
}

DotplotHeatmapTemplate.defaultProps = {
  numRows: 3,
}

export default DotplotHeatmapTemplate
