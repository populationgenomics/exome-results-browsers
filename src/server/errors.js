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

class MissingParameter extends BadRequest {}
class InvalidParameter extends BadRequest {}
class InvalidQueryParameter extends BadRequest {}

module.exports = {
  ApiError,
  ServerError,
  BadRequest,
  NotFound,
  MissingParameter,
  InvalidParameter,
  InvalidQueryParameter,
}
