// UPDATED booking.js (with PhonePe integration)

// ====================================================================
// START: NEW GLOBAL VARS & LOGIC INTEGRATION FROM HTML
// ====================================================================

// Global variable to hold the user's most recent booking for the extension default
let recentBooking = null;
// Flag to indicate if the page is currently operating in 'extension' mode
window.isExtensionMode = false;
window.extensionDetails = null; // Holds {seatId, shift, fromDate} for extension

const API_BASE = "https://kanha-backend-yfx1.onrender.com/api";

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
function groupBookings(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) return [];

  // STEP 1 — Normalize and sort correctly
  const normalized = bookings.map((b) => ({
    ...b,
    dateObj: new Date(b.date),
  }));

  normalized.sort((a, b) => a.dateObj - b.dateObj);

  const groups = [];
  let group = null;

  for (let i = 0; i < normalized.length; i++) {
    const curr = normalized[i];
    const currTime = curr.dateObj.getTime();

    if (!group) {
      // Start first group
      group = {
        seatId: curr.seatId,
        shift: curr.shift,
        start: curr.date,
        end: curr.date,
      };
      continue;
    }

    const lastEnd = new Date(group.end).getTime();
    const nextExpected = lastEnd + 86400000;

    // CASE 1 — SAME DAY duplicate → ignore it
    if (currTime === lastEnd) {
      continue;
    }

    // CASE 2 — Consecutive day → merge
    if (
      curr.seatId === group.seatId &&
      curr.shift === group.shift &&
      currTime === nextExpected
    ) {
      group.end = curr.date;
    }

    // CASE 3 — Not consecutive → push previous group and start new
    else {
      groups.push(group);
      group = {
        seatId: curr.seatId,
        shift: curr.shift,
        start: curr.date,
        end: curr.date,
      };
    }
  }

  if (group) groups.push(group);
  return groups;
}

/**
 * Sets the page to the 'Extend Booking' flow using the most recent booking.
 */
function setExtendMode(groupedBookings) {
  if (groupedBookings.length === 0) return;

  // Find the booking with the latest 'end' date
  groupedBookings.sort((a, b) => new Date(b.end) - new Date(a.end));
  const mostRecent = groupedBookings[0];
  recentBooking = mostRecent;

  // 1. Set the global flag and details
  window.isExtensionMode = true;
  const nextDay = new Date(mostRecent.end);
  nextDay.setDate(nextDay.getDate() + 1);

  window.extensionDetails = {
    seatId: mostRecent.seatId,
    shift: mostRecent.shift,
    // The start date for the extension should be the day *after* the current booking ends.
    startDate: nextDay.toISOString().split("T")[0],
  };

  // 2. Pre-fill & Disable inputs
  if (shiftInput) shiftInput.value = mostRecent.shift;
  if (shiftInput) shiftInput.disabled = true;

  if (startDateInput) {
    startDateInput.value = window.extensionDetails.startDate;
    startDateInput.min = window.extensionDetails.startDate;
    startDateInput.disabled = true;
  }

  // 3. Update UI text
  document.querySelector("h1").textContent =
    `Extend Seat ${mostRecent.seatId} (${mostRecent.shift.toUpperCase()})`;

  // Use a shorter text for the top bar button
  const newBookingBtn = createSwitchButton("New Seat", "new");

  // Place below the H1 title
  const h1 = document.querySelector("h1");
  if (h1 && h1.parentNode) {
    h1.parentNode.insertBefore(newBookingBtn, h1.nextSibling);
  }

  // Also update main and mobile book buttons
  bookBtn.textContent = "Extend Booking";
  document.getElementById("mobile-book-btn").textContent = "Extend";
}

/**
 * Sets the page to the 'New Booking' flow.
 */
function setNewBookingMode() {
  window.isExtensionMode = false;
  window.extensionDetails = null;

  // Ensure inputs are enabled and reset
  if (shiftInput) shiftInput.disabled = false;
  if (startDateInput) startDateInput.disabled = false;

  // Reset UI text
  document.querySelector("h1").textContent = `Library Seat Booking`;
  bookBtn.textContent = "Pay";
  document.getElementById("mobile-book-btn").textContent = "Pay";

  // Add the "Switch to EXTEND" button
  const newBookingBtn = createSwitchButton("Extend Seat", "extend");

  // Place below the H1 title
  const h1 = document.querySelector("h1");
  if (h1 && h1.parentNode) {
    h1.parentNode.insertBefore(newBookingBtn, h1.nextSibling);
  }
}

/**
 * Helper to create the switch buttons
 */
function createSwitchButton(text, mode) {
  let btn = document.getElementById("switch-mode-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "switch-mode-btn";
    // Styling for Button (Centered below title)
    btn.style.cssText = `
        background: var(--primary-50, #f0f9ff);
        border: 1px solid var(--primary-200, #bae6fd);
        border-radius: 20px;
        padding: 6px 16px;
        margin: 0 auto 15px auto;
        display: block;
        width: fit-content;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        cursor: pointer;
        font-weight: 500;
        color: var(--primary-700, #0369a1);
        font-size: 13px;
        transition: all 0.2s;
    `;
    btn.addEventListener("click", () => {
      // Reload the page: either force new booking or clear params to default to extend
      window.location.href = `booking.html${mode === "new" ? "?new=1" : ""}`;
    });
  }
  btn.textContent = text;
  return btn;
}

async function checkAndLoadBookings() {
  const userData = localStorage.getItem("user");
  if (!userData) return;
  const user = JSON.parse(userData);

  try {
    const res = await fetch(`${API_BASE}/bookings?email=${user.email}`);
    const userBookings = await res.json();
    const grouped = groupBookings(userBookings);
    if (grouped.length > 0) {
      grouped.sort((a, b) => new Date(b.end) - new Date(a.end));

      const latestSeat = grouped[0]; // This already has max end-date
      const latestSeatId = latestSeat.seatId;
      const latestShift = latestSeat.shift;

      // STEP 2: Keep only this seat+shift bookings
      userBookingsData = grouped.filter(
        (b) => b.seatId === latestSeatId && b.shift === latestShift,
      );
    } else {
      userBookingsData = [];
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isForceNewBooking = urlParams.get("new") === "1";
    // 🔥 Show only latest seat bookings

    if (userBookingsData.length > 0 && !isForceNewBooking) {
      setExtendMode(userBookingsData); // ✅ Only latest seat data
    } else {
      setNewBookingMode();
    } // Update the My Bookings section UI

    updateMyBookingsUI(userBookingsData);

    console.log("GROUPED INPUT:", userBookingsData);
  } catch (err) {
    console.error("Error loading user bookings for default logic:", err); // If fetch fails, default to New Booking mode
    setNewBookingMode();
  }
}

function updateMyBookingsUI(groupedBookings) {
  const section = document.getElementById("my-bookings");
  const list = document.getElementById("booking-list");

  if (groupedBookings.length > 0) {
    section.style.display = "block";
    list.innerHTML = groupedBookings
      .map(
        (b) => `
            <div class="booking-card">
                <p><strong>Seat:</strong> ${b.seatId}</p>
                <p><strong>From:</strong> ${formatDate(b.start)}</p>
                <p><strong>To:</strong> ${formatDate(b.end)}</p>
                <p><strong>Shift:</strong> ${b.shift.toUpperCase()}</p>
            </div>
        `,
      )
      .join("");
  } else {
    section.style.display = "none";
  }
}

// ====================================================================
// END: NEW GLOBAL VARS & LOGIC INTEGRATION
// ====================================================================

async function refreshUserData() {
  // ... (Existing logic for refreshing user data remains) ...
  const oldUser = JSON.parse(localStorage.getItem("user"));
  if (!oldUser?.email) return;

  try {
    const res = await fetch(
      `https://kanha-backend-yfx1.onrender.com/api/users/me/${oldUser.email}`,
    );
    const user = await res.json();
    localStorage.setItem("user", JSON.stringify(user));
    console.log("✅ Refreshed user data");
  } catch (err) {
    console.error("Failed to fetch user info:", err);
  }
} // ✅ Call it on page load BEFORE booking.js runs

refreshUserData();

const seatMap = document.getElementById("seat-map");
const bookBtn = document.getElementById("book-btn");
const startDateInput = document.getElementById("start-date");
const durationInput = document.getElementById("duration");
const shiftInput = document.getElementById("shift");
const totalSeats = 34;
let bookings = [];
let userBookingsData = []; // <-- REAL USER BOOKINGS SAFE STORAGE

// REMOVE these since the new logic handles extension via globals and functions
// const urlParams = new URLSearchParams(window.location.search);
// const isExtension = urlParams.get('extend') === '1';
// let lockedSeatId = null;
// let lockedShift = null;
// let lockedFromDate = null;
// let lockedToDate = null;

// The logic inside this `if` block is now handled by setExtendMode/window.onload
// if (isExtension) { ... }

const amountDisplay = document.getElementById("amount-display");
let priceSettings = null;
async function fetchPrices() {
  const res = await fetch("https://kanha-backend-yfx1.onrender.com/api/prices");
  priceSettings = await res.json();
  window.priceSettings = priceSettings; // Expose globally for mobile bar logic
}
// === After your fetchPrices() definition ===

async function fetchPricesForLabels() {
  const API_URL = "https://kanha-backend-yfx1.onrender.com/api/prices";
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Failed to fetch prices");
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Using fallback prices due to error:", err);
    return { am: 600, pm: 600, full: 800 };
  }
}

async function updateShiftLabelsWithPrices() {
  const prices = await fetchPricesForLabels();
  const shiftSelect = document.getElementById("shift");
  if (!shiftSelect) return;

  const amPrice = prices.am || prices.AM || 0;
  const pmPrice = prices.pm || prices.PM || 0;
  const fullPrice = prices.full || prices.Full || 0;

  shiftSelect.querySelector('option[value="am"]').textContent =
    `🌅Morning |7 AM - 2 PM| (₹${amPrice})`;
  shiftSelect.querySelector('option[value="pm"]').textContent =
    `🌃Evening |2 PM - 10 PM| (₹${pmPrice})`;
  shiftSelect.querySelector('option[value="full"]').textContent =
    `☀️Full Day |7 AM - 10 PM| (₹${fullPrice})`;
}

// ✅ Run this as soon as the DOM is ready (before your window.onload)
document.addEventListener("DOMContentLoaded", updateShiftLabelsWithPrices);

function getDiscount(duration) {
  // ... (Existing logic remains) ...
  if (!priceSettings || !Array.isArray(priceSettings.offers)) return 0;
  let best = 0;
  for (const offer of priceSettings.offers) {
    if (duration >= offer.duration && offer.discount > best) {
      best = offer.discount;
    }
  }
  return best;
}

function getTotalAmount(base, duration, discount, pgPercent, convenience) {
  // ... (Existing logic remains) ...
  const subtotal = base * duration - discount;
  const pgFee = Math.round(((subtotal + convenience) * pgPercent) / 100);
  const total = subtotal + pgFee + convenience;
  return { subtotal, pgFee, convenience, total };
}

async function updateAmount() {
  // ... (Existing logic remains) ...
  const shift = shiftInput.value;
  const duration = parseInt(durationInput.value);
  if (!priceSettings) await fetchPrices();

  if (!shift || !duration || isNaN(duration)) {
    amountDisplay.innerText = "₹ 0";
    return;
  }

  let basePrice;
  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;

  if (user?.customPricing && user.customPricing[shift]) {
    basePrice = user.customPricing[shift];
  } else {
    basePrice = shift === "full" ? priceSettings.full : priceSettings[shift];
  }

  const discount = getDiscount(duration); // ✅ Detect payment mode

  const paymentMode =
    document.querySelector('input[name="paymentMode"]:checked')?.value ||
    "online"; // ✅ For cash: PG fee = 0, Convenience fee = 100

  const pgPercent =
    paymentMode === "cash" ? 0 : priceSettings.paymentGatewayFeePercent;
  const convenienceFee =
    paymentMode === "cash" ? 20 : priceSettings.convenienceFee;

  const { subtotal, pgFee, convenience, total } = getTotalAmount(
    basePrice,
    duration,
    discount,
    pgPercent,
    convenienceFee,
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
  // ... (Existing logic remains) ...
  if (!start) return null;
  const date = new Date(start);
  if (isNaN(date.getTime())) return null;

  date.setMonth(date.getMonth() + parseInt(months));
  date.setDate(date.getDate() - 1); // 👈 subtract 1 day
  return date.toISOString().split("T")[0];
}

async function fetchBookings() {
  // ... (Existing logic remains) ...
  const startDate = startDateInput.value;
  const duration = durationInput.value;

  if (!startDate || !duration) return;

  const endDate = calculateEndDate(startDate, duration);
  if (!endDate) return;

  try {
    const res = await fetch(
      `https://kanha-backend-yfx1.onrender.com/api/bookings?startDate=${startDate}&endDate=${endDate}`,
    );
    bookings = await res.json();
    renderSeats();
  } catch (err) {
    alert("Failed to load seat bookings");
  }
}

// ⚠️ MODIFIED renderSeats to handle the new `window.isExtensionMode` AND Rotated Layout (3 columns)
function renderSeats() {
  seatMap.innerHTML = "";

  // Create 3 columns to match index.html layout
  const col1 = document.createElement("div");
  col1.className = "seat-column"; // Seats 1-12

  const col2 = document.createElement("div");
  col2.className = "seat-column"; // Seats 13-23

  const col3 = document.createElement("div");
  col3.className = "seat-column"; // Seats 24-34

  // Append columns to seatMap in reverse order (to match index.html's row-reverse + DOM order)
  // DOM Order: col3, col2, col1 -> Visual (Row Reverse): [Col1] [Col2] [Col3]
  seatMap.appendChild(col3);
  seatMap.appendChild(col2);
  seatMap.appendChild(col1);

  for (let i = 1; i <= totalSeats; i++) {
    const seatId = `${i}`;
    const seat = document.createElement("div");
    seat.classList.add("seat");
    seat.dataset.seatId = seatId;

    const seatBookings = bookings.filter((b) => b.seatId === seatId);
    const hasFull = seatBookings.some((b) => b.shift === "full");
    const hasAM = seatBookings.some((b) => b.shift === "am");
    const hasPM = seatBookings.some((b) => b.shift === "pm");

    const selectedShift = shiftInput.value;
    let isSelectable = true;

    // Determine booking status
    if (hasFull || (hasAM && hasPM)) {
      seat.classList.add("booked");
      isSelectable = false;
    } else if (hasAM) {
      seat.classList.add("half-booked");
      if (selectedShift === "full" || selectedShift === "am")
        isSelectable = false;
    } else if (hasPM) {
      seat.classList.add("evening-booked");
      if (selectedShift === "full" || selectedShift === "pm")
        isSelectable = false;
    } else {
      seat.classList.add("available");
    }

    // Determine clickability based on mode
    let isClickable = isSelectable;

    if (window.isExtensionMode) {
      // In extension mode, ONLY the locked seat should be "selectable" (and automatically selected)
      if (seatId === window.extensionDetails.seatId) {
        // CHECK FOR CONFLICTS: Even in extension mode, we must respect existing bookings
        let isBlocked = false;
        if (hasFull) isBlocked = true;
        else if (selectedShift === "full" && (hasAM || hasPM)) isBlocked = true;
        else if (selectedShift === "am" && hasAM) isBlocked = true;
        else if (selectedShift === "pm" && hasPM) isBlocked = true;

        if (isBlocked) {
          seat.classList.add("booked"); // Visual indication (Red)
          seat.classList.remove("selected");
          seat.classList.remove("available");
          isClickable = false;
        } else {
          seat.classList.add("selected");
          // The extension seat is *effectively* selectable, but we don't need a click handler
          // as it's pre-selected. We still want to allow selection to show the highlight.
          isClickable = true;
        }
      } else {
        // Other seats are disabled when extending
        seat.classList.add("disabled");
        isClickable = false;
      }
    } else {
      // New Booking Mode: only available seats are clickable
      if (!isSelectable) {
        seat.classList.add("disabled");
        isClickable = false;
      }
    }

    if (isClickable) {
      seat.addEventListener("click", () => {
        document
          .querySelectorAll(".seat")
          .forEach((s) => s.classList.remove("selected"));
        seat.classList.add("selected");
        // If we switch to 'new' mode, we need to allow selection, but in 'extend' mode,
        // this only applies to the one designated seat.
      });
    } else if (!seat.classList.contains("disabled")) {
      // If it's not selectable for the current shift (e.g., trying full-day on a half-booked seat)
      seat.classList.add("disabled");
    }

    seat.innerText = i;

    // Distribute seats into columns
    if (i <= 12) {
      col1.appendChild(seat);
    } else if (i <= 23) {
      col2.appendChild(seat);
    } else {
      col3.appendChild(seat);
    }
  }
}

// ⚠️ MODIFIED bookBtn.addEventListener to check the new global flag
bookBtn.addEventListener("click", async () => {
  let seatId;
  let shift;
  let startDate;
  if (window.isExtensionMode) {
    seatId = window.extensionDetails.seatId;
    shift = window.extensionDetails.shift;
    startDate = startDateInput.value; // Get the start date from the input

    // Safety Check: Ensure the extension seat is not blocked/booked
    const seatEl = document.querySelector(`.seat[data-seat-id="${seatId}"]`);
    if (seatEl && seatEl.classList.contains("booked")) {
      return alert(
        'This seat is unavailable for the selected dates (already booked). Please switch to "Book a NEW Seat" to choose a different seat.',
      );
    }
  } else {
    const seat = document.querySelector(".seat.selected");
    if (!seat) return alert("Please select a seat.");
    seatId = seat.dataset.seatId;
    shift = shiftInput.value;
    startDate = startDateInput.value;
  }

  const duration = durationInput.value;

  if (!startDate || !duration || !shift)
    return alert("Fill all booking details.");

  const endDate = calculateEndDate(startDate, duration);
  if (!endDate) return alert("Invalid start date.");

  const userData = localStorage.getItem("user");
  const user = JSON.parse(userData);
  const email = user?.email;
  if (!email) return alert("Please login first.");

  const months = parseInt(duration);
  if (!months || isNaN(months)) return alert("Invalid duration selected.");

  const paymentMode = document.querySelector(
    'input[name="paymentMode"]:checked',
  ).value;

  if (paymentMode === "cash") {
    try {
      // ... (Cash booking logic remains the same, but uses new seatId, shift, startDate) ...
      if (!priceSettings) await fetchPrices();

      let basePrice;
      if (user?.customPricing && user.customPricing[shift]) {
        basePrice = user.customPricing[shift];
      } else {
        basePrice =
          shift === "full" ? priceSettings.full : priceSettings[shift];
      }

      const discount = getDiscount(duration); // Cash booking: add ₹100 convenience for cash (you already do)

      let amount = basePrice * duration - discount + 100;

      const res = await fetch(
        "https://kanha-backend-yfx1.onrender.com/api/book-cash",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seatId,
            shift,
            startDate,
            endDate,
            email,
            duration,
            amount,
            isExtension: window.isExtensionMode,
          }), // <-- Added isExtension flag
        },
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Booking failed.");
      } else {
        // prepare query string with useful info and cashRequestId (if returned)
        const qs = new URLSearchParams({
          success: "1",
          cash: "1",
          seatId,
          shift,
          startDate,
          endDate,
        });

        if (data.cashRequestId) qs.set("cashId", data.cashRequestId); // Redirect to index where the modal logic will handle cash=1 differently

        window.location.href = `index.html?${qs.toString()}`;
      }
    } catch (err) {
      console.error(err);
      alert("Cash booking request failed.");
    }
    return;
  } // 🟣 Online booking via PhonePe

  if (!priceSettings) await fetchPrices();
  let basePrice;

  if (user?.customPricing && user.customPricing[shift]) {
    basePrice = user.customPricing[shift];
  } else {
    basePrice = shift === "full" ? priceSettings.full : priceSettings[shift];
  }

  const discount = getDiscount(months);

  const { total: amount } = getTotalAmount(
    basePrice,
    months,
    discount,
    priceSettings.paymentGatewayFeePercent,
    priceSettings.convenienceFee,
  );

  try {
    const res = await fetch(
      "https://kanha-backend-yfx1.onrender.com/api/payment/initiate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" }, // ⚠️ MODIFIED body to include the isExtension flag
        body: JSON.stringify({
          amount,
          email,
          seatId,
          shift,
          startDate,
          endDate,
          isExtension: window.isExtensionMode,
        }),
      },
    );

    const data = await res.json();

    if (!res.ok || !data.redirectUrl) {
      return alert(data.message || "Payment initiation failed.");
    } // Store pending booking in session

    sessionStorage.setItem(
      "pendingBooking",
      JSON.stringify({
        seatId,
        shift,
        startDate,
        endDate,
        email,
        txnId: data.merchantTransactionId,
      }),
    );

    if (window.PhonePeCheckout && window.PhonePeCheckout.transact) {
      window.PhonePeCheckout.transact({
        tokenUrl: data.redirectUrl,
        callback: function (response) {
          console.log("📦 PhonePe response:", response); // No need to handle CONCLUDED here in REDIRECT mode
        },
        type: "REDIRECT",
      });
    } else {
      alert("PhonePe SDK not loaded");
    }
  } catch (err) {
    console.error(err);
    alert("Payment or booking failed.");
  }
});

[startDateInput, durationInput, shiftInput].forEach((input) => {
  input.addEventListener("change", () => {
    fetchBookings();
    updateAmount();
  });
});

// ⚠️ MODIFIED window.onload to use the new logic
window.onload = async () => {
  const today = new Date().toISOString().split("T")[0]; // 1. Remove the old URL param logic
  // 2. Call the new logic to determine the mode

  await checkAndLoadBookings(); // Set today's date if not in extension mode (where date is pre-set)

  if (!startDateInput.value) {
    startDateInput.value = today;
    startDateInput.min = today;
  } else if (startDateInput.value === "NaN-NaN-NaN") {
    // Failsafe for invalid date calculation during extension setup
    startDateInput.value = today;
    startDateInput.min = today;
  } else {
    // Ensure the date picker respects the calculated start date
    startDateInput.min = startDateInput.value;
  } // 3. Fetch bookings and update UI based on the determined mode
  // Ensure the correct seat is selected after seat map renders in EXTEND mode

  if (window.isExtensionMode) {
    const targetSeat = document.querySelector(
      `[data-seat-id="${window.extensionDetails.seatId}"]`,
    );
    if (targetSeat) {
      targetSeat.classList.add("selected");
      // Prevent manual un-selection of the locked seat
      document.querySelectorAll(".seat").forEach((s) => {
        if (s.dataset.seatId !== window.extensionDetails.seatId) {
          s.classList.add("disabled");
        }
      });
    }
  }

  document.querySelectorAll('input[name="paymentMode"]').forEach((radio) => {
    radio.addEventListener("change", updateAmount);
  });

  await updateAmount();
  setTimeout(() => {
    fetchBookings();
  }, 300);
};

// ... (The IIFE for mobile amount updates remains the same) ...
(function () {
  const API_PRICES = "https://kanha-backend-yfx1.onrender.com/api/prices";
  const mobileAmountEl = document.getElementById("mobile-amount");
  const shiftEl = document.getElementById("shift");
  const durationEl = document.getElementById("duration");
  const bookBtn = document.getElementById("book-btn");

  if (!mobileAmountEl) {
    console.warn("mobile-amount element not found. Script will not run.");
    return;
  } // Try to reuse already-fetched priceSettings if present (common in booking.js)

  let _prices = window.priceSettings || window._priceSettings || null;

  async function fetchPricesIfNeeded() {
    if (_prices) return _prices;
    try {
      const res = await fetch(API_PRICES);
      if (!res.ok) throw new Error("fetch failed");
      _prices = await res.json(); // also expose globally for reuse
      window._priceSettings = _prices;
      return _prices;
    } catch (e) {
      console.warn("Could not fetch prices, using fallback defaults.", e);
      _prices = {
        am: 500,
        pm: 400,
        full: 900,
        paymentGatewayFeePercent: 2.5,
        convenienceFee: 25,
        offers: [],
      };
      window._priceSettings = _prices;
      return _prices;
    }
  }

  function getDiscountForDuration(offers, months) {
    if (!Array.isArray(offers)) return 0;
    let best = 0;
    for (const o of offers) {
      const dur = Number(o.duration || 0);
      const disc = Number(o.discount || 0);
      if (months >= dur && disc > best) best = disc;
    }
    return best;
  }

  function computeTotal(basePrice, months, discount, pgPercent, convenience) {
    const baseTimesMonths = Number(basePrice) * Number(months);
    const subtotal = baseTimesMonths - Number(discount || 0);
    const pgFee = Math.round(
      ((subtotal + Number(convenience || 0)) * Number(pgPercent || 0)) / 100,
    );
    const total = subtotal + pgFee + Number(convenience || 0);
    return { subtotal, pgFee, convenience, total };
  }

  function formatINRWithSpace(n) {
    if (isNaN(n)) return "₹ 0"; // simple thousands separator
    return "₹ " + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  async function updateMobileAmount() {
    const prices = await fetchPricesIfNeeded();
    const shift = (shiftEl && shiftEl.value) || "am";
    const months = parseInt((durationEl && durationEl.value) || "1", 10) || 1; // try to use user customPricing if available

    let basePrice;
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (user && user.customPricing && user.customPricing[shift]) {
        basePrice = Number(user.customPricing[shift]);
      }
    } catch (e) {
      /* ignore */
    }

    if (!basePrice) {
      basePrice = shift === "full" ? prices.full || 0 : prices[shift] || 0;
    }

    const discount = getDiscountForDuration(prices.offers || [], months);

    const paymentMode =
      (document.querySelector('input[name="paymentMode"]:checked') || {})
        .value || "online";
    const pgPercent =
      paymentMode === "cash" ? 0 : prices.paymentGatewayFeePercent || 0;
    const convenience =
      paymentMode === "cash" ? 100 : prices.convenienceFee || 0;

    const { total } = computeTotal(
      basePrice,
      months,
      discount,
      pgPercent,
      convenience,
    ); // update the mobile amount span
    // update the mobile amount using the centralized helper (keeps currency + numeric spans)

    updateMobileBarAmount(total); // also update book button dataset so booking.js (if it reads it) can use it

    if (bookBtn) bookBtn.dataset.amount = total;

    return total;
  } // attach listeners

  if (durationEl) durationEl.addEventListener("change", updateMobileAmount);
  if (shiftEl) shiftEl.addEventListener("change", updateMobileAmount);
  document
    .querySelectorAll('input[name="paymentMode"]')
    .forEach((r) => r.addEventListener("change", updateMobileAmount)); // run on load (small delay to let other scripts finish)

  window.addEventListener("load", () => {
    setTimeout(updateMobileAmount, 150);
  }); // expose for manual calls

  window.__Kanha_updateMobileAmount = updateMobileAmount;
})();
function updateMobileBarAmount(numericAmount) {
  const mobileAmountEl = document.getElementById("mobile-amount");
  if (!mobileAmountEl) return; // if using structured HTML (currency + amount)
  const amountNum = mobileAmountEl.querySelector(".amount-num");
  if (amountNum) {
    amountNum.textContent = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(numericAmount ? numericAmount : 0); // ensure currency symbol exists
    if (!mobileAmountEl.querySelector(".currency")) {
      mobileAmountEl.insertAdjacentHTML(
        "afterbegin",
        '<span class="currency">₹</span>',
      );
    }
  } else {
    // fallback: plain text
    mobileAmountEl.textContent = "₹ " + (numericAmount ? numericAmount : 0);
  }
}

document.getElementById("mobile-book-btn").addEventListener("click", () => {
  document.getElementById("book-btn").click();
});
