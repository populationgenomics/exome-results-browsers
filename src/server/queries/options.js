/* eslint-disable max-classes-per-file */

class Options {
  static choices = {}

  static isValid(choice) {
    return Array.from(Object.values(this.choices)).includes(choice)
  }

  static options() {
    return Object.values(this.choices)
  }

  static toString() {
    return this.options()
      .map((o) => `'${o}'`)
      .join(', ')
  }
}

class ExpressionOptions extends Options {
  static choices = {
    log_residual: 'log_residual',
    residual: 'residual',
    log_cpm: 'log_cpm',
  }
}

module.exports = { ExpressionOptions }
