import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import Fetch from '../../base/Fetch'
import StatusMessage from '../../base/StatusMessage'

import { PlotWrapper } from '../utilities/styling'

import AutosizedHeatmap from './components/AutosizedHeatmap'

const TOBAssociationHeatmap = ({ query }) => {
  const [apiPath, setApiPath] = useState(null)

  useEffect(() => {
    setApiPath(`/heatmap/?search=${query}`)
  }, [query])

  if (!apiPath) {
    return <StatusMessage>Search for variant or region to see associations</StatusMessage>
  }

  return (
    <Fetch path={apiPath} params>
      {({ data, error, loading }) => {
        if (loading) {
          return <StatusMessage>Loading results...</StatusMessage>
        }

        if (error || !(data || {}).results) {
          return (
            <StatusMessage>
              Unable to load results
              <div>
                <small>{error.toString().replace('Error:', '')}</small>
              </div>
            </StatusMessage>
          )
        }

        const { range, geneNames, cellTypeIds } = data.results

        if (!data.results.data.length) {
          return <StatusMessage>No associations found</StatusMessage>
        }

        const filledData = [...data.results.data]
        cellTypeIds.forEach((cellTypeId) => {
          geneNames.forEach((geneName) => {
            if (!filledData.find((d) => d.geneName === geneName && d.cellTypeId === cellTypeId)) {
              filledData.push({ geneName, cellTypeId, value: NaN })
            }
          })
        })

        return (
          <>
            <PlotWrapper>
              <AutosizedHeatmap
                id="association-heatmap"
                results={filledData}
                title={'Maximum -log\u2081\u2080(p) variant association'}
                colNames={cellTypeIds}
                rowNames={geneNames}
                tileSpacing={0.01}
                tileRowName={(d) => d.geneName}
                tileColName={(d) => d.cellTypeId}
                minValue={0}
                maxValue={Math.min(4, -Math.log10(range.minValue))}
                tileValue={(d) => Math.min(4, -Math.log10(d.value))}
                tileIsDefined={(d) => Number.isFinite(d.value)}
                tileTooltip={(d) => {
                  if (!Number.isFinite(d.value)) {
                    return `No associations found`
                  }
                  return `${d.geneName} - ${d.cellTypeId}: ${-Math.log(d.value).toFixed(2)}`
                }}
              />
            </PlotWrapper>
          </>
        )
      }}
    </Fetch>
  )
}

TOBAssociationHeatmap.propTypes = {
  query: PropTypes.string.isRequired,
}

export { TileEventType } from './components/AutosizedHeatmap'
export default TOBAssociationHeatmap
