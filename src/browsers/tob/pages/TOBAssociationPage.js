import React, { useCallback, useState } from 'react'
import PropTypes from 'prop-types'

import TOBAssociationHeatmap from '../shared/TOBAssociationHeatmap'
import TOBLocusZoomPlot from '../shared/TOBLocusZoomPlot'

const TOBAssociationPage = ({ match }) => {
  const [search, setSearch] = useState(match.params.query || '22:37966255-37978623')
  const [genes, setGenes] = useState(new Set())
  const [cellTypes, setCellTypes] = useState(new Set())

  const updateSelectedTiles = useCallback((tile) => {
    const updatedGenes = new Set(genes)
    const updatedCellTypes = new Set(cellTypes)

    if (updatedGenes.has(tile.geneName)) {
      updatedGenes.delete(tile.geneName)
    } else {
      updatedGenes.add(tile.geneName)
    }

    if (updatedCellTypes.has(tile.cellTypeId)) {
      updatedCellTypes.delete(tile.cellTypeId)
    } else {
      updatedCellTypes.add(tile.cellTypeId)
    }

    setGenes(updatedGenes)
    setCellTypes(updatedCellTypes)
  }, [])

  return (
    <>
      <TOBLocusZoomPlot
        query={search}
        genes={Array.from(genes)}
        cellTypes={Array.from(cellTypes)}
        onChange={(r) => setSearch(`${r.chrom}-${r.start}-${r.stop}`)}
      />
      <TOBAssociationHeatmap query={search} onChange={updateSelectedTiles} />
    </>
  )
}

TOBAssociationPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  match: PropTypes.object.isRequired,
}

export default TOBAssociationPage
