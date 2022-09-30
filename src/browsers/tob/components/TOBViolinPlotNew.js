import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import { sortBy } from 'lodash'

import { defaultCellTypeColors } from '../shared/utilities/constants'
import { useChartDimensions } from '../shared/hooks'

import ViolinPlot from '../shared/components/ViolinPlotNew'
import BoxplotTooltip from '../shared/components/BoxplotTooltip'
import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'

const CELL_COLORS = defaultCellTypeColors()

const TOBViolinPlot = ({ query, margin, height, yLabel, fontSize, cellTypes }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [ref, dimensions] = useChartDimensions()

  const isEqtl = useMemo(
    () => query?.toString()?.includes(':') || query?.toString()?.includes('-'),
    [query]
  )

  const accessors = useMemo(() => {
    return {
      id: (d) => d.id,
      x: (d) => d.id,
      y: (d) => d.counts,
      bins: (d) => d.bins,
      q1: (d) => d.q1,
      median: (d) => d.median,
      mean: (d) => d.mean,
      q3: (d) => d.q3,
      iqr: (d) => d.iqr,
      min: (d) => d.min,
      max: (d) => d.max,
      color: (d) => {
        let key = d.id
        if (query.includes('-')) {
          key = query.split('-').at(-2)
        } else if (query.includes(':')) {
          key = query.split(':').at(-2)
        }

        return CELL_COLORS[key]
      },
      tooltip: (d) => <BoxplotTooltip statistics={d} />,
      xTickHelp: (d) => cellTypes?.find((x) => x.cell_type_id === d).cell_type_name,
    }
  }, [query, cellTypes])

  useEffect(() => {
    if (!query) return

    let endpoint = `/api/genes/${query}/expression`
    if (isEqtl) {
      endpoint = `/api/associations/${encodeURIComponent(query)}/effect`
    }

    setIsLoading(true)
    fetch(endpoint, { method: 'GET' })
      .then((r) => {
        if (r.ok) {
          r.json()
            .then((d) => {
              setData(sortBy(d, 'id'))
              setError(null)
            })
            .catch((e) => setError(e))
        } else {
          r.json()
            .then((d) => {
              setData(null)
              setError(d.message)
            })
            .catch((e) => setError(e))
        }
      })
      .catch((e) => setError(e))
      .finally(() => setIsLoading(false))
  }, [query, isEqtl])

  // Render
  if (error) {
    return (
      <div ref={ref} style={{ width: '100%' }}>
        <div
          style={{
            height,
            width: dimensions.boundedWidth,
            fontSize,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <StatusMessage>
            Unable to load results
            <div>
              <small>{error.toString()}</small>
            </div>
          </StatusMessage>
        </div>
      </div>
    )
  }

  // Catch initial load
  if (!data) {
    return (
      <div ref={ref} style={{ width: '100%' }}>
        <div
          style={{
            height,
            width: dimensions.boundedWidth,
            fontSize,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <StatusMessage>Loading</StatusMessage>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <LoadingOverlay active={isLoading}>
        <ViolinPlot
          id={`${query}-violin-plot`}
          data={data}
          height={height}
          width={dimensions.boundedWidth}
          yLabel={yLabel}
          margin={margin}
          accessors={accessors}
          fontSize={fontSize}
          cellTypes={cellTypes}
        />
      </LoadingOverlay>
    </div>
  )
}

TOBViolinPlot.propTypes = {
  query: PropTypes.string.isRequired,
  height: PropTypes.number,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
  yLabel: PropTypes.string,
  fontSize: PropTypes.number,
  cellTypes: PropTypes.arrayOf(
    PropTypes.shape({
      cell_type_id: PropTypes.string,
      cell_type_name: PropTypes.string,
      description: PropTypes.string,
    })
  ),
}

TOBViolinPlot.defaultProps = {
  height: 600,
  margin: {},
  yLabel: 'log(CPM)',
  fontSize: 14,
  cellTypes: null,
}

export default TOBViolinPlot
