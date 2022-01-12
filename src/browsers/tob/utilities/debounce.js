export const debounce = (func, ms = 1000) => {
  let timer = 0

  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => func(...args), ms)
  }
}

export default { debounce }
