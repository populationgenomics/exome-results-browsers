import React, { useEffect, useState } from 'react'
// import PropTypes from 'prop-types'
import { SizeMe } from 'react-sizeme'

import StatusMessage from '../../base/StatusMessage'

import LoadingOverlay from './components/LoadingOverlay'
import { PlotWrapper } from './components/utilities/styling'
import ViolinPlot from './components/ViolinPlot'

const TOBViolinPlot = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    const apiPath = `/api/genes/BRCA1/residuals/`

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
  }, [])

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
              // if (!response?.data?.length > 0) {
              //   return (
              //     <StatusMessage>{`No associations were found for query '${query}'`}</StatusMessage>
              //   )
              // }

              return <ViolinPlot width={size.width} data={response || {}} />
            }}
          </SizeMe>
        </PlotWrapper>
      </LoadingOverlay>
    </>
  )
}

TOBViolinPlot.propTypes = {
  // query: PropTypes.string.isRequired,
  // selectedTiles: PropTypes.arrayOf(
  //   PropTypes.shape({
  //     geneName: PropTypes.string.isRequired,
  //     cellTypeId: PropTypes.string.isRequired,
  //   })
  // ),
  // round: PropTypes.number,
  // onChange: PropTypes.func,
}

TOBViolinPlot.defaultProps = {
  // round: 1,
  // selectedTiles: [],
  // onChange: () => {},
}

export default TOBViolinPlot
