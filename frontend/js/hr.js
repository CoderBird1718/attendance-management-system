const user = Auth.requireRole('hr');
let currentEditId = null;

if (user) {
  document.getElementById('sbName').textContent = user.name;
  document.getElementById('sbRole').textContent = user.role;
}

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    ['overview', 'employees', 'attendance'].forEach(t => {
      document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'employees') loadEmployees();
  });
});

/* ---------- Overview ---------- */
function todayISO() { return new Date().toISOString().slice(0, 10); }

async function loadOverview(date) {
  const d = date || todayISO();
  const [summary, records] = await Promise.all([
    apiRequest(`/hr/dashboard?date=${d}`),
    apiRequest(`/hr/attendance?date=${d}`),
  ]);

  document.getElementById('statTotal').textContent = summary.totalEmployees;
  document.getElementById('statPresent').textContent = summary.presentToday;
  document.getElementById('statLate').textContent = summary.lateToday;
  document.getElementById('statAbsent').textContent = summary.absentToday;

  const body = document.getElementById('overviewBody');
  if (!records.records.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6">No attendance marked for this date yet.</td></tr>`;
  } else {
    body.innerHTML = records.records.map(r => `
      <tr>
        <td>${r.employee_name}</td>
        <td>${r.department}</td>
        <td>${r.check_in || '—'}</td>
        <td>${r.check_out || '—'}</td>
        <td>${r.working_hours ? r.working_hours + ' h' : '—'}</td>
        <td><span class="pill ${pillClass(r.status)}">${r.status}</span></td>
      </tr>
    `).join('');
  }
}

document.getElementById('overviewDate').addEventListener('change', (e) => loadOverview(e.target.value));
document.getElementById('overviewDate').value = todayISO();

document.getElementById('btnMarkAbsent').addEventListener('click', async () => {
  const date = document.getElementById('overviewDate').value || todayISO();
  if (!confirm(`Mark all employees without an attendance record on ${date} as Absent?`)) return;
  try {
    const data = await apiRequest('/hr/mark-absentees', { method: 'POST', body: { date } });
    toast(data.message, 'success');
    loadOverview(date);
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Employees ---------- */
async function loadEmployees() {
  const { employees } = await apiRequest('/hr/employees');
  const body = document.getElementById('employeesBody');
  if (!employees.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="7">No employees yet — add your first one.</td></tr>`;
    return;
  }
  body.innerHTML = employees.map(e => `
    <tr>
      <td>${e.name}</td>
      <td>${e.email}</td>
      <td>${e.department}</td>
      <td>${e.designation}</td>
      <td>${e.leave_balance}</td>
      <td>${e.is_active ? '<span class="pill Present">Active</span>' : '<span class="pill Absent">Inactive</span>'}</td>
      <td style="display:flex; gap:6px;">
        <button class="btn btn-outline btn-sm" onclick='openEditModal(${JSON.stringify(e)})'>Edit</button>
        ${e.is_active ? `<button class="btn btn-danger btn-sm" onclick="deactivateEmployee(${e.id})">Deactivate</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function openEmpModal() { document.getElementById('empModal').classList.add('show'); }
function closeEmpModal() {
  document.getElementById('empModal').classList.remove('show');
  ['newName', 'newEmail', 'newDept', 'newDesig', 'newPassword'].forEach(id => document.getElementById(id).value = '');
}
document.getElementById('btnAddEmployee').addEventListener('click', openEmpModal);

document.getElementById('confirmAddEmployee').addEventListener('click', async () => {
  const payload = {
    name: document.getElementById('newName').value.trim(),
    email: document.getElementById('newEmail').value.trim(),
    department: document.getElementById('newDept').value.trim() || 'General',
    designation: document.getElementById('newDesig').value.trim() || 'Employee',
    password: document.getElementById('newPassword').value,
  };
  if (!payload.name || !payload.email || !payload.password) {
    toast('Name, email and password are required.', 'error'); return;
  }
  try {
    const data = await apiRequest('/hr/employees', { method: 'POST', body: payload });
    toast(data.message, 'success');
    closeEmpModal();
    loadEmployees();
  } catch (err) {
    toast(err.message, 'error');
  }
});

function openEditModal(emp) {
  currentEditId = emp.id;
  document.getElementById('editWho').textContent = `${emp.name} · ${emp.email}`;
  document.getElementById('editDept').value = emp.department;
  document.getElementById('editDesig').value = emp.designation;
  document.getElementById('editLeave').value = emp.leave_balance;
  document.getElementById('editModal').classList.add('show');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('show'); currentEditId = null; }

document.getElementById('confirmEditEmployee').addEventListener('click', async () => {
  if (!currentEditId) return;
  const payload = {
    department: document.getElementById('editDept').value.trim(),
    designation: document.getElementById('editDesig').value.trim(),
    leave_balance: parseFloat(document.getElementById('editLeave').value),
  };
  try {
    const data = await apiRequest(`/hr/employees/${currentEditId}`, { method: 'PUT', body: payload });
    toast(data.message, 'success');
    closeEditModal();
    loadEmployees();
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function deactivateEmployee(id) {
  if (!confirm('Deactivate this employee? They will no longer be able to log in.')) return;
  try {
    const data = await apiRequest(`/hr/employees/${id}`, { method: 'DELETE' });
    toast(data.message, 'success');
    loadEmployees();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---------- Attendance records (filters) ---------- */
document.getElementById('btnFilter').addEventListener('click', async () => {
  const from = document.getElementById('filterFrom').value;
  const to = document.getElementById('filterTo').value;
  const status = document.getElementById('filterStatus').value;
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (status) params.set('status', status);

  try {
    const { records } = await apiRequest(`/hr/attendance?${params.toString()}`);
    const body = document.getElementById('recordsBody');
    if (!records.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="7">No records match these filters.</td></tr>`;
    } else {
      body.innerHTML = records.map(r => `
        <tr>
          <td>${formatDate(r.date)}</td>
          <td>${r.employee_name}</td>
          <td>${r.department}</td>
          <td>${r.check_in || '—'}</td>
          <td>${r.check_out || '—'}</td>
          <td>${r.working_hours ? r.working_hours + ' h' : '—'}</td>
          <td><span class="pill ${pillClass(r.status)}">${r.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Init ---------- */
(async function init() {
  try {
    await loadOverview(todayISO());
  } catch (err) {
    toast(err.message, 'error');
  }
})();
