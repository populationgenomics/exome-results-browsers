import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Searchbox as SearchboxInput } from '@gnomad/ui'

const fetchSearchResults = (query) =>
  fetch(`/api/search?q=${query}`)
    .then((response) => {
      const isOk = response.ok
      return response.json().then((data) => {
        if (!isOk) {
          throw new Error(data.error || 'Search failed')
        }
        return data
      })
    })
    .then((data) => data.results.map(({ label, url }) => ({ label, value: url })))

const Searchbox = (props) => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <SearchboxInput
      // Clear input when URL changes
      key={location.pathname}
      placeholder="Search results by gene, variant or region"
      fetchSearchResults={fetchSearchResults}
      onSelect={(url) => navigate(url)}
      {...props}
    />
  )
}

export default Searchbox
