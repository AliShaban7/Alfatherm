import { useState, useEffect, useCallback } from 'react';
import { FiEye, FiPrinter } from 'react-icons/fi';
import { purchaseInvoiceAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { printInvoice } from '../utils/invoicePrint';

const STATUS = {
  paid: { label: 'Ödənilib', color: 'var(--success, #16a34a)' },
  partial: { label: 'Qismən ödənilib', color: 'var(--warning, #d97706)' },
  unpaid: { label: 'Borc', color: 'var(--danger)' }
};

const Fakturalar = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [detail, setDetail] = useState(null);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2 }).format(amount || 0) + ' AZN';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await purchaseInvoiceAPI.getAll({ page: pagination.page, limit: 20 });
      setInvoices(res.data.invoices || []);
      setPagination(res.data.pagination || { page: 1, pages: 1 });
    } catch (error) {
      toast.error('Fakturaları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, [pagination.page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = async (id) => {
    try {
      const res = await purchaseInvoiceAPI.getById(id);
      setDetail(res.data.data);
    } catch (error) {
      toast.error('Faktura məlumatını yükləmək mümkün olmadı');
    }
  };

  // Fetch the full invoice and open the print dialog (browser → Save as PDF).
  const handlePrint = async (id) => {
    let invoice;
    try {
      const res = await purchaseInvoiceAPI.getById(id);
      invoice = res.data?.data;
      if (!invoice) throw new Error('Boş cavab');
    } catch (error) {
      console.error('Faktura yüklənmədi:', error);
      toast.error(error.response?.data?.message || 'Faktura məlumatını yükləmək mümkün olmadı');
      return;
    }
    try {
      printInvoice(invoice);
    } catch (error) {
      console.error('Faktura çap edilmədi:', error);
      toast.warn('Faktura çap edilə bilmədi (brauzer popup-u bloklamış ola bilər)');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fakturalar</h1>
          <p className="page-subtitle">Mal girişi fakturaları və ödəniş statusu</p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Faktura yoxdur. "Anbar → Mal Girişi" ilə yaradın.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Faktura No</th>
                    <th>Tarix</th>
                    <th>Vendor</th>
                    <th>Məhsul sayı</th>
                    <th>Toplam</th>
                    <th>Qalıq borc</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const st = STATUS[inv.paymentStatus] || STATUS.unpaid;
                    return (
                      <tr key={inv._id}>
                        <td>
                          <strong>{inv.invoiceNumber}</strong>
                          {inv.vendorInvoiceNumber && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                              Vendor: {inv.vendorInvoiceNumber}
                            </div>
                          )}
                        </td>
                        <td>{format(new Date(inv.date), 'dd.MM.yyyy')}</td>
                        <td>{inv.vendorId?.name || inv.vendorName || '-'}</td>
                        <td>{inv.items?.length || 0}</td>
                        <td><strong>{formatCurrency(inv.totalAmount)}</strong></td>
                        <td style={{ color: inv.remainingAmount > 0 ? 'var(--danger)' : 'inherit' }}>
                          {formatCurrency(inv.remainingAmount)}
                        </td>
                        <td><span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => openDetail(inv._id)} title="Bax">
                              <FiEye />
                            </button>
                            <button className="btn btn-sm btn-primary" onClick={() => handlePrint(inv._id)} title="Çap / PDF">
                              <FiPrinter />
                            </button>
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
                <button disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>
                  Əvvəlki
                </button>
                <span style={{ padding: '0.5rem 1rem' }}>{pagination.page} / {pagination.pages}</span>
                <button disabled={pagination.page === pagination.pages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>
                  Sonrakı
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Faktura {detail.invoiceNumber}</h3>
              <button className="modal-close" onClick={() => setDetail(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div><span style={{ color: 'var(--gray-500)' }}>Vendor:</span> <strong>{detail.vendorId?.name || detail.vendorName}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Anbar:</span> <strong>{detail.warehouseId?.name || detail.warehouseName}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Tarix:</span> <strong>{format(new Date(detail.date), 'dd.MM.yyyy')}</strong></div>
                {detail.vendorInvoiceNumber && (
                  <div><span style={{ color: 'var(--gray-500)' }}>Vendor faktura:</span> <strong>{detail.vendorInvoiceNumber}</strong></div>
                )}
              </div>

              <table className="table" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>Məhsul</th>
                    <th>Miqdar</th>
                    <th>Maya dəyəri</th>
                    <th>Cəm</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items?.map((it, i) => (
                    <tr key={i}>
                      <td>{it.productName}</td>
                      <td>{it.quantity}</td>
                      <td>{formatCurrency(it.costPrice)}</td>
                      <td><strong>{formatCurrency(it.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '1rem' }}>
                <span>Toplam</span>
                <span>{formatCurrency(detail.totalAmount)}</span>
              </div>

              {detail.creditorId ? (
                <div style={{ borderTop: '1px solid var(--gray-200, #e5e7eb)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ödənilmiş</span>
                    <span>{formatCurrency(detail.creditorId.paidAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 600 }}>
                    <span>Qalıq borc</span>
                    <span>{formatCurrency(detail.creditorId.remainingAmount)}</span>
                  </div>
                  {detail.creditorId.paymentHistory?.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Ödəniş tarixçəsi</div>
                      {detail.creditorId.paymentHistory.map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
                          <span>{format(new Date(p.date), 'dd.MM.yyyy')} — {p.paidBy?.name || ''}</span>
                          <span>{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.75rem' }}>
                    Ödəniş "Kreditorlar" bölməsindən edilir.
                  </p>
                </div>
              ) : (
                <div style={{ color: 'var(--success, #16a34a)', fontWeight: 600 }}>Tam ödənilib</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Bağla</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  try {
                    printInvoice(detail);
                  } catch (error) {
                    console.error('Faktura çap edilmədi:', error);
                    toast.warn('Faktura çap edilə bilmədi (brauzer popup-u bloklamış ola bilər)');
                  }
                }}
              >
                <FiPrinter /> Çap et / PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fakturalar;
