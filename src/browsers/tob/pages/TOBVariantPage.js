import React from 'react'
import { useParams } from 'react-router-dom'

const TOBVariantPage = () => {
  const { variant } = useParams()

  return <div>Variant page for {variant}</div>
}

TOBVariantPage.propTypes = {}

export default TOBVariantPage
