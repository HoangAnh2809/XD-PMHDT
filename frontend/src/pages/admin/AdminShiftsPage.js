import React, { useState, useEffect, useCallback } from 'react';
import { shiftAPI, branchAPI, userAPI } from '../../services/adminAPI';
import './AdminPages.css';

const AdminShiftsPage = () => {
  const [shifts, setShifts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterTechnician, setFilterTechnician] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'calendar'
  const [calendarData, setCalendarData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadShifts = useCallback(async () => {
    try {
      setLoading(true);

      // Build query params
      const params = {};
      if (filterBranch !== 'all') {
        params.service_center_id = filterBranch;
      }
      if (filterTechnician !== 'all') {
        params.technician_id = filterTechnician;
      }
      if (filterDate) {
        params.shift_date = filterDate;
      }

      const response = await shiftAPI.getAll(params);
      setShifts(response.data || []);
    } catch (error) {
      console.error('Error loading shifts:', error);
      alert('Lỗi khi tải danh sách ca làm: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  }, [filterBranch, filterTechnician, filterDate]);

  const loadTechnicians = useCallback(async () => {
    try {
      // Load both technicians and staff
      const [techniciansResponse, staffResponse] = await Promise.all([
        userAPI.getAll({ role: 'technician' }),
        userAPI.getAll({ role: 'staff' })
      ]);

      const techniciansData = (techniciansResponse.data || []).filter(user => user.role === 'technician');
      const staffData = (staffResponse.data || []).filter(user => user.role === 'staff');

      // Combine both arrays
      setTechnicians([...techniciansData, ...staffData]);
    } catch (error) {
      console.error('Error loading technicians and staff:', error);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const response = await branchAPI.getAll();
      setBranches(response.data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  }, []);

  const loadCalendarData = useCallback(async (serviceCenterId, month) => {
    if (!serviceCenterId || serviceCenterId === 'all') return;

    try {
      const response = await shiftAPI.getCalendar(serviceCenterId, month);
      setCalendarData(response.data || {});
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  }, []);

  useEffect(() => {
    loadShifts();
    loadTechnicians();
    loadBranches();
  }, [loadShifts, loadTechnicians, loadBranches]);

  useEffect(() => {
    if (currentView === 'calendar' && filterBranch !== 'all') {
      loadCalendarData(filterBranch, selectedMonth);
    }
  }, [currentView, filterBranch, selectedMonth, loadCalendarData]);

  const handleCreateShift = () => {
    setSelectedShift(null);
    setShowModal(true);
  };

  const handleEditShift = (shift) => {
    setSelectedShift(shift);
    setShowModal(true);
  };

  const handleSaveShift = async (shiftData) => {
    try {
      if (selectedShift) {
        // Update existing shift
        await shiftAPI.update(selectedShift.id, shiftData);
        alert('✅ Cập nhật ca làm thành công!');
        await loadShifts();
        setShowModal(false);
      } else {
        // Create new shift
        await shiftAPI.create(shiftData);
        alert('✅ Thêm ca làm mới thành công!');
        await loadShifts();
        setShowModal(false);
      }
    } catch (error) {
      console.error('❌ Error saving shift:', error);
      let errorMessage = 'Không thể lưu ca làm';

      if (error.response?.status === 400) {
        errorMessage = error.response?.data?.detail || 'Dữ liệu không hợp lệ';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(`❌ Lỗi:\n${errorMessage}`);
      throw error;
    }
  };

  const handleDeleteShift = async (shift) => {
    if (!window.confirm(`Bạn có chắc muốn xóa ca làm này?\n\nNgười làm việc: ${shift.technician_name}\nNgày: ${formatDate(shift.shift_date)}\nThời gian: ${shift.shift_start} - ${shift.shift_end}`)) {
      return;
    }

    try {
      await shiftAPI.delete(shift.id);
      await loadShifts();
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('Lỗi khi xóa ca làm: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Filter shifts based on search and filters
  const filteredShifts = shifts.filter(shift => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        shift.technician_name?.toLowerCase().includes(searchLower) ||
        shift.service_center_name?.toLowerCase().includes(searchLower) ||
        shift.shift_date?.includes(searchTerm);

      if (!matchesSearch) return false;
    }

    return true;
  });

  // Calculate stats
  const totalShifts = filteredShifts.length;
  const activeShifts = filteredShifts.filter(s => s.is_available).length;

  // Get today's date in local timezone for accurate comparison
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayShifts = filteredShifts.filter(s => s.shift_date === todayStr).length;

  const uniqueTechnicians = new Set(filteredShifts.map(s => s.technician_id)).size;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString + 'T00:00:00'); // Ensure local date interpretation
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      return dateString; // Fallback to original string if parsing fails
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return timeString;
  };

  const getShiftStatusBadge = (isAvailable) => {
    return isAvailable ? 'badge-success' : 'badge-danger';
  };

  const getShiftStatusLabel = (isAvailable) => {
    return isAvailable ? '✓ Có sẵn' : '✗ Không có sẵn';
  };

  const generateCalendarDays = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    // Get today's date in local timezone (Vietnam UTC+7)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayShifts = calendarData.calendar?.[dateStr] || [];
      days.push({
        date: day,
        dateStr,
        shifts: dayShifts,
        isToday: dateStr === todayStr
      });
    }

    return days;
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="page-header-modern">
          <div className="header-content">
            <div className="header-icon-wrapper">
              <div className="header-icon">🕒</div>
            </div>
            <div>
              <h1>Quản lý Ca làm</h1>
              <p className="header-subtitle">Quản lý lịch làm việc của kỹ thuật viên và nhân viên</p>
            </div>
          </div>
        </div>
        <div className="loading-container-modern">
          <div className="loading-spinner-modern">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <h3>Đang tải dữ liệu...</h3>
          <p>Chúng tôi đang chuẩn bị thông tin ca làm cho bạn</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-modern">
      {/* Modern Header */}
      <div className="page-header-modern">
        <div className="header-content">
          <div className="header-icon-wrapper">
            <div className="header-icon">🕒</div>
          </div>
          <div>
            <h1>Quản lý Ca làm</h1>
            <p className="header-subtitle">Quản lý lịch làm việc của kỹ thuật viên và nhân viên</p>
          </div>
        </div>
        <div className="header-actions-modern">
          <div className="view-toggle-modern">
            <button
              className={`view-btn-modern ${currentView === 'list' ? 'active' : ''}`}
              onClick={() => setCurrentView('list')}
            >
              <span className="view-icon">📋</span>
              <span className="view-text">Danh sách</span>
            </button>
            <button
              className={`view-btn-modern ${currentView === 'calendar' ? 'active' : ''}`}
              onClick={() => setCurrentView('calendar')}
            >
              <span className="view-icon">📅</span>
              <span className="view-text">Lịch</span>
            </button>
          </div>
          <button className="btn-primary-modern" onClick={handleCreateShift}>
            <span className="btn-icon">➕</span>
            <span className="btn-text">Thêm ca làm</span>
          </button>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="stats-overview-modern">
        <div className="stats-grid-modern">
          <div className="stat-card-modern primary">
            <div className="stat-icon-modern">
              <span>🕒</span>
            </div>
            <div className="stat-content-modern">
              <div className="stat-value-modern">{totalShifts}</div>
              <div className="stat-label-modern">Tổng ca làm</div>
              <div className="stat-trend-modern positive">↗️ Đang tăng</div>
            </div>
          </div>

          <div className="stat-card-modern success">
            <div className="stat-icon-modern">
              <span>✅</span>
            </div>
            <div className="stat-content-modern">
              <div className="stat-value-modern">{activeShifts}</div>
              <div className="stat-label-modern">Ca có sẵn</div>
              <div className="stat-trend-modern positive">↗️ Hoạt động tốt</div>
            </div>
          </div>

          <div className="stat-card-modern info">
            <div className="stat-icon-modern">
              <span>📅</span>
            </div>
            <div className="stat-content-modern">
              <div className="stat-value-modern">{todayShifts}</div>
              <div className="stat-label-modern">Ca hôm nay</div>
              <div className="stat-trend-modern neutral">→ Hôm nay</div>
            </div>
          </div>

          <div className="stat-card-modern warning">
            <div className="stat-icon-modern">
              <span>👥</span>
            </div>
            <div className="stat-content-modern">
              <div className="stat-value-modern">{uniqueTechnicians}</div>
              <div className="stat-label-modern">Kỹ thuật viên & NV</div>
              <div className="stat-trend-modern positive">↗️ Đội ngũ mạnh</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="filters-section-modern">
        <div className="search-card-modern">
          <div className="search-input-wrapper-modern">
            <span className="search-icon-modern">🔍</span>
            <input
              type="text"
              className="search-input-modern"
              placeholder="Tìm kiếm theo tên kỹ thuật viên, nhân viên, chi nhánh, ngày..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-controls-modern">
            <div className="filter-group-modern">
              <label className="filter-label-modern">🏢 Chi nhánh</label>
              <select
                className="filter-select-modern"
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
              >
                <option value="all">Tất cả chi nhánh</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group-modern">
              <label className="filter-label-modern">👤 Kỹ thuật viên</label>
              <select
                className="filter-select-modern"
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
              >
                <option value="all">Tất cả kỹ thuật viên & nhân viên</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>{tech.full_name} ({tech.role === 'technician' ? 'Kỹ thuật viên' : 'Nhân viên'})</option>
                ))}
              </select>
            </div>

            <div className="filter-group-modern">
              <label className="filter-label-modern">📅 Ngày</label>
              <input
                type="date"
                className="filter-select-modern"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="Chọn ngày"
              />
            </div>
          </div>

          {(searchTerm || filterBranch !== 'all' || filterTechnician !== 'all' || filterDate) && (
            <div className="active-filters-modern">
              <span className="filters-label">Bộ lọc đang áp dụng:</span>
              <div className="filter-tags-modern">
                {searchTerm && (
                  <span className="filter-tag-modern">
                    🔍 "{searchTerm}"
                    <button onClick={() => setSearchTerm('')} className="tag-remove">×</button>
                  </span>
                )}
                {filterBranch !== 'all' && (
                  <span className="filter-tag-modern">
                    🏢 {branches.find(b => b.id === filterBranch)?.name}
                    <button onClick={() => setFilterBranch('all')} className="tag-remove">×</button>
                  </span>
                )}
                {filterTechnician !== 'all' && (
                  <span className="filter-tag-modern">
                    👤 {technicians.find(t => t.id === filterTechnician)?.full_name}
                    <button onClick={() => setFilterTechnician('all')} className="tag-remove">×</button>
                  </span>
                )}
                {filterDate && (
                  <span className="filter-tag-modern">
                    📅 {formatDate(filterDate)}
                    <button onClick={() => setFilterDate('')} className="tag-remove">×</button>
                  </span>
                )}
              </div>
              <button
                className="clear-filters-btn-modern"
                onClick={() => {
                  setSearchTerm('');
                  setFilterBranch('all');
                  setFilterTechnician('all');
                  setFilterDate('');
                }}
              >
                🗑️ Xóa tất cả bộ lọc
              </button>
            </div>
          )}

          {filteredShifts.length > 0 && (
            <div className="search-results-modern">
              <span className="results-count-modern">
                🎯 Hiển thị <strong>{filteredShifts.length}</strong> / {shifts.length} ca làm
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content based on view */}
      {currentView === 'list' ? (
        /* Enhanced List View */
        <>
          {filteredShifts.length === 0 ? (
            <div className="empty-state-modern">
              <div className="empty-illustration-modern">
                <div className="empty-icon-modern">🕒</div>
                <div className="empty-decoration-1"></div>
                <div className="empty-decoration-2"></div>
              </div>
              <div className="empty-content-modern">
                <h3>Không tìm thấy ca làm</h3>
                <p>
                  {searchTerm || filterBranch !== 'all' || filterTechnician !== 'all' || filterDate
                    ? 'Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm để tìm thấy ca làm bạn cần.'
                    : 'Chưa có ca làm nào trong hệ thống. Hãy bắt đầu bằng việc tạo ca làm đầu tiên!'}
                </p>
                {(searchTerm || filterBranch !== 'all' || filterTechnician !== 'all' || filterDate) && (
                  <button
                    className="btn-secondary-modern"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterBranch('all');
                      setFilterTechnician('all');
                      setFilterDate('');
                    }}
                  >
                    <span className="btn-icon">🔄</span>
                    <span className="btn-text">Đặt lại bộ lọc</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="shifts-list-modern">
              {filteredShifts.map(shift => (
                <div key={shift.id} className="shift-card-modern">
                  <div className="shift-header-modern">
                    <div className="shift-avatar-modern">
                      <span className="avatar-emoji">
                        {shift.technician_name?.charAt(0) || '👤'}
                      </span>
                    </div>
                    <div className="shift-info-modern">
                      <h3 className="shift-title-modern">{shift.technician_name || 'Unknown Worker'}</h3>
                      <p className="shift-subtitle-modern">{shift.service_center_name || 'Unknown Branch'}</p>
                      <div className="shift-status-modern">
                        <span className={`status-badge-modern ${shift.is_available ? 'available' : 'unavailable'}`}>
                          <span className="status-icon">{shift.is_available ? '✅' : '❌'}</span>
                          <span className="status-text">{shift.is_available ? 'Có sẵn' : 'Không có sẵn'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shift-details-modern">
                    <div className="detail-item-modern">
                      <span className="detail-icon-modern">📅</span>
                      <span className="detail-label-modern">Ngày làm việc:</span>
                      <span className="detail-value-modern">{formatDate(shift.shift_date)}</span>
                    </div>

                    <div className="detail-item-modern">
                      <span className="detail-icon-modern">⏰</span>
                      <span className="detail-label-modern">Thời gian:</span>
                      <span className="detail-value-modern">{formatTime(shift.shift_start)} - {formatTime(shift.shift_end)}</span>
                    </div>

                    <div className="detail-item-modern">
                      <span className="detail-icon-modern">🏢</span>
                      <span className="detail-label-modern">Chi nhánh:</span>
                      <span className="detail-value-modern">{shift.service_center_name}</span>
                    </div>

                    <div className="detail-item-modern">
                      <span className="detail-icon-modern">👤</span>
                      <span className="detail-label-modern">Vai trò:</span>
                      <span className="detail-value-modern">
                        {technicians.find(t => t.id === shift.technician_id)?.role === 'technician' ? 'Kỹ thuật viên' : 'Nhân viên'}
                      </span>
                    </div>

                    <div className="detail-item-modern">
                      <span className="detail-icon-modern">🆔</span>
                      <span className="detail-label-modern">ID:</span>
                      <span className="detail-value-modern code">{shift.id}</span>
                    </div>
                  </div>

                  <div className="shift-actions-modern">
                    <button
                      className="action-btn-modern primary"
                      onClick={() => handleEditShift(shift)}
                      title="Chỉnh sửa ca làm"
                    >
                      <span className="btn-icon">✏️</span>
                      <span className="btn-text">Sửa</span>
                    </button>

                    <button
                      className={`action-btn-modern ${shift.is_available ? 'warning' : 'success'}`}
                      onClick={async () => {
                        try {
                          await shiftAPI.update(shift.id, { ...shift, is_available: !shift.is_available });
                          await loadShifts();
                        } catch (error) {
                          alert('Lỗi khi cập nhật trạng thái: ' + error.message);
                        }
                      }}
                      title={shift.is_available ? 'Đánh dấu không có sẵn' : 'Đánh dấu có sẵn'}
                    >
                      <span className="btn-icon">{shift.is_available ? '🚫' : '✅'}</span>
                      <span className="btn-text">{shift.is_available ? 'Tạm ngưng' : 'Kích hoạt'}</span>
                    </button>

                    <button
                      className="action-btn-modern danger"
                      onClick={() => handleDeleteShift(shift)}
                      title="Xóa ca làm"
                    >
                      <span className="btn-icon">🗑️</span>
                      <span className="btn-text">Xóa</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Enhanced Calendar View */
        <div className="calendar-section-modern">
          <div className="calendar-header-modern">
            <div className="calendar-nav-modern">
              <button
                className="nav-btn-modern"
                onClick={() => {
                  const current = new Date(selectedMonth + '-01');
                  current.setMonth(current.getMonth() - 1);
                  setSelectedMonth(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
                }}
              >
                <span className="nav-icon">⬅️</span>
                <span className="nav-text">Trước</span>
              </button>

              <div className="calendar-title-modern">
                <h2>
                  {new Date(selectedMonth + '-01').toLocaleDateString('vi-VN', {
                    year: 'numeric',
                    month: 'long'
                  })}
                </h2>
                <p className="calendar-subtitle-modern">Lịch ca làm tháng này</p>
              </div>

              <button
                className="nav-btn-modern"
                onClick={() => {
                  const current = new Date(selectedMonth + '-01');
                  current.setMonth(current.getMonth() + 1);
                  setSelectedMonth(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
                }}
              >
                <span className="nav-text">Sau</span>
                <span className="nav-icon">➡️</span>
              </button>
            </div>

            <div className="calendar-filter-modern">
              <label className="filter-label-modern">🏢 Chọn chi nhánh để xem lịch:</label>
              <select
                className="filter-select-modern"
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
              >
                <option value="all">Tất cả chi nhánh</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          </div>

          {filterBranch === 'all' ? (
            <div className="calendar-placeholder-modern">
              <div className="placeholder-icon-modern">🏢</div>
              <h3>Vui lòng chọn chi nhánh</h3>
              <p>Chọn một chi nhánh cụ thể để xem lịch ca làm chi tiết</p>
            </div>
          ) : (
            <div className="calendar-grid-modern">
              {/* Calendar Header */}
              <div className="calendar-week-header-modern">
                {['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'].map(day => (
                  <div key={day} className="week-day-header-modern">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="calendar-days-modern">
                {generateCalendarDays().map(day => (
                  <div
                    key={day.date}
                    className={`calendar-day-modern ${day.isToday ? 'today' : ''}`}
                  >
                    <div className="day-header-modern">
                      <span className="day-number-modern">{day.date}</span>
                      {day.isToday && <span className="today-badge-modern">Hôm nay</span>}
                    </div>
                    <div className="day-content-modern">
                      {day.shifts.map((shift, index) => (
                        <div
                          key={index}
                          className={`shift-item-modern ${shift.is_available ? 'available' : 'unavailable'}`}
                          onClick={() => handleEditShift({
                            id: shift.id,
                            technician_id: shift.technician_id,
                            technician_name: shift.technician_name,
                            service_center_id: filterBranch,
                            shift_date: day.dateStr,
                            shift_start: shift.shift_start,
                            shift_end: shift.shift_end,
                            is_available: shift.is_available
                          })}
                          title={`${shift.technician_name} - ${shift.shift_start} đến ${shift.shift_end}`}
                        >
                          <div className="shift-time-modern">
                            {shift.shift_start} - {shift.shift_end}
                          </div>
                          <div className="shift-worker-modern">
                            {shift.technician_name}
                          </div>
                          <div className="shift-status-indicator-modern">
                            {shift.is_available ? '🟢' : '🔴'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Modal */}
      <ShiftFormModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveShift}
        shift={selectedShift}
        technicians={technicians}
        branches={branches}
      />
    </div>
  );
};

// Enhanced Shift Form Modal Component
const ShiftFormModal = ({ show, onClose, onSave, shift, technicians, branches }) => {
  const [formData, setFormData] = useState({
    technician_id: '',
    service_center_id: '',
    shift_date: '',
    shift_start: '08:00',
    shift_end: '17:00',
    is_available: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shift) {
      setFormData({
        technician_id: shift.technician_id || '',
        service_center_id: shift.service_center_id || '',
        shift_date: shift.shift_date || '',
        shift_start: shift.shift_start || '08:00',
        shift_end: shift.shift_end || '17:00',
        is_available: shift.is_available ?? true
      });
    } else {
      setFormData({
        technician_id: '',
        service_center_id: '',
        shift_date: '',
        shift_start: '08:00',
        shift_end: '17:00',
        is_available: true
      });
    }
  }, [shift]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.technician_id || !formData.service_center_id || !formData.shift_date) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc!');
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
    } catch (error) {
      // Error already handled in parent
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay-modern">
      <div className="modal-content-modern">
        <div className="modal-header-modern">
          <div className="modal-title-section-modern">
            <div className="modal-icon-modern">
              {shift ? '✏️' : '➕'}
            </div>
            <div>
              <h2 className="modal-title-modern">{shift ? 'Chỉnh sửa ca làm' : 'Thêm ca làm mới'}</h2>
              <p className="modal-subtitle-modern">
                {shift ? 'Cập nhật thông tin ca làm' : 'Tạo ca làm mới cho nhân viên'}
              </p>
            </div>
          </div>
          <button className="modal-close-modern" onClick={onClose}>
            <span>✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body-modern">
            <div className="form-grid-modern">
              <div className="form-group-modern">
                <label className="form-label-modern">
                  <span className="label-icon-modern">👤</span>
                  Kỹ thuật viên / Nhân viên <span className="required-indicator">*</span>
                </label>
                <div className="select-wrapper-modern">
                  <select
                    className="form-select-modern"
                    value={formData.technician_id}
                    onChange={(e) => setFormData({...formData, technician_id: e.target.value})}
                    required
                  >
                    <option value="">Chọn kỹ thuật viên hoặc nhân viên</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name} ({tech.role === 'technician' ? 'Kỹ thuật viên' : 'Nhân viên'})
                      </option>
                    ))}
                  </select>
                  <span className="select-arrow-modern">▼</span>
                </div>
              </div>

              <div className="form-group-modern">
                <label className="form-label-modern">
                  <span className="label-icon-modern">🏢</span>
                  Chi nhánh <span className="required-indicator">*</span>
                </label>
                <div className="select-wrapper-modern">
                  <select
                    className="form-select-modern"
                    value={formData.service_center_id}
                    onChange={(e) => setFormData({...formData, service_center_id: e.target.value})}
                    required
                  >
                    <option value="">Chọn chi nhánh</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  <span className="select-arrow-modern">▼</span>
                </div>
              </div>

              <div className="form-group-modern">
                <label className="form-label-modern">
                  <span className="label-icon-modern">📅</span>
                  Ngày làm việc <span className="required-indicator">*</span>
                </label>
                <div className="input-wrapper-modern">
                  <input
                    type="date"
                    className="form-input-modern"
                    value={formData.shift_date}
                    onChange={(e) => setFormData({...formData, shift_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label className="form-label-modern">
                  <span className="label-icon-modern">⏰</span>
                  Thời gian làm việc
                </label>
                <div className="time-inputs-modern">
                  <div className="input-wrapper-modern">
                    <input
                      type="time"
                      className="form-input-modern"
                      value={formData.shift_start}
                      onChange={(e) => setFormData({...formData, shift_start: e.target.value})}
                      required
                    />
                    <span className="input-label-modern">Bắt đầu</span>
                  </div>
                  <span className="time-separator-modern">→</span>
                  <div className="input-wrapper-modern">
                    <input
                      type="time"
                      className="form-input-modern"
                      value={formData.shift_end}
                      onChange={(e) => setFormData({...formData, shift_end: e.target.value})}
                      required
                    />
                    <span className="input-label-modern">Kết thúc</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section-modern">
              <div className="availability-toggle-modern">
                <div className="toggle-header-modern">
                  <span className="toggle-icon-modern">🎯</span>
                  <span className="toggle-label-modern">Trạng thái ca làm</span>
                </div>
                <div className="toggle-description-modern">
                  {formData.is_available
                    ? 'Ca làm này đang hoạt động và có thể được đặt lịch'
                    : 'Ca làm này tạm thời không khả dụng'
                  }
                </div>
                <label className="toggle-switch-modern">
                  <input
                    type="checkbox"
                    checked={formData.is_available}
                    onChange={(e) => setFormData({...formData, is_available: e.target.checked})}
                  />
                  <span className="toggle-slider-modern"></span>
                  <span className="toggle-text-modern">
                    {formData.is_available ? 'Có sẵn' : 'Không có sẵn'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer-modern">
            <button
              type="button"
              className="btn-secondary-modern"
              onClick={onClose}
              disabled={loading}
            >
              <span className="btn-icon">❌</span>
              <span className="btn-text">Hủy</span>
            </button>
            <button
              type="submit"
              className="btn-primary-modern"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner-modern"></div>
                  <span className="btn-text">Đang lưu...</span>
                </>
              ) : (
                <>
                  <span className="btn-icon">{shift ? '💾' : '✅'}</span>
                  <span className="btn-text">{shift ? 'Cập nhật' : 'Thêm mới'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminShiftsPage;