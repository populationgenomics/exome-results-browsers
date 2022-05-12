import React, { useEffect, useState, useCallback } from 'react'
// import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
// import { SizeMe } from 'react-sizeme'
import { CategoryFilterControl } from '@gnomad/ui'
import { extent } from 'd3'
import DotplotHeatmap from '../shared/components/DotplotHeatmap'
import ManhattanPlotNew from '../shared/components/ManhattanPlotNew'
import ViolinPlot from '../shared/components/ViolinPlotNew'
import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'
import GeneInformation from '../shared/components/GeneInformation'
import GenesTrack from '../shared/components/GenesTrack'
import { defaultCellTypeColors } from '../shared/utilities/constants'
import { useChartDimensions } from '../shared/hooks'

// import { PlotWrapper } from '../shared/utilities/styling'

const TOBGenePage = ({ gene }) => {
  // const { gene } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [heatmapResponse, setHeatmapResponse] = useState(null)
  const [geneInfoResponse, setGeneInfoResponse] = useState(null)
  const [geneSymbol, setGeneSymbol] = useState(null)
  const [geneName, setGeneName] = useState(null)
  const [cellTypes, setCellTypes] = useState(null)
  const [manhattanResponse, setManhattanResponse] = useState(null)
  const [coords, setCoords] = useState()
  const [selected, setSelected] = useState(null)
  const [geneExpressionResponse, setGeneExpressionResponse] = useState(null)
  const [violinPlotRef, violinPlotDimensions] = useChartDimensions()
  const [dotplotRef, dotplotDimensions] = useChartDimensions()
  const [manhattanRef, manhattanDimensions] = useChartDimensions()
  const [genesTrackRef, genesTrackDimensions] = useChartDimensions()
  const [eqtlResponse, setEQTLResponse] = useState(null)

  const [selectedCellTypes, setSelectedCellTypes] = useState(null)
  const [selectedLoci, setSelectedLoci] = useState(null)

  const manhattanTooltip = (d) => (
    <table>
      <tbody>
        <tr>
          <td>
            <b>Id: </b>
          </td>
          <td>{d.association_id}</td>
        </tr>
        <tr>
          <td>
            <b>Cell type: </b>
          </td>
          <td>{d.cell_type_id} </td>
        </tr>
        <tr>
          <td>
            <b>P-value: </b>
          </td>
          <td>{d.p_value.toPrecision(2)} </td>
        </tr>
        <tr>
          <td>
            <b>-log10(p): </b>
          </td>
          <td> {-1 * Math.log(d.p_value).toFixed(2)} </td>
        </tr>
        <tr>
          <td>
            <b>Functional annotation: </b>
          </td>
          <td>{d.functional_annotation ?? '?'} </td>
        </tr>
      </tbody>
    </table>
  )

  const dotplotTooltip = (d) => (
    <table>
      <tbody>
        <tr>
          <td>
            <b>Gene: </b>
          </td>
          <td>{d.gene_symbol}</td>
        </tr>
        <tr>
          <td>
            <b>Cell type: </b>
          </td>
          <td>{d.cell_type_id} </td>
        </tr>
        <tr>
          <td>
            <b>Min P-value: </b>
          </td>
          <td>{d.min_p_value.toPrecision(2)} </td>
        </tr>
        <tr>
          <td>
            <b>Max -log10(p): </b>
          </td>
          <td>{-1 * Math.log(d.min_p_value).toPrecision(2)} </td>
        </tr>
        <tr>
          <td>
            <b>Mean Log CPM: </b>
          </td>
          <td> {d.mean_log_cpm.toPrecision(2)} </td>
        </tr>
      </tbody>
    </table>
  )

  const ViolinPlotTooltip = ({ d }) => (
    <table>
      <tbody>
        {['median', 'mean', 'min', 'max', 'q1', 'q3', 'iqr'].map((key) => {
          return (
            <tr key={`violin-tooltip-item-${key}`}>
              <td>
                <b>{key}: </b>
              </td>
              <td>{d[key].toPrecision(4)} </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  useEffect(() => {
    setIsLoading(true)
    const aggregateGenePath = `/api/genes/${gene}/aggregate/`
    const geneInfoPath = `/api/genes/${gene}`
    const cellTypesPath = `/api/cell-types`
    const associationsPath = `/api/genes/${gene}/associations`
    const geneExpressionPath = `/api/genes/${gene}/expression`
    Promise.all([
      fetch(aggregateGenePath, { method: 'GET' })
        .then((r) => {
          if (r.ok) {
            r.json().then(
              (result) => {
                setHeatmapResponse(result)
              },
              () => setError('Could not parse heatmap result')
            )
          } else {
            setError(`${r.status}: ${r.statusText}`)
          }
        })
        .catch((e) => setError(e.toString())),
      fetch(geneInfoPath, { method: 'GET' })
        .then((r) => {
          if (r.ok) {
            r.json().then(
              (result) => {
                setGeneSymbol(result.symbol)
                setGeneName(result.name)
                setGeneInfoResponse(result)
              },
              () => setError('Could not parse gene info result')
            )
          } else {
            setError(`${r.status}: ${r.statusText}`)
          }
        })
        .catch((e) => setError(e.toString())),
      fetch(cellTypesPath, { method: 'GET' })
        .then((r) => {
          if (r.ok) {
            r.json().then(
              (result) => {
                setCellTypes(
                  result.map((i) => i.cell_type_id).reduce((ac, a) => ({ ...ac, [a]: true }), {})
                )
              },
              () => setError('Could not parse celltypes result')
            )
          } else {
            setError(`${r.status}: ${r.statusText}`)
          }
        })
        .catch((e) => setError(e.toString())),
      fetch(associationsPath, { method: 'GET' })
        .then((r) => {
          if (r.ok) {
            r.json().then(
              (result) => {
                setManhattanResponse(result)
                setCoords(extent(result, (d) => d.bp))
              },
              () => setError('Could not parse Manhattan result')
            )
          } else {
            setError(`${r.status}: ${r.statusText}`)
          }
        })
        .catch((e) => setError(e.toString())),
      fetch(geneExpressionPath, { method: 'GET' })
        .then((r) => {
          if (r.ok) {
            r.json().then(
              (result) => {
                setGeneExpressionResponse(result)
              },
              () => setError('Could not parse Gene Expression result')
            )
          } else {
            setError(`${r.status}: ${r.statusText}`)
          }
        })
        .catch((e) => setError(e)),
    ]).finally(() => setIsLoading(false))
  }, [gene])

  const getNewEQTLData = useCallback((id) => {
    const test = '17:41216206:T:C:ENSG00000012048:nk:1'
    fetch(`/api/associations/${encodeURIComponent(test)}/effect`, { method: 'GET' })
      .then((r) => {
        if (r.ok) {
          r.json().then(
            (result) => {
              setEQTLResponse({ ...eqtlResponse, [id]: result })
            },
            () => setError('Could not parse heatmap result')
          )
        } else {
          setError(`${r.status}: ${r.statusText}`)
        }
      })
      .catch((e) => setError(e.toString()))
  })

  const handleBrush = useCallback((start, end) => {
    setCoords([start, end])
  }, [])

  const manhattanOnClick = useCallback(
    (d) => {
      const key = `${d.cell_type_id}-${d.bp}`
      const selectionObject = { cellType: d.cell_type_id, locus: d.bp, id: d.association_id }
      if (!selected) {
        getNewEQTLData(d.association_id)
        setSelected({ [key]: selectionObject })
        setSelectedCellTypes([d.cell_type_id])
        setSelectedLoci([d.bp])
        return
      }
      if (Object.keys(selected).includes(key)) {
        const tempSelected = { ...selected }
        delete tempSelected[key]
        setSelected(tempSelected)
        const tempEQTLSelected = { ...eqtlResponse }
        delete tempEQTLSelected[d.association_id]
        setEQTLResponse(tempEQTLSelected)
        if (
          Object.values(selected).reduce((n, entry) => {
            return n + (entry.cellType === d.cell_type_id)
          }, 0) === 1
        ) {
          setSelectedCellTypes(selectedCellTypes.filter((item) => item !== d.cell_type_id))
        }
        if (
          Object.values(selected).reduce((n, entry) => {
            return n + (entry.locus === d.bp)
          }, 0) === 1
        ) {
          setSelectedLoci(selectedLoci.filter((item) => item !== d.bp))
        }
        return
      }
      getNewEQTLData(d.association_id)
      setSelected({ ...selected, [key]: selectionObject })
      if (!selectedCellTypes.includes(d.cell_type_id)) {
        setSelectedCellTypes([...selectedCellTypes, d.cell_type_id])
      }
      if (!selectedLoci.includes(d.bp)) {
        setSelectedLoci([...selectedLoci, d.bp])
      }
    },
    [selected, selectedCellTypes, selectedLoci, eqtlResponse, getNewEQTLData]
  )

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

  if (isLoading) {
    return <StatusMessage>Loading</StatusMessage>
  }

  return (
    <>
      <LoadingOverlay active={isLoading}>
        <div style={{ marginLeft: 80 }}>
          <div style={{ fontWeight: 'bold', fontSize: 20, display: 'inline-block' }}>
            {geneSymbol}
          </div>
          <div style={{ display: 'inline-block', paddingLeft: 10 }}>{geneName}</div>
          <hr style={{ textAlign: 'left', marginLeft: 0, width: '25%' }} />
        </div>
        <div style={{ marginLeft: 40 }}>
          <GeneInformation data={geneInfoResponse || {}} />
        </div>
        <div ref={violinPlotRef} style={{ width: '100%' }}>
          <ViolinPlot
            id={`${gene}-violin-plot`}
            data={geneExpressionResponse || {}}
            height={300}
            width={violinPlotDimensions.boundedWidth}
            title={`${gene} Expression`}
            yLabel="Expression"
            margins={{ left: 80, right: 220, top: 50, bottom: 55 }}
            accessors={{
              id: (d) => d.id,
              x: (d) => d.id,
              y: (d) => d.counts,
              q1: (d) => d.q1,
              median: (d) => d.median,
              q3: (d) => d.q3,
              iqr: (d) => d.iqr,
              min: (d) => d.min,
              max: (d) => d.max,
              color: (d) => defaultCellTypeColors()[d.id] ?? 'black',
              tooltip: (d) => <ViolinPlotTooltip d={d} />,
            }}
          />
        </div>
        <div ref={dotplotRef} style={{ width: '100%' }}>
          <DotplotHeatmap
            id="Heatmap"
            title="eQTL maxmimum association strength and mean gene expression"
            data={heatmapResponse || []}
            margins={{ top: 60 }}
            width={dotplotDimensions.boundedWidth}
            accessors={{
              id: (d) => `${d.cell_type_id}-${d.gene_symbol}`,
              x: (d) => d.cell_type_id,
              y: (d) => d.gene_symbol,
              size: (d) => -Math.log(d.min_p_value),
              color: (d) => d.mean_log_cpm,
              tooltip: dotplotTooltip,
            }}
          />
        </div>
        <div style={{ marginLeft: 80 }}>
          <b>eQTL associations</b>
          <br />
          {cellTypes && (
            <CategoryFilterControl
              categories={Object.keys(cellTypes).map((item) => ({
                id: item,
                label: item,
                color: defaultCellTypeColors()[item],
              }))}
              id="category-filter-control-example"
              categorySelections={cellTypes}
              onChange={setCellTypes}
            />
          )}
        </div>
        <br />
        <div style={{ marginLeft: 80 }}>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label htmlFor="rounds">Round:</label>
          <select id="rounds">
            <option value="1">Round 1</option>
            <option value="2">Round 2</option>
            <option value="3">Round 3</option>
            <option value="4">Round 4</option>
            <option value="5">Round 5</option>
          </select>
        </div>
        <div ref={manhattanRef} style={{ width: '100%' }}>
          {manhattanResponse && coords && (
            <ManhattanPlotNew
              id="ManhattanPlot"
              data={
                manhattanResponse.filter(
                  (item) =>
                    item.bp >= coords[0] && item.bp <= coords[1] && cellTypes[item.cell_type_id]
                ) || []
              }
              thresholds={[]}
              onBrush={handleBrush}
              width={manhattanDimensions.boundedWidth}
              accessors={{
                x: (d) => d.bp,
                y: (d) => -Math.log(d.p_value),
                color: (d) => defaultCellTypeColors()[d.cell_type_id],
                cellLine: (d) => d.cell_type_id,
                isSelected: (d) => d.selected,
                isReference: (d) => d.ld_reference,
                opacity: (d) => 1,
                tooltip: manhattanTooltip,
                id: (d) => d.association_id,
                onClick: manhattanOnClick,
              }}
            />
          )}
        </div>
        <div ref={genesTrackRef} style={{ width: '100%' }}>
          {geneInfoResponse && (
            <GenesTrack
              genes={[geneInfoResponse] || []}
              start={geneInfoResponse.start}
              stop={geneInfoResponse.stop}
              width={genesTrackDimensions.boundedWidth}
              margin={{ left: 80, right: 220, top: 20, bottom: 10 }}
            />
          )}
        </div>
        <div style={{ marginLeft: 80, marginRight: 220 }}>
          {selected && eqtlResponse && (
            <table>
              <tbody>
                {selectedCellTypes.map((ct) => (
                  <tr key={ct}>
                    {selectedLoci.map((l) => {
                      return `${ct}-${l}` in selected ? (
                        <td key={`${ct}-${l}-cell`}>
                          <ViolinPlot
                            id={`${ct}-${l}-violin-plot`}
                            data={eqtlResponse[selected[`${ct}-${l}`].id] ?? {}}
                            height={300}
                            width={300}
                            title={`${ct}-${l} Effect`}
                            yLabel="Effect"
                            margins={{ left: 20, right: 10, top: 45, bottom: 30 }}
                            accessors={{
                              id: (d) => d.id,
                              x: (d) => d.id,
                              y: (d) => d.counts,
                              q1: (d) => d.q1,
                              median: (d) => d.median,
                              q3: (d) => d.q3,
                              iqr: (d) => d.iqr,
                              min: (d) => d.min,
                              max: (d) => d.max,
                              color: (d) => defaultCellTypeColors()[d.id] ?? 'black',
                              tooltip: (d) => <ViolinPlotTooltip d={d} />,
                            }}
                          />
                        </td>
                      ) : (
                        <td key={`${ct}-${l}-cell`} />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </LoadingOverlay>
    </>
  )
}

TOBGenePage.propTypes = {
  gene: PropTypes.string,
}

TOBGenePage.defaultProps = {
  gene: 'BRCA1',
}

export default TOBGenePage
