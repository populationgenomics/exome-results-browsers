/* eslint-disable no-unused-vars */

const express = require('express')

const {
  isRegionId,
  isVariantId,
  isRsId,
  parseRegionId,
  parseVariantId,
} = require('@gnomad/identifiers')

const { parseConditioningRound } = require('../queries/old/utilities')
const { convertPositionToGlobalPosition } = require('../queries/genome')
const { isGene, isEnsemblGeneId } = require('../identifiers')
const { config } = require('../config')

const {
  fetchGeneIdSuggestions,
  fetchGenesInRegion,
  fetchGenesById,
  fetchGenesAssociatedWithVariant,
  fetchGenes,
  fetchGeneExpression,
} = require('../queries/old/gene')
const { fetchVariantsById, fetchVariantsInRegion } = require('../queries/old/variant')
const { fetchAssociationHeatmap } = require('../queries/old/heatmap')

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  // ===============================================================================================
  // Gene
  // ===============================================================================================
  app.get('/api/search', (req, res) => {
    if (!req.query.q) {
      return res.status(400).json({ error: 'Query required' })
    }

    if (Array.isArray(req.query.q)) {
      return res.status(400).json({ error: 'One query required' })
    }

    return fetchGeneIdSuggestions({ query: req.query.q }).then((data) =>
      res.status(200).json({ results: data })
    )
  })

  app.get('/api/genes', (req, res) => {
    const { query } = req.query

    if (isRegionId(query)) {
      const region = parseRegionId(query)

      if (Math.abs(region.stop - region.start) > config.maxRegionSize) {
        return res.status(400).json({ error: 'Data is not available for a region this large' })
      }

      return fetchGenesInRegion({ region })
        .then((results) => res.status(200).json({ results: { genes: results, region } }))
        .catch((error) => res.status(400).json({ error: error.message }))
    }

    if (isEnsemblGeneId(query)) {
      return fetchGenesById({ ids: [query] })
        .then((results) =>
          res.status(200).json({
            results: {
              genes: results,
              region: {
                chrom: results[0].chrom,
                start: results[0].global_start,
                stop: results[0].global_stop,
              },
            },
          })
        )
        .catch((error) => res.status(400).json({ error: error.message }))
    }

    if (isVariantId(query)) {
      const variant = parseVariantId(query)
      return fetchGenesAssociatedWithVariant({ variant })
        .then((results) =>
          res.status(200).json({
            results: {
              genes: results,
              region: {
                chrom: variant.chrom,
                start: Math.min(...results.map((r) => r.start)),
                stop: Math.max(...results.map((r) => r.stop)),
              },
            },
          })
        )
        .catch((error) => res.status(400).json({ error: error.message }))
    }

    return fetchGenes({ query })
      .then((results) =>
        res.status(200).json({
          results: {
            genes: results,
            region: null,
          },
        })
      )
      .catch((error) => res.status(400).json({ error: error.message }))
  })

  app.get('/api/genes/:id', (req, res) => {
    return fetchGenesById({ ids: [req.params.id] })
      .then((results) => res.status(200).json({ results: results[0] }))
      .catch((error) => res.status(400).json({ error: error.message }))
  })

  app.get('/api/genes/:gene/residuals', (req, res) => {
    return fetchGeneExpression({
      gene: req.params.gene,
      cellTypesIds: req.query.cellTypeIds?.split(',') || [],
      chroms: req.query.chroms?.split(',') || [],
    })
      .then((results) => res.status(200).json({ results }))
      .catch((error) => res.status(400).json({ error: error.message }))
  })

  // ===============================================================================================
  // Variants
  // ===============================================================================================
  app.get('/api/associations/', (req, res) => {
    let round = 1
    try {
      round = parseConditioningRound(req.query.round)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    const region = convertPositionToGlobalPosition({ ...parseRegionId(req.query.region) })
    const genes = req.query.genes?.trim()?.split(',') || []
    const cellTypes = req.query.cellTypes?.trim()?.split(',') || []

    if (Math.abs(region.stop - region.start) > config.maxRegionSize) {
      return res.status(400).json({ error: 'Data is not available for a region this large' })
    }

    return fetchVariantsInRegion({ region, genes, cellTypes, round })
      .then((results) => res.status(200).json({ results }))
      .catch((error) => res.status(400).json({ error: error.message }))
  })

  app.get('/api/associations/aggregate', (req, res) => {
    const { query } = req.query

    if (!(isRegionId(query) || isVariantId(query) || isRsId(query) || isGene(query))) {
      return res.status(400).json({ error: 'Query must be a gene, region, variant ID or rsid' })
    }

    if (isRegionId(query)) {
      const region = parseRegionId(query)

      if (Math.abs(region.stop - region.start) > config.maxRegionSize) {
        return res.status(400).json({ error: 'Data is not available for a region this large' })
      }
    }

    let round = 1
    try {
      round = parseConditioningRound(req.query.round)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    return fetchAssociationHeatmap({ query, round, aggregateBy: 'p_value' })
      .then((data) => res.status(200).json({ results: data }))
      .catch((error) => res.status(400).json({ error: error.message }))
  })

  app.get('/api/associations/:id', (req, res) => {
    return fetchVariantsById({ ids: [req.params.id] })
      .then((results) => res.status(200).json({ results }))
      .catch((error) => res.status(400).json({ error: error.message }))
  })
}

module.exports = { setup }
