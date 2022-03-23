/* eslint-disable max-classes-per-file */

class ApiError extends Error {
  statusCode = null
}

class ServerError extends ApiError {
  statusCode = 500
}

class BadRequest extends ApiError {
  statusCode = 400
}

class NotFound extends ApiError {
  statusCode = 404
}

class MissingPathParameter extends BadRequest {}
class InvalidPathParameter extends BadRequest {}
class InvalidQueryParameter extends BadRequest {}

module.exports = {
  ApiError,
  ServerError,
  BadRequest,
  NotFound,
  MissingPathParameter,
  InvalidPathParameter,
  InvalidQueryParameter,
}
