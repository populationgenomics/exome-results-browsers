import React from 'react'
import { useParams } from 'react-router-dom'

import TOBViolinPlot from '../components/TOBViolinPlot'

const TOBViolinPage = () => {
  const { gene } = useParams()

  return <TOBViolinPlot gene={gene} />
}

TOBViolinPage.propTypes = {}

export default TOBViolinPage
