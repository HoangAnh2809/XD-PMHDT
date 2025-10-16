import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { customerAPI } from '../../services/api';

const BookingPage = () => {
    const [bookingData, setBookingData] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await customerAPI.getBookingDetails();
                setBookingData(response.data);
            } catch (error) {
                console.error('Error fetching booking data:', error);
            }
        };

        fetchData();
    }, []);

    const handleNavigate = (path) => {
        navigate(path);
    };

    if (!bookingData) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <Navbar />
            <h1>Booking Details</h1>
            <pre>{JSON.stringify(bookingData, null, 2)}</pre>
            <button onClick={() => handleNavigate('/home')}>Go to Home</button>
        </div>
    );
};

export default BookingPage;