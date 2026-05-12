import { useState, useEffect } from 'react';
import { FiDownload, FiTrendingUp, FiTrendingDown, FiFileText } from 'react-icons/fi';
import { reportAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

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

  const exportToExcel = (data, filename) => {
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel faylı yükləndi');
    } catch (error) {
      toast.error('Excel faylını yaratmaq mümkün olmadı');
    }
  };

  const exportSalesReport = () => {
    if (!salesReport?.data?.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }
    
    const exportData = salesReport.data.map(row => ({
      'Dövr': row._id.day 
        ? `${row._id.day}.${row._id.month}.${row._id.year}`
        : row._id.month 
          ? `${row._id.month}/${row._id.year}`
          : `Həftə ${row._id.week}/${row._id.year}`,
      'Satış Sayı': row.salesCount,
      'Məbləğ (AZN)': row.totalAmount,
      'Nağd (AZN)': row.cashSales,
      'POS (AZN)': row.posSales,
      'Bank (AZN)': row.bankSales,
      'Nisyə (AZN)': row.creditSales,
      ...(isOwner() && { 'Qazanc (AZN)': row.totalProfit })
    }));
    
    exportToExcel(exportData, 'satış_hesabatı');
  };

  const exportProductReport = () => {
    if (!productReport?.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }
    
    const exportData = productReport.map((row, index) => ({
      '#': index + 1,
      'Məhsul': row.productName,
      'Satış Miqdarı': row.totalQuantity,
      'Toplam Məbləğ (AZN)': row.totalAmount,
      ...(isOwner() && { 'Qazanc (AZN)': row.totalProfit })
    }));
    
    exportToExcel(exportData, 'məhsul_satış_hesabatı');
  };

  const exportInventoryReport = () => {
    if (!inventoryReport?.byWarehouse?.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }
    
    const exportData = inventoryReport.byWarehouse.map(row => ({
      'Anbar': row.warehouseName,
      'Tip': row.warehouseType === 'main' ? 'Əsas' : 'Filial',
      'Məhsul Sayı': row.totalProducts,
      'Miqdar': row.totalQuantity,
      ...(isOwner() && row.totalValue && { 'Maya Dəyəri (AZN)': row.totalValue }),
      'Satış Dəyəri (AZN)': row.totalRetailValue
    }));
    
    exportToExcel(exportData, 'anbar_hesabatı');
  };

  const exportProfitLossReport = () => {
    if (!profitLossReport) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }
    
    const exportData = [
      { 'Hesab': 'GƏLİR', 'Məbləğ (AZN)': profitLossReport.revenue },
      { 'Hesab': '', 'Məbləğ (AZN)': '' },
      { 'Hesab': 'MAYA DƏYƏRİ', 'Məbləğ (AZN)': profitLossReport.costOfGoods },
      { 'Hesab': '', 'Məbləğ (AZN)': '' },
      { 'Hesab': 'BRÜT QAZANC', 'Məbləğ (AZN)': profitLossReport.grossProfit },
      { 'Hesab': '', 'Məbləğ (AZN)': '' },
      { 'Hesab': 'ƏMƏLİYYAT XƏRCLƏRİ', 'Məbləğ (AZN)': '' },
      ...(profitLossReport.expenses?.byCategory || []).map(cat => ({
        'Hesab': `  ${cat._id}`,
        'Məbləğ (AZN)': cat.amount
      })),
      { 'Hesab': 'Toplam Xərclər', 'Məbləğ (AZN)': profitLossReport.expenses?.total },
      { 'Hesab': '', 'Məbləğ (AZN)': '' },
      { 'Hesab': 'XALİS MƏNFƏƏT/ZƏRƏR', 'Məbləğ (AZN)': profitLossReport.netProfit },
      { 'Hesab': '', 'Məbləğ (AZN)': '' },
      { 'Hesab': 'Mənfəət Marjası (%)', 'Məbləğ (AZN)': profitLossReport.profitMargin }
    ];
    
    exportToExcel(exportData, 'mənfəət_zərər_hesabatı');
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

  const renderProfitLossReport = () => {
    if (!profitLossReport) return null;

    const grossProfitMargin = profitLossReport.revenue > 0 
      ? ((profitLossReport.grossProfit / profitLossReport.revenue) * 100).toFixed(1)
      : 0;

    return (
      <div>
        {/* Compact Financial Statement */}
        <div style={{ 
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Mənfəət və Zərər Hesabatı
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.8rem' }}>
                {filters.startDate && filters.endDate 
                  ? `${new Date(filters.startDate).toLocaleDateString('az-AZ')} - ${new Date(filters.endDate).toLocaleDateString('az-AZ')}`
                  : 'Bütün Dövr'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '2rem', lineHeight: 1 }}>
                {profitLossReport.netProfit >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>
                  {formatCurrency(Math.abs(profitLossReport.netProfit))}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.9 }}>
                  {profitLossReport.netProfit >= 0 ? 'Mənfəət' : 'Zərər'}
                </div>
              </div>
            </div>
          </div>

          {/* Main Statement - Two Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e5e7eb' }}>
            
            {/* Left Column: Income Statement */}
            <div style={{ background: 'white', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#2563eb', borderBottom: '2px solid #2563eb', paddingBottom: '0.5rem' }}>
                GƏLİR VƏ XƏRCLƏR
              </h3>
              
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Gəlir</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2563eb' }}>
                    {formatCurrency(profitLossReport.revenue)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: '0.875rem', color: '#666' }}>Maya Dəyəri</span>
                  <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                    ({formatCurrency(profitLossReport.costOfGoods)})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', background: '#f0fdf4', margin: '0 -0.5rem', paddingLeft: '0.5rem', paddingRight: '0.5rem', borderLeft: '3px solid #16a34a' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#16a34a' }}>Brüt Mənfəət</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#16a34a' }}>
                    {formatCurrency(profitLossReport.grossProfit)}
                  </span>
                </div>
              </div>

              <h4 style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
                Əməliyyat Xərcləri
              </h4>
              
              {profitLossReport.expenses?.byCategory?.length > 0 ? (
                <div style={{ marginBottom: '0.5rem' }}>
                  {profitLossReport.expenses.byCategory.map((cat) => (
                    <div 
                      key={cat._id}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.5rem',
                        fontSize: '0.8125rem',
                        borderBottom: '1px solid #f5f5f5'
                      }}
                    >
                      <span style={{ textTransform: 'capitalize', color: '#666' }}>
                        {cat._id}
                      </span>
                      <span style={{ color: '#dc2626', fontWeight: 500 }}>
                        {formatCurrency(cat.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999', fontStyle: 'italic', fontSize: '0.8125rem', margin: '0.5rem 0' }}>
                  Xərc yoxdur
                </p>
              )}

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '0.5rem',
                background: '#fef2f2',
                borderRadius: '4px',
                border: '1px solid #fecaca',
                marginTop: '0.5rem'
              }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
                  Toplam Xərclər
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dc2626' }}>
                  ({formatCurrency(profitLossReport.expenses?.total || 0)})
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '0.75rem',
                marginTop: '0.75rem',
                background: profitLossReport.netProfit >= 0 ? '#f0fdf4' : '#fef2f2',
                borderRadius: '4px',
                border: `2px solid ${profitLossReport.netProfit >= 0 ? '#16a34a' : '#dc2626'}`
              }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                  Xalis Mənfəət/Zərər
                </span>
                <span style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 800,
                  color: profitLossReport.netProfit >= 0 ? '#16a34a' : '#dc2626'
                }}>
                  {formatCurrency(Math.abs(profitLossReport.netProfit))}
                </span>
              </div>
            </div>

            {/* Right Column: Key Metrics */}
            <div style={{ background: '#fafafa', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#333', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                MALİYYƏ GÖSTƏRİCİLƏRİ
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ 
                  background: 'white', 
                  padding: '0.75rem', 
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                    Brüt Mənfəət Marjası
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563eb' }}>
                    {grossProfitMargin}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    Hər 100 AZN gəlirdən {grossProfitMargin} AZN brüt qazanc
                  </div>
                </div>

                <div style={{ 
                  background: 'white', 
                  padding: '0.75rem', 
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                    Xalis Mənfəət Marjası
                  </div>
                  <div style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: 700,
                    color: profitLossReport.netProfit >= 0 ? '#16a34a' : '#dc2626'
                  }}>
                    {profitLossReport.profitMargin}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    Hər 100 AZN gəlirdən {profitLossReport.profitMargin} AZN xalis qazanc
                  </div>
                </div>

                <div style={{ 
                  background: 'white', 
                  padding: '0.75rem', 
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                    Xərc Nisbəti
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b' }}>
                    {profitLossReport.revenue > 0 
                      ? ((profitLossReport.expenses?.total / profitLossReport.revenue) * 100).toFixed(1)
                      : 0}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    Əməliyyat xərclərinin gəlirə nisbəti
                  </div>
                </div>

                <div style={{ 
                  background: 'white', 
                  padding: '0.75rem', 
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                    COGS Nisbəti
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#8b5cf6' }}>
                    {profitLossReport.revenue > 0 
                      ? ((profitLossReport.costOfGoods / profitLossReport.revenue) * 100).toFixed(1)
                      : 0}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    Maya dəyərinin gəlirə nisbəti
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hesabatlar</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
          
          {/* Export Button */}
          {!loading && (
            <button
              className="btn"
              onClick={() => {
                if (activeTab === 'sales') exportSalesReport();
                else if (activeTab === 'products') exportProductReport();
                else if (activeTab === 'inventory') exportInventoryReport();
                else if (activeTab === 'profit' && isOwner()) exportProfitLossReport();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none'
              }}
            >
              <FiDownload />
              Excel
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
