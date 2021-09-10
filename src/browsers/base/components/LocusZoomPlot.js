import React, { useState } from 'react'
import PropTypes from 'prop-types'

import AutosizedGeneResultsManhattanPlot from '../GeneResultsPage/GeneResultsManhattanPlot'
import AutosizedGeneResultsGenesTrack from '../GeneResultsPage/GeneResultsGenesTrack'
import RegionControls from './RegionControls'

const LocusZoomPlot = ({ results, region, onChange, genes }) => {
  const [innerRegion, setInnerRegion] = useState(region)
  // console.log(innerRegion)
  return (
    <>
      <AutosizedGeneResultsManhattanPlot
        results={results}
        pointColor={(d) => d.color}
        region={region}
        onChange={onChange}
        innerRegion={innerRegion}
        setInnerRegion={setInnerRegion}
      />

      <div style={{ margin: '1em 0' }}>
        <div style={{ float: 'right', marginBottom: '2em' }}>
          <RegionControls region={region} onChange={onChange} />
        </div>
        <AutosizedGeneResultsGenesTrack
          genes={genes}
          region={region}
          onChange={onChange}
          innerRegion={innerRegion}
          setInnerRegion={setInnerRegion}
        />
      </div>
    </>
  )
}

LocusZoomPlot.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
  genes: PropTypes.arrayOf(
    PropTypes.shape({
      geneId: PropTypes.string,
      symbol: PropTypes.string,
      chrom: PropTypes.string,
      start: PropTypes.number,
      stop: PropTypes.number,
      exons: PropTypes.arrayOf(
        PropTypes.shape({
          start: PropTypes.number,
          stop: PropTypes.number,
          feature_type: PropTypes.string,
        })
      ),
    })
  ).isRequired,
  region: PropTypes.shape({
    chrom: PropTypes.string.isRequired,
    start: PropTypes.number.isRequired,
    stop: PropTypes.number.isRequired,
  }).isRequired,
}

export default LocusZoomPlot
