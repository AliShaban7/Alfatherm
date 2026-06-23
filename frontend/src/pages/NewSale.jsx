import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSearch } from 'react-icons/fi';
import CustomerFormModal from '../components/customers/CustomerFormModal';
import { saleAPI, productAPI, customerAPI, warehouseAPI, salespersonAPI, ustaAPI, vendorAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { printSaleReceipt } from '../utils/receipt';
import {
  PAYMENT_SELECTION,
  BANK_METHOD,
  toApiPayment,
  formatPaymentLabel
} from '../utils/payment';
import './NewSale.css';

// az-AZ keypads emit a comma decimal ("12,50"). parseFloat('12,50') === 12 would
// silently drop the kuruş, so every money value is read through num(), which
// normalises comma → dot and never returns NaN (blank/garbage → 0).
const num = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Keep only digits and a single decimal point (normalising comma → dot) while
// preserving partial mid-typing input like "12." so controlled inputs work.
const normalizeDecimal = (v) => {
  const cleaned = String(v).replace(',', '.').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  // Drop any extra dots after the first.
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

const NewSale = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  // Synchronous re-entry guard: `loading` only blocks the button on the next
  // render, so a fast double-click could fire submitSale twice and create two
  // sales. This ref flips immediately.
  const submittingRef = useRef(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [vendorMap, setVendorMap] = useState({}); // vendorId -> name (İstehsalçı display)
  const [stockMap, setStockMap] = useState({});
  const [stockLoading, setStockLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Checkout confirmation modal (salesman selection for bonus tracking)
  const [showConfirm, setShowConfirm] = useState(false);
  const [salespersonId, setSalespersonId] = useState('');

  // Per-sale costs captured at checkout (split between owners on the backend).
  const [ustas, setUstas] = useState([]);
  const [commission, setCommission] = useState({ ustaId: '', amount: '' });
  const [saleExpenses, setSaleExpenses] = useState([]); // [{ category, amount }]

  const SALE_EXPENSE_OPTIONS = [
    { value: 'delivery', label: 'Daşınma' },
    { value: 'installation', label: 'Quraşdırma' },
    { value: 'other', label: 'Digər' }
  ];

  const [formData, setFormData] = useState({
    customerId: '',
    warehouseId: '',
    paymentSelection: PAYMENT_SELECTION.CASH,
    bankMethod: BANK_METHOD.POS,
    isOfficial: false,
    paidAmount: '',
    discount: '',
    note: '',
    items: []
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Load available stock for the selected warehouse so the cashier sees
  // quantities up front instead of discovering shortages on submit.
  useEffect(() => {
    if (!formData.warehouseId) {
      setStockMap({});
      return;
    }

    let cancelled = false;
    setStockLoading(true);
    saleAPI
      .getWarehouseStock(formData.warehouseId)
      .then((res) => {
        if (!cancelled) setStockMap(res.data.data || {});
      })
      .catch(() => {
        if (!cancelled) setStockMap({});
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formData.warehouseId]);

  const getAvailableStock = (productId) => stockMap[productId];

  const isStockInsufficient = (item) => {
    if (!formData.warehouseId) return false;
    const available = stockMap[item.productId];
    const qty = item.quantity === '' ? 0 : item.quantity;
    return available === undefined || qty > available;
  };

  const fetchInitialData = async () => {
    try {
      const [productsRes, customersRes, warehousesRes, salespersonsRes, ustasRes, vendorsRes] = await Promise.all([
        productAPI.getAll({ limit: 1000 }),
        customerAPI.getAll({ limit: 1000 }),
        warehouseAPI.getAll(),
        salespersonAPI.getAll(),
        ustaAPI.getAll(),
        vendorAPI.getAll({ limit: 1000 })
      ]);
      setProducts(productsRes.data.products);
      setCustomers(customersRes.data.customers);
      setWarehouses(warehousesRes.data.data);
      setSalespersons(salespersonsRes.data.data || []);
      setUstas(ustasRes.data.data || []);
      setVendorMap(
        (vendorsRes.data.vendors || []).reduce((acc, v) => { acc[v._id] = v.name; return acc; }, {})
      );
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    }
  };

  const handleAddProduct = (product) => {
    const existingIndex = formData.items.findIndex(item => item.productId === product._id);
    
    if (existingIndex >= 0) {
      // Replace the item object instead of mutating it in place: `[...items]` is a
      // shallow copy, so the element is still the same reference held in state.
      const newItems = formData.items.map((item, i) =>
        i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
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
      // Store the raw normalised string so partial decimals ("12.") survive and
      // commas become dots; num() reads it wherever a number is needed.
      newItems[index] = { ...item, unitPrice: value === '' ? '' : normalizeDecimal(value) };
    } else if (field === 'quantity') {
      const digits = String(value).replace(/[^0-9]/g, '');
      newItems[index] = { ...item, quantity: digits === '' ? '' : parseInt(digits, 10) || 0 };
    } else {
      newItems[index] = { ...item, [field]: value };
    }
    
    setFormData({ ...formData, items: newItems });
  };
  
  const isPriceBelowMin = (item) => {
    return item.unitPrice !== '' && num(item.unitPrice) < item.minPrice;
  };

  const calculateItemDiscount = (item) => {
    const qty = num(item.quantity);
    const price = num(item.unitPrice);
    const recommendedPrice = num(item.recommendedPrice);

    if (price < recommendedPrice) {
      return (recommendedPrice - price) * qty;
    }
    return 0;
  };

  const calculateTotalDiscount = () => {
    return formData.items.reduce((sum, item) => {
      return sum + calculateItemDiscount(item);
    }, 0);
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      return sum + (num(item.quantity) * num(item.unitPrice));
    }, 0);
  };

  // Whole-sale discount (clamped to the subtotal); Toplam = subtotal − discount.
  const getDiscount = () => {
    return Math.min(Math.max(num(formData.discount), 0), calculateSubtotal());
  };

  const calculateTotal = () => calculateSubtotal() - getDiscount();

  const addExpenseRow = () =>
    setSaleExpenses((rows) => [...rows, { category: 'delivery', amount: '' }]);

  const updateExpenseRow = (index, field, value) =>
    setSaleExpenses((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );

  const removeExpenseRow = (index) =>
    setSaleExpenses((rows) => rows.filter((_, i) => i !== index));

  const calculateCostsTotal = () => {
    const commissionAmt = num(commission.amount);
    const expensesAmt = saleExpenses.reduce((sum, e) => sum + num(e.amount), 0);
    return commissionAmt + expensesAmt;
  };

  const handlePaymentSelectionChange = (paymentSelection) => {
    setFormData((prev) => ({
      ...prev,
      paymentSelection,
      ...(paymentSelection !== PAYMENT_SELECTION.CREDIT ? { paidAmount: '' } : {})
    }));
  };

  // First step: validate the cart, then open the confirmation modal where the
  // cashier selects which salesman made the sale.
  const handleSubmit = (e) => {
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
      if (item.unitPrice === '' || num(item.unitPrice) < item.minPrice) {
        toast.error(`"${item.productName}" üçün qiymət minimum ${item.minPrice} AZN-dən az ola bilməz`);
        return;
      }
      if (item.quantity === '' || item.quantity < 1) {
        toast.error(`"${item.productName}" üçün miqdar ən azı 1 olmalıdır`);
        return;
      }
      const available = stockMap[item.productId];
      if (available === undefined) {
        toast.error(`"${item.productName}" bu anbarda mövcud deyil`);
        return;
      }
      if (item.quantity > available) {
        toast.error(`"${item.productName}" üçün anbarda yalnız ${available} ədəd var`);
        return;
      }
    }

    setShowConfirm(true);
  };

  // Second step: salesman chosen, actually create the sale.
  const submitSale = async () => {
    if (!salespersonId) {
      toast.error('Satıcı seçin');
      return;
    }

    // Commission: amount and usta go together.
    const commissionAmount = num(commission.amount);
    if (commissionAmount > 0 && !commission.ustaId) {
      toast.error('Komissiya üçün usta seçin');
      return;
    }
    if (commission.ustaId && commissionAmount <= 0) {
      toast.error('Usta üçün komissiya məbləği daxil edin');
      return;
    }

    // Each expense row must be complete (category + amount > 0) before submitting.
    for (const e of saleExpenses) {
      if (!e.category || num(e.amount) <= 0) {
        toast.error('Hər xərc sətri üçün kateqoriya və məbləğ (>0) daxil edin');
        return;
      }
    }

    // Block re-entry from a rapid double-click before `loading` re-renders the
    // disabled button — otherwise the same sale is created twice.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    const { paymentType, paymentMethod } = toApiPayment(
      formData.paymentSelection,
      formData.bankMethod
    );

    const payload = {
      customerId: formData.customerId,
      warehouseId: formData.warehouseId,
      salespersonId,
      paymentType,
      isOfficial: formData.isOfficial,
      items: formData.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: num(item.unitPrice)
      }))
    };

    if (formData.note?.trim()) {
      payload.note = formData.note.trim();
    }

    if (getDiscount() > 0) {
      payload.discount = getDiscount();
    }

    if (commissionAmount > 0) {
      payload.commission = { ustaId: commission.ustaId, amount: commissionAmount };
    }

    if (saleExpenses.length > 0) {
      payload.saleExpenses = saleExpenses.map((e) => ({
        category: e.category,
        amount: num(e.amount)
      }));
    }

    if (paymentMethod) {
      payload.paymentMethod = paymentMethod;
    }

    if (paymentType === 'credit' && formData.paidAmount !== '') {
      payload.paidAmount = num(formData.paidAmount);
    }

    // Only the API call governs success/failure. Receipt printing and navigation
    // run AFTER and must never surface a "failed" toast — otherwise a blocked
    // print popup makes a successful sale look like it failed.
    let response;
    try {
      response = await saleAPI.create(payload);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Satış yaratmaq mümkün olmadı');
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    toast.success('Satış uğurla yaradıldı');
    setShowConfirm(false);
    setLoading(false);
    submittingRef.current = false;

    const sale = response.data?.data;
    if (!sale) {
      navigate('/sales');
      return;
    }

    const customer = customers.find(
      (c) => c._id === (sale.customerId?._id || sale.customerId)
    );
    const warehouse = warehouses.find((w) => w._id === formData.warehouseId);

    // Printing can throw (e.g. popup blocked) — isolate it so it can't affect the sale outcome.
    try {
      printSaleReceipt(sale, {
        customerName: customer?.name || sale.customerId?.name || '-',
        cashierName: user?.name || sale.userId?.name,
        salespersonName: sale.salespersonName,
        warehouseName: sale.warehouseId?.name || warehouse?.name,
        formatDate: (d) => format(new Date(d), 'dd.MM.yyyy HH:mm'),
        paymentLabel: formatPaymentLabel(sale.paymentType, sale.paymentMethod)
      });
    } catch (printError) {
      toast.warn('Qəbz çap edilə bilmədi (satış yadda saxlanıldı)');
    }

    navigate('/sales', {
      state: {
        newSale: {
          _id: sale._id,
          saleNumber: sale.saleNumber,
          date: sale.date,
          customerId: sale.customerId || (customer ? { _id: customer._id, name: customer.name } : null),
          branchId: sale.branchId,
          warehouseId: sale.warehouseId || (warehouse ? { _id: warehouse._id, name: warehouse.name } : null),
          paymentType: sale.paymentType,
          paymentMethod: sale.paymentMethod,
          totalAmount: sale.totalAmount,
          profit: sale.profit,
          status: sale.status || 'completed'
        }
      }
    });
  };

  const handleCreateCustomer = async (payload) => {
    setCustomerLoading(true);
    try {
      const response = await customerAPI.create(payload);
      const createdCustomer = response.data.data;
      
      setCustomers([...customers, createdCustomer]);
      setFormData({ ...formData, customerId: createdCustomer._id });
      
      setShowCustomerModal(false);
      toast.success('Müştəri uğurla yaradıldı');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Müştəri yaratmaq mümkün olmadı');
    } finally {
      setCustomerLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (vendorMap[p.vendorId] || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
  });

  // Sales are made from stores (satış nöqtələri). Fall back to all warehouses
  // only if no store is marked yet, so the screen never breaks during setup.
  const storeWarehouses = warehouses.filter((w) => w.isStore);
  const saleWarehouses = storeWarehouses.length ? storeWarehouses : warehouses;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  return (
    <div className="new-sale-page">
      <div className="new-sale-top">
        <h1 className="page-title">Yeni Satış</h1>
        <label
          className={`new-sale-official ${formData.isOfficial ? 'is-on' : ''}`}
          onClick={() => setFormData({ ...formData, isOfficial: !formData.isOfficial })}
        >
          <span>Rəsmi</span>
          <span className={`new-sale-official-toggle ${formData.isOfficial ? 'on' : ''}`}>
            <span className="new-sale-official-knob" />
          </span>
        </label>
      </div>

      <form onSubmit={handleSubmit} className="new-sale-form">
        <div className="new-sale-grid">
          <div className="card new-sale-products">
              <h3>Məhsullar</h3>
              
              <div className="new-sale-search">
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
                  <div className="new-sale-product-dropdown">
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
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                              {product.brand && <span>Brend: {product.brand}</span>}
                              {vendorMap[product.vendorId] && <span>İstehsalçı: {vendorMap[product.vendorId]}</span>}
                              {!product.brand && !vendorMap[product.vendorId] && <span>{product.sku}</span>}
                              {product.color && <span>Rəng: {product.color}</span>}
                            </div>
                            {formData.warehouseId && (
                              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: getAvailableStock(product._id) > 0 ? 'var(--success, #16a34a)' : 'var(--danger)' }}>
                                {getAvailableStock(product._id) > 0
                                  ? `Anbarda: ${getAvailableStock(product._id)}`
                                  : 'Stokda yoxdur'}
                              </div>
                            )}
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

              <div className="new-sale-items">
              {formData.items.length === 0 ? (
                <div className="empty-state">
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
                          {formData.warehouseId && (
                            <div style={{ fontSize: '0.7rem', fontWeight: 500, color: isStockInsufficient(item) ? 'var(--danger)' : 'var(--gray-500)' }}>
                              Anbarda: {getAvailableStock(item.productId) ?? 0}
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            min="1"
                            style={{ width: '80px', borderColor: isStockInsufficient(item) ? 'var(--danger)' : '' }}
                          />
                          {isStockInsufficient(item) && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '2px' }}>
                              Çatışmır
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="form-control"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
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
                          {formatCurrency(num(item.quantity) * num(item.unitPrice))}
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

          <div className="new-sale-sidebar">
            <div className="card new-sale-details">
              <h3>Satış Məlumatları</h3>

              <div className="new-sale-fields">
                <div className="form-group span-2">
                  <label className="form-label">Müştəri *</label>
                  <div className="new-sale-customer-row">
                    <select
                      className="form-control"
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      required
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
                    >
                      <FiPlus />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mağaza *</label>
                  <select
                    className="form-control"
                    value={formData.warehouseId}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    required
                  >
                    <option value="">Seçin...</option>
                    {saleWarehouses.map(warehouse => (
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
                    value={formData.paymentSelection}
                    onChange={(e) => handlePaymentSelectionChange(e.target.value)}
                  >
                    <option value={PAYMENT_SELECTION.CASH}>Nağd</option>
                    <option value={PAYMENT_SELECTION.BANK}>Bank</option>
                    <option value={PAYMENT_SELECTION.CREDIT}>Nisyə</option>
                  </select>
                </div>

                {formData.paymentSelection === PAYMENT_SELECTION.BANK && (
                  <div className="form-group">
                    <label className="form-label">Bank ödənişi</label>
                    <select
                      className="form-control"
                      value={formData.bankMethod}
                      onChange={(e) => setFormData({ ...formData, bankMethod: e.target.value })}
                    >
                      <option value={BANK_METHOD.POS}>POS</option>
                      <option value={BANK_METHOD.BANK}>Köçürmə</option>
                    </select>
                  </div>
                )}

                {formData.paymentSelection === PAYMENT_SELECTION.CREDIT && (
                  <div className="form-group span-2">
                    <label className="form-label">İlkin Ödəniş</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      value={formData.paidAmount}
                      onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value === '' ? '' : normalizeDecimal(e.target.value) })}
                    />
                  </div>
                )}

                <div className="form-group span-2">
                  <label className="form-label">Qeyd</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="İstəyə bağlı"
                  />
                </div>
              </div>
            </div>

            <div className="card new-sale-checkout">
              <div className="new-sale-totals">
                {calculateTotalDiscount() > 0 && (
                  <div className="new-sale-totals-row discount">
                    <span>Endirim</span>
                    <span>-{formatCurrency(calculateTotalDiscount())}</span>
                  </div>
                )}
                <div className="new-sale-totals-row main" style={{ borderBottom: 'none' }}>
                  <span>Ara cəm</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="new-sale-totals-row" style={{ alignItems: 'center' }}>
                  <span>Endirim (AZN)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    style={{ width: '130px', textAlign: 'right' }}
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: normalizeDecimal(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="new-sale-totals-row main">
                  <span>Toplam</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
                {formData.paymentSelection === PAYMENT_SELECTION.CREDIT && num(formData.paidAmount) > 0 && (
                  <div className="new-sale-totals-row debt">
                    <span>Qalıq borc</span>
                    {/* Clamp at 0 so an over-payment never previews a negative debt
                        (the backend also clamps the stored paidAmount to the total). */}
                    <span>{formatCurrency(Math.max(0, calculateTotal() - num(formData.paidAmount)))}</span>
                  </div>
                )}
              </div>

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

      {showConfirm && (
        <div
          className="ns-modal-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => !loading && setShowConfirm(false)}
        >
          <div
            className="card"
            style={{ width: '420px', maxWidth: '92vw', padding: '1.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Satışı Tamamla</h3>

            <div className="new-sale-totals" style={{ marginBottom: '1rem' }}>
              {getDiscount() > 0 && (
                <div className="new-sale-totals-row discount">
                  <span>Endirim</span>
                  <span>-{formatCurrency(getDiscount())}</span>
                </div>
              )}
              <div className="new-sale-totals-row main">
                <span>Toplam</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
              <div className="new-sale-totals-row" style={{ color: 'var(--gray-500)' }}>
                <span>Ödəniş</span>
                <span>{(() => {
                  const p = toApiPayment(formData.paymentSelection, formData.bankMethod);
                  return formatPaymentLabel(p.paymentType, p.paymentMethod);
                })()}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Satıcı *</label>
              <select
                className="form-control"
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                autoFocus
              >
                <option value="">Seçin...</option>
                {salespersons.map((sp) => (
                  <option key={sp._id} value={sp._id}>{sp.name}</option>
                ))}
              </select>
              {salespersons.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px' }}>
                  Satıcı siyahısı boşdur. Əvvəlcə "Satıcılar" bölməsində satıcı əlavə edin.
                </div>
              )}
            </div>

            {/* Per-sale costs: referral commission + on-the-spot expenses. */}
            <div className="form-group">
              <label className="form-label">Usta komissiyası</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  className="form-control"
                  style={{ flex: 2 }}
                  value={commission.ustaId}
                  onChange={(e) => setCommission({ ...commission, ustaId: e.target.value })}
                >
                  <option value="">Usta (yoxdursa boş)</option>
                  {ustas.map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-control"
                  style={{ flex: 1 }}
                  placeholder="Məbləğ"
                  value={commission.amount}
                  onChange={(e) => setCommission({ ...commission, amount: normalizeDecimal(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Satış xərcləri</label>
              {saleExpenses.map((row, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    className="form-control"
                    style={{ flex: 2 }}
                    value={row.category}
                    onChange={(e) => updateExpenseRow(index, 'category', e.target.value)}
                  >
                    {SALE_EXPENSE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    style={{ flex: 1 }}
                    placeholder="Məbləğ"
                    value={row.amount}
                    onChange={(e) => updateExpenseRow(index, 'amount', normalizeDecimal(e.target.value))}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => removeExpenseRow(index)}
                    title="Sil"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-secondary" onClick={addExpenseRow}>
                <FiPlus /> Xərc əlavə et
              </button>
            </div>

            {calculateCostsTotal() > 0 && (
              <div className="new-sale-totals-row" style={{ color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                <span>Xərclər cəmi</span>
                <span>{formatCurrency(calculateCostsTotal())}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn"
                style={{ flex: 1 }}
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Ləğv et
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={submitSale}
                disabled={loading || !salespersonId}
              >
                {loading ? 'Yaradılır...' : 'Təsdiqlə'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomerFormModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSubmit={handleCreateCustomer}
        loading={customerLoading}
      />
    </div>
  );
};

export default NewSale;
