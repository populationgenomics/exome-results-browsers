import { useEffect, useState } from 'react'

const DEFAULT_MARGIN = Object.freeze({ top: 10, right: 10, bottom: 10, left: 10 })
const DEFAULT_HEIGHT = 400
const DEFAULT_WIDTH = 400

const computeChartDimensions = ({
  width = null,
  height = DEFAULT_HEIGHT,
  margin = DEFAULT_MARGIN,
} = {}) => {
  const dims = {
    width,
    height: height || DEFAULT_HEIGHT,
    margin: {
      top: margin.top || 10,
      right: margin.right || 10,
      bottom: margin.bottom || 10,
      left: margin.top || 10,
    },
  }

  return {
    ...dims,
    boundedHeight: Math.max(dims.height - dims.margin.top - dims.margin.bottom, 0),
    boundedWidth: Math.max(dims.width - dims.margin.left - dims.margin.right, 0),
  }
}

const useChartDimensions = ({
  width = null,
  height = DEFAULT_HEIGHT,
  margin = DEFAULT_MARGIN,
  container = null, // React ref object containing the parent element to watch
} = {}) => {
  const dimensions = computeChartDimensions({
    // No user-specified width or parent container to retreive width from. We will set width
    // to a sensible default here so the plot will still display.
    width: !container && !width ? DEFAULT_WIDTH : width,
    height,
    margin,
  })

  const [observedWidth, setObservedWidth] = useState(0)
  const [observedHeight, setObservedHeight] = useState(0)

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      // Guard against case when there are no elements being observed.
      if (!Array.isArray(entries)) return
      if (!entries.length) return

      // Keep user defined width and height if they were passed in to keep chart area
      // constant and non-responsive.
      if (dimensions.width && dimensions.height) return

      const entry = entries[0]
      if (entry) {
        if (observedWidth !== entry.contentRect.width) {
          setObservedWidth(entry.contentRect.width)
        }
        if (observedHeight !== entry.contentRect.height) {
          setObservedHeight(entry.contentRect.height)
        }
      }
    })

    if (container) observer.observe(container.current)

    // eslint-disable-next-line consistent-return
    return () => (container ? observer.unobserve(container.current) : null)
  }, [])

  // Keep user defined width and height if they were passed in to keep chart area constant and
  // non-responsive.
  const updatedDimensions = computeChartDimensions({
    width: dimensions.width || observedWidth,
    height: dimensions.height || observedHeight,
    margin,
  })

  return updatedDimensions
}

export default useChartDimensions
