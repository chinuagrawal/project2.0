const seatMap = document.getElementById('seat-map');
const bookBtn = document.getElementById('book-btn');
const startDateInput = document.getElementById('start-date');
const durationInput = document.getElementById('duration');
const shiftInput = document.getElementById('shift');
const totalSeats = 34;
let bookings = [];

const amountDisplay = document.getElementById('amount-display');

function updateAmount() {
  const shift = shiftInput.value;
  const duration = parseInt(durationInput.value);

  if (!shift || !duration || isNaN(duration)) {
    amountDisplay.innerText = '₹ 0';
    return;
  }

  const baseAmount = shift === 'full' ? 800 : 600;
  const totalAmount = baseAmount * duration;
  amountDisplay.innerText = `₹ ${totalAmount.toFixed(2)}`;
}

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
    const res = await fetch(`https://project20-production-e7f5.up.railway.app/api/bookings?startDate=${startDate}&endDate=${endDate}`);
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
  if (!endDate) return alert('Invalid start date.');

  const userData = localStorage.getItem('user');
  const user = JSON.parse(userData);
  const email = user?.email;
  if (!email) return alert('Please login first.');

  const months = parseInt(duration);
  if (!months || isNaN(months)) {
    return alert('Invalid duration selected.');
  }

  const paymentMode = document.querySelector('input[name="paymentMode"]:checked').value;

  // 👇 If payment mode is CASH
  if (paymentMode === 'cash') {
    try {
      const res = await fetch('https://project20-production-e7f5.up.railway.app/api/book-cash', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seatId, shift, startDate, endDate, email, duration })
});


      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Booking failed.');
      } else {
        alert('Cash booking request submitted. Please pay to library in-charge.');
        window.location.href = `index.html?success=1&cash=1`;
      }
    } catch (err) {
      console.error(err);
      alert('Cash booking request failed.');
    }
    return; // exit function after cash request
  }

  // 👇 Your existing Razorpay Online Payment Flow (untouched)
  const baseAmount = shift === 'full' ? 80000 : 60000;
  const amount = baseAmount * months;

  try {
    const orderRes = await fetch('https://project20-production-e7f5.up.railway.app/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const orderData = await orderRes.json();

    const options = {
      key: 'rzp_test_n9ZAl4W7UvC5MH',
      amount: orderData.amount,
      currency: 'INR',
      name: 'Seat Booking',
      description: 'Confirm seat',
      order_id: orderData.id,
      handler: async function (response) {
        const payment = {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        };

        const res = await fetch('https://project20-production-e7f5.up.railway.app/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seatId, shift, startDate, endDate, email, payment })
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.message || 'Booking failed.');
        } else {
          window.location.href = `index.html?success=1&seatId=${seatId}&shift=${shift}&startDate=${startDate}&endDate=${endDate}`;
        }
      },
      theme: { color: '#3399cc' }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error(err);
    alert('Payment or booking failed.');
  }
});




[startDateInput, durationInput, shiftInput].forEach(input => {
  input.addEventListener('change', () => {
    fetchBookings();
    updateAmount();
  });
});


window.onload = () => {
  const today = new Date().toISOString().split('T')[0];
  startDateInput.value = today;
  updateAmount(); // ✅ calculate amount at initial load
  fetchBookings();
};

