import { useState, useEffect } from 'react';
import { FiPackage, FiArrowRight, FiPlus, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import { inventoryAPI, warehouseAPI, productAPI, vendorAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [showOwnerSelectModal, setShowOwnerSelectModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const { isOwner, user } = useAuth();
  
  const owners = [
    { id: 'OWNER_ZAUR_ID', name: 'Zaur Müəllim' },
    { id: 'OWNER_ADALAT_ID', name: 'Ədalət Müəllim' }
  ];

  const [entryForm, setEntryForm] = useState({
    productId: '',
    warehouseId: '',
    quantity: 1,
    costPrice: '',
    vendorId: '',
    paymentStatus: 'paid',
    paidAmount: 0,
    dueDate: ''
  });

  const [transferForm, setTransferForm] = useState({
    productId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: 1
  });

  const [editForm, setEditForm] = useState({
    quantity: 0,
    costPrice: ''
  });

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inventoryRes, warehousesRes, productsRes, vendorsRes] = await Promise.all([
        selectedWarehouse 
          ? inventoryAPI.getByWarehouse(selectedWarehouse)
          : inventoryAPI.getAll(),
        warehouseAPI.getAll(),
        productAPI.getAll({ limit: 1000 }),
        vendorAPI.getAll({ limit: 1000 })
      ]);

      if (selectedWarehouse) {
        setInventory(inventoryRes.data.data.items || []);
      } else {
        setInventory(inventoryRes.data.data || []);
      }
      setWarehouses(warehousesRes.data.data);
      setProducts(productsRes.data.products);
      setVendors(vendorsRes.data.vendors || []);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleProductEntry = async (e) => {
    e.preventDefault();
    try {
      // Filter out empty values
      const formData = { ...entryForm };
      if (!formData.dueDate) {
        delete formData.dueDate;
      }
      if (!formData.paidAmount || formData.paymentStatus === 'paid') {
        delete formData.paidAmount;
      }
      
      await inventoryAPI.productEntry(formData);
      toast.success('Mal girişi uğurla tamamlandı');
      setShowEntryModal(false);
      setEntryForm({ 
        productId: '', 
        warehouseId: '', 
        quantity: 1, 
        costPrice: '',
        vendorId: '',
        paymentStatus: 'paid',
        paidAmount: 0,
        dueDate: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const getTotalAmount = () => {
    return entryForm.quantity * (parseFloat(entryForm.costPrice) || 0);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      await inventoryAPI.transfer(transferForm);
      toast.success('Transfer uğurla tamamlandı');
      setShowTransferModal(false);
      setTransferForm({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: 1 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      quantity: item.quantity,
      costPrice: item.costPrice || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await inventoryAPI.update(editingItem._id, editForm);
      toast.success('Stok yeniləndi');
      setShowEditModal(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleDelete = async (item) => {
    const product = item.product || item.productId;
    if (!window.confirm(`"${product?.name}" stokunu silmək istədiyinizə əminsiniz?`)) {
      return;
    }
    try {
      await inventoryAPI.delete(item._id);
      toast.success('Stok silindi');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const getTotalValue = () => {
    return inventory.reduce((total, item) => {
      return total + (item.quantity * (item.costPrice || 0));
    }, 0);
  };

  const exportToExcel = () => {
    if (!inventory.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }

    const exportData = inventory.map((item, index) => ({
      '#': index + 1,
      'Məhsul': item.product?.name || '',
      'SKU': item.product?.sku || '',
      'Kateqoriya': item.product?.category || '',
      'Anbar': item.warehouse?.name || '',
      'Anbar Tipi': item.warehouse?.type === 'main' ? 'Əsas' : 'Filial',
      'Miqdar': item.quantity,
      ...(isOwner() && { 'Maya Dəyəri (vahid, AZN)': item.costPrice || 0 }),
      ...(isOwner() && { 'Toplam Dəyər (AZN)': (item.quantity * (item.costPrice || 0)).toFixed(2) })
    }));

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Anbar');
      XLSX.writeFile(wb, `anbar_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel faylı yükləndi');
    } catch (error) {
      toast.error('Excel faylını yaratmaq mümkün olmadı');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Anbar</h1>
          <p className="page-subtitle">Stok idarəetməsi</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn" 
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none'
            }}
          >
            <FiDownload /> Excel
          </button>
          {isOwner() && (
            <button className="btn btn-primary" onClick={() => setShowOwnerSelectModal(true)}>
              <FiPlus /> Mal Girişi
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowTransferModal(true)}>
            <FiArrowRight /> Transfer
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <select
            className="form-control"
            style={{ width: '300px' }}
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">Bütün Anbarlar</option>
            {warehouses.map(wh => (
              <option key={wh._id} value={wh._id}>{wh.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : inventory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiPackage /></div>
            <p className="empty-state-text">Stok məlumatı yoxdur</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Məhsul</th>
                  <th>SKU</th>
                  <th>Kateqoriya</th>
                  {!selectedWarehouse && <th>Anbar</th>}
                  <th>Miqdar</th>
                  {isOwner() && <th>Dəyər <span style={{ color: '#dc2626', fontWeight: 'bold' }}>({formatCurrency(getTotalValue())})</span></th>}
                  {isOwner() && <th style={{ width: '100px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {inventory.map((item, index) => {
                  const product = item.product || item.productId;
                  const warehouse = item.warehouseId;
                  return (
                    <tr key={index}>
                      <td><strong>{product?.name || '-'}</strong></td>
                      <td>{product?.sku || '-'}</td>
                      <td>
                        <span className="badge badge-secondary">
                          {product?.category || '-'}
                        </span>
                      </td>
                      {!selectedWarehouse && <td>{warehouse?.name || '-'}</td>}
                      <td>
                        <span style={{ 
                          fontWeight: 600,
                          color: item.quantity <= 5 ? 'var(--danger)' : 'inherit'
                        }}>
                          {item.quantity}
                        </span>
                      </td>
                      {isOwner() && (
                        <td>
                          {item.costPrice 
                            ? formatCurrency(item.quantity * item.costPrice)
                            : '-'
                          }
                        </td>
                      )}
                      {isOwner() && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-sm"
                              onClick={() => handleEdit(item)}
                              title="Düzəliş"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(item)}
                              title="Sil"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOwnerSelectModal && (
        <div className="modal-overlay" onClick={() => setShowOwnerSelectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Sahibi Seçin</h3>
              <button className="modal-close" onClick={() => setShowOwnerSelectModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {owners.map(owner => (
                  <button
                    key={owner.id}
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedOwnerId(owner.id);
                      setShowOwnerSelectModal(false);
                      setShowEntryModal(true);
                    }}
                    style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
                  >
                    {owner.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEntryModal && (
        <div className="modal-overlay" onClick={() => setShowEntryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Mal Girişi</h3>
              <button className="modal-close" onClick={() => setShowEntryModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleProductEntry}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor *</label>
                  <select
                    className="form-control"
                    value={entryForm.vendorId}
                    onChange={(e) => setEntryForm({ ...entryForm, vendorId: e.target.value })}
                    required
                  >
                    <option value="">Seçin...</option>
                    {vendors.map(v => (
                      <option key={v._id} value={v._id}>{v.name} {v.companyName ? `(${v.companyName})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Məhsul *</label>
                  <select
                    className="form-control"
                    value={entryForm.productId}
                    onChange={(e) => setEntryForm({ ...entryForm, productId: e.target.value })}
                    required
                  >
                    <option value="">Seçin...</option>
                    {products.map(p => (
                      <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Anbar *</label>
                  <select
                    className="form-control"
                    value={entryForm.warehouseId}
                    onChange={(e) => setEntryForm({ ...entryForm, warehouseId: e.target.value })}
                    required
                  >
                    <option value="">Seçin...</option>
                    {warehouses.map(wh => (
                      <option key={wh._id} value={wh._id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Miqdar *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={entryForm.quantity}
                      onChange={(e) => setEntryForm({ ...entryForm, quantity: parseInt(e.target.value) || 0 })}
                      min="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Maya Dəyəri (vahid) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={entryForm.costPrice}
                      onChange={(e) => setEntryForm({ ...entryForm, costPrice: e.target.value })}
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                
                <div style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius)', marginBottom: '1rem' }}>
                  <strong>Toplam: {formatCurrency(getTotalAmount())}</strong>
                </div>

                <div className="form-group">
                  <label className="form-label">Ödəniş Statusu *</label>
                  <select
                    className="form-control"
                    value={entryForm.paymentStatus}
                    onChange={(e) => setEntryForm({ 
                      ...entryForm, 
                      paymentStatus: e.target.value,
                      paidAmount: e.target.value === 'paid' ? getTotalAmount() : 0
                    })}
                  >
                    <option value="paid">Ödənilib</option>
                    <option value="partial">Qismən ödənilib</option>
                    <option value="unpaid">Ödənilməyib (Borc)</option>
                  </select>
                </div>

                {entryForm.paymentStatus === 'partial' && (
                  <div className="form-group">
                    <label className="form-label">Ödənilmiş məbləğ *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={entryForm.paidAmount}
                      onChange={(e) => setEntryForm({ ...entryForm, paidAmount: parseFloat(e.target.value) || 0 })}
                      step="0.01"
                      min="0"
                      max={getTotalAmount()}
                      required
                    />
                  </div>
                )}

                {entryForm.paymentStatus !== 'paid' && (
                  <div className="form-group">
                    <label className="form-label">Ödəniş tarixi</label>
                    <input
                      type="date"
                      className="form-control"
                      value={entryForm.dueDate}
                      onChange={(e) => setEntryForm({ ...entryForm, dueDate: e.target.value })}
                    />
                  </div>
                )}
          
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEntryModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Əlavə et</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Anbarlar Arası Transfer</h3>
              <button className="modal-close" onClick={() => setShowTransferModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleTransfer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Məhsul *</label>
                  <select
                    className="form-control"
                    value={transferForm.productId}
                    onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                    required
                  >
                    <option value="">Seçin...</option>
                    {products.map(p => (
                      <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mənbə Anbar *</label>
                  <select
                    className="form-control"
                    value={transferForm.fromWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                    required
                  >
                    <option value="">Seçin...</option>
                    {warehouses.map(wh => (
                      <option key={wh._id} value={wh._id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hədəf Anbar *</label>
                  <select
                    className="form-control"
                    value={transferForm.toWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                    required
                  >
                    <option value="">Seçin...</option>
                    {warehouses.filter(wh => wh._id !== transferForm.fromWarehouseId).map(wh => (
                      <option key={wh._id} value={wh._id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Miqdar *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) })}
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Transfer et</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Stok Düzəlişi</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius)' }}>
                  <strong>{(editingItem.product || editingItem.productId)?.name}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                    {(editingItem.product || editingItem.productId)?.sku}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Miqdar *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Maya Dəyəri *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Yadda saxla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
