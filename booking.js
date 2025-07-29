// UPDATED booking.js (with PhonePe integration)

const seatMap = document.getElementById('seat-map');
const bookBtn = document.getElementById('book-btn');
const startDateInput = document.getElementById('start-date');
const durationInput = document.getElementById('duration');
const shiftInput = document.getElementById('shift');
const totalSeats = 34;
let bookings = [];

const urlParams = new URLSearchParams(window.location.search);
const isExtension = urlParams.get('extend') === '1';



let lockedSeatId = null;
let lockedShift = null;
let lockedFromDate = null;
let lockedToDate = null;

if (isExtension) {
  lockedSeatId = urlParams.get('seatId');
  lockedShift = urlParams.get('shift');
  lockedFromDate = urlParams.get('fromDate');
  lockedToDate = urlParams.get('toDate');
}

const amountDisplay = document.getElementById('amount-display');

function updateAmount() {
  const shift = shiftInput.value;
  const duration = parseInt(durationInput.value);

  if (!shift || !duration || isNaN(duration)) {
    amountDisplay.innerText = '₹ 0';
    return;
  }

  const baseAmount = shift === 'full' ? 816 : 612;
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
    const res = await fetch(`https://kanha-backend-bw7a.onrender.com/api/bookings?startDate=${startDate}&endDate=${endDate}`);
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

   if (isSelectable && (!isExtension || seatId === lockedSeatId)) {
  seat.addEventListener('click', () => {
    document.querySelectorAll('.seat').forEach(s => s.classList.remove('selected'));
    seat.classList.add('selected');
  });
} else {
  seat.classList.add('disabled'); // Optionally style it as unclickable
}


    seat.innerText = i;
    seatMap.appendChild(seat);
  }
}

bookBtn.addEventListener('click', async () => {
  let seatId;
if (isExtension) {
  seatId = lockedSeatId;
} else {
  const seat = document.querySelector('.seat.selected');
  if (!seat) return alert('Please select a seat.');
  seatId = seat.dataset.seatId;
}

  const shift = isExtension ? lockedShift : shiftInput.value;
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
      const res = await fetch('https://kanha-backend-bw7a.onrender.com/api/book-cash', {
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
    const res = await fetch('https://kanha-backend-bw7a.onrender.com/api/payment/initiate', {
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
    // No need to handle CONCLUDED here in REDIRECT mode
  },
  type: "REDIRECT"
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

  if (isExtension && lockedSeatId && lockedShift && lockedToDate) {
    const nextDate = new Date(new Date(lockedToDate).getTime() + 86400000); // +1 day
    const nextDateStr = nextDate.toISOString().split('T')[0];

    startDateInput.value = nextDateStr;
    startDateInput.min = nextDateStr;
    startDateInput.disabled = true;

    shiftInput.value = lockedShift;
    shiftInput.disabled = true;

    // Disable seat map interaction
    fetchBookings().then(() => {
      renderSeats(); // highlight selected seat
      const targetSeat = document.querySelector(`[data-seat-id="${lockedSeatId}"]`);
      if (targetSeat) {
        targetSeat.classList.add('selected');
      }
    });

  } else {
    startDateInput.value = today;
    fetchBookings();
  }

  updateAmount();
};

