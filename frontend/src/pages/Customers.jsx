import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';
import { customerAPI } from '../services/api';
import { toast } from 'react-toastify';

const CUSTOMER_TYPES = [
  { value: 'physical', label: 'Fiziki şəxs' },
  { value: 'legal', label: 'Hüquqi şəxs' },
  { value: 'master', label: 'Usta' }
];

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    type: 'physical',
    name: '',
    brandName: '',
    voen: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    note: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, [typeFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAll({ search, type: typeFilter });
      setCustomers(response.data.customers);
    } catch (error) {
      toast.error('Müştəriləri yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customerAPI.update(editingCustomer._id, formData);
        toast.success('Müştəri yeniləndi');
      } else {
        await customerAPI.create(formData);
        toast.success('Müştəri əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      type: customer.type,
      name: customer.name,
      brandName: customer.brandName || '',
      voen: customer.voen || '',
      address: customer.address || '',
      contactPerson: customer.contactPerson || '',
      phone: customer.phone,
      email: customer.email || '',
      note: customer.note || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu müştərini silmək istədiyinizə əminsiniz?')) return;
    try {
      await customerAPI.delete(id);
      toast.success('Müştəri silindi');
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
      type: 'physical',
      name: '',
      brandName: '',
      voen: '',
      address: '',
      contactPerson: '',
      phone: '',
      email: '',
      note: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Müştərilər</h1>
          <p className="page-subtitle">Müştəri idarəetməsi</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FiPlus /> Yeni Müştəri
        </button>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Ad, telefon və ya VÖEN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Bütün tiplər</option>
            {CUSTOMER_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">Axtar</button>
        </form>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Müştəri tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Tip</th>
                  <th>Telefon</th>
                  <th>VÖEN</th>
                  <th>Ünvan</th>
                  <th>Toplam Alış</th>
                  <th>Borc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer._id}>
                    <td>
                      <strong>{customer.name}</strong>
                      {customer.brandName && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                          {customer.brandName}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${customer.type === 'legal' ? 'badge-info' : customer.type === 'master' ? 'badge-warning' : 'badge-secondary'}`}>
                        {CUSTOMER_TYPES.find(t => t.value === customer.type)?.label}
                      </span>
                    </td>
                    <td>{customer.phone}</td>
                    <td>{customer.voen || '-'}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customer.address || '-'}
                    </td>
                    <td>{formatCurrency(customer.totalPurchases || 0)}</td>
                    <td style={{ color: customer.totalDebt > 0 ? 'var(--danger)' : 'inherit' }}>
                      {formatCurrency(customer.totalDebt || 0)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(customer)}>
                          <FiEdit2 />
                        </button>
                        <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(customer._id)}>
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingCustomer ? 'Müştərini Redaktə Et' : 'Yeni Müştəri'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Müştəri Tipi *</label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    {CUSTOMER_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ad *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefon *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {formData.type === 'legal' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Şirkət Adı</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.brandName}
                        onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">VÖEN *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.voen}
                        onChange={(e) => setFormData({ ...formData, voen: e.target.value })}
                        required={formData.type === 'legal'}
                      />
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Əlaqədar Şəxs</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ünvan</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
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
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
