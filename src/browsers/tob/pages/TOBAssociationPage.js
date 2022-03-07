import { PageHeading } from '@gnomad/ui'
import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'

import TOBAssociationHeatmap from '../components/TOBAssociationHeatmap'
import TOBLocusZoomPlot from '../components/TOBLocusZoomPlot'

import StatusMessage from '../shared/components/StatusMessage'

const QueryInformationWrapper = styled.div`
  padding: 0 1.5rem;
`

const Grid = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: 8fr 16fr;
`

const isEnsemblGeneId = (value) => {
  if (!value?.toString()) return false
  return /^ENSG\d{11}$/i.test(value.toString())
}

const TOBAssociationPage = () => {
  let { query } = useParams()
  if (!query) query = '22:37200000-37900000'

  const [apiQuery, setApiQuery] = useState(null)
  const [isGene, setIsGene] = useState(isEnsemblGeneId(query))
  const [error, setError] = useState(null)
  const [selectedTiles, setSelectedTiles] = useState(new Map())

  // Resolve ensembl id to region first
  useEffect(() => {
    setApiQuery(null)

    if (isEnsemblGeneId(query)) {
      setIsGene(true)
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
      setIsGene(false)
      setApiQuery(query)
    }
  }, [query])

  const updateSelectedTiles = useCallback(
    (tiles) => {
      if (!tiles?.length) return

      const newSelectedTiles = tiles.length > 1 ? new Map() : new Map(selectedTiles)

      tiles.forEach((tile) => {
        const tileId = `${tile.gene}:${tile.cell_type_id}`

        if (newSelectedTiles.has(tileId)) {
          newSelectedTiles.delete(tileId)
        } else {
          newSelectedTiles.set(tileId, tile)
        }
      })

      // Render one gene at a time
      if (tiles.length === 1) {
        const tile = tiles[0]
        const tileId = `${tile.gene_name}:${tile.cell_type_id}`

        const uniqueGenes = new Set(Array.from(newSelectedTiles.values()).map((d) => d.gene))
        if (uniqueGenes.size > 1) {
          newSelectedTiles.clear()
          newSelectedTiles.set(tileId, tile)
          setSelectedTiles(newSelectedTiles)

          return
        }
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
      <QueryInformationWrapper>
        <PageHeading>{query}</PageHeading>
      </QueryInformationWrapper>

      <Grid>
        <TOBAssociationHeatmap
          query={apiQuery}
          gene={isGene ? query : null}
          selectedTiles={Array.from(selectedTiles.values())}
          onChange={updateSelectedTiles}
        />
        <TOBLocusZoomPlot
          query={apiQuery}
          genes={Array.from(selectedTiles.values()).map((t) => t.gene)}
          cellTypes={Array.from(selectedTiles.values()).map((t) => t.cell_type_id)}
          onChange={(r) => setApiQuery(`${r.chrom}-${r.start}-${r.stop}`)}
        />
      </Grid>
    </>
  )
}

TOBAssociationPage.propTypes = {}

export default TOBAssociationPage
