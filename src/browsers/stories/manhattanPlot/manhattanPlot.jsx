import React from 'react'
import PropTypes from 'prop-types'
import ManhattanPlotNew from '../../tob/shared/components/ManhattanPlotNew'
import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'

export const ManhattanPlot = ({ numCellLines, selected, referenced }) => {
  const columnNames = Object.keys(defaultCellTypeColors())
  // const rowNames = Array.from({ length: numCellLines }, (_, i) => `Gene${i}`)
  const data = Array.from({ length: 300 * numCellLines }, (_, i) => ({
    pvalue: -1 * Math.log(Math.random()),
    position: Math.floor(Math.random() * 4000000 + 1000000),
    cellLines: columnNames[i % numCellLines],
    selected: selected ? Math.random() < 0.01 : false,
    referenced: referenced ? Math.random() < 0.01 : false,
  }))

  const xAccessor = (d) => d.position
  const yAccessor = (d) => d.pvalue
  const colorAccessor = (d) => d.cellLines
  const isSelected = (d) => d.selected
  const isReference = (d) => d.referenced

  const width = 1000
  const height = 500
  const margin = { left: 80, right: 220, top: 80, bottom: 80 }
  const thresholds = [0.05, 0.01]

  return (
    <ManhattanPlotNew
      id="Test"
      data={data}
      thresholds={thresholds}
      width={width}
      height={height}
      margin={margin}
      accessors={{ x: xAccessor, y: yAccessor, color: colorAccessor, isSelected, isReference }}
    />
  )
}

ManhattanPlot.propTypes = {
  numCellLines: PropTypes.number,
  selected: PropTypes.bool,
  referenced: PropTypes.bool,
}

ManhattanPlot.defaultProps = {
  numCellLines: 3,
  selected: false,
  referenced: false,
}

export default ManhattanPlot
