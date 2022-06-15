import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import { extent } from 'd3'

import { isVariantId, parseVariantId } from '@gnomad/identifiers'

import { defaultCellTypeColors } from '../shared/utilities/constants'

import ManhattanPlot from '../shared/components/ManhattanPlotNew'
import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'
import AssociationTooltip from '../shared/components/AssociationTooltip'

const DEFAULT_Y = { start: 0, stop: 10 }

const TOBAssociationsPlot = ({
  query,
  fdr,
  rounds,
  ldReference,
  cellTypes,
  highlightedAssociations,
  selectedVariantIds,
  selectedGene,
  displayRegion,
  queryRegion,
  width,
  height,
  onClick,
  onBrush,
  onShiftClick,
  onDoubleClick,
  margin,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const [yDomain, setYDomain] = useState(DEFAULT_Y)
  const [zoomedYDomain, setZoomedYDomain] = useState(DEFAULT_Y)

  useEffect(() => {
    if (!queryRegion?.start || !queryRegion?.stop) return

    const regionId = `${queryRegion.chrom}:${queryRegion.start}:${queryRegion.stop}`
    let endpoint = `/api/genes/${query}/associations`
    if (isVariantId(query)) {
      endpoint = `/api/associations`
    }

    // Gene has not been loaded yet, so return to prevent requesting all genes.
    if (isVariantId(query) && !selectedGene?.gene_id) return

    // const selectedCellTypes = Object.entries(cellTypes)
    //   .filter((e) => !!e[1])
    //   .map((e) => e[0])

    const params = new URLSearchParams()
    if (regionId) params.set('region', regionId)
    if (Number.isFinite(fdr)) params.set('fdr', fdr)
    if (rounds) params.set('rounds', [rounds].flat().join(','))
    if (ldReference?.association_id) params.set('ld_reference', ldReference?.association_id)
    if (isVariantId(query) && selectedGene?.gene_id) params.set('genes', [selectedGene?.gene_id])
    // if (cellTypes) params.set('cell_types', selectedCellTypes.join(','))

    setIsLoading(true)
    fetch(`${endpoint}?${params.toString()}`)
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
            .then((d) => {
              const y = {
                start: 0,
                stop: extent(d, (i) => -Math.log10(i.p_value))[1] ?? DEFAULT_Y.stop,
              }
              setYDomain(y)
              setZoomedYDomain(y)

              setData(d)
              setError(null)
            })
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
  }, [
    query,
    fdr,
    rounds,
    // cellTypes,
    selectedGene?.gene_id,
    ldReference?.association_id,
    queryRegion?.chrom,
    queryRegion?.start,
    queryRegion?.stop,
  ])

  const _data = useMemo(() => {
    return (data ?? []).filter(
      (a) =>
        a.bp >= displayRegion.start &&
        a.bp <= displayRegion.stop &&
        (selectedGene?.gene_id ? a.gene_id === selectedGene.gene_id : true) &&
        -Math.log10(a.p_value) >= zoomedYDomain?.start &&
        -Math.log10(a.p_value) <= zoomedYDomain?.stop &&
        cellTypes[a.cell_type_id] &&
        a.fdr <= fdr
    )
  }, [
    data,
    fdr,
    cellTypes,
    displayRegion?.start,
    displayRegion?.stop,
    zoomedYDomain?.start,
    zoomedYDomain?.stop,
    selectedGene?.gene_id,
  ])

  const _accessors = useMemo(() => {
    return {
      id: (d) => d.association_id,
      x: (d) => d.bp,
      y: (d) => -Math.log10(d.p_value),
      color: (d) => defaultCellTypeColors()[d.cell_type_id],
      isSelected: (d) => {
        return (
          d.gene_id === selectedGene?.gene_id &&
          cellTypes[d.cell_type_id] &&
          selectedVariantIds.find((s) => d.variant_id === s)
        )
      },
      isReference: (d) => d.association_id === ldReference?.association_id,
      isHighlighted: (d) =>
        !![highlightedAssociations ?? []].flat().find((a) => a.association_id === d.association_id),
      opacity: (d) => d.ld ?? 1,
      tooltip: (d) => <AssociationTooltip association={d} />,
    }
  }, [
    cellTypes,
    selectedVariantIds,
    selectedGene?.gene_id,
    ldReference?.association_id,
    highlightedAssociations,
  ])

  const _markers = useMemo(() => {
    return isVariantId(query) ? [{ label: query, value: parseVariantId(query).pos }] : []
  }, [query])

  // Auto-select all cell types at each existing variant selection
  useEffect(() => {
    const ids = new Set(_data.filter(_accessors.isSelected).map((d) => d.variant_id))
    const selection = _data.filter((d) => ids.has(d.variant_id) && cellTypes[d.cell_type_id])
    onClick(selection, 'replace')

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellTypes, _data])

  // Render
  if (error) {
    return (
      <div style={{ height, width, display: 'flex', justifyContent: 'center' }}>
        <StatusMessage>
          Unable to load results
          <div>
            <small>{error.toString()}</small>
          </div>
        </StatusMessage>
      </div>
    )
  }

  // Catch initial load
  if (!data) {
    return (
      <div style={{ height, width, display: 'flex', justifyContent: 'center' }}>
        <StatusMessage>Loading</StatusMessage>
      </div>
    )
  }

  return (
    <LoadingOverlay active={isLoading}>
      <ManhattanPlot
        id={`${query}-eqtl-associations`}
        data={_data}
        width={width}
        height={height}
        thresholds={[]}
        markers={_markers}
        onClick={(a) => {
          // Select all cell-types for this locus
          onClick(
            _data.filter((b) => a.variant_id === b.variant_id),
            'toggle'
          )
        }}
        onBrush={({ x, y }) => {
          onBrush({ ...x })
          setZoomedYDomain({ ...y })
        }}
        onDoubleClick={() => {
          onDoubleClick()
          setZoomedYDomain(yDomain)
        }}
        onShiftClick={onShiftClick}
        margin={margin}
        accessors={_accessors}
        xLabel={`Chromosome ${queryRegion.chrom} position (Mb)`}
        xDomain={displayRegion}
        yDomain={zoomedYDomain}
      />
    </LoadingOverlay>
  )
}

TOBAssociationsPlot.propTypes = {
  query: PropTypes.string.isRequired,
  fdr: PropTypes.number,
  rounds: PropTypes.oneOfType([PropTypes.number, PropTypes.arrayOf(PropTypes.number)]),
  ldReference: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  selectedVariantIds: PropTypes.arrayOf(PropTypes.string),
  selectedGene: PropTypes.shape({
    gene_id: PropTypes.string.isRequired,
    gene_symbol: PropTypes.string.isRequired,
  }),
  cellTypes: PropTypes.object, // eslint-disable-line react/forbid-prop-types,
  onClick: PropTypes.func,
  onBrush: PropTypes.func,
  onDoubleClick: PropTypes.func,
  onShiftClick: PropTypes.func,
  highlightedAssociations: PropTypes.arrayOf(
    PropTypes.shape({
      association_id: PropTypes.string.isRequired,
    })
  ),
  width: PropTypes.number,
  height: PropTypes.number,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
  queryRegion: PropTypes.shape({
    chrom: PropTypes.string.isRequired,
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }),
  displayRegion: PropTypes.shape({
    chrom: PropTypes.string,
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }),
}

TOBAssociationsPlot.defaultProps = {
  fdr: null,
  rounds: null,
  ldReference: null,
  selectedVariantIds: [],
  cellTypes: {},
  highlightedAssociations: [],
  onClick: () => {},
  onBrush: () => {},
  onDoubleClick: () => {},
  onShiftClick: () => {},
  height: 500,
  width: 1000,
  margin: {},
  queryRegion: null,
  displayRegion: null,
  selectedGene: null,
}

export default TOBAssociationsPlot
