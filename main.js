window.onload = async () => {
  const res = await fetch('https://kanha-backend-bw7a.onrender.com/api/available-seats');

  const data = await res.json();
  document.getElementById('available-seats').textContent =
    `Available Seats: ${data.available}`;
};

document.getElementById('bookNowBtn').onclick = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
  } else {
    window.location.href = 'booking.html';
  }
};
