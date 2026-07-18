const CATEGORIES = [
  'MOT', 'Passport', 'Driving Licence', 'Insurance',
  'NHS Appointments', 'Council Tax', 'Warranties',
  'Subscriptions', 'Bills', 'Home Maintenance'
];

const CATEGORY_ICONS = {
  'MOT': '🚗',
  'Passport': '🛂',
  'Driving Licence': '🪪',
  'Insurance': '🛡️',
  'NHS Appointments': '🏥',
  'Council Tax': '🏠',
  'Warranties': '🔧',
  'Subscriptions': '📱',
  'Bills': '📄',
  'Home Maintenance': '🔨'
};

let items = [];
let editingId = null;

function loadItems() {
  const data = localStorage.getItem('lifeadmin_items');
  if (data) {
    items = JSON.parse(data);
  }
}

function saveItems() {
  localStorage.setItem('lifeadmin_items', JSON.stringify(items));
  render();
}

function getStatus(item) {
  const now = new Date();
  const due = new Date(item.dueDate);
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 14) return 'due-soon';
  return 'ok';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
  const now = new Date();
  const due = new Date(dateStr + 'T00:00:00');
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function daysText(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0) return `${Math.abs(d)} days overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `${d} days left`;
}

function showAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Item';
  document.getElementById('itemForm').reset();
  document.getElementById('modalOverlay').classList.add('active');
}

function showEditModal(item) {
  editingId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit Item';
  document.getElementById('itemTitle').value = item.title;
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemDate').value = item.dueDate;
  document.getElementById('itemNotes').value = item.notes || '';
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingId = null;
}

function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('itemTitle').value.trim();
  const category = document.getElementById('itemCategory').value;
  const dueDate = document.getElementById('itemDate').value;
  const notes = document.getElementById('itemNotes').value.trim();

  if (editingId) {
    const idx = items.findIndex(i => i.id === editingId);
    if (idx !== -1) {
      items[idx] = { ...items[idx], title, category, dueDate, notes };
    }
  } else {
    const newItem = {
      id: Date.now().toString(),
      title,
      category,
      dueDate,
      notes,
      completed: false,
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
  }
  saveItems();
  closeModal();
}

function toggleComplete(id) {
  const item = items.find(i => i.id === id);
  if (item) {
    item.completed = !item.completed;
    saveItems();
  }
}

function deleteItem(id) {
  if (confirm('Delete this item?')) {
    items = items.filter(i => i.id !== id);
    saveItems();
  }
}

function render() {
  const container = document.getElementById('categoriesContainer');
  const sorted = [...items].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const completed = sorted.filter(i => i.completed);
  const active = sorted.filter(i => !i.completed);

  let html = '';

  if (active.length === 0) {
    html = `
      <div class="empty-state">
        <h2>All clear!</h2>
        <p>Add your first life admin item to get started.</p>
      </div>`;
    container.innerHTML = html;
    return;
  }

  for (const cat of CATEGORIES) {
    const catItems = active.filter(i => i.category === cat);
    if (catItems.length === 0) continue;

    html += `
      <div class="category-group">
        <div class="category-header">
          <div class="category-icon">${CATEGORY_ICONS[cat] || '📌'}</div>
          <span class="category-name">${cat}</span>
          <span class="category-count">${catItems.length}</span>
        </div>`;

    for (const item of catItems) {
      const status = getStatus(item);
      html += `
        <div class="item-card">
          <div class="item-status ${status}"></div>
          <div class="item-info">
            <div class="item-title">${escapeHtml(item.title)}</div>
            <div class="item-meta">${formatDate(item.dueDate)} &middot; ${daysText(item.dueDate)}</div>
          </div>
          <div class="item-actions">
            <button class="complete-btn" onclick="toggleComplete('${item.id}')" title="Mark done">✓</button>
            <button onclick="showEditModal(items.find(i => i.id === '${item.id}'))" title="Edit">✎</button>
            <button class="delete-btn" onclick="deleteItem('${item.id}')" title="Delete">✕</button>
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  if (completed.length > 0) {
    html += `
      <div class="category-group">
        <div class="category-header">
          <div class="category-icon">✅</div>
          <span class="category-name">Completed</span>
          <span class="category-count">${completed.length}</span>
        </div>`;
    for (const item of completed) {
      html += `
        <div class="item-card">
          <div class="item-status ok"></div>
          <div class="item-info">
            <div class="item-title" style="text-decoration:line-through;color:#94a3b8">${escapeHtml(item.title)}</div>
            <div class="item-meta">${formatDate(item.dueDate)}</div>
          </div>
          <div class="item-actions">
            <button onclick="toggleComplete('${item.id}')" title="Undo">↩</button>
            <button class="delete-btn" onclick="deleteItem('${item.id}')" title="Delete">✕</button>
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  loadItems();
  render();
});
