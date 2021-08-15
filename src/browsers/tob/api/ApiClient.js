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
   * @param {{ search: string, threshold?: number }} options
   * @returns {Promise<object>}
   */
  fetchAssociations({ search, threshold }) {
    const params = new URLSearchParams()

    if (search.toString().trim()) {
      params.set('search', search.toString().trim())
    }
    if (parseFloat(threshold)) {
      params.set('threshold', threshold)
    }

    // TODO:
    //  1) Update endpoint to return GeneCellAssociation shaped data
    //  2) Update heatmap component to accept callback to allowing how to get row name,
    //     col name and value
    //  3) Remove this data format translation.
    return this.fetchApi(`/associations/?${params.toString()}`)
  }
}

export default ApiClient
