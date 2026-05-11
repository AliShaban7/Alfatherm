import { NavLink } from 'react-router-dom';
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
  FiCreditCard
} from 'react-icons/fi';
import './Sidebar.css';

const menuItems = [
  { path: '/', icon: FiHome, label: 'Əsas Səhifə' },
  { path: '/sales', icon: FiShoppingCart, label: 'Satış' },
  { path: '/inventory', icon: FiPackage, label: 'Anbar' },
  { path: '/products', icon: FiBox, label: 'Məhsullar' },
  { path: '/customers', icon: FiUsers, label: 'Müştərilər' },
  { path: '/debtors', icon: FiFileText, label: 'Debitorlar' },
  { path: '/vendors', icon: FiTruck, label: 'Vendorlar' },
  { path: '/creditors', icon: FiCreditCard, label: 'Kreditorlar' },
  { path: '/expenses', icon: FiDollarSign, label: 'Xərclər' },
  { path: '/reports', icon: FiPieChart, label: 'Hesabatlar' }
];

const Sidebar = ({ isOpen }) => {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/images/logo.png" alt="Alfatherm" className="logo-img" />
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={item.path === '/'}
          >
            <item.icon className="sidebar-icon" />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <p className="sidebar-version">v1.0.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;
