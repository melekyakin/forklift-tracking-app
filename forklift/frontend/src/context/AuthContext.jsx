import React, { createContext, useState, useContext, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { API_URL } from '../config'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('token'))

  useEffect(() => {
    // Token varsa kullanıcı bilgilerini yükle
    if (token) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const response = await apiClient.get('/api/auth/me')
      setUser(response.data)
    } catch (error) {
      console.error('Kullanıcı bilgisi yüklenemedi:', error)
      if (error.response?.status === 401) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (kullanici_adi, sifre) => {
    try {
      console.log('Login denemesi:', kullanici_adi)
      const response = await apiClient.post('/api/auth/login', {
        kullanici_adi,
        sifre
      })
      
      console.log('Login başarılı:', response.data)
      const { token: newToken, user: userData } = response.data
      
      localStorage.setItem('token', newToken)
      setToken(newToken)
      setUser(userData)
      
      console.log('User set edildi:', userData)
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      console.error('Error response:', error.response)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Giriş başarısız. Lütfen backend sunucusunun çalıştığından emin olun.'
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const hasRole = (roles) => {
    if (!user) return false
    if (Array.isArray(roles)) {
      return roles.includes(user.rol)
    }
    return user.rol === roles
  }

  const value = {
    user,
    token,
    login,
    logout,
    loading,
    hasRole,
    isAuthenticated: !!user
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

