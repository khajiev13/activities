import React, { useState } from 'react';
import axiosInstance from '../../axios';
// import axios from 'axios';
// import { useHistory } from 'react-router-dom';

function Register() {
  const [formData, setFormData] = useState({
    username: 'justin',
    password: '7191710r',
    first_name: 'Justin',
    last_name: 'Kadirov',
    age: '23',
    gender: 'Male',
    email: 'raxmon1710@gmail.com',
  });

  const handleChange = (e) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value.trim(),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    axiosInstance
      .post('api/users/', formData)
      .then((response) => {
        console.log(response);
        // User registration was successful, get the tokens
        axiosInstance
          .post('api/users/token/get/', {
            username: formData.username,
            password: formData.password,
          })
          .then((response) => {
            console.log('Success getting tokens:', response.data);
            // Save the tokens in the local storage
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
          })
          .catch((error) => {
            console.error('Error getting tokens:', error);
          });
      })
      .catch((error) => {
        alert(error.response.data.detail);
      });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        name="username"
        value={formData.username}
        onChange={handleChange}
        className="block w-full p-2 border border-gray-300 rounded"
        placeholder="Username"
      />
      <input
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        className="block w-full p-2 border border-gray-300 rounded"
        placeholder="Password"
      />
      <input
        type="text"
        name="first_name"
        value={formData.first_name}
        onChange={handleChange}
        className="block w-full p-2 border border-gray-300 rounded"
        placeholder="First Name"
      />
      <input
        type="text"
        name="last_name"
        value={formData.last_name}
        onChange={handleChange}
        className="block w-full p-2 border border-gray-300 rounded"
        placeholder="Last Name"
      />
      <input
        type="number"
        name="age"
        value={formData.age}
        onChange={handleChange}
        className="block w-full p-2 border border-gray-300 rounded"
        placeholder="Age"
      />
      <select
        name="gender"
        value={formData.gender}
        onChange={handleChange}
        className="block w-full p-2 border border-gray-300 rounded"
      >
        <option value="">Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        className="block w-full p-2 border border-gray-300 rounded"
        placeholder="Email"
      />
      <button
        type="submit"
        className="block w-full p-2 bg-blue-500 text-white rounded"
      >
        Submit
      </button>
    </form>
  );
}

export default Register;
