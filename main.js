window.onload = async () => {
  const res = await fetch('https://project20-production-e7f5.up.railway.app//api/available-seats');

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
