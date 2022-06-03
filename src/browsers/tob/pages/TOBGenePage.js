import React, { useEffect, useState, useCallback, useMemo } from 'react'

import styled from 'styled-components'
import { useParams } from 'react-router-dom'
import { debounce, sortBy } from 'lodash'

import { CategoryFilterControl, PageHeading } from '@gnomad/ui'

import { useChartDimensions } from '../shared/hooks'
import { defaultCellTypeColors } from '../shared/utilities/constants'

import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'
import GeneInformation from '../shared/components/GeneInformation'
import DocumentTitle from '../shared/components/DocumentTitle'
import EffectGrid from '../shared/components/EffectGrid'

import TOBAssociationsPlot from '../components/TOBAssociationsPlot'
import TOBViolinPlot from '../components/TOBViolinPlotNew'
import TOBAggregatePlot from '../components/TOBAggregatePlot'
import TOBGenesTrack from '../components/TOBGenesTrack'

const SectionHeading = styled.h3`
  margin-top: 1em;
`

const InputWrapper = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 1rem;
`

const categoryFilterStyle = { display: 'flex', flexWrap: 'wrap', gap: '4px' }

const TOBGenePage = () => {
  const query = useParams()

  const [ref, dimensions] = useChartDimensions()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [gene, setGene] = useState(null)

  const [cellTypes, setCellTypes] = useState([])
  const [cellTypeSelection, setCellTypeSelection] = useState({})

  const [fullRegion, setFullRegion] = useState(null)
  const [displayRegion, setDisplayRegion] = useState(null)

  const [fdrFilter, setFdrFilter] = useState(0.05)
  const [condioningRound, setCondioningRound] = useState(1)
  const [ldReference, setLdReference] = useState(null)
  const [selectedAssociations, setSelectedAssociations] = useState([])
  const [selectedVariantIds, setSelectedVariantIds] = useState([])
  const [selectedGene, setSelectedGene] = useState(null)
  const [highlightedAssociation, setHighlightedAssociation] = useState(null)

  // ------- QUERY: Gene Info --------------------------------------------------- //
  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/genes/${query.gene}`)
      .then((response) => {
        if (!response.ok) {
          response
            .json()
            .then((e) => setError(`${e.message} (${e.type})`))
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        } else {
          response
            .json()
            .then((data) => {
              const initialCoordinates = {
                chrom: data.chrom,
                start: data.start,
                stop: data.stop,
              }

              setFullRegion(initialCoordinates)
              setDisplayRegion(initialCoordinates)
              setGene(data)
              setError(null)
            })
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
  }, [query.gene, gene?.gene_id])

  // ------- QUERY: Cell-type Info --------------------------------------------------- //
  useEffect(() => {
    if (cellTypes.length) return

    setIsLoading(true)
    fetch(`/api/cell-types`)
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
              const sorted = sortBy(data, 'cell_type_id')
              const categorySwitches = sorted
                .map((i) => i.cell_type_id)
                .reduce((ac, a) => ({ ...ac, [a]: false }), {})

              categorySwitches[sorted[0].cell_type_id] = true

              setCellTypes(sorted)
              setCellTypeSelection(categorySwitches)
              setError(null)
            })
            .catch((e) => setError(e.toString()))
            .finally(() => setIsLoading(false))
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setIsLoading(false))
  }, [cellTypes.length])

  // -------- Callback definitions ----------------------------------- //
  const debounceSetFdrFilter = debounce((v) => setFdrFilter(Number.parseFloat(v)), 1000)

  const debounceSetConditioningRound = debounce(
    (v) => setCondioningRound(Number.parseInt(v, 10)),
    1000
  )

  const onSelectAggregate = (v) => {
    setSelectedGene(Array.isArray(v) ? v[0] : v)
    setLdReference(null)
    setSelectedAssociations([])
    setSelectedVariantIds([])
  }

  const onReferenceSelect = useCallback(
    (d) => setLdReference(d.association_id === ldReference?.association_id ? null : d),
    [ldReference?.association_id]
  )

  const onAssociationSelect = useCallback(
    (associations, type) => {
      let selected = [...selectedAssociations]

      // Check if each point has already been selected and de-select it if it does
      associations.forEach((a) => {
        const isSelected = selected.find((s) => s.association_id === a.association_id)
        if (isSelected && type !== 'append') {
          selected = selected.filter((s) => s.association_id !== a.association_id)
        } else if (!isSelected) {
          selected.push(a)
        }
      })

      selected = selected.filter((a) => cellTypeSelection[a.cell_type_id])

      const vids = Array.from(new Set(selected.map((x) => x.variant_id)))

      setSelectedAssociations(selected)
      setSelectedVariantIds(vids)
    },
    [selectedAssociations, cellTypeSelection]
  )

  // --------- Memoized values ------------------------------------ //
  const excludedColumns = useMemo(() => {
    return Object.keys(cellTypeSelection).filter(
      (x) => cellTypeSelection[x] && !selectedAssociations.map((y) => y.cell_type_id).includes(x)
    )
  }, [cellTypeSelection, selectedAssociations])

  const cellTypeCategories = useMemo(() => {
    if (!cellTypes) return []

    return cellTypes.map((c) => ({
      id: c.cell_type_id,
      label: c.cell_type_id,
      color: defaultCellTypeColors()[c.cell_type_id],
    }))
  }, [cellTypes])

  const effectGridRows = useMemo(() => {
    return selectedVariantIds.map((vid) => {
      return {
        key: vid,
        help: null,
        content: vid,
        onClear: () => {
          setSelectedVariantIds(selectedVariantIds.filter((v) => v !== vid))
          setSelectedAssociations(selectedAssociations.filter((a) => a.variant_id !== vid))
        },
      }
    })
  }, [selectedVariantIds, selectedAssociations])

  const effectGridColumns = useMemo(() => {
    const geneIdCol = {
      key: 'variant',
      content: 'Variant',
      help: 'Variant Identifier',
      onClear: () => {
        setSelectedVariantIds([])
        setSelectedAssociations([])
      },
    }

    if (!cellTypes || !cellTypeSelection) return [geneIdCol]

    return [
      geneIdCol,
      ...cellTypes.map((c) => {
        return cellTypeSelection[c.cell_type_id] && !excludedColumns.includes(c.cell_type_id)
          ? {
              key: c.cell_type_id,
              help: c.cell_type_name,
              content: c.cell_type_id,
            }
          : null
      }),
    ].filter((c) => !!c)
  }, [cellTypes, cellTypeSelection, excludedColumns])

  const effectGridData = useMemo(() => {
    return selectedAssociations
      .filter(
        (a) => a.gene_id === selectedGene?.gene_id && !excludedColumns.includes(a.cell_type_id)
      )
      .map((a) => {
        return {
          column: a.cell_type_id,
          row: a.variant_id,
          content: (
            <TOBViolinPlot
              query={a.association_id}
              height={150}
              yLabel={null}
              fontSize={12}
              margin={{ left: 30, bottom: 40, right: 0 }}
            />
          ),
          onMouseEnter: () => setHighlightedAssociation(a),
          onMouseLeave: () => setHighlightedAssociation(null),
        }
      })
  }, [selectedGene, selectedAssociations, excludedColumns])

  // --------- Render begin -------------------------------------- //
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
  if (!gene || !cellTypes || !cellTypeSelection) {
    return <StatusMessage>Loading</StatusMessage>
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <LoadingOverlay active={isLoading}>
        <section>
          <DocumentTitle title={gene.gene_id} />
          <PageHeading>{gene.symbol}</PageHeading>
          <GeneInformation gene={gene} />
        </section>

        <section>
          <SectionHeading>Cell type expression</SectionHeading>
          <TOBViolinPlot
            query={query.gene}
            height={500}
            margin={{ left: 100, bottom: 75 }}
            cellTypes={cellTypes}
          />
        </section>

        <section>
          <SectionHeading>Association strength</SectionHeading>
          <p>
            This plot shows the maximum association significance and mean expression across all cell
            types for {query.gene}
          </p>
          <TOBAggregatePlot
            query={query.gene}
            selected={selectedGene}
            width={dimensions.boundedWidth}
            margin={{ top: 20, right: 250, bottom: 125, left: 100 }}
            onClick={onSelectAggregate}
            onRowClick={onSelectAggregate}
            cellTypes={cellTypes}
          />
        </section>

        <section>
          <SectionHeading>eQTL associations</SectionHeading>
          <div style={{ marginBottom: '1rem' }}>
            <small style={{ display: 'block' }}>
              Shift click an eQTL to set it as the LD reference locus. Shift click again to
              de-select.
            </small>
            <small style={{ display: 'block' }}>
              Drag select over the Manhattan plot to zoom into a region. Double click an empty space
              in the Manhattan plot to reset zoom.
            </small>
          </div>

          <CategoryFilterControl
            id={`${query.gene}-category-filter-control`}
            categories={cellTypeCategories}
            categorySelections={cellTypeSelection}
            onChange={setCellTypeSelection}
            style={categoryFilterStyle}
          />

          <InputWrapper>
            <button
              type="button"
              onClick={() =>
                setCellTypeSelection(
                  cellTypes.reduce((acc, c) => ({ ...acc, [c.cell_type_id]: true }), {})
                )
              }
            >
              Select all cells types
            </button>
          </InputWrapper>

          <InputWrapper>
            <span>Show EQTLs with an FDR &le;</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              defaultValue={fdrFilter}
              onChange={(e) => debounceSetFdrFilter(e.target.value)}
              style={{ width: 75 }}
            />
          </InputWrapper>
          <InputWrapper>
            <span>Show EQTLs in conditioning round (1-5):</span>
            <input
              type="number"
              min={1}
              max={5}
              defaultValue={condioningRound}
              onChange={(e) => debounceSetConditioningRound(e.target.value)}
              style={{ width: 75 }}
            />
          </InputWrapper>

          <TOBAssociationsPlot
            query={query.gene}
            fdr={fdrFilter}
            rounds={condioningRound}
            cellTypes={cellTypeSelection}
            ldReference={ldReference}
            selected={selectedAssociations}
            selectedGene={selectedGene}
            queryRegion={fullRegion}
            displayRegion={displayRegion}
            highlightedAssociation={highlightedAssociation}
            width={dimensions.boundedWidth}
            height={500}
            margin={{ top: 20, bottom: 140, right: 10, left: 100 }}
            onBrush={setDisplayRegion}
            onDoubleClick={() => setDisplayRegion(fullRegion)}
            onClick={onAssociationSelect}
            onShiftClick={onReferenceSelect}
          />

          <TOBGenesTrack
            queryRegion={fullRegion}
            displayRegion={displayRegion}
            margin={{ top: 0, bottom: 0, right: 10, left: 100 }}
          />
        </section>

        <section>
          <SectionHeading>eQTL effect</SectionHeading>
          <div style={{ minHeight: 400, width: dimensions.boundedWidth, overflowX: 'scroll' }}>
            <>
              {selectedGene?.gene_id ? (
                <div>
                  <span>Viewing association effect on log(CPM) gene expression for </span>
                  <span>
                    {selectedGene.gene_symbol} ({selectedGene.gene_id})
                  </span>
                </div>
              ) : null}
              {effectGridRows.length > 0 && effectGridColumns.length > 0 ? (
                <>
                  {excludedColumns.length > 0 && (
                    <div>
                      <br />
                      <i>
                        {`NOTE: The ${
                          excludedColumns.slice(0, -1).join(', ') +
                          (excludedColumns.length > 1 ? ' and ' : '') +
                          excludedColumns.slice(-1)
                        } cell types `}
                        have no EQTLs for the current selection and have been omitted.
                      </i>
                    </div>
                  )}
                  <InputWrapper>
                    <button
                      type="button"
                      style={{ marginBottom: 4 }}
                      onClick={() => {
                        setSelectedAssociations([])
                        setSelectedVariantIds([])
                      }}
                    >
                      Clear all
                    </button>
                  </InputWrapper>
                  <EffectGrid
                    rows={effectGridRows}
                    columns={effectGridColumns}
                    data={effectGridData}
                  />
                </>
              ) : (
                <p>Select eQTL associations to view their effect on gene expression</p>
              )}
            </>
          </div>
        </section>
      </LoadingOverlay>
    </div>
  )
}

export default TOBGenePage
