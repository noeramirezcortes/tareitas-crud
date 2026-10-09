import { useEffect, useState } from 'react'

/**
 * Devuelve el valor con un retardo: solo cambia cuando el valor
 * lleva `delay` ms sin modificarse. Útil para inputs de búsqueda.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}
