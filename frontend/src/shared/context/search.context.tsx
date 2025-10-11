import React, { createContext, useContext, useState, useCallback } from 'react'

interface SearchContextValue {
  query: string
  setQuery: (value: string) => void
  resetQuery: () => void
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined)

export const SearchProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [query, setQueryState] = useState('')

  const setQuery = useCallback((value: string) => {
    setQueryState(value)
  }, [])

  const resetQuery = useCallback(() => {
    setQueryState('')
  }, [])

  return <SearchContext.Provider value={{ query, setQuery, resetQuery }}>{children}</SearchContext.Provider>
}

export const useSearch = (): SearchContextValue => {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}
