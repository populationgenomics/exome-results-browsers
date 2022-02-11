import React from 'react'
import { useParams } from 'react-router-dom'

const TOBGenePage = () => {
  const { gene } = useParams()

  return <div>Gene page for {gene}</div>
}

TOBGenePage.propTypes = {}

export default TOBGenePage
