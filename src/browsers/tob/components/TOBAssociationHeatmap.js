/* eslint-disable camelcase */
import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { SizeMe } from 'react-sizeme'

import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'
import { PlotWrapper } from '../shared/utilities/styling'
import Heatmap from '../shared/components/Heatmap'

const TOBAssociationHeatmap = ({ query, gene, round, selectedTiles, onChange }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    const apiPath = `/api/associations/aggregate/?query=${gene ?? query}&round=${round}`

    fetch(apiPath, { method: 'GET' })
      .then((r) => {
        if (r.ok) {
          r.json().then(
            ({ results }) => {
              // Pre-select first row for a gene search or first cell for other searches
              if (!selectedTiles?.length) {
                const firstGene = results.data
                  .filter((d) => Number.isFinite(d.value))
                  .sort((a, b) => a.gene > b.gene)[0]?.gene

                const firstRow = results.data
                  .filter((d) => firstGene && d.gene === firstGene)
                  .filter((d) => Number.isFinite(d.value))

                onChange(
                  gene ? firstRow : [firstRow.sort((a, b) => a.cell_type_id > b.cell_type_id)[0]]
                )
              }

              setResponse({ ...results })
            },
            () => setError('Could not parse result')
          )
        } else if (r.status === 400) {
          r.json()
            .then((result) => setError(result.error))
            .catch(() => setError('Could not parse result'))
        } else {
          setError(`${r.status}: ${r.statusText}`)
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
  }, [query, gene, round])

  if (error) {
    return (
      <StatusMessage>
        <small>{error.toString().replace('Error:', '')}</small>
      </StatusMessage>
    )
  }

  if (!response?.data && isLoading) {
    return <StatusMessage>Loading</StatusMessage>
  }

  return (
    <>
      <LoadingOverlay active={isLoading}>
        <PlotWrapper>
          <SizeMe>
            {({ size }) => {
              if (!response?.data?.length > 0) {
                return (
                  <StatusMessage>{`No associations were found for query '${query}'`}</StatusMessage>
                )
              }

              return (
                <Heatmap
                  id="association-heatmap"
                  width={size.width}
                  height={gene ? 200 : 800}
                  data={response.data}
                  title={'Maximum -log\u2081\u2080(p) variant association'}
                  colNames={response.cell_type_ids.sort()}
                  rowNames={response.gene_names.sort()}
                  tileSpacing={0.01}
                  tileRowName={(d) => d.gene}
                  tileColName={(d) => d.cell_type_id}
                  minValue={0}
                  maxValue={4}
                  onClickTile={onChange}
                  selectedTiles={selectedTiles}
                  tileValue={(d) => Math.min(4, -Math.log10(d.value))}
                  tileIsDefined={(d) => Number.isFinite(d.value)}
                  tileTooltip={(d) => {
                    if (!Number.isFinite(d.value)) {
                      return `No associations found`
                    }
                    return `${d.gene} - ${d.cell_type_id}: ${Math.min(
                      4,
                      -Math.log10(d.value)
                    ).toFixed(2)}`
                  }}
                />
              )
            }}
          </SizeMe>
        </PlotWrapper>
      </LoadingOverlay>
    </>
  )
}

TOBAssociationHeatmap.propTypes = {
  query: PropTypes.string.isRequired,
  gene: PropTypes.string,
  selectedTiles: PropTypes.arrayOf(
    PropTypes.shape({
      gene: PropTypes.string.isRequired,
      cell_type_id: PropTypes.string.isRequired,
    })
  ),
  round: PropTypes.number,
  onChange: PropTypes.func,
}

TOBAssociationHeatmap.defaultProps = {
  round: 1,
  gene: null,
  selectedTiles: [],
  onChange: () => {},
}

export { TileEventType } from '../shared/components/Heatmap'
export default TOBAssociationHeatmap
