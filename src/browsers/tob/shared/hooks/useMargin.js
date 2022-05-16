import { useEffect, useState } from 'react'

const DEFAULT_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * @param {{top?: number, right?: number, bottom?: number, left?: number}} margin
 * @param {{top?: number, right?: number, bottom?: number, left?: number}} defaults
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
const useMargin = (margin = {}, defaults = { ...DEFAULT_MARGIN }) => {
  const [_margin, setMargin] = useState({
    ...DEFAULT_MARGIN,
    ...(defaults ?? {}),
    ...(margin ?? {}),
  })

  useEffect(() => {
    setMargin({
      top: margin?.top ?? defaults?.top ?? DEFAULT_MARGIN.top,
      right: margin?.right ?? defaults?.right ?? DEFAULT_MARGIN.right,
      bottom: margin?.bottom ?? defaults?.bottom ?? DEFAULT_MARGIN.bottom,
      left: margin?.left ?? defaults?.left ?? DEFAULT_MARGIN.left,
    })
  }, [
    margin?.top,
    margin?.right,
    margin?.bottom,
    margin?.left,
    defaults?.top,
    defaults?.right,
    defaults?.bottom,
    defaults?.left,
  ])

  return _margin
}

export default useMargin
