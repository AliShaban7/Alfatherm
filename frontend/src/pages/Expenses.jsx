import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiFilter } from 'react-icons/fi';
import { expenseAPI, branchAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { EXPENSE_CATEGORIES } from '../utils/labels';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [formData, setFormData] = useState({
    branchId: '',
    category: 'other',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    isShared: false,
    receiptNumber: '',
    note: ''
  });

  useEffect(() => {
    fetchData();
  }, [categoryFilter, branchFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expensesRes, branchesRes] = await Promise.all([
        expenseAPI.getAll({ category: categoryFilter, branchId: branchFilter }),
        branchAPI.getAll()
      ]);
      setExpenses(expensesRes.data.expenses);
      setBranches(branchesRes.data.data);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...formData };
      
      // Auto-generate receipt number if empty
      if (!submitData.receiptNumber && !editingExpense) {
        const timestamp = Date.now().toString().slice(-8);
        submitData.receiptNumber = `QBZ-${timestamp}`;
      }
      
      if (editingExpense) {
        await expenseAPI.update(editingExpense._id, submitData);
        toast.success('Xərc yeniləndi');
      } else {
        await expenseAPI.create(submitData);
        toast.success('Xərc əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      branchId: expense.branchId?._id || '',
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      date: expense.date?.split('T')[0] || '',
      paymentMethod: expense.paymentMethod || 'cash',
      isShared: expense.isShared || false,
      receiptNumber: expense.receiptNumber || '',
      note: expense.note || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu xərci silmək istədiyinizə əminsiniz?')) return;
    try {
      await expenseAPI.delete(id);
      toast.success('Xərc silindi');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      branchId: '',
      category: 'other',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      isShared: false,
      receiptNumber: '',
      note: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const getTotalAmount = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Xərclər</h1>
          <p className="page-subtitle">Xərc idarəetməsi</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FiPlus /> Yeni Xərc
        </button>
      </div>

      <div className="card">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '0.75rem', 
          marginBottom: '1.25rem', 
          flexWrap: 'wrap',
          padding: '0.75rem',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            color: '#6b7280',
            fontWeight: 500,
            fontSize: '0.875rem'
          }}>
            <FiFilter />
            <span>Filtrlər:</span>
          </div>
          
          <select
            className="form-control"
            style={{ 
              width: 'auto',
              minWidth: '180px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              background: 'white'
            }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">📁 Bütün kateqoriyalar</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          
          <select
            className="form-control"
            style={{ 
              width: 'auto',
              minWidth: '180px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              background: 'white'
            }}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">🏢 Bütün filiallar</option>
            {branches.map(b => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
          
          {(categoryFilter || branchFilter) && (
            <button 
              className="btn btn-sm btn-secondary"
              style={{ 
                fontSize: '0.8125rem',
                padding: '0.4rem 0.75rem'
              }}
              onClick={() => {
                setCategoryFilter('');
                setBranchFilter('');
              }}
            >
              Təmizlə
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Xərc tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Qəbz No</th>
                  <th>Tarix</th>
                  <th>Kateqoriya</th>
                  <th>Qeyd</th>
                  <th>Filial</th>
                  <th>
                    Məbləğ 
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      color: '#dc2626', 
                      fontWeight: 700 
                    }}>
                      ({formatCurrency(getTotalAmount())})
                    </span>
                  </th>
                  <th>Metod</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(expense => (
                  <tr key={expense._id}>
                    <td><strong>{expense.expenseNumber || '-'}</strong></td>
                    <td>{format(new Date(expense.date), 'dd.MM.yyyy')}</td>
                    <td>
                      <span className="badge badge-secondary">
                        {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category}
                      </span>
                    </td>
                    <td>{expense.description}</td>
                    <td>{expense.branchId?.name || '-'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>
                      {formatCurrency(expense.amount)}
                    </td>
                    <td>
                      {expense.paymentMethod === 'cash' ? 'Nağd' : 
                       expense.paymentMethod === 'pos' ? 'POS' : 'Bank'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(expense)}>
                          <FiEdit2 />
                        </button>
                        <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(expense._id)}>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingExpense ? 'Xərci Redaktə Et' : 'Yeni Xərc'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Filial *</label>
                    <select
                      className="form-control"
                      value={formData.branchId}
                      onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                      required
                    >
                      <option value="">Seçin...</option>
                      {branches.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kateqoriya *</label>
                    <select
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Təsvir *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Məbləğ *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tarix *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
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
                  <div className="form-group">
                    <label className="form-label">Qəbz No</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.receiptNumber}
                      onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                      placeholder="Boş buraxılsa avtomatik yaradılacaq"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isShared}
                      onChange={(e) => setFormData({ ...formData, isShared: e.target.checked })}
                    />
                    <span>Ortaq xərc (bütün sahiblər)</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingExpense ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
