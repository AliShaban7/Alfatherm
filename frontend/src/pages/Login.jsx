import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Email və şifrə daxil edin');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Uğurla daxil oldunuz');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Giriş uğursuz oldu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg"></div>
      <div className="login-container">
        <div className="login-header">
          <img src="/images/logo.png" alt="Alfatherm" className="login-logo-img" />
          <p className="login-subtitle">İdarəetmə Sisteminə Xoş Gəlmisiniz</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Şifrə</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg login-btn"
            disabled={loading}
          >
            {loading ? 'Giriş edilir...' : 'Daxil ol'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
