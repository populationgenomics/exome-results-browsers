import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import TOBAssociationHeatmap from '../components/TOBAssociationHeatmap'
import TOBLocusZoomPlot from '../components/TOBLocusZoomPlot'

import StatusMessage from '../shared/components/StatusMessage'

const TOBAssociationPage = () => {
  const { query } = useParams({ query: '22:37200000-39900000' })

  const [apiQuery, setApiQuery] = useState(null)
  const [error, setError] = useState(null)
  const [selectedTiles, setSelectedTiles] = useState(new Map())

  // Resolve ensembl id to region first
  useEffect(() => {
    setApiQuery(null)

    if (/^ENSG\d{11}$/i.test(query.toString())) {
      fetch(`/api/genes/${query}`, { method: 'GET' })
        .then((r) => {
          if (r.ok) {
            r.json().then(
              ({ results: { chrom, start, stop } }) => {
                setApiQuery(`${chrom}:${start - 1e3}-${stop + 1e3}`)
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
      setApiQuery(query)
    }
  }, [query, setApiQuery, setError])

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

  if (apiQuery == null) {
    return <StatusMessage>Fetching region</StatusMessage>
  }

  return (
    <>
      <TOBLocusZoomPlot
        query={apiQuery}
        genes={Array.from(selectedTiles.values()).map((t) => t.geneName)}
        cellTypes={Array.from(selectedTiles.values()).map((t) => t.cellTypeId)}
        onChange={(r) => setApiQuery(`${r.chrom}-${r.start}-${r.stop}`)}
      />
      <TOBAssociationHeatmap
        query={apiQuery}
        selectedTiles={Array.from(selectedTiles.values())}
        onChange={updateSelectedTiles}
      />
    </>
  )
}

TOBAssociationPage.propTypes = {}

export default TOBAssociationPage
