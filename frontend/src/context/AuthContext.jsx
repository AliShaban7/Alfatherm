import { createContext, useContext, useState, useEffect } from 'react';
import api, { clearApiCache } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      setLoading(false);
      return;
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Show the cached user immediately (no flicker), then re-validate the token
    // against the server. This catches a revoked/expired token and refreshes the
    // role/ownerId if it changed since login — instead of trusting localStorage,
    // which a user could tamper with. A 401 is handled by the api interceptor.
    try {
      setUser(JSON.parse(userData));
    } catch {
      localStorage.removeItem('user');
    }

    api.get('/auth/profile')
      .then((res) => {
        const fresh = res.data?.data;
        if (fresh) {
          const normalized = {
            id: fresh._id,
            name: fresh.name,
            email: fresh.email,
            role: fresh.role,
            ownerId: fresh.ownerId,
            branchId: fresh.branchId?._id || fresh.branchId || null
          };
          localStorage.setItem('user', JSON.stringify(normalized));
          setUser(normalized);
        }
      })
      .catch(() => {
        // Invalid/expired token: the response interceptor clears storage and
        // redirects to /login, so nothing extra is needed here.
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { user: userData, token } = response.data.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    clearApiCache();

    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    clearApiCache();
    setUser(null);
  };

  const isOwner = () => {
    return user?.role === 'OWNER' || user?.role === 'SUPER_OWNER';
  };

  const isSuperOwner = () => {
    return user?.role === 'SUPER_OWNER';
  };

  const isEmployee = () => {
    return user?.role === 'EMPLOYEE';
  };

  const getHomePath = () => (user?.role === 'EMPLOYEE' ? '/sales' : '/');

  const value = {
    user,
    loading,
    login,
    logout,
    isOwner,
    isSuperOwner,
    isEmployee,
    getHomePath
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
