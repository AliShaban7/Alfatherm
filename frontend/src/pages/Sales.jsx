import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiPlus, FiSearch, FiEye, FiFilter, FiPrinter, FiTrash2 } from 'react-icons/fi';
import { saleAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { printSaleReceipt } from '../utils/receipt';
import { formatPaymentLabel } from '../utils/payment';

const Sales = () => {
  const location = useLocation();
  const pendingPrepend = useRef(location.state?.newSale);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    paymentType: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const { isOwner } = useAuth();

  useEffect(() => {
    const prepend = pendingPrepend.current;
    if (prepend) {
      pendingPrepend.current = null;
      window.history.replaceState({}, document.title);
    }
    fetchSales(prepend);
  }, [filters.paymentType, pagination.page]);

  const fetchSales = async (prependSale) => {
    const showPrependFirst = prependSale && pagination.page === 1;
    if (showPrependFirst) {
      setSales([prependSale]);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const response = await saleAPI.getAll({
        ...filters,
        page: pagination.page,
        limit: 10
      });
      let list = response.data.sales || [];
      if (showPrependFirst) {
        list = [prependSale, ...list.filter((s) => s._id !== prependSale._id)];
      }
      setSales(list);
      setPagination(response.data.pagination);
    } catch (error) {
      if (!showPrependFirst) {
        toast.error('Satışları yükləmək mümkün olmadı');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const getPaymentBadge = (sale) => {
    const label = formatPaymentLabel(sale.paymentType, sale.paymentMethod);
    const isCredit = sale.paymentType === 'credit';
    const isBank =
      sale.paymentType === 'prepaid' &&
      (sale.paymentMethod === 'pos' || sale.paymentMethod === 'bank');
    const className = isCredit
      ? 'badge badge-warning'
      : isBank
        ? 'badge badge-info'
        : 'badge badge-success';
    return <span className={className}>{label}</span>;
  };

  const handlePrint = async (sale) => {
    // Step 1: load the full sale. Surface the server's actual message so a real
    // problem (permission, not-found, server error) isn't hidden behind a
    // generic "couldn't load" toast.
    let full;
    try {
      const response = await saleAPI.getById(sale._id);
      full = response.data?.data;
      if (!full) throw new Error('Boş cavab');
    } catch (error) {
      console.error('Çek məlumatı yüklənmədi:', error);
      toast.error(error.response?.data?.message || 'Çek məlumatını yükləmək mümkün olmadı');
      return;
    }

    // Step 2: print. A failure here is almost always a blocked popup, not a data
    // problem — so it gets its own message and never looks like a load failure.
    try {
      printSaleReceipt(full, {
        customerName: full.customerId?.name || '-',
        warehouseName: full.warehouseId?.name || null,
        branchName: full.branchId?.name || null,
        cashierName: full.userId?.name,
        formatDate: (d) => format(new Date(d), 'dd.MM.yyyy HH:mm'),
        paymentLabel: formatPaymentLabel(full.paymentType, full.paymentMethod)
      });
    } catch (error) {
      console.error('Çek çap edilmədi:', error);
      toast.warn('Qəbz çap edilə bilmədi (brauzer popup-u bloklamış ola bilər)');
    }
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Bu satışı ləğv etmək istədiyinizə əminsiniz?')) return;
    try {
      await saleAPI.cancel(saleId);
      toast.success('Satış ləğv edildi');
      fetchSales();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Satışlar</h1>
        </div>
        <Link to="/sales/new" className="btn btn-primary">
          <FiPlus /> Yeni Satış
        </Link>
      </div>

      <div className="card">
        <div className="filters-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Satış nömrəsi ilə axtar..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={filters.paymentType}
            onChange={(e) => setFilters({ ...filters, paymentType: e.target.value })}
          >
            <option value="">Bütün ödəniş tipləri</option>
            <option value="prepaid">Nağd / Bank</option>
            <option value="credit">Nisyə</option>
          </select>
          <input
            type="date"
            className="form-control"
            style={{ width: 'auto' }}
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
          <input
            type="date"
            className="form-control"
            style={{ width: 'auto' }}
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
          <button className="btn btn-secondary" onClick={fetchSales}>
            <FiFilter /> Filtrlə
          </button>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p className="empty-state-text">Satış tapılmadı</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Satış No</th>
                    <th>Tarix</th>
                    <th>Müştəri</th>
                    <th>Anbar</th>
                    <th>Ödəniş</th>
                    <th>Məbləğ</th>
                    {isOwner() && <th>Qazanc</th>}
                    <th style={{ width: '120px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const voided = sale.status === 'cancelled' || sale.status === 'returned';
                    return (
                    <tr
                      key={sale._id}
                      style={voided ? { background: 'rgba(220, 38, 38, 0.07)' } : undefined}
                    >
                      <td>
                        <strong style={voided ? { textDecoration: 'line-through', color: 'var(--danger)' } : undefined}>
                          {sale.saleNumber}
                        </strong>
                        {voided && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: 'var(--danger)',
                              border: '1px solid var(--danger)',
                              borderRadius: '4px',
                              padding: '1px 6px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sale.status === 'cancelled' ? 'Ləğv edilib' : 'Qaytarılıb'}
                          </span>
                        )}
                      </td>
                      <td>{format(new Date(sale.date), 'dd.MM.yyyy HH:mm')}</td>
                      <td>{sale.customerId?.name || '-'}</td>
                      <td>{sale.warehouseId?.name || sale.branchId?.name || '-'}</td>
                      <td>{getPaymentBadge(sale)}</td>
                      <td><strong>{formatCurrency(sale.totalAmount)}</strong></td>
                      {isOwner() && (
                        <td style={{ color: 'var(--success)' }}>
                          {formatCurrency(sale.profit || 0)}
                        </td>
                      )}
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => handlePrint(sale)}
                            title="Çap et"
                          >
                            <FiPrinter />
                          </button>
                          {isOwner() && sale.status === 'completed' && (
                            <button 
                              className="btn btn-sm" 
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(sale._id)}
                              title="Ləğv et"
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                >
                  Əvvəlki
                </button>
                <span style={{ padding: '0.5rem 1rem' }}>
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                >
                  Sonrakı
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Sales;
