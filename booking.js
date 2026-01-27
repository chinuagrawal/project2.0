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
  window.isChangeSeatMode = false;
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

  // Create a container for the buttons to sit side-by-side
  const btnContainer = document.createElement("div");
  btnContainer.id = "action-buttons-container";
  btnContainer.style.display = "flex";
  btnContainer.style.justifyContent = "center";
  btnContainer.style.gap = "10px";
  btnContainer.style.alignItems = "center";
  btnContainer.style.marginTop = "10px";
  btnContainer.style.width = "100%";

  // Use a shorter text for the top bar button
  const newBookingBtn = createSwitchButton("New Seat", "new");
  newBookingBtn.style.margin = "0"; // Override CSS margin for flex layout

  // Create Change Seat Button
  const changeSeatBtn = document.createElement("button");
  changeSeatBtn.id = "change-seat-btn";
  changeSeatBtn.textContent = "Change Seat";

  // Match #switch-mode-btn style but with pink background
  changeSeatBtn.style.background = "#ec4899";
  changeSeatBtn.style.color = "white";
  changeSeatBtn.style.border = "none"; // No border for filled button
  changeSeatBtn.style.padding = "8px 20px"; // Match #switch-mode-btn
  changeSeatBtn.style.borderRadius = "30px"; // Match #switch-mode-btn
  changeSeatBtn.style.cursor = "pointer";
  changeSeatBtn.style.fontSize = "0.9rem"; // Match #switch-mode-btn
  changeSeatBtn.style.fontWeight = "600"; // Match #switch-mode-btn
  changeSeatBtn.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.05)";
  changeSeatBtn.style.fontFamily = '"Poppins", sans-serif';
  changeSeatBtn.style.transition = "all 0.3s ease";

  changeSeatBtn.addEventListener("mouseover", () => {
    changeSeatBtn.style.transform = "translateY(-2px)";
    changeSeatBtn.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.1)";
  });
  changeSeatBtn.addEventListener("mouseout", () => {
    changeSeatBtn.style.transform = "translateY(0)";
    changeSeatBtn.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.05)";
  });

  changeSeatBtn.addEventListener("click", () => {
    setChangeSeatMode(mostRecent);
  });

  // Append buttons to container (New Seat first, then Change Seat)
  btnContainer.appendChild(newBookingBtn);
  btnContainer.appendChild(changeSeatBtn);

  // Place below the H1 title
  const h1 = document.querySelector("h1");
  // Remove existing buttons/containers if any to avoid duplicates
  const existingContainer = document.getElementById("action-buttons-container");
  const existingSwitch = document.getElementById("switch-mode-btn");
  const existingChange = document.getElementById("change-seat-btn");

  if (existingContainer) existingContainer.remove();
  if (existingSwitch) existingSwitch.remove();
  if (existingChange) existingChange.remove();

  if (h1 && h1.parentNode) {
    h1.parentNode.insertBefore(btnContainer, h1.nextSibling);
  }

  // Also update main and mobile book buttons
  bookBtn.textContent = "Extend Booking";
  document.getElementById("mobile-book-btn").textContent = "Extend";

  // Re-fetch bookings for extension period
  fetchBookings();
}

function setChangeSeatMode(mostRecent) {
  window.isExtensionMode = false;
  window.isChangeSeatMode = true;

  const today = new Date().toISOString().split("T")[0];
  const endDate = mostRecent.end;

  window.changeSeatDetails = {
    oldSeatId: mostRecent.seatId,
    shift: mostRecent.shift,
    startDate: today,
    endDate: endDate,
  };

  // Update Inputs
  if (shiftInput) {
    shiftInput.value = mostRecent.shift;
    shiftInput.disabled = true;
  }
  if (startDateInput) {
    startDateInput.value = today;
    startDateInput.disabled = true; // Fixed start date
  }
  if (durationInput) {
    durationInput.disabled = true; // Duration fixed by range
  }

  // Update UI
  document.querySelector("h1").textContent = `Change Seat ${mostRecent.seatId}`;

  // Button to Cancel Change (Go back to Extend)
  const btnContainer = document.createElement("div");
  btnContainer.id = "action-buttons-container";
  btnContainer.style.display = "flex";
  btnContainer.style.justifyContent = "center";
  btnContainer.style.width = "100%";
  btnContainer.style.marginTop = "10px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel Change";
  cancelBtn.style.background = "#6b7280";
  cancelBtn.style.color = "white";
  cancelBtn.style.border = "none";
  cancelBtn.style.padding = "8px 20px";
  cancelBtn.style.borderRadius = "30px";
  cancelBtn.style.cursor = "pointer";
  cancelBtn.style.fontSize = "0.9rem";
  cancelBtn.style.fontWeight = "600";
  cancelBtn.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.05)";
  cancelBtn.style.fontFamily = '"Poppins", sans-serif';

  cancelBtn.addEventListener("click", () => {
    // Reload or call checkAndLoadBookings to reset
    window.location.reload();
  });

  btnContainer.appendChild(cancelBtn);

  const h1 = document.querySelector("h1");
  // Remove existing buttons
  const existingContainer = document.getElementById("action-buttons-container");
  const existingSwitch = document.getElementById("switch-mode-btn");
  const existingChange = document.getElementById("change-seat-btn");

  if (existingContainer) existingContainer.remove();
  if (existingSwitch) existingSwitch.remove();
  if (existingChange) existingChange.remove();

  if (h1 && h1.parentNode) {
    h1.parentNode.insertBefore(btnContainer, h1.nextSibling);
  }

  bookBtn.textContent = "Pay ₹49 & Change";
  document.getElementById("mobile-book-btn").textContent = "Pay";

  // Fetch bookings for the change period
  fetchBookings();
  updateAmount();
  if (window.__Kanha_updateMobileAmount) window.__Kanha_updateMobileAmount();
}

/**
 * Sets the page to the 'New Booking' flow.
 */
function setNewBookingMode() {
  window.isExtensionMode = false;
  window.isChangeSeatMode = false;
  window.extensionDetails = null;
  window.changeSeatDetails = null;

  // Ensure inputs are enabled and reset
  if (shiftInput) shiftInput.disabled = false;
  if (startDateInput) startDateInput.disabled = false;
  if (durationInput) durationInput.disabled = false;

  // Reset UI text
  document.querySelector("h1").textContent = `Library Seat Booking`;
  bookBtn.textContent = "Pay";
  document.getElementById("mobile-book-btn").textContent = "Pay";

  // Add the "Switch to EXTEND" button
  const btnContainer = document.createElement("div");
  btnContainer.id = "action-buttons-container";
  btnContainer.style.display = "flex";
  btnContainer.style.justifyContent = "center";
  btnContainer.style.width = "100%";
  btnContainer.style.marginTop = "10px";

  const newBookingBtn = createSwitchButton("Extend Seat", "extend");
  newBookingBtn.style.margin = "0"; // Override CSS margin
  btnContainer.appendChild(newBookingBtn);

  // Remove Change Seat button if exists
  const existingContainer = document.getElementById("action-buttons-container");
  const existingChange = document.getElementById("change-seat-btn");

  if (existingContainer) existingContainer.remove();
  if (existingChange) existingChange.remove();

  // Place below the H1 title
  const h1 = document.querySelector("h1");
  if (h1 && h1.parentNode) {
    h1.parentNode.insertBefore(btnContainer, h1.nextSibling);
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
    // Styling is now handled by CSS (#switch-mode-btn)
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
  if (window.isChangeSeatMode) {
    amountDisplay.innerHTML = `
        <div class="price-breakdown">
          <div><span>Seat Change Fee</span> <span>₹49</span></div>
          <hr>
          <div class="total"><span>Total Amount</span> <span>₹49</span></div>
        </div>
      `;
    updateMobileBarAmount(49);
    if (bookBtn) bookBtn.dataset.amount = 49;
    return;
  }

  // ... (Existing logic remains) ...
  const shift = shiftInput.value;
  const duration = parseInt(durationInput.value);
  if (!priceSettings) await fetchPrices();

  if (!shift || !duration || isNaN(duration)) {
    amountDisplay.innerText = "₹ 0";
    updateMobileBarAmount(0);
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
  updateMobileBarAmount(total);
  if (bookBtn) bookBtn.dataset.amount = total;
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
  const startDate = startDateInput.value;
  const duration = durationInput.value;

  let endDate;
  if (window.isChangeSeatMode && window.changeSeatDetails) {
    endDate = window.changeSeatDetails.endDate;
    // startDate is already set to Today in setChangeSeatMode
  } else {
    if (!startDate || !duration) return;
    endDate = calculateEndDate(startDate, duration);
  }

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

  const selectedShift = shiftInput.value;

  // ---------------------------------------------------------
  // 🧠 OPTIMIZATION LOGIC:
  // If user wants AM, and there are seats with PM booked (but AM free),
  // FORCE them to pick those seats first. (Block fully empty seats).
  // Same for PM (force pick AM-booked seats).
  // ---------------------------------------------------------
  let restrictFullyEmptySeats = false;

  if (
    !window.isExtensionMode &&
    (selectedShift === "am" || selectedShift === "pm")
  ) {
    // Check if any "Perfect Match" exists
    for (let i = 1; i <= totalSeats; i++) {
      const sId = `${i}`;
      const sBookings = bookings.filter((b) => b.seatId === sId);
      const sFull = sBookings.some((b) => b.shift === "full");
      const sAM = sBookings.some((b) => b.shift === "am");
      const sPM = sBookings.some((b) => b.shift === "pm");

      if (selectedShift === "am") {
        // Looking for a seat that is FREE for AM, but BOOKED for PM
        if (!sFull && !sAM && sPM) {
          restrictFullyEmptySeats = true;
          break;
        }
      } else if (selectedShift === "pm") {
        // Looking for a seat that is FREE for PM, but BOOKED for AM
        if (!sFull && !sPM && sAM) {
          restrictFullyEmptySeats = true;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------
  // 📢 GUIDANCE MESSAGE LOGIC
  // ---------------------------------------------------------
  const guidanceMsgEl = document.getElementById("seat-guidance-msg");
  if (guidanceMsgEl) {
    guidanceMsgEl.style.display = "block";
    guidanceMsgEl.innerHTML = ""; // Clear previous

    if (window.isExtensionMode) {
      guidanceMsgEl.innerHTML =
        "You are extending your current seat. Please proceed to payment.";
    } else {
      if (selectedShift === "am") {
        if (restrictFullyEmptySeats) {
          guidanceMsgEl.innerHTML = `Please select a <span style="color: #a855f7; font-weight: bold;">PURPLE</span> seat.`;
        } else {
          guidanceMsgEl.innerHTML = `Please select a <span style="color: #6b7280; font-weight: bold;">WHITE</span> seat.`;
        }
      } else if (selectedShift === "pm") {
        if (restrictFullyEmptySeats) {
          guidanceMsgEl.innerHTML = `Please select an <span style="color: #f97316; font-weight: bold;">ORANGE</span> seat.`;
        } else {
          guidanceMsgEl.innerHTML = `Please select a <span style="color: #6b7280; font-weight: bold;">WHITE</span> seat.`;
        }
      } else if (selectedShift === "full") {
        guidanceMsgEl.innerHTML = `Please select a <span style="color: #6b7280; font-weight: bold;">WHITE</span> seat.`;
      } else {
        guidanceMsgEl.style.display = "none";
      }
    }
  }

  for (let i = 1; i <= totalSeats; i++) {
    const seatId = `${i}`;
    const seat = document.createElement("div");
    seat.classList.add("seat");
    seat.dataset.seatId = seatId;

    const seatBookings = bookings.filter((b) => b.seatId === seatId);
    const hasFull = seatBookings.some((b) => b.shift === "full");
    const hasAM = seatBookings.some((b) => b.shift === "am");
    const hasPM = seatBookings.some((b) => b.shift === "pm");

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

      // 🔒 APPLY RESTRICTION HERE
      if (restrictFullyEmptySeats) {
        // This is a fully available seat, but we are restricting them
        // because a "better fit" seat exists.
        isSelectable = false;
        seat.title =
          "Please select a half-booked seat to optimize library capacity.";
      }
    }

    // Determine clickability based on mode
    let isClickable = isSelectable;

    if (window.isChangeSeatMode) {
      // Change Seat Mode Logic
      if (seatId === window.changeSeatDetails.oldSeatId) {
        // This is the current seat
        seat.classList.add("booked");
        seat.style.backgroundColor = "#6b7280"; // Gray to indicate "Current"
        seat.innerText = "Curr";
        isClickable = false;
      } else {
        // Standard availability rules apply
        if (!isSelectable) {
          seat.classList.add("disabled");
          isClickable = false;
        }
      }
    } else if (window.isExtensionMode) {
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
  // Visual feedback: Prevent double clicks
  const originalText = bookBtn.textContent;
  bookBtn.disabled = true;
  bookBtn.textContent = "Processing...";

  try {
    if (window.isChangeSeatMode) {
      const seat = document.querySelector(".seat.selected");
      if (!seat) throw new Error("Please select a new seat.");
      const newSeatId = seat.dataset.seatId;

      const { oldSeatId, startDate, endDate, shift } =
        window.changeSeatDetails || {};
      if (!oldSeatId) throw new Error("Missing seat change details.");

      const user = JSON.parse(localStorage.getItem("user"));
      if (!user?.email) throw new Error("Please login.");

      const res = await fetch(
        "https://kanha-backend-yfx1.onrender.com/api/payment/initiate-change-seat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            oldSeatId,
            newSeatId,
            startDate,
            endDate,
            shift,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Failed to initiate seat change.");

      if (window.PhonePeCheckout && window.PhonePeCheckout.transact) {
        window.PhonePeCheckout.transact({
          tokenUrl: data.redirectUrl,
          callback: function (response) {
            console.log("📦 PhonePe response:", response);
          },
          type: "REDIRECT",
        });
      } else {
        window.location.href = data.redirectUrl;
      }
      return;
    }

    let seatId;
    let shift;
    let startDate;
    if (window.isExtensionMode) {
      seatId = window.extensionDetails?.seatId;
      shift = window.extensionDetails?.shift;
      startDate = startDateInput.value;

      const seatEl = document.querySelector(`.seat[data-seat-id="${seatId}"]`);
      if (seatEl && seatEl.classList.contains("booked")) {
        throw new Error(
          'This seat is unavailable for the selected dates. Please switch to "Book a NEW Seat".',
        );
      }
    } else {
      const seat = document.querySelector(".seat.selected");
      if (!seat) throw new Error("Please select a seat.");
      seatId = seat.dataset.seatId;
      shift = shiftInput.value;
      startDate = startDateInput.value;
    }

    const duration = durationInput.value;

    if (!startDate || !duration || !shift)
      throw new Error("Fill all booking details.");

    const endDate = calculateEndDate(startDate, duration);
    if (!endDate) throw new Error("Invalid start date.");

    const userData = localStorage.getItem("user");
    const user = JSON.parse(userData);
    const email = user?.email;
    if (!email) throw new Error("Please login first.");

    const months = parseInt(duration);
    if (!months || isNaN(months)) throw new Error("Invalid duration selected.");

    const paymentMode = document.querySelector(
      'input[name="paymentMode"]:checked',
    ).value;

    if (paymentMode === "cash") {
      // ... (Cash booking logic) ...
      if (!priceSettings) await fetchPrices();

      let basePrice;
      if (user?.customPricing && user.customPricing[shift]) {
        basePrice = user.customPricing[shift];
      } else {
        basePrice =
          shift === "full" ? priceSettings.full : priceSettings[shift];
      }

      const discount = getDiscount(duration);
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
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Booking failed.");

      const qs = new URLSearchParams({
        success: "1",
        cash: "1",
        seatId,
        shift,
        startDate,
        endDate,
      });

      if (data.cashRequestId) qs.set("cashId", data.cashRequestId);
      window.location.href = `index.html?${qs.toString()}`;
      return;
    }

    // 🟣 Online booking via PhonePe
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

    const res = await fetch(
      "https://kanha-backend-yfx1.onrender.com/api/payment/initiate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      throw new Error(data.message || "Payment initiation failed.");
    }

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
          console.log("📦 PhonePe response:", response);
        },
        type: "REDIRECT",
      });
    } else {
      window.location.href = data.redirectUrl;
    }
  } catch (err) {
    console.error(err);
    alert(err.message || "An error occurred.");
    bookBtn.disabled = false;
    bookBtn.textContent = originalText;
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

// Expose updateMobileBarAmount to window so it can be used if needed
window.__Kanha_updateMobileAmount = updateAmount;

document.getElementById("mobile-book-btn").addEventListener("click", () => {
  document.getElementById("book-btn").click();
});
