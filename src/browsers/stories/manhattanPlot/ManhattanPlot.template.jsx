import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'
import { useChartDimensions } from '../../tob/shared/hooks'

import ManhattanPlot from '../../tob/shared/components/ManhattanPlotNew'

const cellLines = Object.keys(defaultCellTypeColors())

const ManhattanPlotTooltip = ({ d }) => {
  return (
    <table>
      <tbody>
        <tr>
          <td>
            <b>Id: </b>
          </td>
          <td>{d.id}</td>
        </tr>
        <tr>
          <td>
            <b>Cell type: </b>
          </td>
          <td>{d.cellLine} </td>
        </tr>
        <tr>
          <td>
            <b>P-value: </b>
          </td>
          <td>{d.pvalue.toPrecision(2)} </td>
        </tr>
        <tr>
          <td>
            <b>-log10(p): </b>
          </td>
          <td> {-1 * Math.log(d.pvalue).toFixed(2)} </td>
        </tr>
        <tr>
          <td>
            <b>Functional annotation: </b>
          </td>
          <td>{d.functional_annotation ?? '?'} </td>
        </tr>
      </tbody>
    </table>
  )
}

// eslint-disable-next-line react/forbid-prop-types
ManhattanPlotTooltip.propTypes = { d: PropTypes.object.isRequired }
ManhattanPlotTooltip.defaultProps = {}

const ManhattanPlotTemplate = ({ numCellLines, selected, referenced }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState()
  const [coords, setCoords] = useState()
  const [ref, dimensions] = useChartDimensions()

  const accessors = {
    id: (d) => d.id,
    x: (d) => d.position,
    y: (d) => -1 * Math.log(d.pvalue),
    color: (d) => d.cellColour,
    cellLine: (d) => d.cellLine,
    isSelected: (d) => d.selected,
    isReference: (d) => d.referenced,
    opacity: (d) => d.opacity,
    tooltip: (d) => <ManhattanPlotTooltip d={d} />,
  }

  const height = 500
  const margins = { left: 80, right: 220, top: 80, bottom: 80 }
  const thresholds = [0.05, 0.01].map((item) => -1 * Math.log(item))

  useEffect(() => {
    setIsLoading(true)
    const myData = Array.from({ length: 300 * numCellLines }, (_, i) => ({
      pvalue: Math.random(),
      opacity: Math.random(),
      position: Math.floor(Math.random() * 4e6),
      cellLine: cellLines[i % numCellLines],
      cellColour: defaultCellTypeColors()[cellLines[i % numCellLines]],
      selected: selected ? Math.random() < 0.01 : false,
      referenced: referenced ? Math.random() < 0.01 : false,
      id: i,
    }))

    setData(myData)
    setCoords([
      Math.min(...myData.map((d) => d.position)),
      Math.max(...myData.map((d) => d.position)),
    ])
    setIsLoading(false)
  }, [numCellLines, referenced, selected])

  const handleBrush = (start, end) => {
    setCoords([start, end])
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <ManhattanPlot
        id="my-manhattan-plot"
        title="My Manhattan Plot"
        data={data.filter((item) => item.position >= coords[0] && item.position <= coords[1])}
        thresholds={thresholds}
        width={dimensions.boundedWidth}
        height={height}
        margins={margins}
        onBrush={handleBrush}
        accessors={accessors}
      />
    </div>
  )
}

ManhattanPlotTemplate.propTypes = {
  numCellLines: PropTypes.number,
  selected: PropTypes.bool,
  referenced: PropTypes.bool,
}

ManhattanPlotTemplate.defaultProps = {
  numCellLines: 3,
  selected: false,
  referenced: false,
}

export default ManhattanPlotTemplate
