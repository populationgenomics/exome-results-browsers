const { BigQuery } = require('@google-cloud/bigquery')

const REFERENCES = {
  grch37: 'grch37',
  grch38: 'grch38',
  default: 'grch37',

  referenceIsValid: (value) => {
    return ['grch37', 'grch38'].includes(value.toString().toLowerCase())
  },
}

const CHROM_LENGTHS = {
  [REFERENCES.grch37]: {
    chr1: 249250621,
    chr2: 243199373,
    chr3: 198022430,
    chr4: 191154276,
    chr5: 180915260,
    chr6: 171115067,
    chr7: 159138663,
    chr8: 146364022,
    chr9: 141213431,
    chr10: 135534747,
    chr11: 135006516,
    chr12: 133851895,
    chr13: 115169878,
    chr14: 107349540,
    chr15: 102531392,
    chr16: 90354753,
    chr17: 81195210,
    chr18: 78077248,
    chr19: 59128983,
    chr20: 63025520,
    chr21: 48129895,
    chr22: 51304566,
    chrX: 155270560,
    chrY: 59373566,
  },
  [REFERENCES.grch38]: {
    chr1: 248956422,
    chr2: 242193529,
    chr3: 198295559,
    chr4: 190214555,
    chr5: 181538259,
    chr6: 170805979,
    chr7: 159345973,
    chr8: 145138636,
    chr9: 138394717,
    chr10: 133797422,
    chr11: 135086622,
    chr12: 133275309,
    chr13: 114364328,
    chr14: 107043718,
    chr15: 101991189,
    chr16: 90338345,
    chr17: 83257441,
    chr18: 80373285,
    chr19: 58617616,
    chr20: 64444167,
    chr21: 46709983,
    chr22: 50818468,
    chrX: 156040895,
    chrY: 57227415,
  },
}

const OFFSETS = { [REFERENCES.grch37]: {}, [REFERENCES.grch38]: {} }
Object.keys(OFFSETS).forEach((reference) => {
  Object.keys(CHROM_LENGTHS[reference]).forEach((_, index) => {
    const offset = Object.values(CHROM_LENGTHS[reference])
      .slice(0, index)
      .reduce((x, y) => x + y, 0)

    OFFSETS[reference][index + 1] = offset
  })
})

const convertPositionToGlobalPosition = ({
  chrom,
  start,
  stop,
  reference = REFERENCES.default,
}) => {
  const offset = OFFSETS[reference][chrom] - 1 // Range end is not included

  return { chrom, start: start + offset, stop: stop + offset }
}

const submitQuery = async ({ query, options }) => {
  // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
  const bigquery = new BigQuery()

  const verbose = options.verbose || false
  if (verbose) {
    // eslint-disable-next-line no-console
    console.debug(query)
  }

  const [job] = await bigquery.createQueryJob({
    query,
    location: 'australia-southeast1',
    allowLargeResults: true,
    useQueryCache: true,
    ...options,
  })

  const result = await job.getQueryResults()

  return result.flat()
}

const fetchGeneIdSuggestions = async ({ gene, options = {} }) => {
  const query = `
    SELECT
      DISTINCT
        gene_id,
        gene_name
    FROM
      \`tob-wgs-browser.grch37.gene_annotation\`
    WHERE
        gene_name LIKE '${gene}%'
  `

  const results = await submitQuery({ query, options })

  return results.map((r) => {
    return { url: `/gene/${r.gene_id.split('.')[0]}`, label: r.gene_name }
  })
}

const fetchGenesInRegion = async ({ region, round = 1, options = {} }) => {
  const query = `
  SELECT
    DISTINCT(gene), 
  FROM 
    \`tob-wgs-browser.grch37.eqtl\`
  WHERE
      g_bp >= ${region.start} 
    AND 
      g_bp <= ${region.stop}
    AND
      round = ${round}
`
  const result = await submitQuery({ query, options })

  return result.map((record) => record.gene)
}

const fetchAssociationHeatmap = async ({
  region,
  aggregateBy = 'q_value',
  round = 1,
  options = {},
}) => {
  const heatmapQuery = `
    SELECT
      DISTINCT 
        gene AS geneName, 
        cell_type_id AS cellTypeId,
      q_value AS value
    FROM 
      (
        SELECT
          *,
          MIN(${aggregateBy}) OVER (PARTITION BY gene, cell_type_id) AS minValue
        FROM
          \`tob-wgs-browser.grch37.eqtl\`
        WHERE
            g_bp >= ${region.start} 
          AND 
            g_bp <= ${region.stop}
          AND 
            chr = ${region.chrom}
          AND
            round = ${round}
      )
    WHERE
      q_value = minValue
  `

  const results = await submitQuery({ query: heatmapQuery, options })

  const minValue = results.reduce((min, r) => Math.min(min, r.value), Number.MAX_SAFE_INTEGER)
  const maxValue = results.reduce((max, r) => Math.max(max, r.value), Number.MIN_SAFE_INTEGER)
  const geneNames = results.map((r) => r.geneName)
  const cellTypeIds = Array.from(new Set(results.map((r) => r.cellTypeId))).sort()

  return { geneNames, cellTypeIds, range: { minValue, maxValue }, data: results }
}

module.exports = {
  fetchGeneIdSuggestions,
  convertPositionToGlobalPosition,
  fetchAssociationHeatmap,
  fetchGenesInRegion,
}
