const DB_KEY = "goaltrack_database_v1";
const SESSION_KEY = "goaltrack_session_v1";

const seedUsers = [
  { id: "u1", name: "Emma Johnson", email: "emma@company.com", password: "password123", role: "employee" },
  { id: "u2", name: "Noah Singh", email: "noah@company.com", password: "password123", role: "employee" },
  { id: "u3", name: "Maria Garcia", email: "maria@company.com", password: "password123", role: "manager" }
];

function createSeedDatabase() {
  return {
    users: [...seedUsers],
    goals: [],
    notifications: []
  };
}

function getDb() {
  if (window.goalTrackMemoryDb) return window.goalTrackMemoryDb;

  try {
    const saved = localStorage.getItem(DB_KEY);
    if (!saved) {
      const db = createSeedDatabase();
      saveDb(db);
      return db;
    }

    const db = JSON.parse(saved);
    seedUsers.forEach((seedUser) => {
      if (!db.users.some((user) => user.id === seedUser.id)) {
        db.users.push(seedUser);
      }
    });
    db.goals = db.goals || [];
    db.notifications = db.notifications || [];
    saveDb(db);
    return db;
  } catch {
    const db = createSeedDatabase();
    return db;
  }
}

function saveDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    window.goalTrackMemoryDb = db;
  }
}

function setSession(user) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, role: user.role }));
  } catch {
    window.goalTrackMemorySession = { userId: user.id, role: user.role };
  }
}

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    if (window.goalTrackMemorySession) return window.goalTrackMemorySession;
  }

  const params = new URLSearchParams(window.location.search);
  const userId = params.get("user");
  const role = params.get("role");
  return userId && role ? { userId, role } : null;
}

function dashboardUrlFor(user) {
  const page = user.role === "manager" ? "manager-dashboard.html" : "employee-dashboard.html";
  const params = new URLSearchParams({ user: user.id, role: user.role });
  return `${page}?${params.toString()}`;
}

function currentUser(requiredRole) {
  const session = getSession();
  const db = getDb();
  const user = session ? db.users.find((item) => item.id === session.userId) : null;
  if (!user || user.role !== requiredRole) {
    window.location.href = requiredRole === "manager" ? "manager-login.html" : "employee-login.html";
    return null;
  }
  return user;
}

function badge(status) {
  const normalized = status || "draft";
  const label = normalized === "pending" ? "Pending Approval" : normalized[0].toUpperCase() + normalized.slice(1);
  return `<span class="badge ${normalized}">${label}</span>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loginInit() {
  const form = document.querySelector("[data-login-role]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const db = getDb();
    const role = form.dataset.loginRole;
    const data = new FormData(form);
    const email = data.get("email").trim().toLowerCase();
    const password = data.get("password");
    const error = form.querySelector(".form-error");
    const user = db.users.find((item) => item.email === email && item.password === password && item.role === role);

    if (!user) {
      error.textContent = `No ${role} account found for those credentials.`;
      return;
    }

    setSession(user);
    window.location.href = dashboardUrlFor(user);
  });
}

function logoutInit() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        window.goalTrackMemorySession = null;
      }
      window.goalTrackMemorySession = null;
      window.location.href = "index.html";
    });
  });
}

function getEmployeeGoals(userId) {
  return getDb().goals.filter((goal) => goal.user_id === userId);
}

function groupStatus(goals) {
  if (!goals.length) return "draft";
  if (goals.every((goal) => goal.status === "approved")) return "approved";
  if (goals.some((goal) => goal.status === "pending")) return "pending";
  return "draft";
}

function totalWeight(goals) {
  return goals.reduce((sum, goal) => sum + Number(goal.weightage || 0), 0);
}

function validateGoals(goals) {
  if (goals.length === 0) return "Add at least one goal before submitting.";
  if (goals.length > 8) return "You can submit a maximum of 8 goals.";
  if (goals.some((goal) => Number(goal.weightage) < 10)) return "Each goal must have at least 10% weightage.";
  if (totalWeight(goals) !== 100) return "Total goal weightage must equal exactly 100%.";
  return "";
}

function ensurePendingNotifications(db) {
  const managers = db.users.filter((user) => user.role === "manager");
  const pendingEmployeeIds = [...new Set(db.goals.filter((goal) => goal.status === "pending").map((goal) => goal.user_id))];

  pendingEmployeeIds.forEach((employeeId) => {
    const employee = db.users.find((user) => user.id === employeeId);
    if (!employee) return;

    managers.forEach((manager) => {
      const alreadyExists = db.notifications.some((notification) =>
        notification.user_id === manager.id &&
        notification.employee_id === employee.id &&
        notification.type === "goal_submission" &&
        !notification.is_read
      );

      if (!alreadyExists) {
        db.notifications.push({
          id: makeId("notification"),
          user_id: manager.id,
          message: `${employee.name} has submitted goals`,
          employee_id: employee.id,
          type: "goal_submission",
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
    });
  });
}

function renderAttachment(goal) {
  if (!goal.file_url) return `<span class="muted">No attachment</span>`;
  const preview = goal.file_type && goal.file_type.startsWith("image/")
    ? `<img class="attachment-preview" src="${goal.file_url}" alt="${goal.file_name}" />`
    : "";
  return `
    <div class="attachment">
      ${preview}
      <a href="${goal.file_url}" target="_blank" download="${goal.file_name || "attachment"}">Preview / download</a>
    </div>
  `;
}

function renderEmployeeDashboard() {
  const user = currentUser("employee");
  if (!user) return;

  const db = getDb();
  const goals = db.goals.filter((goal) => goal.user_id === user.id);
  const status = groupStatus(goals);
  const locked = status === "pending" || status === "approved";
  const list = document.getElementById("employeeGoals");
  const form = document.getElementById("goalForm");
  const submitButton = document.getElementById("submitGoals");
  const submitHelp = document.getElementById("submitHelp");

  document.getElementById("employeeName").textContent = `${user.name}'s Goals`;
  document.getElementById("goalStatus").innerHTML = badge(status);
  document.getElementById("goalCount").textContent = `${goals.length} / 8`;
  document.getElementById("totalWeight").textContent = `${totalWeight(goals)}%`;
  document.getElementById("formStatusBadge").outerHTML = badge(status).replace("<span", '<span id="formStatusBadge"');

  form.querySelectorAll("input, textarea, button").forEach((control) => {
    if (control.id !== "resetForm") control.disabled = locked;
  });
  submitButton.disabled = locked || goals.length === 0;
  submitButton.textContent = status === "draft" ? `Submit Goals (${totalWeight(goals)}% / 100%)` : "Submit Goals";
  submitHelp.textContent = locked
    ? "Goals are locked while pending approval or after approval."
    : "Save draft goals first. Submit is enabled when saved goals total exactly 100%.";

  if (!goals.length) {
    list.innerHTML = `<div class="empty-state">No goals yet. Add up to 8 goals with a total weightage of 100%.</div>`;
    return;
  }

  list.innerHTML = goals.map((goal) => `
    <article class="goal-card" id="${goal.id}">
      <div class="goal-card-header">
        <div>
          <h3>${goal.title}</h3>
          ${badge(goal.status)}
        </div>
        <div class="goal-actions">
          <button class="ghost-button small" data-edit="${goal.id}" ${locked ? "disabled" : ""}>Edit</button>
          <button class="danger-button small" data-delete="${goal.id}" ${locked ? "disabled" : ""}>Delete</button>
        </div>
      </div>
      <p>${goal.description}</p>
      <dl>
        <div><dt>Target</dt><dd>${goal.target}</dd></div>
        <div><dt>Weightage</dt><dd>${goal.weightage}%</dd></div>
      </dl>
      ${renderAttachment(goal)}
    </article>
  `).join("");
}

async function fileToDataUrl(file) {
  if (!file) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function employeeDashboardInit() {
  if (document.body.dataset.page !== "employee") return;
  const user = currentUser("employee");
  if (!user) return;

  const form = document.getElementById("goalForm");
  const error = form.querySelector(".form-error");
  const success = form.querySelector(".form-success");
  const submitError = document.getElementById("submitError");

  renderEmployeeDashboard();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const db = getDb();
    const goals = db.goals.filter((goal) => goal.user_id === user.id);
    const data = new FormData(form);
    const goalId = data.get("goalId");
    const editing = goals.find((goal) => goal.id === goalId);
    const file = data.get("file");
    const weightage = Number(data.get("weightage"));
    error.textContent = "";
    success.textContent = "";
    submitError.textContent = "";

    if (goals.length >= 8 && !editing) {
      error.textContent = "You can create a maximum of 8 goals.";
      return;
    }
    if (weightage < 10) {
      error.textContent = "Each goal needs at least 10% weightage.";
      return;
    }

    const fileUrl = file && file.size ? await fileToDataUrl(file) : editing?.file_url || "";
    const payload = {
      id: editing?.id || makeId("goal"),
      user_id: user.id,
      title: data.get("title").trim(),
      description: data.get("description").trim(),
      target: data.get("target").trim(),
      weightage,
      file_url: fileUrl,
      file_name: file && file.size ? file.name : editing?.file_name || "",
      file_type: file && file.size ? file.type : editing?.file_type || "",
      status: "draft"
    };

    if (editing) {
      Object.assign(editing, payload);
    } else {
      db.goals.push(payload);
    }

    saveDb(db);
    form.reset();
    form.goalId.value = "";
    success.textContent = "Goal saved as draft. Add more goals or submit when total weightage is 100%.";
    renderEmployeeDashboard();
  });

  document.getElementById("employeeGoals").addEventListener("click", (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    const db = getDb();

    if (editId) {
      const goal = db.goals.find((item) => item.id === editId);
      form.goalId.value = goal.id;
      form.title.value = goal.title;
      form.description.value = goal.description;
      form.target.value = goal.target;
      form.weightage.value = goal.weightage;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (deleteId) {
      db.goals = db.goals.filter((goal) => goal.id !== deleteId);
      saveDb(db);
      renderEmployeeDashboard();
    }
  });

  document.getElementById("resetForm").addEventListener("click", () => {
    form.reset();
    form.goalId.value = "";
    error.textContent = "";
    success.textContent = "";
  });

  document.getElementById("submitGoals").addEventListener("click", () => {
    const db = getDb();
    const goals = db.goals.filter((goal) => goal.user_id === user.id);
    const validation = validateGoals(goals);
    error.textContent = "";
    success.textContent = "";
    if (validation) {
      submitError.textContent = validation;
      return;
    }

    db.goals.forEach((goal) => {
      if (goal.user_id === user.id) goal.status = "pending";
    });
    db.users.filter((item) => item.role === "manager").forEach((manager) => {
      db.notifications.push({
        id: makeId("notification"),
        user_id: manager.id,
        message: `${user.name} has submitted goals`,
        employee_id: user.id,
        type: "goal_submission",
        is_read: false,
        created_at: new Date().toISOString()
      });
    });
    saveDb(db);
    submitError.textContent = "";
    renderEmployeeDashboard();
  });
}

function managerDashboardInit() {
  if (document.body.dataset.page !== "manager") return;
  const user = currentUser("manager");
  if (!user) return;
  document.getElementById("managerName").textContent = `${user.name}'s Approvals`;
  renderManagerDashboard();
  setInterval(renderManagerDashboard, 2000);
  window.addEventListener("storage", () => renderManagerDashboard());

  document.getElementById("notifications").addEventListener("click", (event) => {
    const employeeId = event.target.closest("[data-open-employee]")?.dataset.openEmployee;
    if (!employeeId) return;
    const db = getDb();
    db.notifications.forEach((notification) => {
      if (notification.employee_id === employeeId && notification.user_id === user.id) notification.is_read = true;
    });
    saveDb(db);
    renderManagerDashboard(employeeId);
  });

  document.getElementById("managerEmployees").addEventListener("click", (event) => {
    const approveId = event.target.dataset.approve;
    const rejectId = event.target.dataset.reject;
    if (!approveId && !rejectId) return;

    const db = getDb();
    db.goals.forEach((goal) => {
      if (goal.user_id === (approveId || rejectId) && goal.status === "pending") {
        goal.status = approveId ? "approved" : "draft";
      }
    });
    db.notifications.forEach((notification) => {
      if (notification.employee_id === (approveId || rejectId) && notification.user_id === user.id) {
        notification.is_read = true;
      }
    });
    saveDb(db);
    renderManagerDashboard(approveId || rejectId);
  });
}

function renderManagerDashboard(focusEmployeeId = "") {
  const manager = currentUser("manager");
  if (!manager) return;

  const db = getDb();
  ensurePendingNotifications(db);
  saveDb(db);
  const employees = db.users.filter((user) => user.role === "employee");
  const notifications = db.notifications
    .filter((notification) => notification.user_id === manager.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  document.getElementById("notificationCount").textContent = unreadCount;
  document.getElementById("notifications").innerHTML = notifications.length ? notifications.map((notification) => `
    <button class="notification-item ${notification.is_read ? "read" : ""}" data-open-employee="${notification.employee_id}">
      <strong>${notification.message}</strong>
      <span>${formatDate(notification.created_at)}</span>
    </button>
  `).join("") : `<div class="empty-state">No notifications yet.</div>`;

  document.getElementById("managerEmployees").innerHTML = employees.map((employee) => {
    const goals = db.goals.filter((goal) => goal.user_id === employee.id);
    const status = groupStatus(goals);
    const pending = goals.some((goal) => goal.status === "pending");
    const expanded = focusEmployeeId === employee.id || pending;
    return `
      <article class="employee-card ${expanded ? "expanded" : ""}" id="employee-${employee.id}">
        <div class="employee-header">
          <div>
            <h3>${employee.name}</h3>
            <span>${employee.email}</span>
          </div>
          <div class="employee-actions">
            ${badge(status)}
            <button class="primary-button small" data-approve="${employee.id}" ${pending ? "" : "disabled"}>Approve</button>
            <button class="ghost-button small" data-reject="${employee.id}" ${pending ? "" : "disabled"}>Reject</button>
          </div>
        </div>
        <div class="goal-list">
          ${goals.length ? goals.map((goal) => `
            <article class="goal-card compact-card">
              <div class="goal-card-header">
                <h4>${goal.title}</h4>
                ${badge(goal.status)}
              </div>
              <p>${goal.description}</p>
              <dl>
                <div><dt>Target</dt><dd>${goal.target}</dd></div>
                <div><dt>Weightage</dt><dd>${goal.weightage}%</dd></div>
              </dl>
              ${renderAttachment(goal)}
            </article>
          `).join("") : `<div class="empty-state">No goals created.</div>`}
        </div>
      </article>
    `;
  }).join("");

  if (focusEmployeeId) {
    document.getElementById(`employee-${focusEmployeeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

loginInit();
logoutInit();
employeeDashboardInit();
managerDashboardInit();
