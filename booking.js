// UPDATED booking.js (with PhonePe integration)

  async function refreshUserData() {
    const oldUser = JSON.parse(localStorage.getItem("user"));
    if (!oldUser?.email) return;

    try {
      const res = await fetch(`https://kanha-backend-yfx1.onrender.com/api/users/me/${oldUser.email}`);
      const user = await res.json();
      localStorage.setItem("user", JSON.stringify(user));
      console.log("✅ Refreshed user data");
    } catch (err) {
      console.error("Failed to fetch user info:", err);
    }
  }

  // ✅ Call it on page load BEFORE booking.js runs
  refreshUserData();


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
let priceSettings = null;
async function fetchPrices() {
  const res = await fetch('https://kanha-backend-yfx1.onrender.com/api/prices');
  priceSettings = await res.json();
}

function getDiscount(duration) {
  if (!priceSettings || !Array.isArray(priceSettings.offers)) return 0;

  // Find the best applicable discount for the given duration
  let best = 0;
  for (const offer of priceSettings.offers) {
    if (duration >= offer.duration && offer.discount > best) {
      best = offer.discount;
    }
  }
  return best;
}

function getTotalAmount(base, duration, discount, pgPercent, convenience) {
  const subtotal = base * duration - discount;
  const pgFee = Math.round(((subtotal + convenience)* pgPercent ) / 100);
  const total = subtotal + pgFee + convenience;
  return { subtotal, pgFee, convenience, total };
}

async function updateAmount() {
  const shift = shiftInput.value;
  const duration = parseInt(durationInput.value);
  
  if (!priceSettings) await fetchPrices();

  if (!shift || !duration || isNaN(duration)) {
    amountDisplay.innerText = '₹ 0';
    return;
  }

  let basePrice;
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  if (user?.customPricing && user.customPricing[shift]) {
    basePrice = user.customPricing[shift];
  } else {
    basePrice = shift === 'full' ? priceSettings.full : priceSettings[shift];
  }

  const discount = getDiscount(duration);

  // ✅ Detect payment mode
  const paymentMode = document.querySelector('input[name="paymentMode"]:checked')?.value || "online";

  // ✅ If cash, PG fee is 0 and convenience is 0
  const pgPercent = paymentMode === 'cash' ? 0 : priceSettings.paymentGatewayFeePercent;
  const convenienceFee =  priceSettings.convenienceFee;

  const { subtotal, pgFee, convenience, total } = getTotalAmount(
    basePrice,
    duration,
    discount,
    pgPercent,
    convenienceFee
  );

  amountDisplay.innerHTML = `
    <div class="price-breakdown">
      <div><span>Base Price</span> <span>₹${basePrice} × ${duration} months</span></div>
      <div><span>Subtotal</span> <span>₹${basePrice * duration}</span></div>
      <div><span>Discount</span> <span class="discount">– ₹${discount}</span></div>
      <div><span>Convenience Fee</span> <span>+ ₹${convenience}</span></div>
      <div><span>PG Fee (${pgPercent}%)</span> <span>+ ₹${pgFee}</span></div>
      <hr>
      <div class="total"><span>Total Amount</span> <span>₹${total}</span></div>
    </div>
  `;
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
    const res = await fetch(`https://kanha-backend-yfx1.onrender.com/api/bookings?startDate=${startDate}&endDate=${endDate}`);
    bookings = await res.json();
    renderSeats();
  } catch (err) {
    alert('Failed to load seat bookings');
  }
}

function renderSeats() {
  seatMap.innerHTML = '';
  for (let i = 1; i <= totalSeats; i++) {
    const seatId = `${i}`;
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
    if (!priceSettings) await fetchPrices();

    let basePrice;
    if (user?.customPricing && user.customPricing[shift]) {
      basePrice = user.customPricing[shift];
    } else {
      basePrice = shift === 'full' ? priceSettings.full : priceSettings[shift];
    }

    const discount = getDiscount(duration);

    // ✅ Cash booking: no PG fee, no convenience fee
    let amount = basePrice * duration - discount ;

    // OPTIONAL: If you want cash to be ₹100 more than online
    

    const res = await fetch('https://kanha-backend-yfx1.onrender.com/api/book-cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId, shift, startDate, endDate, email, duration, amount })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Booking failed.');
    } else {
      alert(`Cash booking request submitted for ₹${amount}. Please pay to Bindal E-mitra, contact 9828130420.`);
      window.location.href = `index.html?success=1&cash=1`;
    }
  } catch (err) {
    console.error(err);
    alert('Cash booking request failed.');
  }
  return;
}

  // 🟣 Online booking via PhonePe
  if (!priceSettings) await fetchPrices();
let basePrice;

if (user?.customPricing && user.customPricing[shift]) {
  basePrice = user.customPricing[shift];
} else {
  basePrice = shift === 'full' ? priceSettings.full : priceSettings[shift];
}

const discount = getDiscount(months);

const { total: amount } = getTotalAmount(
  basePrice,
  months,
  discount,
  priceSettings.paymentGatewayFeePercent,
  priceSettings.convenienceFee
);

try {
  const res = await fetch('https://kanha-backend-yfx1.onrender.com/api/payment/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, email, seatId, shift, startDate, endDate })
  });

  const data = await res.json();

  if (!res.ok || !data.redirectUrl) {
    return alert(data.message || 'Payment initiation failed.');
  }

  // Store pending booking in session
  sessionStorage.setItem('pendingBooking', JSON.stringify({
    seatId, shift, startDate, endDate, email, txnId: data.merchantTransactionId
  }));

  // ⚠️ Show warning UI
  const warningElement = document.getElementById("payment-warning");

  if (warningElement) {
    warningElement.style.display = "flex";

    // Wait 4 seconds, then redirect to PhonePe
    setTimeout(() => {
      if (window.PhonePeCheckout && window.PhonePeCheckout.transact) {
        window.PhonePeCheckout.transact({
          tokenUrl: data.redirectUrl,
          callback: function (response) {
            console.log("📦 PhonePe response:", response);
          },
          type: "REDIRECT"
        });
      } else {
        alert("PhonePe SDK not loaded");
      }
    }, 4000);

  } else {
    console.warn("Element with ID 'payment-warning' not found.");
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

window.onload = async () => {
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
    await fetchBookings();
    renderSeats(); // highlight selected seat
    const targetSeat = document.querySelector(`[data-seat-id="${lockedSeatId}"]`);
    if (targetSeat) {
      targetSeat.classList.add('selected');
    }

  } else {
    startDateInput.value = today;
    await fetchBookings();
  }


  document.querySelectorAll('input[name="paymentMode"]').forEach(radio => {
  radio.addEventListener('change', updateAmount);
});

  await updateAmount();
};


