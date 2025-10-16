#  Hệ thống Quản lý Bảo dưỡng Xe Điện (EV Maintenance Management System)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2+-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Container-Docker-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Hệ thống microservice cho trung tâm bảo dưỡng xe điện: quản lý khách hàng/xe, lịch hẹn, kho phụ tùng, nhân sự, thanh toán, thông báo, và cổng API hợp nhất.

##  Mục lục

- [Lưu ý bảo mật](#️-lưu-ý-bảo-mật-dev-vs-prod)
- [Thành phần hệ thống](#-thành-phần-hệ-thống)
- [Công nghệ chính](#-công-nghệ-chính)
- [Chức năng nổi bật](#-chức-năng-nổi-bật)
- [Khởi chạy nhanh](#-khởi-chạy-nhanh-docker)
- [Biến môi trường](#-biến-môi-trường-quan-trọng-trích-trong-docker-compose)
- [API Gateway](#-tuyến-api-gateway-chuẩn-hoá-frontend--gateway)
- [API Documentation](#-api-documentation-chi-tiết)
- [Database Schema](#-database-schema)
- [Kiểm thử](#-kiểm-thử-nhanh-api-powershell)
- [Frontend Integration](#️-ghi-chú-tích-hợp-frontend)
- [Monitoring & Performance](#-monitoring--performance)
- [Xử lý sự cố](#-xử-lý-sự-cố-troubleshooting)
- [Bảo mật](#-bảo-mật-tóm-tắt)
- [Triển khai Production](#-triển-khai-production-gợi-ý)
- [Đóng góp](#-đóng-góp)

##  Lưu ý bảo mật (dev vs prod)

- File `docker-compose.yml` chứa thông tin mặc định cho môi trường development. Không dùng trực tiếp cho production.
- Trước khi triển khai production, hãy thay đổi ngay: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_*`, tất cả `SECRET_KEY`, khóa thanh toán (VNPay/Momo), SMTP.
- Sử dụng `.env` để quản lý biến môi trường nhạy cảm. Ví dụ: `OPENAI_API_KEY`, thông tin SMTP, thanh toán.


##  Thành phần hệ thống

- API Gateway (FastAPI, cổng 8000): xác thực, định tuyến tới các dịch vụ con (/customer, /service-center, /payment, /chat, /notification, /admin)
- Customer Service (8001): khách hàng, xe, lịch sử bảo dưỡng, đặt lịch
- Service Center (8002): lịch hẹn, kỹ thuật viên, kho phụ tùng, báo cáo
- Chat Service (8003): chat realtime và AI trợ lý (tùy chọn OPENAI_API_KEY)
- Notification Service (8004): email/thông báo
- Payment Service (8005): hóa đơn, tích hợp thanh toán (VNPay/Momo)
- Admin Service (8007): backend cho trang quản trị
- PostgreSQL (5432), Redis (6379), pgAdmin (5050)

Sơ đồ (rút gọn):

Frontend (3000) → API Gateway (8000) → { customer(8001), service-center(8002), chat(8003), notification(8004), payment(8005), admin(8007) } → PostgreSQL/Redis


## 🧰 Công nghệ chính

Backend: FastAPI, SQLAlchemy, Pydantic, JWT, Redis, PostgreSQL
Frontend: React 18, React Router, Axios
DevOps: Docker, Docker Compose, pgAdmin


## ✨ Chức năng nổi bật

- Đăng ký/Đăng nhập, phân quyền (customer, staff, technician, admin)
- Quản lý xe, đặt lịch bảo dưỡng, theo dõi lịch sử
- Quản lý kho phụ tùng, tồn kho thấp, điều chỉnh tồn
- Phân công kỹ thuật viên, quản lý lịch làm việc
- Hóa đơn, thanh toán VNPay/Momo (mock/real tùy cấu hình)
- Thông báo email, nhắc lịch
- Trang quản trị (Admin) với thống kê, CRUD người dùng/chi nhánh/dịch vụ


## ⚡ Khởi chạy nhanh (Docker)

Yêu cầu: Docker Desktop, Docker Compose, RAM ≥ 8GB

1) Clone code và vào thư mục dự án

```powershell
# (Ví dụ) Đã ở D:\api
Get-ChildItem
```

2) Khởi động toàn bộ dịch vụ

```powershell
docker-compose up -d
```

3) Truy cập

- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- pgAdmin: http://localhost:5050

4) Tạo tài khoản admin nhanh (nếu chưa có) – đã kèm script trong quá trình trước, hoặc dùng luồng đăng ký qua API Gateway.


## 🔑 Biến môi trường quan trọng (trích trong docker-compose)

- Cấp dịch vụ chung:
  - `DATABASE_URL=postgresql://evadmin:evadmin123@postgres:5432/ev_maintenance`
  - `REDIS_URL=redis://redis:6379`
  - `SECRET_KEY=your-secret-key-change-in-production`
- Gateway định tuyến:
  - `CUSTOMER_SERVICE_URL=http://customer_service:8001`
  - `SERVICE_CENTER_URL=http://service_center:8002`
  - `CHAT_SERVICE_URL=http://chat_service:8003`
  - `NOTIFICATION_SERVICE_URL=http://notification_service:8004`
  - `PAYMENT_SERVICE_URL=http://payment_service:8005`
  - `ADMIN_SERVICE_URL=http://admin_service:8007`
- Frontend:
  - `REACT_APP_API_URL=http://localhost:8000` (sử dụng API Gateway)
  - (Đã bỏ dùng direct `REACT_APP_ADMIN_API_URL` — Admin đi qua Gateway `/admin/*`)
- Chat Service:
  - `OPENAI_API_KEY` (tùy chọn)
- Notification:
  - SMTP_HOST/PORT/USER/PASSWORD
- Payment:
  - VNPay: `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`
  - Momo: `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`


## 🔀 Tuyến API Gateway (chuẩn hoá frontend → gateway)

Frontend gọi qua `REACT_APP_API_URL` (mặc định http://localhost:8000). Các tiền tố:

- `/auth/*` → Gateway xử lý (đăng ký, đăng nhập, /auth/me)
- `/customer/*` → Customer Service
- `/service-center/*` → Service Center Service
- `/payment/*` → Payment Service
- `/chat/*` → Chat Service
- `/notification/*` → Notification Service
- `/admin/*` → Admin Service (proxy đến `/api/admin/*` phía sau)

Ví dụ: `/admin/users` trên Gateway → `http://admin_service:8007/api/admin/users`


## API Documentation chi tiết

### Authentication Endpoints

#### POST /auth/register
Đăng ký tài khoản mới
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Nguyễn Văn A",
  "phone": "0912345678",
  "role": "customer"  // customer | staff | technician | admin
}
```

#### POST /auth/login-json
Đăng nhập
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "role": "customer",
  "user_id": "uuid-here"
}
```

#### GET /auth/me
Lấy thông tin user hiện tại (yêu cầu Bearer token)

### Customer Service Endpoints

#### GET /customer/vehicles
Lấy danh sách xe của khách hàng

#### POST /customer/vehicles  
Thêm xe mới
```json
{
  "vin": "1HGBH41JXMN109186",
  "make": "Tesla",
  "model": "Model 3", 
  "year": 2023,
  "color": "Trắng",
  "battery_capacity": 75,
  "current_mileage": 5000,
  "license_plate": "30A-12345"
}
```

#### GET /customer/appointments
Lấy lịch hẹn của khách hàng

#### POST /customer/appointments
Đặt lịch bảo dưỡng
```json
{
  "vehicle_id": "uuid",
  "service_center_id": "uuid", 
  "service_type_id": "uuid",
  "appointment_date": "2024-01-15T10:00:00",
  "customer_notes": "Xe có tiếng động bất thường"
}
```

### Service Center Endpoints

#### GET /service-center/appointments
Lấy tất cả lịch hẹn (Staff/Admin)
Parameters:
- `status`: pending | confirmed | in_progress | completed | cancelled
- `date_from`: YYYY-MM-DD
- `date_to`: YYYY-MM-DD
- `technician_id`: uuid

#### PUT /service-center/appointments/{id}/status
Cập nhật trạng thái lịch hẹn
```json
{
  "status": "confirmed",
  "technician_id": "uuid",
  "staff_notes": "Đã xác nhận và phân công kỹ thuật viên"
}
```

#### GET /service-center/parts
Lấy danh sách phụ tùng
Parameters:
- `low_stock`: true/false
- `category`: string
- `search`: string

#### POST /service-center/parts/{id}/adjust-stock
Điều chỉnh tồn kho
```json
{
  "quantity_change": -5,
  "reason": "Sử dụng cho bảo dưỡng xe Tesla Model 3",
  "appointment_id": "uuid"  // tùy chọn
}
```

### Payment Endpoints

#### POST /payment/invoices
Tạo hóa đơn (Staff/Admin)
```json
{
  "appointment_id": "uuid",
  "customer_id": "uuid",
  "service_center_id": "uuid",
  "subtotal": 2000000,
  "discount": 100000,
  "tax_rate": 0.1,
  "due_date": "2024-01-20",
  "notes": "Bảo dưỡng định kỳ 10,000km"
}
```

#### POST /payment/payments/vnpay/create
Tạo link thanh toán VNPay
```json
{
  "invoice_id": "uuid"
}
```
Response:
```json
{
  "payment_url": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "order_info": "Thanh toan hoa don #INV001"
}
```

### Admin Endpoints

#### GET /admin/users
Lấy danh sách người dùng (Admin)
Parameters:
- `role`: customer | staff | technician | admin
- `is_active`: true/false
- `search`: string

#### POST /admin/users
Tạo người dùng mới (Admin)
```json
{
  "email": "staff@company.com",
  "username": "staff001",
  "full_name": "Nguyễn Văn B",
  "phone": "0987654321",
  "role": "staff",
  "is_active": true,
  "branch_id": "uuid"  // cho staff/technician
}
```

#### GET /admin/stats/dashboard
Thống kê tổng quan (Admin/Staff)
```json
{
  "total_appointments": 150,
  "pending_appointments": 25,
  "completed_today": 8,
  "revenue_this_month": 45000000,
  "low_stock_parts": 12,
  "active_technicians": 15
}
```


## 🗄️ Database Schema

### Core Tables

#### users
- id (UUID, PK)
- email (unique)
- username (unique) 
- password_hash
- full_name
- phone
- role (customer|staff|technician|admin)
- is_active
- created_at, updated_at

#### customers
- id (UUID, PK)
- user_id (FK → users.id)
- date_of_birth
- address
- emergency_contact

#### staff
- id (UUID, PK) 
- user_id (FK → users.id)
- employee_id (unique)
- branch_id (FK → branches.id)
- hire_date
- salary

#### technicians
- id (UUID, PK)
- user_id (FK → users.id) 
- employee_id (unique)
- specialization
- experience_years
- certification_level
- is_available

#### vehicles
- id (UUID, PK)
- customer_id (FK → customers.id)
- vin (unique)
- make, model, year
- color, battery_capacity
- current_mileage
- license_plate

#### appointments
- id (UUID, PK)
- customer_id, vehicle_id, service_center_id
- service_type_id, technician_id
- appointment_date
- status (pending|confirmed|in_progress|completed|cancelled)
- customer_notes, staff_notes
- estimated_duration, actual_duration
- created_at, updated_at

#### parts
- id (UUID, PK)
- name, description, category
- sku (unique)
- current_stock, min_stock_level
- unit_price, supplier_info

#### invoices
- id (UUID, PK)
- appointment_id (FK)
- customer_id (FK)
- subtotal, discount, tax_amount, total_amount
- status (draft|sent|paid|overdue|cancelled)
- due_date, paid_date

### Relationships
- One user → One customer/staff/technician profile
- One customer → Many vehicles → Many appointments
- One appointment → One invoice → Many payments
- Many appointments ↔ Many parts (junction table: appointment_parts)


## Kiểm thử nhanh API (PowerShell)

- Kiểm tra root API Gateway

```powershell
Invoke-WebRequest http://localhost:8000/ | Select-Object -ExpandProperty Content
```

- Đăng nhập JSON

```powershell
$body = @{ email = "admin@evmaintenance.com"; password = "admin123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/auth/login-json -ContentType 'application/json' -Body $body
```

- Lấy danh sách người dùng (admin)

```powershell
$token = 'Bearer <ACCESS_TOKEN>'
Invoke-RestMethod -Headers @{ Authorization=$token } -Uri 'http://localhost:8000/admin/users'
```


## 🛠️ Ghi chú tích hợp Frontend

- Frontend sử dụng `REACT_APP_API_URL` để đi qua Gateway. File `frontend/src/services/adminAPI.js` đã được chỉnh để dùng base URL: `${REACT_APP_API_URL}/admin` cho admin.
- Nếu CRUD trang Nhân sự không hoạt động: kiểm tra token lưu trong localStorage, kiểm tra API gọi tới `http://localhost:8000/admin/*` thay vì `8007`.


## � Monitoring & Performance

### Health Checks

Kiểm tra sức khỏe các dịch vụ:

```powershell
# API Gateway
Invoke-WebRequest http://localhost:8000/ 

# Customer Service
Invoke-WebRequest http://localhost:8001/health

# Service Center
Invoke-WebRequest http://localhost:8002/health

# Payment Service  
Invoke-WebRequest http://localhost:8005/health

# Chat Service
Invoke-WebRequest http://localhost:8003/
```

### Container Resource Usage

```powershell
# Xem resource usage
docker stats --no-stream

# Xem logs real-time
docker-compose logs -f api_gateway

# Kiểm tra container health
docker-compose ps
```

### Database Performance

```powershell
# Kết nối database để kiểm tra
docker exec -it ev_maintenance_db psql -U evadmin -d ev_maintenance
```

SQL queries hữu ích:
```sql
-- Xem số lượng bản ghi các bảng chính
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments 
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles;

-- Appointments trong 7 ngày gần đây
SELECT status, COUNT(*) 
FROM appointments 
WHERE appointment_date >= NOW() - INTERVAL '7 days' 
GROUP BY status;

-- Phụ tùng tồn kho thấp
SELECT name, current_stock, min_stock_level 
FROM parts 
WHERE current_stock <= min_stock_level;
```

### Performance Tips

- Restart containers nếu memory usage cao: `docker-compose restart service_name`
- Tăng RAM cho Docker Desktop nếu cần (Settings > Resources)
- Sử dụng Redis để cache các API calls thường xuyên
- Index database cho các queries phổ biến (appointment_date, vehicle_id, customer_id)
- Compression cho API responses (đã enable trong FastAPI)


## �🐞 Xử lý sự cố (Troubleshooting)

1) Không truy cập được API Gateway

```powershell
docker-compose ps
docker logs ev_api_gateway --tail 100
```

2) Frontend không gọi được API

- Đảm bảo biến `REACT_APP_API_URL` là `http://localhost:8000`
- Rebuild frontend nếu cần:

```powershell
docker-compose up -d --build frontend
```

3) Lỗi 422 khi reset mật khẩu hoặc CRUD

- Xem log Admin Service:

```powershell
docker logs ev_admin_service --tail 200
```

- Kiểm tra payload đúng schema Pydantic theo backend.

4) Database connection issues

```powershell
# Kiểm tra PostgreSQL container
docker logs ev_maintenance_db --tail 100

# Restart database nếu cần
docker-compose restart postgres

# Test connection
docker exec ev_maintenance_db pg_isready -U evadmin
```

5) CORS errors từ frontend

- Kiểm tra CORS settings trong API Gateway
- Đảm bảo frontend gọi đúng `http://localhost:8000`
- Restart API Gateway sau khi thay đổi CORS:

```powershell
docker-compose restart api_gateway
```

6) Port conflicts

```powershell
# Kiểm tra port đang được sử dụng
netstat -ano | findstr :8000

# Thay đổi port trong docker-compose.yml nếu cần
# Ví dụ: "8080:8000" thay vì "8000:8000"
```

7) JWT Token expired

- Token mặc định expire sau 24h
- Frontend tự động redirect về /login khi 401
- Kiểm tra localStorage token:

```javascript
// Trong browser console
console.log(localStorage.getItem('token'));
```

8) Chat service OpenAI errors

- Kiểm tra `OPENAI_API_KEY` được set chưa
- Xem logs:

```powershell
docker logs ev_chat_service --tail 100
```

9) Email notification không gửi được

- Kiểm tra SMTP settings trong docker-compose.yml
- Test với Gmail: cần App Password, không dùng password thường
- Xem logs notification service:

```powershell
docker logs ev_notification_service --tail 100
```

### Debug Tools

- **pgAdmin**: http://localhost:5050 để query database trực tiếp
- **Browser DevTools**: Network tab để xem API requests/responses
- **Container logs**: `docker logs <container_name>` để xem lỗi backend
- **Docker stats**: `docker stats` để monitor resource usage


##  Bảo mật (tóm tắt)

- JWT + role-based access control
- Hash mật khẩu (bcrypt)
- Chống SQL injection qua ORM SQLAlchemy
- CORS cấu hình trong API Gateway
- Xác thực và kiểm tra đầu vào bằng Pydantic



##  Đóng góp

1. Fork repository này
2. Tạo feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add some AmazingFeature'`  
4. Push to branch: `git push origin feature/AmazingFeature` 
5. Tạo Pull Request với mô tả chi tiết

### Development Guidelines

- Follow PEP 8 cho Python code
- Sử dụng TypeScript cho frontend (nếu migrate)
- Viết unit tests cho API endpoints mới
- Update README nếu thêm features mới
- Test trên Docker environment trước khi PR

### Coding Standards

- Backend: FastAPI + SQLAlchemy patterns
- Frontend: React functional components + hooks
- Database: PostgreSQL với proper indexes
- API: RESTful design với proper HTTP status codes
- Security: Always validate input, use parameterized queries


##  Changelog

### v1.0.0 (Current)
-  Complete microservices architecture
-  JWT authentication & RBAC
-  Customer vehicle management
-  Appointment booking system
-  Parts inventory management 
-  Payment integration (VNPay/Momo)
-  Admin dashboard with statistics
-  Real-time chat with AI assistant
-  Email notifications
-  Docker containerization

### Planned Features
-  Mobile app (React Native)
-  Advanced reporting & analytics
-  SMS notifications
-  Multi-language support
-  API rate limiting
-  Automated testing pipeline


##  Project Stats

- **Backend Services**: 7 microservices
- **Database Tables**: 15+ core tables
- **API Endpoints**: 50+ REST endpoints
- **User Roles**: 4 (customer, staff, technician, admin)
- **Payment Methods**: 3 (cash, VNPay, Momo)
- **Container Count**: 11 Docker containers



---

Thông tin nhanh:
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- pgAdmin: http://localhost:5050 (Email: admin@evmaintenance.com / Password: admin123)
- Database host trong pgAdmin: `postgres` (container name), DB: `ev_maintenance`, User: `evadmin`
Thông tin đăng nhập pgAdmin:
Email: admin@evmaintenance.com
Password: admin123

Host name/address: postgres (hoặc ev_maintenance_db)
Port: 5432
Maintenance database: ev_maintenance
Username: evadmin
Password: evadmin123