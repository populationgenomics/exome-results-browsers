const parseNumber = (n, fallback = null, parser = (x) => parseInt(x, 10)) => {
  const number = parser(n)

  if (!number) return fallback
  if (Number.isNaN(number)) return fallback
  if (!Number.isFinite(number)) return fallback
  if (number < 0) return fallback

  return number
}

module.exports = { parseNumber }
