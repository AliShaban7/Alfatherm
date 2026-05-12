# Alfaterm - İdarəetmə Sistemi

Santexnik mağazası üçün tam funksional idarəetmə sistemi.

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

### Modullar

- **Satış**: Nağd/Nisyə satışlar, minimum qiymət qorunması
- **Anbar**: Əsas və filial anbarları, mal girişi, transfer
- **Müştərilər**: Fiziki, hüquqi, usta tipləri
- **Debitorlar**: Nisyə satışlar, ödəniş izləmə
- **Vendorlar**: Təchizatçı idarəetməsi
- **Kreditorlar**: Vendor borcları
- **Xərclər**: Kateqoriya əsaslı xərc izləmə
- **Hesabatlar**: Satış, anbar, mənfəət/zərər

## Biznes Qaydaları

### Qiymət Qorunması

- İşçilər minimum qiymətdən aşağı satış edə bilməz
- Backend tərəfindən ciddi şəkildə yoxlanılır

### Maya Dəyəri Gizliliyi

- Yalnız Owner və Super Owner görə bilər
- API cavablarından avtomatik silinir

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
