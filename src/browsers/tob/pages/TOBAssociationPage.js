import React, { useCallback, useState } from 'react'
import PropTypes from 'prop-types'

import TOBAssociationHeatmap from '../shared/TOBAssociationHeatmap'
import TOBLocusZoomPlot from '../shared/TOBLocusZoomPlot'

const TOBAssociationPage = ({ match }) => {
  const [search, setSearch] = useState(match.params.query || '22:37200000-39900000')
  const [selectedTiles, setSelectedTiles] = useState(new Map())

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

  return (
    <>
      <TOBLocusZoomPlot
        query={search}
        genes={Array.from(selectedTiles.values()).map((t) => t.geneName)}
        cellTypes={Array.from(selectedTiles.values()).map((t) => t.cellTypeId)}
        onChange={(r) => setSearch(`${r.chrom}-${r.start}-${r.stop}`)}
      />
      <TOBAssociationHeatmap
        query={search}
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
