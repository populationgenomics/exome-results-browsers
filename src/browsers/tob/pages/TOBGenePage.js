import React, { useEffect, useState, useCallback } from 'react'
// import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
// import { SizeMe } from 'react-sizeme'
import { CategoryFilterControl } from '@gnomad/ui'
import { extent } from 'd3'
import DotplotHeatmap from '../shared/components/DotplotHeatmap'
import ManhattanPlotNew from '../shared/components/ManhattanPlotNew'
import StatusMessage from '../shared/components/StatusMessage'
import LoadingOverlay from '../shared/components/LoadingOverlay'
import GeneInformation from '../shared/components/GeneInformation'
import { defaultCellTypeColors } from '../shared/utilities/constants'

import { PlotWrapper } from '../shared/utilities/styling'

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

  useEffect(() => {
    setIsLoading(true)
    const aggregateGenePath = `/api/genes/${gene}/aggregate/`
    const geneInfoPath = `/api/genes/${gene}`
    const cellTypesPath = `/api/cell-types`
    const associationsPath = `/api/genes/${gene}/associations`
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
    ]).finally(() => setIsLoading(false))
  }, [])

  const handleBrush = useCallback(
    (start, end) => {
      setCoords([start, end])
    },
    [manhattanResponse]
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
        <PlotWrapper>
          <DotplotHeatmap
            id="Heatmap"
            title="eQTL maxmimum association strength and mean gene expression"
            data={heatmapResponse || []}
            accessors={{
              id: (d) => `${d.cell_type_id}-${d.gene_symbol}`,
              x: (d) => d.cell_type_id,
              y: (d) => d.gene_symbol,
              size: (d) => -Math.log(d.min_p_value),
              color: (d) => d.mean_log_cpm,
              tooltip: dotplotTooltip,
            }}
          />
        </PlotWrapper>
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
        <PlotWrapper>
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
              }}
            />
          )}
        </PlotWrapper>
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
