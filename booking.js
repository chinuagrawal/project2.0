// UPDATED booking.js (with PhonePe integration)

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
  const totalAmount =Math.round(baseAmount * duration);
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

    if (hasFull || (hasAM && hasPM)) {
      seat.classList.add('booked');
      isSelectable = false;
    } else if (hasAM) {
      seat.classList.add('half-booked');
      if (selectedShift === 'full' || selectedShift === 'am') isSelectable = false;
    } else if (hasPM) {
      seat.classList.add('evening-booked');
      if (selectedShift === 'full' || selectedShift === 'pm') isSelectable = false;
    } else {
      seat.classList.add('available');
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

  if (!startDate || !duration || !shift) return alert('Fill all booking details.');

  const endDate = calculateEndDate(startDate, duration);
  if (!endDate) return alert('Invalid start date.');

  const userData = localStorage.getItem('user');
  const user = JSON.parse(userData);
  const email = user?.email;
  if (!email) return alert('Please login first.');

  const months = parseInt(duration);
  if (!months || isNaN(months)) return alert('Invalid duration selected.');

  const paymentMode = document.querySelector('input[name="paymentMode"]:checked').value;

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
        alert('Cash booking request submitted. Please pay to Bindal E-mitra ,contact 9828130420.');
        window.location.href = `index.html?success=1&cash=1`;
      }
    } catch (err) {
      console.error(err);
      alert('Cash booking request failed.');
    }
    return;
  }

  // 🟣 Online booking via PhonePe
  const baseAmount = shift === 'full' ? 2 : 1;
  const amount =Math.round(baseAmount * months);

  try {
    const res = await fetch('https://project20-production-e7f5.up.railway.app/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, email })
    });

    const data = await res.json();

    if (!res.ok || !data.redirectUrl) {
      return alert(data.message || 'Payment initiation failed.');
    }

    sessionStorage.setItem('pendingBooking', JSON.stringify({
      seatId, shift, startDate, endDate, email, txnId: data.merchantTransactionId
    }));

 if (window.PhonePeCheckout && window.PhonePeCheckout.transact) {
  window.PhonePeCheckout.transact({
    tokenUrl: data.redirectUrl,
    callback: function (response) {
      console.log("📦 PhonePe response:", response);
      if (response === 'CONCLUDED') {
        alert('Payment Completed! Redirecting...');
        // ❌ WRONG:
        // window.location.href = `index.html?success=1`;

        // ✅ CORRECT:
        window.location.href = `payment-status.html?txnId=${data.merchantTransactionId}`;
      } else if (response === 'USER_CANCEL') {
        alert('Payment Cancelled by User');
      }
    },
    type: "IFRAME" // or "REDIRECT" if you prefer full page
  });

} else {
  alert("PhonePe SDK not loaded");
}
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
  updateAmount();
  fetchBookings();
};
