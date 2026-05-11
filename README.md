# Alfaterm - İdarəetmə Sistemi

Santexnik mağazası üçün tam funksional idarəetmə sistemi.

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

### Əsas Anbar

- Yalnız Super Owner-lər daxil ola bilər
- Transfer və mal girişi məhdudlaşdırılıb

### VÖEN Unikalıq

- Hüquqi şəxslər üçün VÖEN unikal olmalıdır
- Sistemdə dublikat VÖEN qəbul edilmir

## Lisenziya

Bu layihə Alfaterm şirkəti üçün hazırlanmışdır.
