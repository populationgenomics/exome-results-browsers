import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import { withSize } from 'react-sizeme'
import styled from 'styled-components'

import Chart from 'chart.js/auto'
import lodash from 'lodash'

const DEFAULT_COLORS = [
  '#332288',
  '#6699cc',
  '#88ccee',
  '#44aa99',
  '#117733',
  '#999933',
  '#ddcc77',
  '#661100',
  '#cc6677',
  '#aa4466',
  '#882255',
  '#aa4499',
]

const GeneResultsUmapPlot = ({ id, embedding, labels, labelColors, ...otherProps }) => {
  const [chart, setChart] = useState(null)

  useEffect(() => {
    const ctx = document.getElementById(id).getContext('2d')
    if (ctx == null) {
      return
    }

    if (chart != null) {
      chart.destroy()
    }

    const datasets = lodash.groupBy(lodash.zip(labels, embedding), (tuple) => tuple[0])
    const chartData = lodash.keys(datasets).map((key, idx) => {
      return {
        label: key,
        data: datasets[key].map(([x, y]) => {
          return { x: y[0], y: y[1] }
        }),
        borderColor: labelColors[idx],
        backgroundColor: labelColors[idx],
      }
    })

    console.log(chartData)

    const newChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        labels: new Set(labels),
        datasets: chartData,
      },
      options: {
        ...otherProps,
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'UMAP of residual expression across all genes',
          },
        },
      },
    })

    setChart(newChart)
  }, [embedding, labels, labelColors])

  return <canvas id={id} />
}

GeneResultsUmapPlot.propTypes = {
  id: PropTypes.string,
  embedding: PropTypes.arrayOf(PropTypes.array).isRequired,
  labels: PropTypes.arrayOf(PropTypes.string).isRequired,
  labelColors: PropTypes.arrayOf(PropTypes.string),
}

GeneResultsUmapPlot.defaultProps = {
  id: 'gene-results-umap-plot',
  labelColors: [...DEFAULT_COLORS],
}

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const AutosizedGeneResultsUmapPlot = withSize()(({ size, ...otherProps }) => (
  <Wrapper>
    {Boolean(size.width) && <GeneResultsUmapPlot height={500} width={size.width} {...otherProps} />}
  </Wrapper>
))

export default AutosizedGeneResultsUmapPlot
