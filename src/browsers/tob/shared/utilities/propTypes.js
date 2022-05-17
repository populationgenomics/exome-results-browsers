import PropTypes from 'prop-types'

const margin = PropTypes.shape({
  top: PropTypes.number,
  right: PropTypes.number,
  bottom: PropTypes.number,
  left: PropTypes.number,
})

const region = PropTypes.shape({
  chrom: PropTypes.string,
  start: PropTypes.number.isRequired,
  stop: PropTypes.number.isRequired,
})

const aggregate = PropTypes.shape({
  gene_id: PropTypes.string.isRequired,
  gene_symbol: PropTypes.string.isRequired,
  cell_type_id: PropTypes.string.isRequired,
  min_p_value: PropTypes.number.isRequired,
  log10_min_p_value: PropTypes.number.isRequired,
  mean_log_cpm: PropTypes.number.isRequired,
})

export default {
  margin,
  region,
  aggregate,
}
