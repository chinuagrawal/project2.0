async function fetchPendingBookings() {
  try {
    const res = await fetch('https://project20-production-e7f5.up.railway.app/api/pending-bookings');
    const bookings = await res.json();

    const tbody = document.getElementById('pending-bookings-body');
    tbody.innerHTML = '';

    bookings.forEach(booking => {
      const idsString = booking.ids.join(',');
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${booking.seatId}</td>
        <td>${booking.startDate} ➔ ${booking.endDate}</td>
        <td>${booking.shift}</td>
        <td>${booking.email}</td>
        <td>₹ ${booking.amount.toFixed(2)}</td>
        <td><button data-ids="${idsString}" data-amount="${booking.amount}">Mark as Paid</button></td>
      `;
      tbody.appendChild(row);
    });

    // Attach event listeners after rendering
    document.querySelectorAll('button[data-ids]').forEach(button => {
      button.addEventListener('click', () => {
        const ids = button.dataset.ids.split(',');
        const amount = parseFloat(button.dataset.amount);
        if (confirm(`Confirm you have received ₹${amount.toFixed(2)} in CASH?`)) {
          markAsPaid(ids);
        }
      });
    });

  } catch (err) {
    console.error(err);
    alert('Failed to load pending bookings');
  }
}


async function markAsPaid(ids) {
  try {
    const res = await fetch('https://project20-production-e7f5.up.railway.app/api/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Marked as Paid!');
      fetchPendingBookings();
    } else {
      alert(data.message || 'Failed to update.');
    }
  } catch (err) {
    console.error(err);
    alert('Error updating payment status.');
  }
}


window.onload = fetchPendingBookings;
