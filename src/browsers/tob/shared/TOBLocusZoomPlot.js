import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { SizeMe } from 'react-sizeme'
import { isRegionId, isVariantId, parseRegionId, parseVariantId } from '@gnomad/identifiers'

import ManhattanPlot from './components/ManhattanPlot'
import GenesTrack from './components/GenesTrack'
import RegionControls from './components/RegionControls'
import { PlotWrapper } from './components/utilities/styling'
import StatusMessage from '../../base/StatusMessage'
import LoadingOverlay from './components/LoadingOverlay'

const stringifyRegion = ({ chrom, start, stop }) => {
  return `${chrom}-${start}-${stop}`
}

const parseQueryToRegion = (query) => {
  if (isRegionId(query)) {
    return parseRegionId(query)
  }

  if (isVariantId(query)) {
    const variant = parseVariantId(query)
    return parseRegionId(
      stringifyRegion({
        chrom: variant.chrom,
        start: Math.max(1, variant.pos - 2e6),
        stop: variant.pos + 2e6,
      })
    )
  }

  return null
}

const TOBLocusZoomPlot = ({ query, onChange, genes, cellTypes }) => {
  const [innerRegion, setInnerRegion] = useState(parseQueryToRegion(query))

  const [isManhattanPlotLoading, setIsManhattanPlotLoading] = useState(true)
  const [manhattanPlotError, setManhattanPlotError] = useState(null)
  const [manhattanPlotResponse, setManhattanPlotResponse] = useState(null)

  const [isGeneTrackLoading, setIsGeneTrackLoading] = useState(true)
  const [geneTrackError, setGeneTrackError] = useState(null)
  const [geneTrackResponse, setGeneTrackResponse] = useState(null)

  useEffect(() => {
    setInnerRegion(parseQueryToRegion(query))
  }, [query])

  useEffect(() => {
    setIsManhattanPlotLoading(true)

    const region = stringifyRegion(parseQueryToRegion(query))
    let apiPath = `/api/associations/?region=${region}`

    if (genes) {
      apiPath += `&genes=${genes.join(',')}`
    }

    if (cellTypes) {
      apiPath += `&cellTypes=${cellTypes.join(',')}`
    }

    fetch(apiPath, { method: 'GET' })
      .then((r) => {
        if (r.ok) {
          r.json().then(
            (result) => {
              setManhattanPlotResponse(result)
            },
            () => setManhattanPlotError('Could not parse result')
          )
        } else {
          setManhattanPlotError(`${r.status}: ${r.statusText}`)
        }
      })
      .catch((e) => setManhattanPlotError(e.toString()))
      .finally(() => setIsManhattanPlotLoading(false))
  }, [query, genes, cellTypes])

  useEffect(() => {
    setIsGeneTrackLoading(true)

    const region = stringifyRegion(parseQueryToRegion(query))
    const apiPath = `/api/genes/?query=${region}`

    fetch(apiPath, { method: 'GET' })
      .then((r) => {
        if (r.ok) {
          r.json().then(
            (result) => {
              setGeneTrackResponse(result)
            },
            () => setGeneTrackError('Could not parse result')
          )
        } else {
          setGeneTrackError(`${r.status}: ${r.statusText}`)
        }
      })
      .catch((e) => setGeneTrackError(e.toString()))
      .finally(() => setIsGeneTrackLoading(false))
  }, [query])

  const renderManhattanPlot = useCallback(() => {
    if (!manhattanPlotResponse?.results && isManhattanPlotLoading) {
      return <StatusMessage>Loading</StatusMessage>
    }

    if (manhattanPlotError) {
      return (
        <StatusMessage>
          Unable to load results
          <div>
            <small>{manhattanPlotError.toString().replace('Error:', '')}</small>
          </div>
        </StatusMessage>
      )
    }

    return (
      <LoadingOverlay active={isManhattanPlotLoading}>
        <PlotWrapper>
          <SizeMe>
            {({ size }) => {
              return (
                <ManhattanPlot
                  data={manhattanPlotResponse?.results || []}
                  width={size.width}
                  onChange={onChange}
                  innerRegion={innerRegion}
                  setInnerRegion={setInnerRegion}
                />
              )
            }}
          </SizeMe>
        </PlotWrapper>
      </LoadingOverlay>
    )
  }, [
    innerRegion,
    setInnerRegion,
    manhattanPlotResponse,
    manhattanPlotError,
    isManhattanPlotLoading,
    onChange,
  ])

  const renderGeneTrack = useCallback(() => {
    if (!geneTrackResponse?.results && isGeneTrackLoading) {
      return <StatusMessage>Loading</StatusMessage>
    }

    if (geneTrackError) {
      return (
        <StatusMessage>
          Unable to load results
          <div>
            <small>{geneTrackError.toString().replace('Error:', '')}</small>
          </div>
        </StatusMessage>
      )
    }

    return (
      <LoadingOverlay active={isGeneTrackLoading}>
        <PlotWrapper>
          <SizeMe>
            {({ size }) => {
              return (
                <div style={{ margin: '1em 0' }}>
                  <div style={{ float: 'right', marginBottom: '2em', marginRight: '1em' }}>
                    <RegionControls region={innerRegion} onChange={onChange} />
                  </div>
                  <GenesTrack
                    genes={geneTrackResponse?.results?.genes || []}
                    width={size.width}
                    onChange={onChange}
                    innerRegion={innerRegion}
                    setInnerRegion={setInnerRegion}
                  />
                </div>
              )
            }}
          </SizeMe>
        </PlotWrapper>
      </LoadingOverlay>
    )
  }, [innerRegion, setInnerRegion, geneTrackResponse, geneTrackError, isGeneTrackLoading, onChange])

  if (!innerRegion) {
    return <StatusMessage>Search for a region ID or variant ID</StatusMessage>
  }

  return (
    <>
      {renderManhattanPlot()}
      {renderGeneTrack()}
    </>
  )
}

TOBLocusZoomPlot.propTypes = {
  query: PropTypes.string.isRequired,
  genes: PropTypes.arrayOf(PropTypes.string),
  cellTypes: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func,
}

TOBLocusZoomPlot.defaultProps = {
  genes: [],
  cellTypes: [],
  onChange: () => {},
}

export default TOBLocusZoomPlot
