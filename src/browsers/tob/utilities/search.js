import {
  isRegionId,
  isVariantId,
  normalizeVariantId,
  parseRegionId,
  isRsId,
} from '@gnomad/identifiers'

export const resolveSearchQuery = (query) => {
  // ==============================================================================================
  // Variant
  // ==============================================================================================

  if (isVariantId(query)) {
    const variantId = normalizeVariantId(query)
    return Promise.resolve([
      {
        label: variantId,
        value: `/variant/${variantId}`,
      },
    ])
  }

  if (isRsId(query)) {
    const rsId = query
    return Promise.resolve([
      {
        label: rsId,
        value: `/variant/${rsId}`,
      },
    ])
  }

  if (/^CA[0-9]+$/i.test(query)) {
    const caid = query.toUpperCase()
    return Promise.resolve([
      {
        label: caid,
        value: `/variant/${caid}`,
      },
    ])
  }

  if (/^[0-9]+$/.test(query)) {
    const clinvarVariationId = query
    return Promise.resolve([
      {
        label: clinvarVariationId,
        value: `/variant/${clinvarVariationId}`,
      },
    ])
  }

  // ==============================================================================================
  // Region
  // ==============================================================================================

  if (isRegionId(query)) {
    const { chrom, start, stop } = parseRegionId(query)
    const regionId = `${chrom}-${start}-${stop}`
    const results = [
      {
        label: regionId,
        value: `/region/${regionId}`,
      },
    ]

    // If a position is entered, return options for a 40 base region centered
    // at the position and the position as a one base region.
    if (start === stop) {
      const windowRegionId = `${chrom}-${Math.max(1, start - 20)}-${stop + 20}`
      results.unshift({
        label: windowRegionId,
        value: `/region/${windowRegionId}`,
      })
    }

    return Promise.resolve(results)
  }

  // ==============================================================================================
  // Gene ID
  // ==============================================================================================

  const upperCaseQuery = query.toUpperCase()

  if (/^ENSG\d{11}$/.test(upperCaseQuery)) {
    const geneId = upperCaseQuery
    return Promise.resolve([
      {
        label: geneId,
        value: `/gene/${geneId}`,
      },
    ])
  }

  // ==============================================================================================
  // Gene symbol
  // ==============================================================================================

  if (/^[A-Z][A-Z0-9-]*$/.test(upperCaseQuery)) {
    return fetch('/api/gene/search', {
      body: JSON.stringify({ query: upperCaseQuery }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.json())
      .then((response) => {
        if (!response.data) {
          throw new Error('Unable to retrieve search results')
        }

        const genes = response.data

        const geneSymbolCounts = {}
        genes.forEach((gene) => {
          if (geneSymbolCounts[gene.symbol] === undefined) {
            geneSymbolCounts[gene.symbol] = 0
          }
          geneSymbolCounts[gene.symbol] += 1
        })

        return genes.map((gene) => ({
          label:
            geneSymbolCounts[gene.symbol] > 1 ? `${gene.symbol} (${gene.ensemblId})` : gene.symbol,
          value: `/gene/${gene.ensemblId}`,
        }))
      })
  }

  return Promise.resolve([])
}

export const resolveVariantQuery = (query) => {
  return fetch('/api/variant/search', {
    body: JSON.stringify({ query }),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
    .then((response) => response.json())
    .then((response) => {
      if (!response.data) {
        throw new Error('Unable to retrieve search results')
      }

      return response.data.map((result) => result.variantId)
    })
}
