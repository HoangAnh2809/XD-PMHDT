import React, { useState, useEffect } from 'react';
import { technicianAPI } from '../../services/api';

const TechnicianSchedulePage = () => {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(0);

  useEffect(() => {
    loadSchedule();
  }, [currentWeek]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const response = await technicianAPI.getSchedule(currentWeek);
      // Backend returns { week_start, week_end, appointments }
      const appointments = response.appointments || [];
      setSchedule(appointments);
    } catch (error) {
      console.error('Error loading schedule:', error);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return '#28a745';
    if (status === 'in_progress') return '#ffc107';
    if (status === 'pending') return '#17a2b8';
    if (status === 'cancelled') return '#dc3545';
    return '#6c757d';
  };

  const getStatusName = (status) => {
    if (status === 'completed') return '✅ Hoàn thành';
    if (status === 'in_progress') return '⏳ Đang thực hiện';
    if (status === 'pending') return '📋 Chờ xử lý';
    if (status === 'cancelled') return '❌ Đã hủy';
    return 'Không xác định';
  };

  return (
    <div className="container" style={{marginTop: '2rem'}}>
        <div className="page-header">
          <h1>📅 Lịch làm việc</h1>
          <p>Xem lịch ca làm việc của bạn</p>
        </div>

        {/* Week Navigation */}
        <div className="card" style={{marginBottom: '1.5rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <button className="btn btn-secondary" onClick={() => setCurrentWeek(currentWeek - 1)}>
              ← Tuần trước
            </button>
            <h3>
              {currentWeek === 0 ? 'Tuần này' : currentWeek > 0 ? `Tuần sau ${currentWeek}` : `${Math.abs(currentWeek)} tuần trước`}
            </h3>
            <button className="btn btn-secondary" onClick={() => setCurrentWeek(currentWeek + 1)}>
              Tuần sau →
            </button>
          </div>
        </div>

        {/* Schedule Calendar */}
        <div className="card">
          {loading ? (
            <div style={{textAlign: 'center', padding: '3rem'}}>
              <div className="spinner"></div>
              <p>Đang tải lịch...</p>
            </div>
          ) : schedule.length === 0 ? (
            <div style={{textAlign: 'center', padding: '3rem', color: '#666'}}>
              <p style={{fontSize: '1.2rem'}}>📅 Không có lịch hẹn nào trong tuần này</p>
            </div>
          ) : (
            <div className="schedule-grid" style={{display: 'grid', gap: '1rem'}}>
              {schedule.map((appointment, index) => (
                <div key={appointment.id || index} style={{
                  padding: '1.5rem',
                  background: '#fff',
                  border: '2px solid',
                  borderColor: getStatusColor(appointment.status),
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem'}}>
                    <div>
                      <h3 style={{margin: 0, color: '#333'}}>{appointment.date}</h3>
                      <div style={{fontSize: '1.1rem', color: '#666', marginTop: '0.25rem'}}>
                        🕐 {appointment.time}
                      </div>
                    </div>
                    <div style={{
                      padding: '0.5rem 1rem',
                      background: getStatusColor(appointment.status),
                      color: 'white',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      {getStatusName(appointment.status)}
                    </div>
                  </div>

                  <div style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '6px',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{marginBottom: '0.5rem'}}>
                      <strong>👤 Khách hàng:</strong> {appointment.customer_name}
                    </div>
                    <div style={{marginBottom: '0.5rem'}}>
                      <strong>� Xe:</strong> {appointment.vehicle}
                    </div>
                    <div>
                      <strong>🔧 Dịch vụ:</strong> {appointment.service_type}
                    </div>
                  </div>

                  {appointment.estimated_duration && (
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      ⏱️ Thời gian dự kiến: {appointment.estimated_duration} phút
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="card" style={{marginTop: '1.5rem'}}>
          <h3>Chú thích trạng thái</h3>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <div style={{width: '24px', height: '24px', background: '#17a2b8', borderRadius: '4px'}}></div>
              <span>📋 Chờ xử lý</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <div style={{width: '24px', height: '24px', background: '#ffc107', borderRadius: '4px'}}></div>
              <span>⏳ Đang thực hiện</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <div style={{width: '24px', height: '24px', background: '#28a745', borderRadius: '4px'}}></div>
              <span>✅ Hoàn thành</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <div style={{width: '24px', height: '24px', background: '#dc3545', borderRadius: '4px'}}></div>
              <span>❌ Đã hủy</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicianSchedulePage;