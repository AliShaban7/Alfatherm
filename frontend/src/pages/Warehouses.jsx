import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiHome, FiMapPin } from 'react-icons/fi';
import { warehouseAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const { isOwner } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'branch',
    address: ''
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const response = await warehouseAPI.getAll();
      setWarehouses(response.data.data);
    } catch (error) {
      toast.error('Anbarları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await warehouseAPI.update(editingWarehouse._id, formData);
        toast.success('Anbar yeniləndi');
      } else {
        await warehouseAPI.create(formData);
        toast.success('Anbar əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchWarehouses();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      type: warehouse.type,
      address: warehouse.address || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu anbarı silmək istədiyinizə əminsiniz?')) return;
    try {
      await warehouseAPI.delete(id);
      toast.success('Anbar silindi');
      fetchWarehouses();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditingWarehouse(null);
    setFormData({
      name: '',
      code: '',
      type: 'branch',
      address: ''
    });
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'main': return 'Əsas Anbar';
      case 'branch': return 'Filial Anbarı';
      default: return type;
    }
  };

  const getTypeIcon = (type) => {
    return type === 'main' ? <FiHome /> : <FiMapPin />;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Anbarlar</h1>
        </div>
        {isOwner() && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <FiPlus /> Yeni Anbar
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Anbar tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kod</th>
                  <th>Tip</th>
                  <th>Ünvan</th>
                  <th>Status</th>
                  {isOwner() && <th style={{ width: '100px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {warehouses.map(warehouse => (
                  <tr key={warehouse._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: warehouse.type === 'main' ? 'var(--primary)' : 'var(--gray-500)' }}>
                          {getTypeIcon(warehouse.type)}
                        </span>
                        <strong>{warehouse.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary">{warehouse.code}</span>
                    </td>
                    <td>{getTypeLabel(warehouse.type)}</td>
                    <td>{warehouse.address || '-'}</td>
                    <td>
                      <span className={`badge ${warehouse.isActive ? 'badge-success' : 'badge-secondary'}`}>
                        {warehouse.isActive ? 'Aktiv' : 'Deaktiv'}
                      </span>
                    </td>
                    {isOwner() && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-sm" 
                            onClick={() => handleEdit(warehouse)}
                            title="Düzəliş"
                          >
                            <FiEdit2 />
                          </button>
                          {warehouse.type !== 'main' && (
                            <button 
                              className="btn btn-sm" 
                              style={{ color: 'var(--danger)' }} 
                              onClick={() => handleDelete(warehouse._id)}
                              title="Sil"
                            >
                              <FiTrash2 />
                            </button>
                          )}
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingWarehouse ? 'Anbarı Redaktə Et' : 'Yeni Anbar'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Anbar Adı *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Məs: Əsas Anbar"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Anbar Kodu</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingWarehouse ? formData.code : 'Avtomatik yaradılacaq'}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tip *</label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    disabled={editingWarehouse?.type === 'main'}
                  >
                    <option value="branch">Filial Anbarı</option>
                    <option value="main">Əsas Anbar</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ünvan</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Anbar ünvanı"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingWarehouse ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warehouses;
