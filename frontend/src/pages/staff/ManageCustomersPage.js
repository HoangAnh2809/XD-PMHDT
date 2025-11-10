import React, { useState, useEffect } from 'react';
import StaffLayout from '../../components/StaffLayout';
import { staffAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function ManageCustomersPage() {
  const { user } = useAuth();
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadCustomers();
  }, [searchTerm, currentPage]);

  useEffect(() => {
    // Reset to page 1 when search term changes
    if (searchTerm) {
      setCurrentPage(1);
    }
  }, [searchTerm]);

  const loadCustomers = async () => {
    setLoading(true);
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
      console.warn('Skipping getCustomers API call: insufficient role', user?.role);
      setMessage({ type: 'warning', text: 'Bạn không có quyền xem danh sách khách hàng.' });
      setFilteredCustomers([]);
      setLoading(false);
      return;
    }
    try {
      const params = {
        page: currentPage,
        page_size: pageSize
      };
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await staffAPI.getCustomers(searchTerm);
      setFilteredCustomers(response.data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setMessage({ type: 'error', text: 'Không thể tải danh sách khách hàng' });
      setFilteredCustomers([]);
    }
    setLoading(false);
  };

  const viewCustomerDetails = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
    
    // Load service history
    try {
      const historyResponse = await staffAPI.getCustomerServiceHistory(customer.id);
      setServiceHistory(historyResponse.data);
    } catch (error) {
      console.error('Error loading service history:', error);
    }
  };

  const viewCustomerVehicles = async (customer) => {
    setSelectedCustomer(customer);
    
    try {
      const vehiclesResponse = await staffAPI.getCustomerVehicles(customer.id);
      setCustomerVehicles(vehiclesResponse.data);
      setShowVehicleModal(true);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      setMessage({ type: 'error', text: 'Không thể tải danh sách xe' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: 'Chờ xác nhận', class: 'badge-pending' },
      'confirmed': { label: 'Đã xác nhận', class: 'badge-confirmed' },
      'in_progress': { label: 'Đang thực hiện', class: 'badge-in-progress' },
      'completed': { label: 'Hoàn thành', class: 'badge-completed' },
      'cancelled': { label: 'Đã hủy', class: 'badge-cancelled' }
    };
    const statusInfo = statusMap[status] || { label: status, class: 'badge-pending' };
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  if (loading) {
    return (
      <StaffLayout>
        <div className="loading">Đang tải dữ liệu...</div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="container">
        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}

        {/* Search and Filter */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="search-bar">
            <input
              type="text"
              placeholder="🔍 Tìm kiếm theo tên, email, SĐT, biển số xe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{ maxWidth: '500px' }}
            />
            <div className="search-stats">
              Hiển thị <strong>{filteredCustomers.length}</strong> khách hàng
              {searchTerm && <button onClick={() => setSearchTerm('')} className="btn btn-sm btn-outline" style={{ marginLeft: '1rem' }}>✕ Xóa tìm kiếm</button>}
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="card">
          <div className="card-header">
            <h2>Danh sách khách hàng ({filteredCustomers.length})</h2>
          </div>

          {filteredCustomers.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.2rem', color: '#666' }}>
                {searchTerm ? '🔍 Không tìm thấy khách hàng nào' : '📭 Chưa có khách hàng'}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Số xe</th>
                    <th>Ngày đăng ký</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <strong>{customer.full_name || customer.username}</strong>
                      </td>
                      <td>{customer.email || 'N/A'}</td>
                      <td>{customer.phone || 'N/A'}</td>
                      <td>
                        <span className="badge badge-info">{customer.vehicle_count || 0} xe</span>
                      </td>
                      <td>{formatDate(customer.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => viewCustomerDetails(customer)}
                            className="btn btn-sm btn-primary"
                            title="Xem chi tiết"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => viewCustomerVehicles(customer)}
                            className="btn btn-sm btn-secondary"
                            title="Xem xe"
                          >
                            🚗
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

        {/* Customer Detail Modal */}
        {showDetailModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            
            <div className="modal-header">
              <h2>👤 Thông tin khách hàng</h2>
            </div>
            
            <div className="modal-body">
              {/* Customer Info */}
              <div className="detail-section">
                <h3>Thông tin cá nhân</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Mã KH:</span>
                    <span className="info-value">#{selectedCustomer.id}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Họ tên:</span>
                    <span className="info-value">{selectedCustomer.full_name || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Email:</span>
                    <span className="info-value">{selectedCustomer.email || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Số điện thoại:</span>
                    <span className="info-value">{selectedCustomer.phone || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Địa chỉ:</span>
                    <span className="info-value">{selectedCustomer.address || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Ngày đăng ký:</span>
                    <span className="info-value">{formatDate(selectedCustomer.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Service History */}
              <div className="detail-section">
                <h3>Lịch sử dịch vụ ({serviceHistory.length})</h3>
                
                {serviceHistory.length === 0 ? (
                  <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                    Chưa có lịch sử dịch vụ
                  </p>
                ) : (
                  <div className="service-history-list">
                    {serviceHistory.slice(0, 5).map((service, index) => (
                      <div key={index} className="history-item-compact">
                        <div className="history-info">
                          <strong>{service.service_type?.name || 'Dịch vụ'}</strong>
                          <span className="history-date">
                            {formatDate(service.scheduled_date)}
                          </span>
                        </div>
                        {getStatusBadge(service.status)}
                      </div>
                    ))}
                    {serviceHistory.length > 5 && (
                      <p style={{ textAlign: 'center', color: '#666', marginTop: '1rem' }}>
                        ... và {serviceHistory.length - 5} dịch vụ khác
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button onClick={() => viewCustomerVehicles(selectedCustomer)} className="btn btn-primary">
                  🚗 Xem danh sách xe
                </button>
                <button onClick={() => setShowDetailModal(false)} className="btn btn-outline">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles Modal */}
      {showVehicleModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowVehicleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowVehicleModal(false)}>✕</button>
            
            <div className="modal-header">
              <h2>🚗 Danh sách xe của {selectedCustomer.full_name}</h2>
            </div>
            
            <div className="modal-body">
              {customerVehicles.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  Khách hàng chưa đăng ký xe nào
                </p>
              ) : (
                <div className="vehicles-grid">
                  {customerVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="vehicle-card">
                      <div className="vehicle-header">
                        <h4>{vehicle.make} {vehicle.model}</h4>
                        <span className="vehicle-plate">{vehicle.license_plate}</span>
                      </div>
                      <div className="vehicle-details">
                        <p><strong>VIN:</strong> {vehicle.vin || 'N/A'}</p>
                        <p><strong>Năm:</strong> {vehicle.year}</p>
                        <p><strong>Màu:</strong> {vehicle.color || 'N/A'}</p>
                        <p><strong>Số km:</strong> {vehicle.mileage ? `${parseInt(vehicle.mileage).toLocaleString()} km` : 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </StaffLayout>
  );
}
