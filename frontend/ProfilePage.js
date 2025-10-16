import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { customerAPI } from '../../services/api';

const ProfilePage = () => {
  const [userData, setUserData] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await customerAPI.getUserProfile(currentUser.uid);
        setUserData(response.data);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    if (currentUser) {
      fetchUserData();
    } else {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  return (
    <div>
      <Navbar />
      <h1>Profile</h1>
      {userData ? (
        <div>
          <p>Name: {userData.name}</p>
          <p>Email: {userData.email}</p>
          {/* Hiển thị thêm thông tin hồ sơ nếu cần */}
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default ProfilePage;