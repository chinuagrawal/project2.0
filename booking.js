const seatMap = document.getElementById('seat-map');
const bookBtn = document.getElementById('book-btn');
const startDateInput = document.getElementById('start-date');
const durationInput = document.getElementById('duration');
const shiftInput = document.getElementById('shift');
const totalSeats = 34;
let bookings = [];

function calculateEndDate(start, months) {
  if (!start) return null;
  const date = new Date(start);
  if (isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + parseInt(months));
  return date.toISOString().split('T')[0];
}

async function fetchBookings() {
  const startDate = startDateInput.value;
  const duration = durationInput.value;

  if (!startDate || !duration) return;

  const endDate = calculateEndDate(startDate, duration);
  if (!endDate) return;

  try {
    const res = await fetch(`http://localhost:3000/api/bookings?startDate=${startDate}&endDate=${endDate}`);
    bookings = await res.json();
    renderSeats();
  } catch (err) {
    alert('Failed to load seat bookings');
  }
}

function renderSeats() {
  seatMap.innerHTML = '';
  for (let i = 1; i <= totalSeats; i++) {
    const seatId = `S${i}`;
    const seat = document.createElement('div');
    seat.classList.add('seat');
    seat.dataset.seatId = seatId;

    const seatBookings = bookings.filter(b => b.seatId === seatId);
    const hasFull = seatBookings.some(b => b.shift === 'full');
    const hasAM = seatBookings.some(b => b.shift === 'am');
    const hasPM = seatBookings.some(b => b.shift === 'pm');

    const selectedShift = shiftInput.value;
    let isSelectable = true;

    // Set visual color
    if (hasFull || (hasAM && hasPM)) {
      seat.classList.add('booked'); // 🔴 red
      isSelectable = false;
    } else if (hasAM) {
      seat.classList.add('half-booked'); // 🟠 orange
      if (selectedShift === 'full' || selectedShift === 'am') isSelectable = false;
    } else if (hasPM) {
      seat.classList.add('evening-booked'); // 🟣 purple
      if (selectedShift === 'full' || selectedShift === 'pm') isSelectable = false;
    } else {
      seat.classList.add('available'); // ⚪ white
    }

    if (isSelectable) {
      seat.addEventListener('click', () => {
        document.querySelectorAll('.seat').forEach(s => s.classList.remove('selected'));
        seat.classList.add('selected');
      });
    }

    seat.innerText = i;
    seatMap.appendChild(seat);
  }
}


bookBtn.addEventListener('click', async () => {
  const seat = document.querySelector('.seat.selected');
  if (!seat) return alert('Please select a seat.');

  const seatId = seat.dataset.seatId;
  const shift = shiftInput.value;
  const startDate = startDateInput.value;
  const duration = durationInput.value;

  if (!startDate || !duration || !shift) {
    return alert('Fill all booking details.');
  }

  const endDate = calculateEndDate(startDate, duration);
  if (!endDate) {
    return alert('Invalid start date.');
  }

  try {
    const res = await fetch('http://localhost:3000/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId, shift, startDate, endDate })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Booking failed.');
    } else {
      alert('✅ Seat booked!');
    }
    fetchBookings();
  } catch (err) {
    alert('Booking request failed.');
  }
});

[startDateInput, durationInput, shiftInput].forEach(input => {
  input.addEventListener('change', fetchBookings);
});

window.onload = () => {
  const today = new Date().toISOString().split('T')[0];
  startDateInput.value = today;
  fetchBookings();
};
