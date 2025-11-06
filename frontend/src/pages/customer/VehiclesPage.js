import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { customerAPI } from '../../services/api';

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    battery_capacity: '',
    current_mileage: 0,
    license_plate: '',
    purchase_date: ''
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const response = await customerAPI.getVehicles();
      setVehicles(response.data || []);
    } catch (error) {
      // Vehicles API not ready - showing empty list
      setVehicles([]); // Set empty array as fallback
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await customerAPI.createVehicle(formData);
      alert('Thêm xe thành công!');
      setShowForm(false);
      setFormData({
        vin: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        battery_capacity: '',
        current_mileage: 0,
        license_plate: '',
        purchase_date: ''
      });
      loadVehicles();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.detail || 'Không thể thêm xe'));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc muốn xóa xe này?')) {
      try {
        await customerAPI.deleteVehicle(id);
        alert('Đã xóa xe');
        loadVehicles();
      } catch (error) {
        alert('Lỗi: ' + (error.response?.data?.detail || 'Không thể xóa xe'));
      }
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      
      <div className="container">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', marginBottom: '2rem'}}>
          <h1>Xe của tôi</h1>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? 'Hủy' : '+ Thêm xe mới'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{marginBottom: '2rem'}}>
            <h2>Thêm xe mới</h2>
            <form onSubmit={handleSubmit}>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="form-group">
                  <label>Số VIN *</label>
                  <input
                    type="text"
                    name="vin"
                    className="form-control"
                    value={formData.vin}
                    onChange={handleChange}
                    required
                    maxLength="17"
                  />
                </div>

                <div className="form-group">
                  <label>Biển số xe</label>
                  <input
                    type="text"
                    name="license_plate"
                    className="form-control"
                    value={formData.license_plate}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Hãng xe *</label>
                  <input
                    type="text"
                    name="make"
                    className="form-control"
                    value={formData.make}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Model *</label>
                  <input
                    type="text"
                    name="model"
                    className="form-control"
                    value={formData.model}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Năm sản xuất *</label>
                  <input
                    type="number"
                    name="year"
                    className="form-control"
                    value={formData.year}
                    onChange={handleChange}
                    required
                    min="2000"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                <div className="form-group">
                  <label>Màu sắc</label>
                  <input
                    type="text"
                    name="color"
                    className="form-control"
                    value={formData.color}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Dung lượng pin (kWh)</label>
                  <input
                    type="number"
                    name="battery_capacity"
                    className="form-control"
                    value={formData.battery_capacity}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Số km hiện tại</label>
                  <input
                    type="number"
                    name="current_mileage"
                    className="form-control"
                    value={formData.current_mileage}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Ngày mua</label>
                  <input
                    type="date"
                    name="purchase_date"
                    className="form-control"
                    value={formData.purchase_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>
                Thêm xe
              </button>
            </form>
          </div>
        )}

        {vehicles.length === 0 ? (
          <div className="card" style={{textAlign: 'center', padding: '3rem'}}>
            <p style={{fontSize: '1.2rem', color: '#666'}}>
              Bạn chưa thêm xe nào. Nhấn "Thêm xe mới" để bắt đầu.
            </p>
          </div>
        ) : (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem'}}>
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="card">
                <div style={{background: '#f8f9fa', padding: '1rem', margin: '-1.5rem -1.5rem 1rem', borderRadius: '8px 8px 0 0'}}>
                  <h3 style={{margin: 0}}>{vehicle.make} {vehicle.model}</h3>
                  <p style={{margin: '0.5rem 0 0', color: '#666'}}>{vehicle.year}</p>
                </div>

                <div style={{marginBottom: '0.5rem'}}>
                  <strong>VIN:</strong> {vehicle.vin}
                </div>
                <div style={{marginBottom: '0.5rem'}}>
                  <strong>Biển số:</strong> {vehicle.license_plate || 'Chưa có'}
                </div>
                <div style={{marginBottom: '0.5rem'}}>
                  <strong>Màu:</strong> {vehicle.color || 'Chưa rõ'}
                </div>
                <div style={{marginBottom: '0.5rem'}}>
                  <strong>Số km:</strong> {vehicle.current_mileage?.toLocaleString('vi-VN')} km
                </div>
                {vehicle.battery_capacity && (
                  <div style={{marginBottom: '0.5rem'}}>
                    <strong>Pin:</strong> {vehicle.battery_capacity} kWh
                  </div>
                )}

                <div style={{marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.5rem'}}>
                  <button onClick={() => handleDelete(vehicle.id)} className="btn btn-danger" style={{flex: 1}}>
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehiclesPage;
