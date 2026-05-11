import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiEye, FiFilter, FiPrinter, FiTrash2 } from 'react-icons/fi';
import { saleAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const Sales = () => {
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
    fetchSales();
  }, [filters.paymentType, pagination.page]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await saleAPI.getAll({
        ...filters,
        page: pagination.page
      });
      setSales(response.data.sales);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Satışları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const getPaymentTypeBadge = (type) => {
    return type === 'prepaid' 
      ? <span className="badge badge-success">Nağd</span>
      : <span className="badge badge-warning">Nisyə</span>;
  };

  const getPaymentMethodBadge = (method) => {
    const methods = {
      cash: 'Nağd',
      pos: 'POS',
      bank: 'Bank'
    };
    return methods[method] || '-';
  };

  const handlePrint = (sale) => {
    const printWindow = window.open('', '', 'width=300,height=600');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Qəbz - ${sale.saleNumber}</title>
        <style>
          @media print {
            @page { size: 80mm auto; margin: 0; }
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            margin: 0;
            padding: 5mm;
          }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .header h2 { margin: 5px 0; font-size: 16px; }
          .info { margin-bottom: 10px; font-size: 11px; }
          .items { margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .item-detail { font-size: 10px; color: #666; }
          .total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; }
          .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>ALFATERM</h2>
          <div>Qəbz #${sale.saleNumber}</div>
        </div>
        <div class="info">
          <div>Tarix: ${format(new Date(sale.date), 'dd.MM.yyyy HH:mm')}</div>
          <div>Müştəri: ${sale.customerId?.name || '-'}</div>
          <div>Ödəniş: ${sale.paymentType === 'prepaid' ? 'Nağd' : 'Nisyə'} (${getPaymentMethodBadge(sale.paymentMethod)})</div>
          ${sale.branchId ? `<div>Filial: ${sale.branchId.name}</div>` : ''}
        </div>
        <div class="items">
          ${sale.items.map(item => `
            <div class="item">
              <div>
                <div>${item.productName || item.productId?.name || '-'}</div>
                <div class="item-detail">${item.quantity} x ${item.unitPrice.toFixed(2)} AZN</div>
              </div>
              <div>${(item.quantity * item.unitPrice).toFixed(2)} AZN</div>
            </div>
          `).join('')}
        </div>
        <div class="total">
          <div style="display: flex; justify-content: space-between;">
            <span>TOPLAM:</span>
            <span>${sale.totalAmount.toFixed(2)} AZN</span>
          </div>
          ${sale.paymentType === 'credit' ? `
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
              <span>Ödənilib:</span>
              <span>${(sale.paidAmount || 0).toFixed(2)} AZN</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
              <span>Qalıq:</span>
              <span>${(sale.totalAmount - (sale.paidAmount || 0)).toFixed(2)} AZN</span>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          Təşəkkür edirik!
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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
            <option value="prepaid">Nağd</option>
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
                    <th>Filial</th>
                    <th>Ödəniş Tipi</th>
                    <th>Metod</th>
                    <th>Məbləğ</th>
                    {isOwner() && <th>Qazanc</th>}
                    <th style={{ width: '120px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale._id}>
                      <td><strong>{sale.saleNumber}</strong></td>
                      <td>{format(new Date(sale.date), 'dd.MM.yyyy HH:mm')}</td>
                      <td>{sale.customerId?.name || '-'}</td>
                      <td>{sale.branchId?.name || '-'}</td>
                      <td>{getPaymentTypeBadge(sale.paymentType)}</td>
                      <td>{getPaymentMethodBadge(sale.paymentMethod)}</td>
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
                  ))}
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
