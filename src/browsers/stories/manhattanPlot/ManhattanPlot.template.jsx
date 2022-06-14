import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'
import { useChartDimensions } from '../../tob/shared/hooks'

import ManhattanPlot from '../../tob/shared/components/ManhattanPlotNew'

const cellLines = Object.keys(defaultCellTypeColors())

const ManhattanPlotTooltip = (d) => {
  return `<table>
      <tbody>
        <tr>
          <td>
            <b>Id: </b>
          </td>
          <td>${d.id}</td>
        </tr>
        <tr>
          <td>
            <b>Cell type: </b>
          </td>
          <td>${d.cellLine} </td>
        </tr>
        <tr>
          <td>
            <b>P-value: </b>
          </td>
          <td>${d.pvalue.toPrecision(2)} </td>
        </tr>
        <tr>
          <td>
            <b>-log10(p): </b>
          </td>
          <td> ${-1 * Math.log(d.pvalue).toFixed(2)} </td>
        </tr>
        <tr>
          <td>
            <b>Functional annotation: </b>
          </td>
          <td>${d.functional_annotation ?? '?'} </td>
        </tr>
      </tbody>
    </table>
    <br/>
    <a href='#' onclick='alert("Make Reference Clicked"); event.preventDefault();'>Make LD Reference</a><br/>
    <a href='#' onclick='alert("Condition Clicked"); event.preventDefault();'>Condition on this eQTL</a><br/>
    <a href='#' onclick='alert("Added to eQTL Effect Grid"); event.preventDefault();'>Add to eQTL Effect Grid</a>`
}

// eslint-disable-next-line react/forbid-prop-types
ManhattanPlotTooltip.propTypes = { d: PropTypes.object.isRequired }
ManhattanPlotTooltip.defaultProps = {}

const accessors = {
  id: (d) => d.id,
  x: (d) => d.position,
  y: (d) => -1 * Math.log10(d.pvalue),
  color: (d) => d.cellColour,
  isSelected: (d) => d.selected,
  isReference: (d) => d.referenced,
  opacity: (d) => d.opacity,
  tooltip: (d) => ManhattanPlotTooltip(d),
}

const ManhattanPlotTemplate = ({ numCellLines, selected, referenced }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState(null)
  const [coords, setCoords] = useState(null)
  const [orginalCoords, setOriginalCoords] = useState(null)
  const [ref, dimensions] = useChartDimensions()

  const height = 500
  const margin = { left: 80, right: 100, top: 80, bottom: 100 }
  const thresholds = [0.05, 0.01].map((item) => -1 * Math.log10(item))

  useEffect(() => {
    setIsLoading(true)
    const myData = Array.from({ length: 300 * numCellLines }, (_, i) => ({
      pvalue: Math.random(),
      opacity: Math.random(),
      position: Math.floor(Math.random() * 4e6),
      cellColour: defaultCellTypeColors()[cellLines[i % numCellLines]],
      selected: selected ? Math.random() < 0.01 : false,
      referenced: referenced ? Math.random() < 0.01 : false,
      id: i,
    }))

    setData(myData)

    const region = {
      x: {
        start: Math.min(...myData.map(accessors.x)),
        stop: Math.max(...myData.map(accessors.x)),
      },
      y: {
        start: Math.min(...myData.map(accessors.y)),
        stop: Math.max(...myData.map(accessors.y)),
      },
    }

    setCoords(region)
    setOriginalCoords(region)

    setIsLoading(false)
  }, [numCellLines, referenced, selected])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <ManhattanPlot
        id="my-manhattan-plot"
        title="My Manhattan Plot"
        data={data.filter((item) =>
          coords?.x && coords?.y
            ? accessors.x(item) >= coords?.x?.start &&
              accessors.x(item) <= coords?.x?.stop &&
              accessors.y(item) >= coords?.y?.start &&
              accessors.y(item) <= coords?.y?.stop
            : true
        )}
        thresholds={thresholds}
        width={dimensions.boundedWidth}
        height={height}
        margin={margin}
        onBrush={(r) => setCoords(r)}
        onDoubleClick={() => setCoords(orginalCoords)}
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
