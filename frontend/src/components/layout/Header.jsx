import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  FiHome, 
  FiShoppingCart, 
  FiPackage, 
  FiBox,
  FiUsers, 
  FiFileText,
  FiTruck,
  FiDollarSign,
  FiPieChart,
  FiCreditCard,
  FiUser,
  FiLogOut,
  FiChevronDown,
  FiMenu,
  FiX,
  FiSettings,
  FiGrid
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

const Header = () => {
  const { user, logout, isEmployee } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [parametrlerOpen, setParametrlerOpen] = useState(false);
  const [hesabatlarOpen, setHesabatlarOpen] = useState(false);
  
  const parametrlerRef = useRef(null);
  const hesabatlarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (parametrlerRef.current && !parametrlerRef.current.contains(event.target)) {
        setParametrlerOpen(false);
      }
      if (hesabatlarRef.current && !hesabatlarRef.current.contains(event.target)) {
        setHesabatlarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_OWNER':
        return <span className="role-badge super-owner">Admin</span>;
      case 'OWNER':
        return <span className="role-badge owner">Təsisçi</span>;
      default:
        return <span className="role-badge employee">İşçi</span>;
    }
  };

  const isParametrlerActive = ['/customers', '/vendors', '/warehouses'].includes(location.pathname);
  const isHesabatlarActive = ['/reports', '/debtors', '/creditors'].includes(location.pathname);

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <NavLink to="/" className="header-logo">
            <img src="/images/logo.png" alt="Alfatherm" className="logo-img" />
          </NavLink>
          
          <nav className="header-nav">
            {!isEmployee() && (
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                <FiHome className="nav-icon" />
                <span className="nav-label">Əsas Səhifə</span>
              </NavLink>
            )}
            
            <NavLink to="/sales" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FiShoppingCart className="nav-icon" />
              <span className="nav-label">Satış</span>
            </NavLink>
            
            <NavLink to="/inventory" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FiPackage className="nav-icon" />
              <span className="nav-label">Anbar</span>
            </NavLink>
            
            <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FiBox className="nav-icon" />
              <span className="nav-label">Məhsullar</span>
            </NavLink>
            
            {!isEmployee() && (
              <NavLink to="/expenses" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <FiDollarSign className="nav-icon" />
                <span className="nav-label">Xərclər</span>
              </NavLink>
            )}

            {/* Hesabatlar Dropdown - Hidden for employees */}
            {!isEmployee() && (
              <div className="nav-dropdown" ref={hesabatlarRef}>
              <button 
                className={`nav-link nav-dropdown-btn ${isHesabatlarActive ? 'active' : ''}`}
                onClick={() => setHesabatlarOpen(!hesabatlarOpen)}
              >
                <FiPieChart className="nav-icon" />
                <span className="nav-label">Hesabatlar</span>
                <FiChevronDown className={`nav-dropdown-arrow ${hesabatlarOpen ? 'open' : ''}`} />
              </button>
              {hesabatlarOpen && (
                <div className="nav-dropdown-menu">
                  <NavLink 
                    to="/reports" 
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setHesabatlarOpen(false)}
                  >
                    <FiPieChart className="nav-icon" />
                    <span>Hesabatlar</span>
                  </NavLink>
                  <NavLink 
                    to="/debtors" 
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setHesabatlarOpen(false)}
                  >
                    <FiFileText className="nav-icon" />
                    <span>Debitorlar</span>
                  </NavLink>
                  <NavLink 
                    to="/creditors" 
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setHesabatlarOpen(false)}
                  >
                    <FiCreditCard className="nav-icon" />
                    <span>Kreditorlar</span>
                  </NavLink>
                </div>
              )}
              </div>
            )}

            {/* Parametrlər Dropdown */}
            <div className="nav-dropdown" ref={parametrlerRef}>
              <button 
                className={`nav-link nav-dropdown-btn ${isParametrlerActive ? 'active' : ''}`}
                onClick={() => setParametrlerOpen(!parametrlerOpen)}
              >
                <FiSettings className="nav-icon" />
                <span className="nav-label">Parametrlər</span>
                <FiChevronDown className={`nav-dropdown-arrow ${parametrlerOpen ? 'open' : ''}`} />
              </button>
              {parametrlerOpen && (
                <div className="nav-dropdown-menu">
                  <NavLink 
                    to="/customers" 
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setParametrlerOpen(false)}
                  >
                    <FiUsers className="nav-icon" />
                    <span>Müştərilər</span>
                  </NavLink>
                  {!isEmployee() && (
                    <>
                      <NavLink 
                        to="/vendors" 
                        className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => setParametrlerOpen(false)}
                      >
                        <FiTruck className="nav-icon" />
                        <span>Vendorlar</span>
                      </NavLink>
                      <NavLink 
                        to="/warehouses" 
                        className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => setParametrlerOpen(false)}
                      >
                        <FiHome className="nav-icon" />
                        <span>Anbarlar</span>
                      </NavLink>
                      <NavLink 
                        to="/categories" 
                        className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => setParametrlerOpen(false)}
                      >
                        <FiGrid className="nav-icon" />
                        <span>Kateqoriyalar</span>
                      </NavLink>
                    </>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
        
        <div className="header-right">
          <div className="header-user" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="user-avatar">
              <FiUser />
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              {getRoleBadge(user?.role)}
            </div>
            <FiChevronDown className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`} />
            
            {dropdownOpen && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <p className="dropdown-name">{user?.name}</p>
                  <p className="dropdown-email">{user?.email}</p>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleLogout}>
                  <FiLogOut />
                  <span>Çıxış</span>
                </button>
              </div>
            )}
          </div>

          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="mobile-nav">
          {!isEmployee() && (
            <NavLink to="/" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} end onClick={() => setMobileMenuOpen(false)}>
              <FiHome className="nav-icon" /><span>Əsas Səhifə</span>
            </NavLink>
          )}
          <NavLink to="/sales" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <FiShoppingCart className="nav-icon" /><span>Satış</span>
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <FiPackage className="nav-icon" /><span>Anbar</span>
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <FiBox className="nav-icon" /><span>Məhsullar</span>
          </NavLink>
          {!isEmployee() && (
            <NavLink to="/expenses" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              <FiDollarSign className="nav-icon" /><span>Xərclər</span>
            </NavLink>
          )}
          
          {!isEmployee() && (
            <div className="mobile-nav-group">
              <span className="mobile-nav-group-title">Hesabatlar</span>
              <NavLink to="/reports" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                <FiPieChart className="nav-icon" /><span>Hesabatlar</span>
              </NavLink>
              <NavLink to="/debtors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                <FiFileText className="nav-icon" /><span>Debitorlar</span>
              </NavLink>
              <NavLink to="/creditors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                <FiCreditCard className="nav-icon" /><span>Kreditorlar</span>
              </NavLink>
            </div>
          )}
          
          <div className="mobile-nav-group">
            <span className="mobile-nav-group-title">Parametrlər</span>
            <NavLink to="/customers" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              <FiUsers className="nav-icon" /><span>Müştərilər</span>
            </NavLink>
            {!isEmployee() && (
              <>
                <NavLink to="/vendors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiTruck className="nav-icon" /><span>Vendorlar</span>
                </NavLink>
                <NavLink to="/warehouses" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiHome className="nav-icon" /><span>Anbarlar</span>
                </NavLink>
                <NavLink to="/categories" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiGrid className="nav-icon" /><span>Kateqoriyalar</span>
                </NavLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
