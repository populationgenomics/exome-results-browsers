import React, { useCallback, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { extent } from 'd3'
import ManhattanPlotNew from '../../tob/shared/components/ManhattanPlotNew'
import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'

export const ManhattanPlot = ({ numCellLines, selected, referenced }) => {
  const columnNames = Object.keys(defaultCellTypeColors())

  const xAccessor = (d) => d.position
  const yAccessor = (d) => -1 * Math.log(d.pvalue)
  const cellLineAccessor = (d) => d.cellLine
  const colorAccessor = (d) => d.cellColour
  const isSelected = (d) => d.selected
  const isReference = (d) => d.referenced
  const opacity = (d) => d.opacity
  const tooltip = (d) => (
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
  const id = (d) => d.id

  const width = 1000
  const height = 500
  const margins = { left: 80, right: 220, top: 80, bottom: 80 }
  const thresholds = [0.05, 0.01].map((item) => -1 * Math.log(item))

  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState()
  const [coords, setCoords] = useState()
  useEffect(() => {
    const myData = Array.from({ length: 300 * numCellLines }, (_, i) => ({
      pvalue: Math.random(),
      opacity: Math.random(),
      position: Math.floor(Math.random() * 4000000 + 1000000),
      cellLine: columnNames[i % numCellLines],
      cellColour: defaultCellTypeColors()[columnNames[i % numCellLines]],
      selected: selected ? Math.random() < 0.01 : false,
      referenced: referenced ? Math.random() < 0.01 : false,
      id: i,
    }))
    setData(myData)
    setCoords(extent(myData, xAccessor))
    setIsLoading(false)
  }, [])

  const handleBrush = useCallback(
    (start, end) => {
      setCoords([start, end])
    },
    [data]
  )

  return (
    <>
      {!isLoading && (
        <ManhattanPlotNew
          id="Test"
          data={data.filter((item) => item.position >= coords[0] && item.position <= coords[1])}
          thresholds={thresholds}
          width={width}
          height={height}
          margins={margins}
          onBrush={handleBrush}
          accessors={{
            x: xAccessor,
            y: yAccessor,
            color: colorAccessor,
            cellLine: cellLineAccessor,
            isSelected,
            isReference,
            opacity,
            tooltip,
            id,
          }}
        />
      )}
    </>
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
