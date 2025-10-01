 EV Service Center Maintenance Management System

Phần mềm quản lý bảo dưỡng xe điện cho trung tâm dịch vụ
Kiến trúc Microservices | Backend Python | Frontend React | Database Dockerized

🏗 1. Kiến trúc hệ thống (Microservices)

Hệ thống được phát triển theo hướng Microservices, mỗi service đảm nhận 1 nghiệp vụ riêng biệt:

Auth Service → Đăng ký, đăng nhập, phân quyền (JWT, OAuth2).

Customer Service → Quản lý khách hàng & hồ sơ xe.

Booking Service → Đặt lịch dịch vụ, quản lý trạng thái.

Workshop Service → Quản lý quy trình bảo dưỡng & kỹ thuật viên.

Inventory Service → Quản lý phụ tùng EV, gợi ý AI nhu cầu tồn kho.

Payment Service → Quản lý thanh toán (online/offline).

Report Service → Báo cáo tài chính, thống kê dịch vụ.

Notification Service → Email/SMS/Push notification nhắc nhở bảo dưỡng.

Mỗi service chạy độc lập, giao tiếp qua API Gateway và Message Broker (Kafka/RabbitMQ).

👥 2. Phân quyền (Actors & Roles)

Hệ thống có 4 loại người dùng:

👤 Customer

Theo dõi xe & nhắc nhở bảo dưỡng.

Đặt lịch dịch vụ online.

Quản lý lịch sử bảo dưỡng & chi phí.

Thanh toán online (e-wallet, banking).

👨‍💼 Staff

Quản lý hồ sơ khách hàng & xe.

Tiếp nhận yêu cầu dịch vụ.

Quản lý lịch hẹn, hàng chờ.

Ghi nhận tình trạng xe & checklist.

👨‍🔧 Technician

Xem lịch phân công công việc.

Cập nhật tiến độ bảo dưỡng.

Nhập thông tin tình trạng xe sau sửa chữa.

👑 Admin

Quản lý khách hàng, nhân sự, phụ tùng.

Quản lý doanh thu, chi phí, báo cáo.

Theo dõi hiệu suất & phân công kỹ thuật viên.

Quản lý chính sách & gói dịch vụ.

🖥 3. Công nghệ sử dụng
🔹 Backend (Python Microservices)

FastAPI / Django REST Framework → xây dựng API.

SQLAlchemy / Django ORM → ORM cho database.

Celery + Redis → xử lý background tasks (ví dụ: gửi email nhắc nhở).

JWT / OAuth2 → xác thực & phân quyền.

Kafka / RabbitMQ → giao tiếp giữa các service.

🔹 Frontend (React + TypeScript)

React 18 + Vite/CRA → frontend SPA.

Redux Toolkit / Zustand → quản lý state.

React Router DOM → điều hướng trang.

Material UI / TailwindCSS → giao diện hiện đại.

Axios / React Query → gọi API.

🔹 Database (Dockerized)

PostgreSQL → dữ liệu giao dịch, booking, khách hàng.

MongoDB → lưu trữ logs, checklist kỹ thuật.

Redis → cache & session.

Tất cả DB chạy trong Docker Compose.

📂 4. Cấu trúc thư mục (ví dụ)
ev-service-center/
│── backend/
│   ├── auth-service/         # Đăng nhập, phân quyền
│   ├── customer-service/     # Quản lý khách hàng & xe
│   ├── booking-service/      # Quản lý lịch hẹn
│   ├── workshop-service/     # Quản lý bảo dưỡng & kỹ thuật
│   ├── inventory-service/    # Quản lý phụ tùng
│   ├── payment-service/      # Thanh toán
│   ├── report-service/       # Báo cáo & dashboard
│   ├── notification-service/ # Gửi thông báo
│   └── api-gateway/          # Gateway & Load Balancer
│
│── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Giao diện trang
│   │   ├── services/         # Gọi API backend
│   │   ├── hooks/            # Custom hooks
│   │   └── store/            # Redux/Zustand
│
│── database/
│   ├── postgres/             # PostgreSQL schema
│   ├── mongodb/              # MongoDB collections
│   └── docker-compose.yml    # Docker config
│
│── docs/
│   └── README.md

⚡ 5. Luồng hoạt động chính

Customer đăng nhập → chọn dịch vụ → đặt lịch → thanh toán online.

Staff tiếp nhận → phân công Technician → cập nhật tình trạng xe.

Technician thực hiện bảo dưỡng → cập nhật checklist → hoàn tất.

Payment Service xử lý hóa đơn → lưu vào DB.

Notification Service gửi nhắc nhở & kết quả cho khách hàng.

Admin theo dõi dashboard: doanh thu, hiệu suất, phụ tùng, báo cáo.

🐳 6. Cài đặt với Docker
1. Clone project
git clone https://github.com/your-repo/ev-service-center.git
cd ev-service-center

2. Chạy database & services
docker-compose up -d

3. Chạy backend
cd backend/auth-service
uvicorn main:app --reload --port 8001

4. Chạy frontend
cd frontend
npm install
npm start

📊 7. Tính năng mở rộng (Future Work)

AI dự đoán hỏng hóc EV & đề xuất bảo dưỡng.

Mobile App (React Native).

Tích hợp VietQR / Momo / ZaloPay.

Báo cáo BI nâng cao với PowerBI / Metabase.
