import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { SizeMe } from 'react-sizeme'

import StatusMessage from '../../base/StatusMessage'

import LoadingOverlay from './components/LoadingOverlay'
import { PlotWrapper } from './components/utilities/styling'
import Heatmap from './components/Heatmap'

const TOBAssociationHeatmap = ({ query, round, selectedTiles, onChange }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    const apiPath = `/api/associations/aggregate/?query=${query}&round=${round}`

    fetch(apiPath, { method: 'GET' })
      .then((r) => {
        if (r.ok) {
          r.json().then(
            (result) => {
              const { geneNames, cellTypeIds, range, data } = result.results
              const filledData = [...data]

              if (filledData.length > 0) {
                cellTypeIds.forEach((cellTypeId) => {
                  geneNames.forEach((geneName) => {
                    if (
                      !filledData.find(
                        (d) => d.geneName === geneName && d.cellTypeId === cellTypeId
                      )
                    ) {
                      filledData.push({ geneName, cellTypeId, value: NaN })
                    }
                  })
                })
              }

              setResponse({ geneNames, cellTypeIds, range, data: filledData })
            },
            () => setError('Could not parse result')
          )
        } else {
          setError(`${r.status}: ${r.statusText}`)
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
  }, [query, round])

  if (error) {
    return (
      <StatusMessage>
        Unable to load results
        <div>
          <small>{error.toString().replace('Error:', '')}</small>
        </div>
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
                  height={Math.min(1200, 10 * response.geneNames?.length) || 1}
                  data={response.data}
                  title={'Maximum -log\u2081\u2080(p) variant association'}
                  colNames={response.cellTypeIds}
                  rowNames={response.geneNames}
                  tileSpacing={0.01}
                  tileRowName={(d) => d.geneName}
                  tileColName={(d) => d.cellTypeId}
                  minValue={0}
                  onClickTile={onChange}
                  selectedTiles={selectedTiles}
                  maxValue={Math.min(4, -Math.log10(response.range.minValue))}
                  tileValue={(d) => Math.min(4, -Math.log10(d.value))}
                  tileIsDefined={(d) => Number.isFinite(d.value)}
                  tileTooltip={(d) => {
                    if (!Number.isFinite(d.value)) {
                      return `No associations found`
                    }
                    return `${d.geneName} - ${d.cellTypeId}: ${-Math.log(d.value).toFixed(2)}`
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
  selectedTiles: PropTypes.arrayOf(
    PropTypes.shape({
      geneName: PropTypes.string.isRequired,
      cellTypeId: PropTypes.string.isRequired,
    })
  ),
  round: PropTypes.number,
  onChange: PropTypes.func,
}

TOBAssociationHeatmap.defaultProps = {
  round: 1,
  selectedTiles: [],
  onChange: () => {},
}

export { TileEventType } from './components/Heatmap'
export default TOBAssociationHeatmap
