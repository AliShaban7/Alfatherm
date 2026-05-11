import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSearch, FiX } from 'react-icons/fi';
import { saleAPI, productAPI, customerAPI, warehouseAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const NewSale = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    type: 'physical',
    name: '',
    brandName: '',
    voen: '',
    address: '',
    contactPerson: '',
    phone: ''
  });

  const [formData, setFormData] = useState({
    customerId: '',
    warehouseId: '',
    paymentType: 'prepaid',
    paymentMethod: 'cash',
    isOfficial: false,
    paidAmount: 0,
    note: '',
    items: []
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [productsRes, customersRes, warehousesRes] = await Promise.all([
        productAPI.getAll({ limit: 1000 }),
        customerAPI.getAll({ limit: 1000 }),
        warehouseAPI.getAll()
      ]);
      setProducts(productsRes.data.products);
      setCustomers(customersRes.data.customers);
      setWarehouses(warehousesRes.data.data);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    }
  };

  const handleAddProduct = (product) => {
    const existingIndex = formData.items.findIndex(item => item.productId === product._id);
    
    if (existingIndex >= 0) {
      const newItems = [...formData.items];
      newItems[existingIndex].quantity += 1;
      setFormData({ ...formData, items: newItems });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, {
          productId: product._id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.recommendedPrice,
          minPrice: product.minPrice,
          recommendedPrice: product.recommendedPrice
        }]
      });
    }
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const handleRemoveProduct = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    const item = newItems[index];
    
    if (field === 'unitPrice') {
      newItems[index] = { ...item, unitPrice: value === '' ? '' : parseFloat(value) || 0 };
    } else if (field === 'quantity') {
      newItems[index] = { ...item, quantity: value === '' ? '' : parseInt(value) || 0 };
    } else {
      newItems[index] = { ...item, [field]: value };
    }
    
    setFormData({ ...formData, items: newItems });
  };
  
  const isPriceBelowMin = (item) => {
    return item.unitPrice !== '' && item.unitPrice < item.minPrice;
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const qty = item.quantity === '' ? 0 : item.quantity;
      const price = item.unitPrice === '' ? 0 : item.unitPrice;
      return sum + (qty * price);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerId) {
      toast.error('Müştəri seçin');
      return;
    }

    if (!formData.warehouseId) {
      toast.error('Anbar seçin');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Ən azı bir məhsul əlavə edin');
      return;
    }

    for (const item of formData.items) {
      if (item.unitPrice === '' || item.unitPrice < item.minPrice) {
        toast.error(`"${item.productName}" üçün qiymət minimum ${item.minPrice} AZN-dən az ola bilməz`);
        return;
      }
      if (item.quantity === '' || item.quantity < 1) {
        toast.error(`"${item.productName}" üçün miqdar ən azı 1 olmalıdır`);
        return;
      }
    }

    setLoading(true);
    try {
      await saleAPI.create(formData);
      toast.success('Satış uğurla yaradıldı');
      navigate('/sales');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Satış yaratmaq mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    
    if (!newCustomer.name.trim()) {
      toast.error('Ad, soyad, ata adı daxil edin');
      return;
    }
    if (!newCustomer.phone.trim()) {
      toast.error('Əlaqə nömrəsi daxil edin');
      return;
    }
    
    setCustomerLoading(true);
    try {
      const response = await customerAPI.create(newCustomer);
      const createdCustomer = response.data.data;
      
      setCustomers([...customers, createdCustomer]);
      setFormData({ ...formData, customerId: createdCustomer._id });
      
      setShowCustomerModal(false);
      setNewCustomer({ type: 'physical', name: '', brandName: '', voen: '', address: '', contactPerson: '', phone: '' });
      toast.success('Müştəri uğurla yaradıldı');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Müştəri yaratmaq mümkün olmadı');
    } finally {
      setCustomerLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Yeni Satış</h1>
          <p className="page-subtitle">Yeni satış əməliyyatı yaradın</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem' }}>
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Məhsullar</h3>
              
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <div className="search-box">
                  <FiSearch className="search-box-icon" />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Məhsul axtar..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowProductSearch(true);
                    }}
                    onFocus={() => setShowProductSearch(true)}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                
                {showProductSearch && searchTerm && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 100
                  }}>
                    {filteredProducts.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                        Məhsul tapılmadı
                      </div>
                    ) : (
                      filteredProducts.slice(0, 10).map(product => (
                        <div
                          key={product._id}
                          onClick={() => handleAddProduct(product)}
                          style={{
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gray-100)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'var(--gray-50)'}
                          onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                          <div>
                            <div style={{ fontWeight: 500 }}>{product.name}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>{product.sku}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600 }}>{formatCurrency(product.recommendedPrice)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                              Min: {formatCurrency(product.minPrice)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {formData.items.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p>Məhsul əlavə edin</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Məhsul</th>
                      <th style={{ width: '100px' }}>Miqdar</th>
                      <th style={{ width: '150px' }}>Qiymət</th>
                      <th style={{ width: '120px' }}>Cəm</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.productName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                            Min: {formatCurrency(item.minPrice)}
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            min="1"
                            style={{ width: '80px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                            step="0.01"
                            placeholder={item.recommendedPrice}
                            style={{ 
                              width: '120px',
                              borderColor: isPriceBelowMin(item) ? 'var(--danger)' : ''
                            }}
                          />
                          {isPriceBelowMin(item) && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '2px' }}>
                              Min: {item.minPrice} AZN
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleRemoveProduct(index)}
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontWeight: 600 }}>Satış Məlumatları</h3>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: formData.isOfficial ? 'var(--success)' : 'var(--gray-400)'
                }}>
                  <div 
                    onClick={() => setFormData({ ...formData, isOfficial: !formData.isOfficial })}
                    style={{
                      width: '36px',
                      height: '20px',
                      borderRadius: '10px',
                      background: formData.isOfficial ? 'var(--success)' : 'var(--gray-300)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: formData.isOfficial ? '18px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                  
                </label>
              </div>
              
              <div className="form-group">
                <label className="form-label">Müştəri *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="form-control"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    required
                    style={{ flex: 1 }}
                  >
                    <option value="">Seçin...</option>
                    {customers.map(customer => (
                      <option key={customer._id} value={customer._id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowCustomerModal(true)}
                    title="Yeni müştəri"
                    style={{ padding: '0.5rem 0.75rem' }}
                  >
                    <FiPlus />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Anbar *</label>
                <select
                  className="form-control"
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  required
                >
                  <option value="">Seçin...</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ödəniş Tipi *</label>
                <select
                  className="form-control"
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                >
                  <option value="prepaid">Nağd</option>
                  <option value="credit">Nisyə</option>
                </select>
              </div>

              {formData.paymentType === 'prepaid' && (
                <div className="form-group">
                  <label className="form-label">Ödəniş Metodu</label>
                  <select
                    className="form-control"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Nağd</option>
                    <option value="pos">POS</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              )}

              {formData.paymentType === 'credit' && (
                <div className="form-group">
                  <label className="form-label">İlkin Ödəniş</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Qeyd</label>
                <textarea
                  className="form-control"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows="2"
                ></textarea>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--gray-600)' }}>Toplam:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {formatCurrency(calculateTotal())}
                </span>
              </div>

              {formData.paymentType === 'credit' && formData.paidAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--warning)' }}>
                  <span>Qalıq borc:</span>
                  <span style={{ fontWeight: 600 }}>
                    {formatCurrency(calculateTotal() - formData.paidAmount)}
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={loading || formData.items.length === 0}
              >
                {loading ? 'Yaradılır...' : 'Satışı Tamamla'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {showCustomerModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 'var(--border-radius-lg)',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: 600 }}>Yeni Müştəri</h3>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label className="form-label">Müştəri tipi *</label>
                <select
                  className="form-control"
                  value={newCustomer.type}
                  onChange={(e) => setNewCustomer({ ...newCustomer, type: e.target.value })}
                >
                  <option value="physical">Fiziki şəxs</option>
                  <option value="legal">Hüquqi şəxs</option>
                  <option value="master">Usta (Texnik)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ad, Soyad, Ata adı *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Məsələn: Əliyev Əli Vəli oğlu"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Müştəri brend adı</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCustomer.brandName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, brandName: e.target.value })}
                  placeholder="Şirkət/mağaza adı"
                />
              </div>

              <div className="form-group">
                <label className="form-label">VÖEN (Vergi nömrəsi)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCustomer.voen}
                  onChange={(e) => setNewCustomer({ ...newCustomer, voen: e.target.value })}
                  placeholder="1234567890"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ünvan</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  placeholder="Şəhər, küçə, bina"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Referral (Kim tövsiyə edib)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCustomer.contactPerson}
                  onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })}
                  placeholder="Tövsiyə edən şəxs"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Əlaqə nömrəsi *</label>
                <input
                  type="tel"
                  className="form-control"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="+994 XX XXX XX XX"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCustomerModal(false)}
                  style={{ flex: 1 }}
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={customerLoading}
                  style={{ flex: 1 }}
                >
                  {customerLoading ? 'Yaradılır...' : 'Yarat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewSale;
