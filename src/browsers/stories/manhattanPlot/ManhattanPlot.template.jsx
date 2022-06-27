import React, { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

import { uniqBy } from 'lodash'
import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'
import { useChartDimensions } from '../../tob/shared/hooks'

import ManhattanPlot from '../../tob/shared/components/ManhattanPlotNew'

const cellLines = Object.keys(defaultCellTypeColors())

const ManhattanPlotTooltipButton = styled.button`
  display: block;
  margin-top: 4px;
`

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

const ManhattanPlotTemplate = ({ numCellLines }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState(null)
  const [coords, setCoords] = useState(null)
  const [orginalCoords, setOriginalCoords] = useState(null)
  const [ref, dimensions] = useChartDimensions()
  const [ldReference, setLdReference] = useState(null)
  const [selected, setSelected] = useState([])

  const height = 500
  const margin = { left: 80, right: 100, top: 80, bottom: 100 }
  const thresholds = [0.05, 0.01].map((item) => ({ label: 'FDR', value: -1 * Math.log10(item) }))

  useEffect(() => {
    setIsLoading(true)
    const _data = Array.from({ length: 300 * numCellLines }, (_, i) => ({
      pvalue: Math.random(),
      opacity: Math.random(),
      position: Math.floor(Math.random() * 4e6),
      cellColour: defaultCellTypeColors()[cellLines[i % numCellLines]],
      id: i,
    }))

    const xMin = Math.min(..._data.map((d) => d.position))
    const xMax = Math.max(..._data.map((d) => d.position))
    const yMin = Math.min(..._data.map((d) => -1 * Math.log10(d.pvalue)))
    const yMax = Math.max(..._data.map((d) => -1 * Math.log10(d.pvalue)))

    const region = {
      x: {
        start: Number.isFinite(xMin) ? xMin : 0,
        stop: Number.isFinite(xMax) ? xMax : 100000,
      },
      y: {
        start: Number.isFinite(yMin) ? yMin : 0,
        stop: Number.isFinite(yMax) ? yMax : 5,
      },
    }
    setCoords(region)
    setOriginalCoords(region)

    setData(_data)
    setIsLoading(false)
  }, [numCellLines])

  const accessors = useMemo(() => {
    return {
      id: (d) => d.id,
      x: (d) => d.position,
      y: (d) => -1 * Math.log10(d.pvalue),
      color: (d) => d.cellColour,
      isSelected: (d) => selected.find((x) => x.id === d.id),
      isReference: (d) => d.id === ldReference?.id,
      opacity: (d) => d.opacity,
      tooltip: (d) => (
        <div>
          <ManhattanPlotTooltip d={d} />
          <br />
          <ManhattanPlotTooltipButton
            type="button"
            onClick={() => (d.id === ldReference?.id ? setLdReference(null) : setLdReference(d))}
          >
            {d.id === ldReference?.id ? 'Remove LD reference' : 'Set LD reference'}
          </ManhattanPlotTooltipButton>
          <ManhattanPlotTooltipButton
            type="button"
            onClick={() =>
              selected.find((x) => x.id === d.id)
                ? setSelected(selected.filter((x) => x.id !== d.id))
                : setSelected(uniqBy([...selected, d], 'id'))
            }
          >
            {selected.find((x) => x.id === d.id) ? 'Remove from grid' : 'Add to grid'}
          </ManhattanPlotTooltipButton>
          {/* eslint-disable-next-line no-alert */}
          <ManhattanPlotTooltipButton type="button" onClick={() => alert('Conditioned')}>
            Condition on this eQTL
          </ManhattanPlotTooltipButton>
        </div>
      ),
    }
  }, [ldReference, selected])

  const filteredData = useMemo(() => {
    return (data ?? []).filter((item) =>
      coords?.x && coords?.y
        ? accessors.x(item) >= coords?.x?.start &&
          accessors.x(item) <= coords?.x?.stop &&
          accessors.y(item) >= coords?.y?.start &&
          accessors.y(item) <= coords?.y?.stop
        : true
    )
  }, [coords, data, accessors])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <ManhattanPlot
        id="my-manhattan-plot"
        title="My Manhattan Plot"
        data={filteredData}
        thresholds={thresholds}
        width={dimensions.boundedWidth}
        height={height}
        margin={margin}
        onBrush={(r) => setCoords(r)}
        onDoubleClick={() => setCoords(orginalCoords)}
        accessors={accessors}
        xDomain={coords.x}
        yDomain={coords.y}
      />
      <div>
        <span>Selected: </span>
        {selected.map((item) => (
          <span style={{ marginRight: 4 }} key={item.id}>
            {item.id},
          </span>
        ))}
      </div>
    </div>
  )
}

ManhattanPlotTemplate.propTypes = {
  numCellLines: PropTypes.number,
}

ManhattanPlotTemplate.defaultProps = {
  numCellLines: 5,
}

export default ManhattanPlotTemplate
