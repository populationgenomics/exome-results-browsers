import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import { SizeMe } from 'react-sizeme'

import Fetch from '../../base/Fetch'
import StatusMessage from '../../base/StatusMessage'

import { PlotWrapper } from './components/utilities/styling'
import Heatmap from './components/Heatmap'

const TOBAssociationHeatmap = ({ query, round, onChange }) => {
  const [apiPath, setApiPath] = useState(null)

  useEffect(() => {
    setApiPath(`/associations/aggregate/?query=${query}&round=${round}`)
  }, [query])

  if (!apiPath) {
    return <StatusMessage>Search for variant or region to see associations</StatusMessage>
  }

  return (
    <Fetch path={apiPath}>
      {({ data, error, loading }) => {
        if (loading) {
          return <StatusMessage>Loading</StatusMessage>
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
              <SizeMe>
                {({ size }) => {
                  return (
                    <Heatmap
                      id="association-heatmap"
                      width={size.width}
                      height={Math.min(800, 10 * geneNames?.length) || 1}
                      data={filledData}
                      title={'Maximum -log\u2081\u2080(p) variant association'}
                      colNames={cellTypeIds}
                      rowNames={geneNames}
                      tileSpacing={0.01}
                      tileRowName={(d) => d.geneName}
                      tileColName={(d) => d.cellTypeId}
                      minValue={0}
                      onClickTile={onChange}
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
                  )
                }}
              </SizeMe>
            </PlotWrapper>
          </>
        )
      }}
    </Fetch>
  )
}

TOBAssociationHeatmap.propTypes = {
  query: PropTypes.string.isRequired,
  round: PropTypes.number,
  onChange: PropTypes.func,
}

TOBAssociationHeatmap.defaultProps = {
  round: 1,
  onChange: () => {},
}

export { TileEventType } from './components/Heatmap'
export default TOBAssociationHeatmap
