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

const TOBViolinPlot = ({ query, margin, height }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [ref, dimensions] = useChartDimensions()

  const isEqtl = useMemo(() => query?.toString()?.includes(':'), [query])

  const accessors = useMemo(() => {
    return {
      id: (d) => d.id,
      x: (d) => d.id,
      y: (d) => d.counts,
      q1: (d) => d.q1,
      median: (d) => d.median,
      mean: (d) => d.mean,
      q3: (d) => d.q3,
      iqr: (d) => d.iqr,
      min: (d) => d.min,
      max: (d) => d.max,
      color: (d) => {
        const key = query.includes(':') ? query.split(':').at(-2) : d.id
        return CELL_COLORS[key]
      },
      tooltip: (d) => <BoxplotTooltip statistics={d} />,
    }
  }, [query])

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
              if (!query.includes(':')) {
                // Gene query, sort historgrams by cell type id
                setData({ histograms: sortBy(d.histograms, 'id'), bins: d.bins })
              } else {
                setData(d)
              }
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
      <div style={{ height, width: dimensions.boundedWidth }}>
        <StatusMessage>
          Unable to load results
          <div>
            <small>{error.toString()}</small>
          </div>
        </StatusMessage>
      </div>
    )
  }

  // Catch initial load
  if (!data) {
    return (
      <div style={{ height, width: dimensions.boundedWidth }}>
        <StatusMessage>Loading</StatusMessage>
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
          yLabel="-log(CPM)"
          margin={margin}
          accessors={accessors}
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
}

TOBViolinPlot.defaultProps = {
  height: 600,
  margin: {},
}

export default TOBViolinPlot
