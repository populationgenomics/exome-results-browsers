import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { SizeMe } from 'react-sizeme'
// import { isEmpty } from 'lodash'

import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'
import { defaultCellTypeColors } from '../shared/utilities/constants'

import { PlotWrapper } from '../shared/utilities/styling'
import ViolinPlot from '../shared/components/ViolinPlot'

const TOBViolinPlot = ({ gene }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    const apiPath = `/api/genes/${gene}/residuals/`

    fetch(apiPath, { method: 'GET' })
      .then((r) => {
        if (r.ok) {
          r.json().then(
            (result) => {
              setResponse(result.results)
            },
            () => setError('Could not parse result')
          )
        } else {
          setError(`${r.status}: ${r.statusText}`)
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
  }, [gene])

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

  if (!response && isLoading) {
    return <StatusMessage>Loading</StatusMessage>
  }

  return (
    <>
      <LoadingOverlay active={isLoading}>
        <PlotWrapper>
          <SizeMe>
            {({ size }) => {
              // if (isEmpty(response)) {
              //   return (
              //     <div style={{ width: size.width }}>
              //       <StatusMessage>{`No data found for gene '${gene}'`}</StatusMessage>
              //     </div>
              //   )
              // }

              return (
                <ViolinPlot
                  width={size.width}
                  data={response || {}}
                  categoryColors={defaultCellTypeColors()}
                />
              )
            }}
          </SizeMe>
        </PlotWrapper>
      </LoadingOverlay>
    </>
  )
}

TOBViolinPlot.propTypes = {
  gene: PropTypes.string,
}

TOBViolinPlot.defaultProps = {
  gene: 'BRCA1',
}

export default TOBViolinPlot
