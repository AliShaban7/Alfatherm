import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import NewSale from './pages/NewSale';
import Inventory from './pages/Inventory';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Debtors from './pages/Debtors';
import Vendors from './pages/Vendors';
import Creditors from './pages/Creditors';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Warehouses from './pages/Warehouses';
import Categories from './pages/Categories';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales/new" element={<NewSale />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/products" element={<Products />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/debtors" element={<Debtors />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/creditors" element={<Creditors />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/warehouses" element={<Warehouses />} />
                <Route path="/categories" element={<Categories />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
