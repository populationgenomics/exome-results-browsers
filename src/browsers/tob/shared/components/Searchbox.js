import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Searchbox as SearchboxInput } from '@gnomad/ui'
import { isVariantId } from '@gnomad/identifiers'

const fetchSearchResults = (query) => {
  const results = fetch(`/api/genes?search=${query}&expand=false`)
    .then((response) => {
      const isOk = response.ok
      return response.json().then((data) => {
        if (!isOk) {
          throw new Error(data.error || 'Search failed')
        }
        return data
      })
    })
    .then((data) => {
      if (isVariantId(query)) {
        return [{ label: query, value: `/variant/${query}` }]
      }
      return data.map((g) => ({ label: g.symbol, value: `/gene/${g.gene_id}` }))
    })

  return results
}

const Searchbox = (props) => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <SearchboxInput
      // Clear input when URL changes
      key={location.pathname}
      placeholder="Search results by gene or variant"
      fetchSearchResults={fetchSearchResults}
      onSelect={(url) => navigate(url)}
      {...props}
    />
  )
}

export default Searchbox
