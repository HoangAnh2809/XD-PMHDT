import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import { staffAPI } from '../../services/api';

export default function ChecklistPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadChecklist();
  }, [appointmentId]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const response = await staffAPI.getAppointmentChecklist(appointmentId);
      setChecklist(response.data);
    } catch (error) {
      console.error('Error loading checklist:', error);
      if (error.response?.status === 404) {
        setMessage({ 
          type: 'error', 
          text: 'Không tìm thấy checklist cho lịch hẹn này. Có thể dịch vụ chưa có checklist.' 
        });
      } else {
        setMessage({ type: 'error', text: 'Không thể tải checklist' });
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = async (itemId, currentStatus, notes = '') => {
    try {
      setSaving(true);
      await staffAPI.updateChecklistItem(appointmentId, itemId, {
        is_completed: !currentStatus,
        notes: notes || null
      });
      
      // Reload checklist to get updated data
      await loadChecklist();
      
      setMessage({ 
        type: 'success', 
        text: !currentStatus ? '✅ Đã đánh dấu hoàn thành' : '⏸️ Đã bỏ đánh dấu' 
      });
      
      // Clear message after 2 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } catch (error) {
      console.error('Error updating checklist item:', error);
      setMessage({ type: 'error', text: 'Không thể cập nhật checklist item' });
    } finally {
      setSaving(false);
    }
  };

  const handleNotesChange = async (itemId, currentStatus, notes) => {
    try {
      await staffAPI.updateChecklistItem(appointmentId, itemId, {
        is_completed: currentStatus,
        notes: notes
      });
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage < 30) return '#dc3545'; // red
    if (percentage < 70) return '#ffc107'; // yellow
    return '#28a745'; // green
  };

  if (loading) {
    return (
      <StaffLayout>
        <div className="loading">Đang tải checklist...</div>
      </StaffLayout>
    );
  }

  if (!checklist) {
    return (
      <StaffLayout>
        <div className="container">
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '3rem' }}>
              <h2>⚠️ Không tìm thấy checklist</h2>
              <p>{message.text || 'Dịch vụ này chưa có checklist được cấu hình.'}</p>
              <button onClick={() => navigate('/staff/appointments')} className="btn btn-primary">
                ← Quay lại danh sách lịch hẹn
              </button>
            </div>
          </div>
        </div>
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

        {/* Header with Progress */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>📋 {checklist.checklist_name}</h2>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
                  Lịch hẹn #{appointmentId.slice(0, 8)}
                </p>
              </div>
              <button onClick={() => navigate('/staff/appointments')} className="btn btn-outline">
                ← Quay lại
              </button>
            </div>
          </div>
          
          <div className="card-body">
            {/* Progress Bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.5rem'
              }}>
                <span style={{ fontWeight: 'bold' }}>Tiến độ hoàn thành</span>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: getProgressColor(checklist.progress_percentage)
                }}>
                  {checklist.progress_percentage}%
                </span>
              </div>
              <div style={{ 
                width: '100%', 
                height: '30px', 
                backgroundColor: '#e9ecef', 
                borderRadius: '15px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${checklist.progress_percentage}%`, 
                  height: '100%', 
                  backgroundColor: getProgressColor(checklist.progress_percentage),
                  transition: 'width 0.3s ease',
                  borderRadius: '15px'
                }}></div>
              </div>
              <p style={{ marginTop: '0.5rem', color: '#666', textAlign: 'center' }}>
                {checklist.completed_items} / {checklist.total_items} mục đã hoàn thành
              </p>
            </div>
          </div>
        </div>

        {/* Checklist Items by Category */}
        {checklist.categories.map((category, catIndex) => (
          <div key={catIndex} className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                🔧 {category.category}
              </h3>
            </div>
            
            <div className="card-body">
              <div className="checklist-items">
                {category.items.map((item, itemIndex) => (
                  <div 
                    key={itemIndex} 
                    className={`checklist-item ${item.is_completed ? 'completed' : ''}`}
                    style={{
                      padding: '1rem',
                      borderBottom: itemIndex < category.items.length - 1 ? '1px solid #e9ecef' : 'none',
                      backgroundColor: item.is_completed ? '#f0f9ff' : 'transparent',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={() => toggleChecklistItem(item.id, item.is_completed, item.notes)}
                        disabled={saving}
                        style={{
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          marginTop: '0.2rem',
                          accentColor: '#667eea'
                        }}
                      />
                      
                      {/* Item Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          <strong style={{ 
                            fontSize: '1.1rem',
                            textDecoration: item.is_completed ? 'line-through' : 'none',
                            color: item.is_completed ? '#6c757d' : '#212529'
                          }}>
                            {item.item_name}
                          </strong>
                          {item.is_required && (
                            <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                              Bắt buộc
                            </span>
                          )}
                          {item.is_completed && (
                            <span style={{ color: '#28a745', fontSize: '1.2rem' }}>✓</span>
                          )}
                        </div>
                        
                        {item.description && (
                          <p style={{ 
                            margin: '0 0 0.5rem 0', 
                            color: '#6c757d',
                            fontSize: '0.9rem'
                          }}>
                            {item.description}
                          </p>
                        )}
                        
                        {/* Notes Input */}
                        <div style={{ marginTop: '0.5rem' }}>
                          <textarea
                            placeholder="Ghi chú (tùy chọn)..."
                            value={item.notes || ''}
                            onChange={(e) => handleNotesChange(item.id, item.is_completed, e.target.value)}
                            className="form-control"
                            rows={2}
                            style={{ 
                              fontSize: '0.9rem',
                              backgroundColor: '#f8f9fa'
                            }}
                          />
                        </div>
                        
                        {/* Completed Info */}
                        {item.completed_at && (
                          <div style={{ 
                            marginTop: '0.5rem', 
                            fontSize: '0.85rem', 
                            color: '#6c757d',
                            fontStyle: 'italic'
                          }}>
                            ✓ Hoàn thành lúc {new Date(item.completed_at).toLocaleString('vi-VN')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Summary Card */}
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            {checklist.progress_percentage === 100 ? (
              <div>
                <h3 style={{ color: '#28a745' }}>🎉 Checklist đã hoàn thành!</h3>
                <p style={{ color: '#6c757d' }}>
                  Tất cả {checklist.total_items} mục đã được kiểm tra và hoàn thành.
                </p>
              </div>
            ) : (
              <div>
                <h3 style={{ color: '#ffc107' }}>⏳ Đang thực hiện</h3>
                <p style={{ color: '#6c757d' }}>
                  Còn {checklist.total_items - checklist.completed_items} mục cần hoàn thành.
                </p>
              </div>
            )}
            <button 
              onClick={() => navigate('/staff/appointments')} 
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
            >
              Quay lại danh sách lịch hẹn
            </button>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
