import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { SizeMe } from 'react-sizeme'
import { isRegionId, isVariantId, parseRegionId, parseVariantId } from '@gnomad/identifiers'

import ManhattanPlot from './components/ManhattanPlot'
import GenesTrack from './components/GenesTrack'
import RegionControls from './components/RegionControls'
import { PlotWrapper } from './components/utilities/styling'
import StatusMessage from '../../base/StatusMessage'
import Fetch from '../../base/Fetch'

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

  useEffect(() => {
    setInnerRegion(parseQueryToRegion(query))
  }, [query])

  const manhattanPlotApiPath = useCallback(() => {
    const region = stringifyRegion(parseQueryToRegion(query))
    let path = `/associations/?region=${region}`

    if (genes) {
      path += `&genes=${genes.join(',')}`
    }

    if (cellTypes) {
      path += `&cellTypes=${cellTypes.join(',')}`
    }

    return path
  }, [query, genes, cellTypes])

  const geneTrackApiPath = useCallback(() => {
    const region = stringifyRegion(parseQueryToRegion(query))
    return `/genes/?query=${region}`
  }, [query])

  return (
    <>
      <PlotWrapper>
        <SizeMe>
          {({ size }) => {
            if (!innerRegion) {
              return <StatusMessage>Search for a region ID or variant ID</StatusMessage>
            }

            return (
              <>
                <Fetch path={manhattanPlotApiPath()}>
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

                    return (
                      <ManhattanPlot
                        data={data.results}
                        width={size.width * 2}
                        pointColor={(d) => d.color}
                        onChange={onChange}
                        innerRegion={innerRegion}
                        setInnerRegion={setInnerRegion}
                      />
                    )
                  }}
                </Fetch>
              </>
            )
          }}
        </SizeMe>
      </PlotWrapper>

      <PlotWrapper>
        <SizeMe>
          {({ size }) => {
            if (!innerRegion) {
              return <StatusMessage>Search for a region ID or variant ID</StatusMessage>
            }

            return (
              <>
                <Fetch path={geneTrackApiPath()}>
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

                    return (
                      <div style={{ margin: '1em 0' }}>
                        <div style={{ float: 'right', marginBottom: '2em', marginRight: '1em' }}>
                          <RegionControls region={innerRegion} onChange={onChange} />
                        </div>
                        <GenesTrack
                          genes={data.results.genes}
                          width={size.width * 2}
                          onChange={onChange}
                          innerRegion={innerRegion}
                          setInnerRegion={setInnerRegion}
                        />
                      </div>
                    )
                  }}
                </Fetch>
              </>
            )
          }}
        </SizeMe>
      </PlotWrapper>
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
