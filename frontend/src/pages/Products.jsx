import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import { productAPI, categoryAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

const UNITS = [
  { value: 'eded', label: 'Ədəd' },
  { value: 'metr', label: 'Metr' },
  { value: 'm2', label: 'm²' },
  { value: 'm3', label: 'm³' },
  { value: 'kg', label: 'Kq' },
  { value: 'litr', label: 'Litr' },
  { value: 'dəst', label: 'Dəst' },
  { value: 'qutu', label: 'Qutu' }
];

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const { isOwner, isSuperOwner, user } = useAuth();
  
  const owners = [
    { id: 'owner_zaur_001', name: 'Zaur' },
    { id: 'owner_adalat_002', name: 'Ədalət' }
  ];

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    manufacturer: '',
    country: '',
    category: 'general',
    unit: 'eded',
    color: '',
    minPrice: '',
    recommendedPrice: '',
    description: '',
    ownerId: user?.ownerId || ''
  });

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [category]);

  const fetchCategories = async () => {
    try {
      const response = await categoryAPI.getAll({ type: 'product' });
      setCategories(response.data.data);
    } catch (error) {
      console.error('Kateqoriyaları yükləmək mümkün olmadı');
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAll({ search, category });
      setProducts(response.data.products);
    } catch (error) {
      toast.error('Məhsulları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Remove empty string fields to avoid validation errors
      const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      if (editingProduct) {
        await productAPI.update(editingProduct._id, cleanedData);
        toast.success('Məhsul yeniləndi');
      } else {
        await productAPI.create(cleanedData);
        toast.success('Məhsul əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      brand: product.brand || '',
      manufacturer: product.manufacturer || '',
      country: product.country || '',
      category: product.category,
      unit: product.unit,
      color: product.color || '',
      minPrice: product.minPrice,
      recommendedPrice: product.recommendedPrice,
      description: product.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu məhsulu silmək istədiyinizə əminsiniz?')) return;
    try {
      await productAPI.delete(id);
      toast.success('Məhsul silindi');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      brand: '',
      manufacturer: '',
      country: '',
      category: 'general',
      unit: 'eded',
      color: '',
      minPrice: '',
      recommendedPrice: '',
      description: '',
      ownerId: user?.ownerId || ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const exportToExcel = () => {
    if (!products.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }

    const exportData = products.map((product, index) => ({
      '#': index + 1,
      'Məhsul Adı': product.name,
      'SKU': product.sku,
      'Kateqoriya': categories.find(c => c.code === product.category)?.name || product.category,
      'Brend': product.brand || '',
      'İstehsalçı': product.manufacturer || '',
      'Ölkə': product.country || '',
      'Ölçü vahidi': UNITS.find(u => u.value === product.unit)?.label || product.unit,
      'Rəng': product.color || '',
      ...(isOwner() && { 'Maya Dəyəri (AZN)': product.costPrice || 0 }),
      'Minimum Qiymət (AZN)': product.minPrice || 0,
      'Təklif olunan Qiymət (AZN)': product.recommendedPrice || 0,
      'Təsvir': product.description || ''
    }));

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Məhsullar');
      XLSX.writeFile(wb, `məhsullar_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel faylı yükləndi');
    } catch (error) {
      toast.error('Excel faylını yaratmaq mümkün olmadı');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Məhsullar</h1>
          <p className="page-subtitle">Məhsul kataloqu</p>
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
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
              <FiPlus /> Yeni Məhsul
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Məhsul adı..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Bütün kateqoriyalar</option>
            {categories.map(cat => (
              <option key={cat.code} value={cat.code}>{cat.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">Axtar</button>
        </form>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Məhsul tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Məhsul</th>
                  <th>SKU</th>
                  <th>Kateqoriya</th>
                  <th>Brend</th>
                  <th>Min Qiymət</th>
                  <th>Tövsiyə Qiymət</th>
                  {isOwner() && <th></th>}
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product._id}>
                    <td><strong>{product.name}</strong></td>
                    <td><code>{product.sku}</code></td>
                    <td>
                      <span className="badge badge-secondary">
                        {categories.find(c => c.code === product.category)?.name || product.category}
                      </span>
                    </td>
                    <td>{product.brand || '-'}</td>
                    <td>{formatCurrency(product.minPrice)}</td>
                    <td><strong>{formatCurrency(product.recommendedPrice)}</strong></td>
                    {isOwner() && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(product)}>
                            <FiEdit2 />
                          </button>
                          <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(product._id)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    )}
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
              <h3 className="modal-title">{editingProduct ? 'Məhsulu Redaktə Et' : 'Yeni Məhsul'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Məhsul Adı *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {isSuperOwner() && !editingProduct && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Sahibi *</label>
                      <select
                        className="form-control"
                        value={formData.ownerId}
                        onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                        required
                      >
                        <option value="">Seçin...</option>
                        {owners.map(owner => (
                          <option key={owner.id} value={owner.id}>{owner.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kateqoriya *</label>
                    <select
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      <option value="">Seçin...</option>
                      {categories.map(cat => (
                        <option key={cat.code} value={cat.code}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vahid</label>
                    <select
                      className="form-control"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                      {UNITS.map(unit => (
                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Brend</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">İstehsalçı</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ölkə</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rəng</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Min Qiymət *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.minPrice}
                      onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tövsiyə Qiymət *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.recommendedPrice}
                      onChange={(e) => setFormData({ ...formData, recommendedPrice: e.target.value })}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
