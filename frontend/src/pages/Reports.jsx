import { useState, useEffect } from 'react';
import { FiDownload, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { reportAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [loading, setLoading] = useState(true);
  const [salesReport, setSalesReport] = useState(null);
  const [productReport, setProductReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [profitLossReport, setProfitLossReport] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    groupBy: 'day'
  });
  const { isOwner } = useAuth();

  useEffect(() => {
    fetchReport();
  }, [activeTab]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'sales':
          const salesRes = await reportAPI.getSalesReport(filters);
          setSalesReport(salesRes.data.data);
          break;
        case 'products':
          const productRes = await reportAPI.getProductSalesReport(filters);
          setProductReport(productRes.data.data);
          break;
        case 'inventory':
          const invRes = await reportAPI.getInventoryReport();
          setInventoryReport(invRes.data.data);
          break;
        case 'profit':
          if (isOwner()) {
            const profitRes = await reportAPI.getProfitLossReport(filters);
            setProfitLossReport(profitRes.data.data);
          }
          break;
      }
    } catch (error) {
      toast.error('Hesabatı yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount || 0) + ' AZN';
  };

  const renderSalesReport = () => (
    <div>
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-value">{salesReport?.totals?.salesCount || 0}</div>
          <div className="stat-card-label">Toplam Satış</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{formatCurrency(salesReport?.totals?.totalAmount)}</div>
          <div className="stat-card-label">Toplam Məbləğ</div>
        </div>
        {isOwner() && (
          <>
            <div className="stat-card">
              <div className="stat-card-value">{formatCurrency(salesReport?.totals?.totalCost)}</div>
              <div className="stat-card-label">Maya Dəyəri</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(salesReport?.totals?.totalProfit)}
              </div>
              <div className="stat-card-label">Qazanc</div>
            </div>
          </>
        )}
      </div>

      {salesReport?.data?.length > 0 && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Dövr</th>
                <th>Satış Sayı</th>
                <th>Məbləğ</th>
                <th>Nağd</th>
                <th>POS</th>
                <th>Bank</th>
                <th>Nisyə</th>
                {isOwner() && <th>Qazanc</th>}
              </tr>
            </thead>
            <tbody>
              {salesReport.data.map((row, index) => (
                <tr key={index}>
                  <td>
                    {row._id.day 
                      ? `${row._id.day}.${row._id.month}.${row._id.year}`
                      : row._id.month 
                        ? `${row._id.month}/${row._id.year}`
                        : `Həftə ${row._id.week}/${row._id.year}`
                    }
                  </td>
                  <td>{row.salesCount}</td>
                  <td><strong>{formatCurrency(row.totalAmount)}</strong></td>
                  <td>{formatCurrency(row.cashSales)}</td>
                  <td>{formatCurrency(row.posSales)}</td>
                  <td>{formatCurrency(row.bankSales)}</td>
                  <td style={{ color: 'var(--warning)' }}>{formatCurrency(row.creditSales)}</td>
                  {isOwner() && (
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(row.totalProfit)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderProductReport = () => (
    <div>
      <h3 style={{ marginBottom: '1rem' }}>Ən Çox Satılan Məhsullar</h3>
      {productReport?.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Məhsul</th>
                <th>Satış Miqdarı</th>
                <th>Toplam Məbləğ</th>
                {isOwner() && <th>Qazanc</th>}
              </tr>
            </thead>
            <tbody>
              {productReport.map((row, index) => (
                <tr key={row._id}>
                  <td>{index + 1}</td>
                  <td><strong>{row.productName}</strong></td>
                  <td>{row.totalQuantity}</td>
                  <td>{formatCurrency(row.totalAmount)}</td>
                  {isOwner() && (
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(row.totalProfit)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p className="empty-state-text">Məlumat tapılmadı</p>
        </div>
      )}
    </div>
  );

  const renderInventoryReport = () => (
    <div>
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-value">{inventoryReport?.totals?.totalProducts || 0}</div>
          <div className="stat-card-label">Məhsul Növü</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{inventoryReport?.totals?.totalQuantity || 0}</div>
          <div className="stat-card-label">Toplam Miqdar</div>
        </div>
        {isOwner() && inventoryReport?.totals?.totalValue && (
          <div className="stat-card">
            <div className="stat-card-value">{formatCurrency(inventoryReport.totals.totalValue)}</div>
            <div className="stat-card-label">Maya Dəyəri</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-card-value">{formatCurrency(inventoryReport?.totals?.totalRetailValue)}</div>
          <div className="stat-card-label">Satış Dəyəri</div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem' }}>Anbarlara görə Stok</h3>
      {inventoryReport?.byWarehouse?.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Anbar</th>
                <th>Tip</th>
                <th>Məhsul Sayı</th>
                <th>Miqdar</th>
                {isOwner() && <th>Maya Dəyəri</th>}
                <th>Satış Dəyəri</th>
              </tr>
            </thead>
            <tbody>
              {inventoryReport.byWarehouse.map((row) => (
                <tr key={row._id}>
                  <td><strong>{row.warehouseName}</strong></td>
                  <td>
                    <span className={`badge ${row.warehouseType === 'main' ? 'badge-info' : 'badge-secondary'}`}>
                      {row.warehouseType === 'main' ? 'Əsas' : 'Filial'}
                    </span>
                  </td>
                  <td>{row.totalProducts}</td>
                  <td>{row.totalQuantity}</td>
                  {isOwner() && row.totalValue && (
                    <td>{formatCurrency(row.totalValue)}</td>
                  )}
                  <td>{formatCurrency(row.totalRetailValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p className="empty-state-text">Məlumat tapılmadı</p>
        </div>
      )}
    </div>
  );

  const renderProfitLossReport = () => (
    <div>
      {profitLossReport && (
        <>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-card-value">{formatCurrency(profitLossReport.revenue)}</div>
              <div className="stat-card-label">Gəlir</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(profitLossReport.costOfGoods)}
              </div>
              <div className="stat-card-label">Maya Dəyəri</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(profitLossReport.grossProfit)}
              </div>
              <div className="stat-card-label">Brüt Qazanc</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(profitLossReport.expenses?.total)}
              </div>
              <div className="stat-card-label">Xərclər</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Xəlas Nəticə</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {profitLossReport.netProfit >= 0 ? (
                <FiTrendingUp style={{ fontSize: '2rem', color: 'var(--success)' }} />
              ) : (
                <FiTrendingDown style={{ fontSize: '2rem', color: 'var(--danger)' }} />
              )}
              <div>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 700,
                  color: profitLossReport.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  {formatCurrency(profitLossReport.netProfit)}
                </div>
                <div style={{ color: 'var(--gray-500)' }}>
                  Mənfəət Marjası: {profitLossReport.profitMargin}%
                </div>
              </div>
            </div>
          </div>

          {profitLossReport.expenses?.byCategory?.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Xərclər (Kateqoriyaya görə)</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kateqoriya</th>
                      <th>Məbləğ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitLossReport.expenses.byCategory.map((cat) => (
                      <tr key={cat._id}>
                        <td style={{ textTransform: 'capitalize' }}>{cat._id}</td>
                        <td>{formatCurrency(cat.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hesabatlar</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('sales')}
          >
            Satış Hesabatı
          </button>
          <button
            className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('products')}
          >
            Məhsul Satışı
          </button>
          <button
            className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('inventory')}
          >
            Anbar Hesabatı
          </button>
          {isOwner() && (
            <button
              className={`btn ${activeTab === 'profit' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('profit')}
            >
              Mənfəət/Zərər
            </button>
          )}
        </div>

        {(activeTab === 'sales' || activeTab === 'products' || activeTab === 'profit') && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Başlanğıc</label>
              <input
                type="date"
                className="form-control"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Son</label>
              <input
                type="date"
                className="form-control"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            {activeTab === 'sales' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Qruplaşdırma</label>
                <select
                  className="form-control"
                  value={filters.groupBy}
                  onChange={(e) => setFilters({ ...filters, groupBy: e.target.value })}
                >
                  <option value="day">Günlük</option>
                  <option value="week">Həftəlik</option>
                  <option value="month">Aylıq</option>
                </select>
              </div>
            )}
            <button className="btn btn-primary" onClick={fetchReport}>
              Hesabla
            </button>
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {activeTab === 'sales' && renderSalesReport()}
            {activeTab === 'products' && renderProductReport()}
            {activeTab === 'inventory' && renderInventoryReport()}
            {activeTab === 'profit' && isOwner() && renderProfitLossReport()}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
