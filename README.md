# Alfaterm - İdarəetmə Sistemi

Ev kommunal məhsulları satan şirkət üçün tam funksional idarəetmə sistemi.

## Texnologiyalar

### Backend

- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcryptjs (şifrə hash)

### Frontend

- React 18
- React Router v6
- Axios
- React Toastify
- Vite

## Xüsusiyyətlər

### İki Sahibli Sistem

- Hər sahibin öz məhsulları, satışları və hesabatları
- Məlumatların tam təcrid olunması
- Owner ID ilə bütün sorğuların filtrlənməsi

### Rollar və İcazələr

- **SUPER_OWNER**: Tam nəzarət (Zaur & Adalat)
- **OWNER**: Məhsul və qiymət idarəetməsi
- **EMPLOYEE**: Satış yaratma (maya dəyərini görmür)

### Modullar

- **Satış**: Nağd/Nisyə satışlar, minimum qiymət qorunması
- **Anbar**: Əsas və filial anbarları, mal girişi, transfer
- **Müştərilər**: Fiziki, hüquqi, usta tipləri
- **Debitorlar**: Nisyə satışlar, ödəniş izləmə
- **Vendorlar**: Təchizatçı idarəetməsi
- **Kreditorlar**: Vendor borcları
- **Xərclər**: Kateqoriya əsaslı xərc izləmə
- **Hesabatlar**: Satış, anbar, mənfəət/zərər

## Quraşdırma

### Backend

```bash
cd backend
npm install
```

`.env` faylı yaradın:

```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb+srv://frtlpenahpenahli_db_user:PenahPenahli@alfatherm.4xdi58s.mongodb.net/alfaterm
JWT_SECRET=alfaterm_super_secret_key_2024_production_ready
JWT_EXPIRE=7d
```

İlkin məlumatları yükləyin:

```bash
node utils/seed.js
```

Serveri işə salın:

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend `http://localhost:3000` ünvanında, Backend `http://localhost:5001` ünvanında işləyəcək.

## Test İstifadəçiləri

| Email               | Şifrə  | Rol         | Owner  |
| ------------------- | ------ | ----------- | ------ |
| zaur@alfaterm.az    | 123456 | SUPER_OWNER | Zaur   |
| adalat@alfaterm.az  | 123456 | SUPER_OWNER | Adalat |
| satici1@alfaterm.az | 123456 | EMPLOYEE    | Zaur   |
| satici2@alfaterm.az | 123456 | EMPLOYEE    | Adalat |

## API Endpoints

### Auth

- `POST /api/auth/register` - Qeydiyyat
- `POST /api/auth/login` - Giriş
- `GET /api/auth/profile` - Profil

### Products

- `GET /api/products` - Bütün məhsullar
- `POST /api/products` - Yeni məhsul (Owner)
- `PUT /api/products/:id` - Redaktə (Owner)
- `DELETE /api/products/:id` - Silmə (Owner)

### Sales

- `GET /api/sales` - Bütün satışlar
- `POST /api/sales` - Yeni satış
- `GET /api/sales/:id` - Satış detalları
- `PUT /api/sales/:id/cancel` - Ləğv etmə (Owner)

### Inventory

- `GET /api/inventory` - Bütün stok
- `GET /api/inventory/warehouse/:id` - Anbar stoku
- `POST /api/inventory/entry` - Mal girişi (Owner)
- `POST /api/inventory/transfer` - Transfer

### Customers

- `GET /api/customers` - Müştərilər
- `POST /api/customers` - Yeni müştəri
- `PUT /api/customers/:id` - Redaktə
- `DELETE /api/customers/:id` - Silmə

### Debtors

- `GET /api/debtors` - Debitorlar
- `POST /api/debtors/:id/payment` - Ödəniş

### Vendors

- `GET /api/vendors` - Vendorlar
- `POST /api/vendors` - Yeni vendor (Owner)

### Creditors

- `GET /api/creditors` - Kreditorlar
- `POST /api/creditors` - Yeni borc (Owner)
- `POST /api/creditors/:id/payment` - Ödəniş

### Expenses

- `GET /api/expenses` - Xərclər
- `POST /api/expenses` - Yeni xərc

### Reports

- `GET /api/reports/dashboard` - Dashboard
- `GET /api/reports/sales` - Satış hesabatı
- `GET /api/reports/products` - Məhsul hesabatı
- `GET /api/reports/inventory` - Anbar hesabatı
- `GET /api/reports/profit-loss` - Mənfəət/Zərər (Owner)

## Biznes Qaydaları

### Qiymət Qorunması

- İşçilər minimum qiymətdən aşağı satış edə bilməz
- Backend tərəfindən ciddi şəkildə yoxlanılır

### Maya Dəyəri Gizliliyi

- Yalnız Owner və Super Owner görə bilər
- API cavablarından avtomatik silinir

### Əsas Anbar

- Yalnız Super Owner-lər daxil ola bilər
- Transfer və mal girişi məhdudlaşdırılıb

### VÖEN Unikalıq

- Hüquqi şəxslər üçün VÖEN unikal olmalıdır
- Sistemdə dublikat VÖEN qəbul edilmir

## Folder Strukturu

```
alfaterm/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── validators/
│   ├── utils/
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   └── index.html
└── README.md
```

## Lisenziya

Bu layihə Alfaterm şirkəti üçün hazırlanmışdır.
