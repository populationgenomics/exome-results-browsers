import { useEffect, useRef, useState } from 'react'

const DEFAULT_MARGIN = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 })

const computeChartDimensions = ({ width = null, height = null, margin = DEFAULT_MARGIN } = {}) => {
  const dims = {
    width,
    height,
    margin: {
      top: margin.top || DEFAULT_MARGIN.top,
      right: margin.right || DEFAULT_MARGIN.right,
      bottom: margin.bottom || DEFAULT_MARGIN.bottom,
      left: margin.top || DEFAULT_MARGIN.left,
    },
  }

  return {
    ...dims,
    boundedHeight: Math.max(dims.height - dims.margin.top - dims.margin.bottom, 0),
    boundedWidth: Math.max(dims.width - dims.margin.left - dims.margin.right, 0),
  }
}

const useChartDimensions = ({ width = null, height = null, margin = DEFAULT_MARGIN } = {}) => {
  const ref = useRef()

  const dimensions = computeChartDimensions({
    // No user-specified width or parent container to retreive width from. We will set width
    // to a sensible default here so the plot will still display.
    width,
    height,
    margin,
  })

  const [observedWidth, setObservedWidth] = useState(0)
  const [observedHeight, setObservedHeight] = useState(0)

  useEffect(() => {
    if (dimensions.width && dimensions.height) return

    const element = ref.current
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
    }, [])

    if (element) observer.observe(element)

    // eslint-disable-next-line consistent-return
    return () => (element ? observer.unobserve(element) : null)
  })

  // Keep user defined width and height if they were passed in to keep chart area constant and
  // non-responsive.
  const updatedDimensions = computeChartDimensions({
    width: dimensions.width || observedWidth,
    height: dimensions.height || observedHeight,
    margin,
  })

  return [ref, updatedDimensions]
}

export default useChartDimensions
