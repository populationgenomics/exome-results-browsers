import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import ViolinPlot from '../../tob/shared/components/ViolinPlotNew'
import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'
import { useChartDimensions } from '../../tob/shared/hooks'

const accessors = {
  id: (d) => d.id,
  x: (d) => d.id,
  y: (d) => d.counts,
  q1: (d) => d.q1,
  median: (d) => d.median,
  q3: (d) => d.q3,
  iqr: (d) => d.iqr,
  min: (d) => d.min,
  max: (d) => d.max,
  color: (d) => defaultCellTypeColors()[d.id] ?? 'black',
  tooltip: (d) => <ViolinPlotTooltip d={d} />,
}

const ViolinPlotTooltip = ({ d }) => (
  <table>
    <tbody>
      {['median', 'mean', 'min', 'max', 'q1', 'q3', 'iqr'].map((key) => {
        return (
          <tr key={`violin-tooltip-item-${key}`}>
            <td>
              <b>{key}: </b>
            </td>
            <td>{d[key].toPrecision(4)} </td>
          </tr>
        )
      })}
    </tbody>
  </table>
)

// eslint-disable-next-line react/forbid-prop-types
ViolinPlotTooltip.propTypes = { d: PropTypes.object.isRequired }

const ViolinPlotTemplate = ({ query, data }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)
  const [ref, dimensions] = useChartDimensions()

  const isEqtl = query?.toString()?.includes(':')

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
              setResponse(d)
              setError(null)
            })
            .catch((e) => setError(e))
        } else {
          r.json()
            .then((d) => {
              setResponse(null)
              setError(d.message)
            })
            .catch((e) => setError(e))
        }
      })
      .catch((e) => setError(e))
      .finally(() => setIsLoading(false))
  }, [query, isEqtl])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.toString()}</div>

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <ViolinPlot
        id={`${query}-violin-plot`}
        data={(query ? response : data) ?? {}}
        height={800}
        width={dimensions.boundedWidth}
        title={`${query} ${isEqtl ? 'Effect' : 'Expression'}`}
        yLabel={`${isEqtl ? 'Effect' : 'Expression'}`}
        margin={{ left: 80, right: 80, top: 80, bottom: 200 }}
        accessors={accessors}
      />
    </div>
  )
}

ViolinPlotTemplate.propTypes = {
  query: PropTypes.string,
  data: PropTypes.shape({
    histograms: PropTypes.arrayOf(PropTypes.object).isRequired,
    bins: PropTypes.arrayOf(
      PropTypes.shape({
        min: PropTypes.number.isRequired,
        max: PropTypes.number.isRequired,
      }).isRequired
    ),
  }),
}

ViolinPlotTemplate.defaultProps = {
  query: 'IL7',
  data: null,
}

export default ViolinPlotTemplate
