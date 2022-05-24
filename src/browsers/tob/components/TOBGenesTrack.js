import React, { useEffect, useState } from 'react'

import { useChartDimensions } from '../shared/hooks'

import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'
import GenesTrack from '../shared/components/GenesTrack'
import propTypes from '../shared/utilities/propTypes'

const TOBGenesTrack = ({ queryRegion, displayRegion, margin }) => {
  const [ref, dimensions] = useChartDimensions()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [genes, setGenes] = useState(null)

  useEffect(() => {
    const region = `${queryRegion.chrom}:${queryRegion.start}-${queryRegion.stop}`
    const url = `/api/genes?region=${region}&expand=true`

    setIsLoading(true)
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          response
            .json()
            .then((e) => setError(`${e.message} (${e.type}`))
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        } else {
          response
            .json()
            .then((data) => {
              setGenes(data.map((g) => ({ ...g, exons: g.canonical_transcript?.features })))
              setError(null)
            })
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
  }, [queryRegion?.chrom, queryRegion?.start, queryRegion?.stop])

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

  // Initial load
  if (isLoading || (!error && !genes)) {
    return <StatusMessage>Loading</StatusMessage>
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <LoadingOverlay active={isLoading}>
        <GenesTrack
          genes={genes}
          region={displayRegion}
          width={dimensions.boundedWidth}
          margin={margin}
        />
      </LoadingOverlay>
    </div>
  )
}

TOBGenesTrack.propTypes = {
  queryRegion: propTypes.region.isRequired,
  displayRegion: propTypes.region.isRequired,
  margin: propTypes.margin,
}

TOBGenesTrack.defaultProps = {
  margin: null,
}

export default TOBGenesTrack
