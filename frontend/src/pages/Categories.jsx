import { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';

const Categories = () => {
  const [categories] = useState([
    { id: 'Elektrik', name: 'Elektrik', nameAz: 'Elektrik' },
    { id: 'Isidici', name: 'İsidici', nameAz: 'İsidici' },
    { id: 'Hamam', name: 'Vanna otağı', nameAz: 'Vanna' },
    { id: 'Ümumi', name: 'Ümumi', nameAz: 'Ümumi' }
  ]);

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    nameAz: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // This will require backend implementation to add custom categories
    toast.info('Kateqoriya əlavə etmək funksiyası tezliklə əlavə ediləcək');
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', nameAz: '' });
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, nameAz: category.nameAz });
    setShowModal(true);
  };

  const handleDelete = (categoryId) => {
    if (!window.confirm('Bu kateqoriyanı silmək istədiyinizə əminsiniz?')) return;
    toast.info('Kateqoriya silmək funksiyası tezliklə əlavə ediləcək');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kateqoriyalar</h1>
          <p className="page-subtitle">Məhsul kateqoriyaları</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Yeni Kateqoriya
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Kod</th>
                <th>Məhsul Sayı</th>
                <th style={{ width: '120px' }}></th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <tr key={category.id}>
                  <td><strong>{category.name}</strong></td>
                  <td><code>{category.id}</code></td>
                  <td>-</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(category)}>
                        <FiEdit2 />
                      </button>
                      <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(category.id)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingCategory ? 'Kateqoriyanı Redaktə Et' : 'Yeni Kateqoriya'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ad *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Kateqoriya adı"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Kod *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.nameAz}
                    onChange={(e) => setFormData({ ...formData, nameAz: e.target.value })}
                    placeholder="Məs: electric, heating"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
