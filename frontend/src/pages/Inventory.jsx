import { useState, useEffect } from 'react';
import { FiPackage, FiArrowRight, FiPlus, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import { inventoryAPI, warehouseAPI, productAPI, vendorAPI, purchaseInvoiceAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { BUSINESS_OWNERS } from '../config/owners';
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
  const { isOwner, isSuperOwner, user } = useAuth();

  // A purchase invoice (faktura): one vendor + one warehouse + several product
  // lines, with one payment status for the whole invoice.
  const emptyEntryItem = () => ({ productId: '', quantity: 1, costPrice: '' });
  const [entryForm, setEntryForm] = useState({
    vendorId: '',
    warehouseId: '',
    vendorInvoiceNumber: '',
    items: [emptyEntryItem()],
    paymentStatus: 'paid',
    paidAmount: '',
    dueDate: '',
    ownerId: ''
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

  // Cache of "products in this location" counts for the transfer modal.
  const [whCounts, setWhCounts] = useState({});

  const loadWhCount = async (id) => {
    if (!id || whCounts[id] !== undefined) return;
    try {
      const res = await inventoryAPI.getByWarehouse(id);
      setWhCounts((prev) => ({ ...prev, [id]: (res.data.data.items || []).length }));
    } catch {
      /* ignore count errors */
    }
  };

  // Reference data (warehouses, products, vendors) rarely changes, so load it
  // once — not on every warehouse switch. The owner filter for the entry modal
  // is applied client-side (see entryProducts), so products needn't refetch.
  useEffect(() => {
    fetchReference();
  }, []);

  // Only the stock list depends on the selected warehouse.
  useEffect(() => {
    fetchInventory();
  }, [selectedWarehouse]);

  const fetchReference = async () => {
    try {
      const [warehousesRes, productsRes, vendorsRes] = await Promise.all([
        warehouseAPI.getAll(),
        productAPI.getAll({ limit: 1000 }),
        vendorAPI.getAll({ limit: 1000 })
      ]);
      setWarehouses(warehousesRes.data.data || []);
      setProducts(productsRes.data.products || []);
      setVendors(vendorsRes.data.vendors || []);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = selectedWarehouse
        ? await inventoryAPI.getByWarehouse(selectedWarehouse)
        : await inventoryAPI.getAll();
      setInventory(selectedWarehouse ? (res.data.data.items || []) : (res.data.data || []));
    } catch (error) {
      toast.error('Stok məlumatını yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const addEntryItem = () =>
    setEntryForm((f) => ({ ...f, items: [...f.items, emptyEntryItem()] }));

  const updateEntryItem = (index, field, value) =>
    setEntryForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    }));

  const removeEntryItem = (index) =>
    setEntryForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items
    }));

  const resetEntryForm = () =>
    setEntryForm({
      vendorId: '',
      warehouseId: '',
      vendorInvoiceNumber: '',
      items: [emptyEntryItem()],
      paymentStatus: 'paid',
      paidAmount: '',
      dueDate: '',
      ownerId: ''
    });

  const handleProductEntry = async (e) => {
    e.preventDefault();

    const items = entryForm.items
      .filter((it) => it.productId && (parseInt(it.quantity) || 0) > 0 && it.costPrice !== '')
      .map((it) => ({
        productId: it.productId,
        quantity: parseInt(it.quantity) || 0,
        costPrice: parseFloat(it.costPrice) || 0
      }));

    if (items.length === 0) {
      toast.error('Ən azı bir məhsul (miqdar və maya ilə) əlavə edin');
      return;
    }

    const payload = {
      vendorId: entryForm.vendorId,
      warehouseId: entryForm.warehouseId,
      items,
      paymentStatus: entryForm.paymentStatus
    };
    if (entryForm.vendorInvoiceNumber?.trim()) {
      payload.vendorInvoiceNumber = entryForm.vendorInvoiceNumber.trim();
    }
    if (entryForm.paymentStatus === 'partial') {
      payload.paidAmount = parseFloat(entryForm.paidAmount) || 0;
    }
    if (entryForm.paymentStatus !== 'paid' && entryForm.dueDate) {
      payload.dueDate = entryForm.dueDate;
    }
    if (isSuperOwner() && selectedOwnerId) {
      payload.ownerId = selectedOwnerId;
    }

    try {
      await purchaseInvoiceAPI.create(payload);
      toast.success('Mal girişi (faktura) uğurla yaradıldı');
      setShowEntryModal(false);
      setSelectedOwnerId('');
      resetEntryForm();
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const getTotalAmount = () =>
    entryForm.items.reduce(
      (sum, it) => sum + (parseInt(it.quantity) || 0) * (parseFloat(it.costPrice) || 0),
      0
    );

  // Mal Girişi product list filtered to the selected vendor's products only.
  // A product matches if its vendorId equals the vendor (new id link) OR — for
  // products created before the id link — its İstehsalçı name equals the
  // vendor's name. Products tied to no vendor are hidden. Before a vendor is
  // chosen, show everything.
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'az');
  const norm = (s) => String(s || '').trim().toLowerCase();
  const selectedVendorName = norm(vendors.find((v) => v._id === entryForm.vendorId)?.name);

  // For the super owner, scope entry products to the chosen owner (client-side).
  const entryProducts = (selectedOwnerId && isSuperOwner())
    ? products.filter((p) => p.ownerId === selectedOwnerId)
    : products;

  const vendorSortedProducts = !entryForm.vendorId
    ? [...entryProducts].sort(byName)
    : entryProducts
        .filter((p) =>
          p.vendorId
            ? String(p.vendorId) === entryForm.vendorId
            : p.manufacturer && norm(p.manufacturer) === selectedVendorName
        )
        .sort(byName);

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      await inventoryAPI.transfer(transferForm);
      toast.success('Transfer uğurla tamamlandı');
      setShowTransferModal(false);
      setTransferForm({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: 1 });
      setWhCounts({}); // counts changed for the two locations
      fetchInventory();
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
      fetchInventory();
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
      fetchInventory();
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

    const exportData = inventory.map((item, index) => {
      // The two list endpoints return different shapes: the all-warehouses list
      // populates `productId`/`warehouseId` as objects, while the single-warehouse
      // list returns `product` + a raw `warehouseId` id. Normalize both so no
      // column comes out blank. (`item.warehouse` never existed — always blank.)
      const product = item.product || item.productId || {};
      const wh = (item.warehouseId && typeof item.warehouseId === 'object')
        ? item.warehouseId
        : warehouses.find((w) => w._id === item.warehouseId);
      return {
        '#': index + 1,
        'Məhsul': product.name || '',
        'SKU': product.sku || '',
        'Kateqoriya': product.category || '',
        'Anbar': wh?.name || '',
        'Anbar Tipi': wh?.type === 'main' ? 'Əsas' : 'Filial',
        'Miqdar': item.quantity,
        ...(isOwner() && { 'Maya Dəyəri (vahid, AZN)': item.costPrice || 0 }),
        ...(isOwner() && { 'Toplam Dəyər (AZN)': (item.quantity * (item.costPrice || 0)).toFixed(2) })
      };
    });

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
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (isSuperOwner()) {
                  setShowOwnerSelectModal(true);
                } else {
                  setSelectedOwnerId(user.ownerId);
                  setShowEntryModal(true);
                }
              }}
            >
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

        {loading && inventory.length === 0 ? (
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
                {BUSINESS_OWNERS.map(owner => (
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1140px', width: '95vw' }}>
            <div className="modal-header">
              <h3 className="modal-title">Mal Girişi (Faktura)</h3>
              <button className="modal-close" onClick={() => setShowEntryModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleProductEntry}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
                  {/* LEFT: invoice details + payment */}
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
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
                          <option key={v._id} value={v._id}>{v.companyName ? v.companyName : ''}{v.name ? ` (${v.name})` : ''}</option>
                     
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
                    <div className="form-group">
                      <label className="form-label">Faktura No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={entryForm.vendorInvoiceNumber}
                        onChange={(e) => setEntryForm({ ...entryForm, vendorInvoiceNumber: e.target.value })}
                        placeholder="Vendorun faktura nömrəsi (istəyə bağlı)"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Ödəniş Statusu *</label>
                      <select
                        className="form-control"
                        value={entryForm.paymentStatus}
                        onChange={(e) => setEntryForm({
                          ...entryForm,
                          paymentStatus: e.target.value,
                          paidAmount: e.target.value === 'paid' ? getTotalAmount() : ''
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
                          onChange={(e) => setEntryForm({ ...entryForm, paidAmount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                          step="0.01"
                          min="0"
                          max={getTotalAmount()}
                          placeholder="0"
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

                    <div style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius)' }}>
                      <strong>Toplam: {formatCurrency(getTotalAmount())}</strong>
                    </div>
                  </div>

                  {/* RIGHT: product lines */}
                  <div style={{ flex: '2 1 480px', minWidth: 0 }}>
                    <label className="form-label">Məhsullar *</label>
                    <div style={{ border: '1px solid var(--gray-200, #e5e7eb)', borderRadius: '8px', padding: '0.5rem' }}>
                      <table className="table" style={{ marginBottom: '0.5rem' }}>
                        <thead>
                          <tr>
                            <th>Məhsul</th>
                            <th style={{ width: '90px' }}>Miqdar</th>
                            <th style={{ width: '120px' }}>Maya dəyəri</th>
                            <th style={{ width: '110px' }}>Cəm</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {entryForm.items.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <select
                                  className="form-control"
                                  value={item.productId}
                                  onChange={(e) => updateEntryItem(index, 'productId', e.target.value)}
                                >
                                  <option value="">Seçin...</option>
                                  {vendorSortedProducts.map(p => (
                                    <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={item.quantity}
                                  onChange={(e) => updateEntryItem(index, 'quantity', e.target.value)}
                                  min="1"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={item.costPrice}
                                  onChange={(e) => updateEntryItem(index, 'costPrice', e.target.value)}
                                  step="0.01"
                                  min="0"
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {formatCurrency((parseInt(item.quantity) || 0) * (parseFloat(item.costPrice) || 0))}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => removeEntryItem(index)}
                                  disabled={entryForm.items.length === 1}
                                  title="Sil"
                                >
                                  <FiTrash2 />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addEntryItem}>
                        <FiPlus /> Məhsul əlavə et
                      </button>
                    </div>
                  </div>
                </div>
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
                  <label className="form-label">Haradan (Anbar / Mağaza) *</label>
                  <select
                    className="form-control"
                    value={transferForm.fromWarehouseId}
                    onChange={(e) => {
                      setTransferForm({ ...transferForm, fromWarehouseId: e.target.value });
                      loadWhCount(e.target.value);
                    }}
                    required
                  >
                    <option value="">Seçin...</option>
                    <optgroup label="Anbarlar">
                      {warehouses.filter(wh => !wh.isStore && wh._id !== transferForm.toWarehouseId).map(wh => (
                        <option key={wh._id} value={wh._id}>{wh.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Mağazalar">
                      {warehouses.filter(wh => wh.isStore && wh._id !== transferForm.toWarehouseId).map(wh => (
                        <option key={wh._id} value={wh._id}>{wh.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  {transferForm.fromWarehouseId && whCounts[transferForm.fromWarehouseId] !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '4px' }}>
                      Bu məkanda {whCounts[transferForm.fromWarehouseId]} məhsul var
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Hara (Anbar / Mağaza) *</label>
                  <select
                    className="form-control"
                    value={transferForm.toWarehouseId}
                    onChange={(e) => {
                      setTransferForm({ ...transferForm, toWarehouseId: e.target.value });
                      loadWhCount(e.target.value);
                    }}
                    required
                  >
                    <option value="">Seçin...</option>
                    <optgroup label="Anbarlar">
                      {warehouses.filter(wh => !wh.isStore && wh._id !== transferForm.fromWarehouseId).map(wh => (
                        <option key={wh._id} value={wh._id}>{wh.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Mağazalar">
                      {warehouses.filter(wh => wh.isStore && wh._id !== transferForm.fromWarehouseId).map(wh => (
                        <option key={wh._id} value={wh._id}>{wh.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  {transferForm.toWarehouseId && whCounts[transferForm.toWarehouseId] !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '4px' }}>
                      Bu məkanda {whCounts[transferForm.toWarehouseId]} məhsul var
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Miqdar *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 0 })}
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
