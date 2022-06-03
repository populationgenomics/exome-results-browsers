import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import { sortBy } from 'lodash'
import { isVariantId } from '@gnomad/identifiers'

import appPropTypes from '../shared/utilities/propTypes'

import DotplotHeatmap from '../shared/components/DotplotHeatmap'
import StatusMessage from '../shared/components/StatusMessage'
import AggregateTooltip from '../shared/components/AggregateTooltip'

const TOBAggregatePlot = ({
  query,
  selected,
  onClick,
  onRowClick,
  width,
  height,
  margin,
  cellTypes,
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  useEffect(() => {
    const isVariant = isVariantId(query)
    const endpoint = `/api/${isVariant ? 'variants' : 'genes'}/${query}/aggregate`

    setIsLoading(true)
    fetch(endpoint, { method: 'GET' })
      .then((res) => {
        if (!res.ok) {
          res
            .json()
            .then((e) => setError(`${e.message} (${e.type}`))
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        } else {
          res
            .json()
            .then((data) => {
              const sorted = sortBy(data, ['gene_symbol'])
              setResponse(sorted)
              setError(null)
              onClick(sorted[0])
            })
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const accessors = useMemo(() => {
    return {
      id: (d) => `${d.gene_symbol}-${d.cell_type_id}`,
      x: (d) => d.cell_type_id,
      y: (d) => d.gene_symbol,
      size: (d) => -Math.log10(d.min_p_value),
      color: (d) => d.mean_log_cpm,
      tooltip: (d) => <AggregateTooltip data={d} />,
      isSelected: (d) => {
        if (selected) return d.gene_id === selected?.gene_id
        if (response) return d.gene_id === sortBy(response, ['gene_id'])[0]?.gene_id
        return false
      },
      xTickHelp: (d) => cellTypes?.find((x) => x.cell_type_id === d).cell_type_name,
    }
  }, [selected, response, cellTypes])

  if (error) {
    return (
      <div style={{ height, width, display: 'flex', justifyContent: 'center' }}>
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
  if (isLoading || (!error && !response)) {
    return (
      <div style={{ height, width, display: 'flex', justifyContent: 'center' }}>
        <StatusMessage>Loading</StatusMessage>
      </div>
    )
  }

  return (
    <DotplotHeatmap
      id={`${query}-dot-plot`}
      data={response}
      width={width}
      margin={margin}
      onClick={onClick}
      onRowClick={onRowClick}
      accessors={accessors}
    />
  )
}

TOBAggregatePlot.propTypes = {
  query: PropTypes.string.isRequired,
  selected: appPropTypes.aggregate,
  width: PropTypes.number,
  height: PropTypes.number,
  margin: appPropTypes.margin,
  onClick: PropTypes.func,
  onRowClick: PropTypes.func,
  cellTypes: PropTypes.arrayOf(
    PropTypes.shape({
      cell_type_id: PropTypes.string,
      cell_type_name: PropTypes.string,
      description: PropTypes.string,
    })
  ),
}

TOBAggregatePlot.defaultProps = {
  selected: null,
  onClick: () => {},
  onRowClick: () => {},
  width: null,
  height: null,
  margin: { top: 20, right: 210, bottom: 0, left: 100 },
  cellTypes: null,
}

export default TOBAggregatePlot
