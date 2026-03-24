import React, { createContext, useContext } from 'react'

const NavigationContext = createContext(null)

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

export const NavigationProvider = ({ children, setActiveTab }) => {
  return (
    <NavigationContext.Provider value={{ setActiveTab }}>
      {children}
    </NavigationContext.Provider>
  )
}

