import PropTypes from 'prop-types'
import React from 'react'
import { withSize } from 'react-sizeme'
import styled from 'styled-components'

// import { ManhattanPlot } from '@gnomad/manhattan-plot'
import ManhattanPlot from '../components/ManhattanPlot'

const GeneResultsManhattanPlot = ({
  pValueColumn,
  pointLabel,
  pointColor,
  onClickPoint,
  results,
  region,
  ...otherProps
}) => {
  const renderedDataPoints = results
    .filter((r) => r.chrom && r.pos && r[pValueColumn])
    .map((r) => ({ ...r, pval: r[pValueColumn] }))

  return (
    <ManhattanPlot
      {...otherProps}
      dataPoints={renderedDataPoints}
      region={region}
      // pointLabel={pointLabel}
      // pointColor={pointColor}
      // yLabel={'-log\u2081\u2080(p)'}
      // onClickPoint={onClickPoint}
    />
  )
}

GeneResultsManhattanPlot.propTypes = {
  pValueColumn: PropTypes.string,
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
  pointLabel: PropTypes.func,
  pointColor: PropTypes.func,
  onClickPoint: PropTypes.func,
  region: PropTypes.shape({
    chrom: PropTypes.string.isRequired,
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }).isRequired,
}

GeneResultsManhattanPlot.defaultProps = {
  pValueColumn: 'pval',
  pointLabel: (d) => `${d.id} ${d.gene_symbol || d.gene_id} (p = ${d.pval.toExponential(3)})`,
  pointColor: (d) => d.color || '#1e1e1e',
  onClickPoint: (d) => window.open(`/gene/${d.gene_symbol || d.gene_id}`),
}

const Wrapper = styled.div`
  overflow: visible;
  width: 100%;
`

const AutosizedGeneResultsManhattanPlot = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && (
      <GeneResultsManhattanPlot height={400} width={size.width} {...otherProps} />
    )}
  </Wrapper>
))

export default AutosizedGeneResultsManhattanPlot
