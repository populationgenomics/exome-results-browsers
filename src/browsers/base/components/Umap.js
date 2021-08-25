import PropTypes from 'prop-types'
import React, { useEffect, useRef } from 'react'

import { scaleLinear, zoom, quadtree, select, extent, color } from 'd3'
import {
  chartCartesian,
  seriesWebglMulti,
  seriesSvgMulti,
  seriesWebglPoint,
  pointer,
  webglFillColor,
  webglStrokeColor,
} from 'd3fc'
import { annotationCallout } from 'd3-svg-annotation'

import seriesSvgAnnotation from './annotation-series'

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
//! FIX ESLINTING
const Umap = ({
  height,
  width,
  id, // eslint-disable-line
  data,
  pointColor, // eslint-disable-line
  pointLabel,
  pointX, // eslint-disable-line
  pointY, // eslint-disable-line
  labelColors,
  margin, // eslint-disable-line
}) => {
  const wrapperRef = useRef()
  let newData = data

  const allLabels = Array.from(new Set(data.map(pointLabel)))
  const labelToColor = allLabels.reduce((map, label, index) => {
    const myColor = index < labelColors.length ? labelColors[index] : '#1e1e1e'
    return { ...map, [label]: myColor }
  }, {})
  useEffect(() => {
    const createAnnotationData = (datapoint) => ({
      note: {
        // label: `${datapoint.x} ${datapoint.y}`,
        // bgPadding: 5,
        title: datapoint.label,
      },
      x: datapoint.x,
      y: datapoint.y,
      dx: -20, // offset for tooltip //TODO (consider edge cases that get cut off)
      dy: -20,
      color: '#000000',
    })

    //     create a spatial index for rapidly finding the closest datapoint
    const thisQuadtree = quadtree()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(data)

    const xScale = scaleLinear()
      .domain(extent(data.map((d) => d.x)))
      .nice()
    const yScale = scaleLinear()
      .domain(extent(data.map((d) => d.y)))
      .nice()
    const xScaleOriginal = xScale.copy()
    const yScaleOriginal = yScale.copy()

    const pointSeries = seriesWebglPoint()
      .equals((a, b) => a === b)
      .size(50)
      .crossValue((d) => d.x)
      .mainValue((d) => d.y)

    // compute the fill color for each datapoint
    const webglColor = (thisColor, opacity = 0.7) => {
      const { r, g, b } = color(thisColor).rgb()
      return [r / 255, g / 255, b / 255, opacity]
    }

    pointSeries.decorate((program) => {
      webglFillColor()
        .value((d) => webglColor(labelToColor[d.label]))
        .data(newData)(program)
      webglStrokeColor()
        .value((d) => webglColor(labelToColor[d.label]))
        .data(newData)(program)
      // pointAntiAlias()(program)
      const gl = program.context()
      gl.enable(gl.BLEND)
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    })

    const annotations = []

    const zoomFunction = zoom()
      // .scaleExtent([0.8, 10])
      // .translateExtent([-30, -30], [width + 90, height + 100])
      .extent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([1, 10])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (e) => {
        // update the scales based on current zoom
        xScale.domain(e.transform.rescaleX(xScaleOriginal).domain())
        yScale.domain(e.transform.rescaleY(yScaleOriginal).domain())
        select('#chart').datum({ annotations, newData }).call(chart) // eslint-disable-line
      })

    const pointerFunction = pointer().on('point', ([coord]) => {
      // console.log(labelToColor.Bmem)
      annotations.pop()

      if (!coord || !quadtree) {
        return
      }

      // find the closes datapoint to the pointer
      const x = xScale.invert(coord.x)
      const y = yScale.invert(coord.y)
      const radius = Math.abs(xScale.invert(coord.x) - xScale.invert(coord.x - 20))
      const closestDatum = thisQuadtree.find(x, y, radius)

      // if the closest point is within 20 pixels, show the annotation
      if (closestDatum) {
        newData = data
          .filter((d) => d.label !== closestDatum.label)
          .concat(data.filter((d) => d.label === closestDatum.label))
        pointSeries.decorate((program) => {
          webglFillColor()
            .value((d) => {
              return d.label === closestDatum.label
                ? webglColor(labelToColor[d.label], 1)
                : webglColor(labelToColor[d.label])
            })
            .data(newData)(program)
          webglStrokeColor()
            .value((d) =>
              d.label === closestDatum.label ? [0, 0, 0, 1] : webglColor(labelToColor[d.label])
            )
            .data(newData)(program)
          const gl = program.context()
          gl.enable(gl.BLEND)
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        })
        annotations[0] = createAnnotationData(closestDatum)
      } else {
        newData = data
        pointSeries.decorate((program) => {
          webglFillColor()
            .value((d) => webglColor(labelToColor[d.label]))
            .data(newData)(program)
          webglStrokeColor()
            .value((d) => webglColor(labelToColor[d.label]))
            .data(newData)(program)
          const gl = program.context()
          gl.enable(gl.BLEND)
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        })
      }
      select('#chart').datum({ annotations, newData }).call(chart) // eslint-disable-line
    })

    const annotationSeries = seriesSvgAnnotation().notePadding(15).type(annotationCallout)

    const chart = chartCartesian(xScale, yScale)
      .webglPlotArea(
        // only render the point series on the WebGL layer
        seriesWebglMulti()
          .series([pointSeries])
          .mapping((d) => d.newData)
      )
      .svgPlotArea(
        // only render the annotations series on the SVG layer
        seriesSvgMulti()
          .series([annotationSeries])
          .mapping((d) => d.annotations)
      )
      .decorate((sel) =>
        sel
          .enter()
          .select('d3fc-svg.plot-area')
          .on('measure.range', (e) => {
            xScaleOriginal.range([0, e.detail.width])
            yScaleOriginal.range([e.detail.height, 0])
          })
          .call(zoomFunction)
          .call(pointerFunction)
      )

    // weird transparency settings
    select('#chart').datum({ annotations, newData }).call(chart)
    // const canvas = document.getElementsByTagName('canvas').item(0)
    // canvas.getContext('webgl', { premultipliedAlpha: false })
    // const c = canvas.getContext('webgl')
    // c.clear(c.COLOR_CLEAR_VALUE)
    // select('#chart').datum({ annotations, newData }).call(chart)
  }, [])

  return <div ref={wrapperRef} id="chart" style={{ height: `${height}px`, width: `${width}px` }} />
}

Umap.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  pointColor: PropTypes.func,
  pointX: PropTypes.func,
  pointY: PropTypes.func,
  pointLabel: PropTypes.func,
  labelColors: PropTypes.arrayOf(PropTypes.string),
  height: PropTypes.number,
  width: PropTypes.number,
  id: PropTypes.string,
  margin: PropTypes.shape({
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    bottom: PropTypes.number,
  }),
}

Umap.defaultProps = {
  height: 500,
  width: 500,
  id: 'umap',
  labelColors: [...DEFAULT_COLORS],
  margin: { left: 40, right: 40, top: 40, bottom: 40 },
  pointColor: null,
  pointX: (d) => d.x,
  pointY: (d) => d.y,
  pointLabel: (d) => d.label,
}

export default Umap
