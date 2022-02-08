import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import TOBAssociationHeatmap from '../shared/TOBAssociationHeatmap'
import TOBLocusZoomPlot from '../shared/TOBLocusZoomPlot'
import { isEnsemblGeneId } from '../../../server/identifiers'
import StatusMessage from '../../base/StatusMessage'

const TOBAssociationPage = ({ match }) => {
  const [search, setSearch] = useState(match.params.query || '22:37200000-39900000')
  const [query, setQuery] = useState(null)
  const [error, setError] = useState(null)
  const [selectedTiles, setSelectedTiles] = useState(new Map())

  useEffect(() => {
    setQuery(null)

    if (isEnsemblGeneId(search)) {
      fetch(`/api/genes/${search}`, { method: 'GET' })
        .then((r) => {
          if (r.ok) {
            r.json().then(
              ({ results: { chrom, start, stop } }) => {
                setQuery(`${chrom}:${start - 1e3}-${stop + 1e3}`)
                setError(null)
              },
              () => setError('Could not parse result')
            )
          } else {
            setError(`${r.status}: ${r.statusText}`)
          }
        })
        .catch((e) => setError(e.toString()))
    } else {
      setQuery(search)
    }
  }, [search, setQuery, setError])

  const updateSelectedTiles = useCallback(
    (tile) => {
      const newSelectedTiles = new Map(selectedTiles)
      const tileId = `${tile.geneName}:${tile.cellTypeId}`

      if (newSelectedTiles.has(tileId)) {
        newSelectedTiles.delete(tileId)
      } else {
        newSelectedTiles.set(tileId, tile)
      }

      // Render one gene at a time
      const uniqueGenes = new Set(Array.from(newSelectedTiles.values()).map((d) => d.geneName))
      if (uniqueGenes.size > 1) {
        newSelectedTiles.clear()
        newSelectedTiles.set(tileId, tile)
        setSelectedTiles(newSelectedTiles)

        return
      }

      setSelectedTiles(newSelectedTiles)
    },
    [selectedTiles]
  )

  if (error) {
    return <StatusMessage>{error}</StatusMessage>
  }

  if (query == null) {
    return <StatusMessage>Fetching region</StatusMessage>
  }

  return (
    <>
      <TOBLocusZoomPlot
        query={query}
        genes={Array.from(selectedTiles.values()).map((t) => t.geneName)}
        cellTypes={Array.from(selectedTiles.values()).map((t) => t.cellTypeId)}
        onChange={(r) => setSearch(`${r.chrom}-${r.start}-${r.stop}`)}
      />
      <TOBAssociationHeatmap
        query={query}
        selectedTiles={Array.from(selectedTiles.values())}
        onChange={updateSelectedTiles}
      />
    </>
  )
}

TOBAssociationPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  match: PropTypes.object.isRequired,
}

export default TOBAssociationPage
