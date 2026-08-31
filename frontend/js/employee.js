const user = Auth.requireRole('employee');

if (user) {
  document.getElementById('sbName').textContent = user.name;
  document.getElementById('sbRole').textContent = user.role;
  document.getElementById('firstName').textContent = user.name.split(' ')[0];
}

/* ---------- Live clock ---------- */
function tickClock() {
  const now = new Date();
  document.getElementById('liveClock').textContent = now.toLocaleTimeString();
  document.getElementById('liveDate').textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  document.getElementById('todayLabel').textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}
tickClock();
setInterval(tickClock, 1000);

/* ---------- Today's status + buttons ---------- */
async function loadToday() {
  const { record } = await apiRequest('/attendance/today');
  const btnIn = document.getElementById('btnCheckIn');
  const btnOut = document.getElementById('btnCheckOut');
  const note = document.getElementById('statusNote');

  if (!record || !record.check_in) {
    btnIn.style.display = 'inline-flex';
    btnOut.style.display = 'none';
    btnIn.disabled = false;
    note.textContent = "You haven't checked in yet today.";
  } else if (record.check_in && !record.check_out) {
    btnIn.style.display = 'none';
    btnOut.style.display = 'inline-flex';
    note.textContent = `Checked in at ${record.check_in}. Don't forget to check out!`;
  } else {
    btnIn.style.display = 'none';
    btnOut.style.display = 'none';
    note.textContent = `Today: ${record.status} · Checked in ${record.check_in} · Checked out ${record.check_out} · ${record.working_hours}h worked.`;
  }
}

document.getElementById('btnCheckIn').addEventListener('click', async () => {
  try {
    const data = await apiRequest('/attendance/check-in', { method: 'POST' });
    toast(data.message, 'success');
    await Promise.all([loadToday(), loadHistory(), loadProfile()]);
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('btnCheckOut').addEventListener('click', async () => {
  try {
    const data = await apiRequest('/attendance/check-out', { method: 'POST' });
    toast(data.message, 'success');
    await Promise.all([loadToday(), loadHistory(), loadProfile()]);
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Leave modal ---------- */
function openLeaveModal() {
  const modal = document.getElementById('leaveModal');
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('leaveDate').min = today;
  document.getElementById('leaveDate').value = today;
  modal.classList.add('show');
}
function closeLeaveModal() { document.getElementById('leaveModal').classList.remove('show'); }
document.getElementById('btnLeave').addEventListener('click', openLeaveModal);

document.getElementById('confirmLeave').addEventListener('click', async () => {
  const date = document.getElementById('leaveDate').value;
  const remarks = document.getElementById('leaveRemarks').value.trim();
  if (!date) { toast('Please choose a date.', 'error'); return; }
  try {
    const data = await apiRequest('/attendance/apply-leave', { method: 'POST', body: { date, remarks } });
    toast(data.message, 'success');
    closeLeaveModal();
    await Promise.all([loadHistory(), loadProfile(), loadToday()]);
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Profile / leave balance / month stats ---------- */
async function loadProfile() {
  const { user: me } = await apiRequest('/attendance/me');
  document.getElementById('leaveBalance').innerHTML = `${me.leave_balance}<span>days left</span>`;
}

/* ---------- History table ---------- */
async function loadHistory(month) {
  const query = month ? `?month=${month}` : '';
  const { records } = await apiRequest(`/attendance/history${query}`);
  const body = document.getElementById('historyBody');

  if (!records.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="5">No attendance records yet — check in to get started.</td></tr>`;
  } else {
    body.innerHTML = records.map(r => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td>${r.check_in || '—'}</td>
        <td>${r.check_out || '—'}</td>
        <td>${r.working_hours ? r.working_hours + ' h' : '—'}</td>
        <td><span class="pill ${pillClass(r.status)}">${r.status}</span></td>
      </tr>
    `).join('');
  }

  const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const totalHours = records.reduce((sum, r) => sum + (r.working_hours || 0), 0);
  document.getElementById('monthPresent').textContent = presentCount;
  document.getElementById('monthHours').textContent = `${totalHours.toFixed(1)} h`;
}

document.getElementById('monthFilter').addEventListener('change', (e) => {
  loadHistory(e.target.value);
});
(function initMonthFilter() {
  const now = new Date();
  const val = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('monthFilter').value = val;
})();

/* ---------- Init ---------- */
(async function init() {
  try {
    await Promise.all([loadToday(), loadProfile(), loadHistory(document.getElementById('monthFilter').value)]);
  } catch (err) {
    toast(err.message, 'error');
  }
})();
