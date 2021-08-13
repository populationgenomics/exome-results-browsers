import { GeneCellAssociation } from './data_types/GeneCallAssociation'
import { VariantAssociation } from './data_types/VariantAssociation'

export class ApiClient {
  constructor(endpoint = 'api/') {
    this.endpoint = endpoint
  }

  fetchApi(path) {
    return fetch(`/${this.endpoint}/${path}`, {
      method: 'GET',
    }).then((response) => {
      const isOk = response.ok
      return response.json().then(
        (data) => {
          if (!isOk) {
            throw new Error(data.error || 'Unable to load data')
          }
          return data.results
        },
        () => {
          throw new Error('Unable to parse response')
        }
      )
    })
  }

  /**
   * @param {{ search: string, pValMax?: number }} options
   * @returns {Promise<{data: GeneCellAssociation[], minValue: number, maxValue: number>}
   */
  fetchHeatmap({ search, pValMax }) {
    const params = new URLSearchParams()

    if (search.toString().trim()) {
      params.set('search', search.toString().trim())
    }
    if (parseFloat(pValMax)) {
      params.set('pValMax', pValMax)
    }

    // TODO:
    //  1) Update endpoint to return GeneCellAssociation shaped data
    //  2) Update heatmap component to accept callback to allowing how to get row name,
    //     col name and value
    //  3) Remove this data format translation.
    return this.fetchApi(`/heatmap/?${params.toString()}`).then((result) => {
      return {
        ...result,
        data: result.data.map((item) => {
          return new GeneCellAssociation({
            gene: item.row,
            cell: item.col,
            pval: item.value,
          })
        }),
      }
    })
  }

  /**
   * @param {{ geneCellPairs: {gene: string, cell: string}[], pValMax?: number }} options
   * @returns {Promise<{data: VariantAssociation[], minValue: number, maxValue: number>}
   */
  fetchLocusPlot({ geneCellPairs, pValMax }) {
    const params = new URLSearchParams({ delimiter: '|' })

    if (parseFloat(pValMax)) {
      params.set('pValMax', pValMax)
    }
    if (geneCellPairs.length > 0) {
      geneCellPairs.forEach(({ gene, cell }) => {
        params.append('geneCellPair', [gene, cell].join('|'))
      })
    }

    return this.fetchApi(`/locus-plot/?${params.toString()}`).then((result) => {
      return {
        ...result,
        data: result.data.map((item) => new VariantAssociation({ ...item })),
      }
    })
  }
}

export default ApiClient
