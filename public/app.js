let currentUser = null;
let allProjects = [];
let allGuildRoles = [];
let currentCategory = 'all';

// Theme Setup
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeButton(isLight);
}

function updateThemeButton(isLight) {
    const btn = document.querySelector('.theme-toggle-btn');
    if(isLight) {
        btn.innerHTML = `<i class="fas fa-moon"></i> Dark Theme`;
    } else {
        btn.innerHTML = `<i class="fas fa-sun"></i> Light Theme`;
    }
}

// Initializing
window.onload = async () => {
    // Apply saved theme
    if(localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        updateThemeButton(true);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error === 'banned') {
        showToast('Your account is restricted from accessing the platform.', 'error');
        return;
    } else if (error === 'not_in_server') {
        showToast('You must join our Discord server to login.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/me');
        const data = await res.json();

        if (data.banned) {
            showToast('Your account is restricted from accessing the platform.', 'error');
            return;
        }

        if (!data.loggedIn) {
            window.location.href = '/auth/discord';
            return;
        }

        currentUser = data.user;
        allGuildRoles = data.allRoles || [];
        
        setupUser(currentUser);
        fetchProjects();
    } catch (e) {
        showToast('Failed to load application data.', 'error');
    }
};

function setupUser(user) {
    document.getElementById('user-footer').innerHTML = `
        <div style="display:flex; gap:12px; align-items:center;">
            <img src="${user.avatar}" style="width:40px; height:40px; border-radius:50%; border:2px solid var(--accent-orange);" onclick="openImageModal(this.src)">
            <div style="font-weight:bold; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;">${user.username}</div>
            <a href="/auth/logout" style="color:var(--danger-red); margin-left:auto; font-size:1.1rem;" title="Logout"><i class="fas fa-sign-out-alt"></i></a>
        </div>
    `;

    document.getElementById('p-avatar').src = user.avatar;
    document.getElementById('p-name').innerText = user.username;

    const rolesContainer = document.getElementById('p-roles');
    if (user.roles && user.roles.length > 0) {
        rolesContainer.innerHTML = user.roles.map(r => `<div class="role-badge"><i class="fas fa-shield-alt"></i> ${r.name}</div>`).join('');
    } else {
        rolesContainer.innerHTML = `<span style="color:var(--text-muted)">No roles assigned</span>`;
    }

    if (user.isAdmin) {
        document.querySelector('.admin-only').style.display = 'flex';
        const roleSelect = document.getElementById('ap-roles');
        roleSelect.innerHTML = allGuildRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        loadBannedUsers();
    }
}

async function fetchProjects() {
    const res = await fetch('/api/projects');
    allProjects = await res.json();
    renderProjects();
}

function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[onclick="filterCategory('${cat}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    renderProjects();
    switchView('browse');
}

function renderProjects() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const type = document.getElementById('type-filter').value;
    const container = document.getElementById('cards-container');

    const filtered = allProjects.filter(p => {
        const matchCat = currentCategory === 'all' || p.category === currentCategory;
        const matchType = type === 'all' || p.type === type;
        const matchSearch = p.title.toLowerCase().includes(search);
        return matchCat && matchType && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:40px;">No projects found.</p>`;
        return;
    }

    container.innerHTML = filtered.map(p => `
        <div class="res-card" onclick="openProject(${p.id})">
            <img src="${p.thumbnail}" class="res-img">
            <div class="res-info">
                <h3 style="color:var(--text-main); font-size:1.1rem; margin-bottom:5px;">${p.title}</h3>
                <span style="font-size:0.8rem; color:var(--accent-orange); background:rgba(255,85,0,0.1); padding:3px 8px; border-radius:5px; font-weight:bold;">
                    ${p.type === 'free' ? 'Free' : 'Showcase'}
                </span>
            </div>
        </div>
    `).join('');
}

function openProject(id) {
    const p = allProjects.find(x => x.id === id);
    if (!p) return;

    let canDownload = true;
    let lockReason = '';

    if (p.type === 'showcase') {
        canDownload = false;
        lockReason = 'Showcase Only';
    } else if (p.requiredRoles && p.requiredRoles.length > 0 && !currentUser.isAdmin) {
        const hasRole = p.requiredRoles.some(roleId => currentUser.roleIds.includes(roleId));
        if (!hasRole) {
            canDownload = false;
            lockReason = 'Role Required';
        }
    }

    const btnHTML = canDownload
        ? `<button class="cyber-btn" onclick="downloadFile(${p.id})"><i class="fas fa-download"></i> Download Now</button>`
        : `<button class="cyber-btn locked-btn" disabled><i class="fas fa-lock"></i> ${lockReason}</button>`;

    const adminBtns = currentUser.isAdmin
        ? `<button class="cyber-btn" style="background:#ffaa00; color:#000;" onclick="editProject(${p.id})"><i class="fas fa-edit"></i> Edit</button>
           <button class="cyber-btn" style="background:var(--danger-red);" onclick="deleteProject(${p.id})"><i class="fas fa-trash"></i> Delete</button>` : '';

    let mediaHtml = '';
    if (p.video) {
        mediaHtml += `
        <video controls autoplay muted loop style="width:100%; border-radius:12px; border:1px solid var(--border-color); margin-bottom:15px;">
            <source src="${p.video}" type="video/mp4">
        </video>`;
    }

    if (p.images && p.images.length > 0) {
        mediaHtml += `<div style="display: flex; gap: 10px;">`;
        p.images.forEach(img => {
            mediaHtml += `<img src="${img}" style="width: 32%; height: 90px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-subtle); cursor:pointer;" onclick="openImageModal('${img}')">`;
        });
        mediaHtml += `</div>`;
    }

    document.getElementById('project-details-content').innerHTML = `
        <div style="flex: 1.2;">${mediaHtml}</div>
        <div class="pd-info">
            <h1>${p.title}</h1>
            <p>${p.description}</p>
            <div style="display:flex; gap:12px; margin-top:auto; padding-top:20px; flex-wrap:wrap;">
                ${btnHTML}
                ${adminBtns}
            </div>
        </div>
    `;
    switchView('project-details');
}

async function downloadFile(id) {
    showToast('Processing download...', 'info');
    const res = await fetch(`/api/projects/${id}/download`);
    const data = await res.json();
    
    if (data.success) {
        showToast('Download started!', 'success');
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.target = '_blank';
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
    } else {
        showToast(data.error || 'Failed to download file.', 'error');
    }
}

function openImageModal(src) {
    if(!src) return;
    document.getElementById('modal-img').src = src;
    document.getElementById('image-modal').style.display = 'flex';
}

function closeImageModal() {
    document.getElementById('image-modal').style.display = 'none';
}

// --- Admin Functions ---
function switchAdminTab(tab) {
    document.getElementById('admin-tab-projects').style.display = tab === 'projects' ? 'block' : 'none';
    document.getElementById('admin-tab-users').style.display = tab === 'users' ? 'block' : 'none';
}

function editProject(id) {
    const p = allProjects.find(x => x.id === id);
    if(!p) return;

    document.getElementById('form-title').innerText = 'Edit Project';
    document.getElementById('ap-id').value = p.id;
    document.getElementById('ap-title').value = p.title;
    document.getElementById('ap-category').value = p.category;
    document.getElementById('ap-type').value = p.type;
    document.getElementById('ap-thumb').value = p.thumbnail;
    document.getElementById('ap-file').value = p.fileUrl || '';
    document.getElementById('ap-video').value = p.video || '';
    document.getElementById('ap-img1').value = p.images[0] || '';
    document.getElementById('ap-img2').value = p.images[1] || '';
    document.getElementById('ap-img3').value = p.images[2] || '';
    document.getElementById('ap-desc').value = p.description;

    const select = document.getElementById('ap-roles');
    Array.from(select.options).forEach(opt => {
        opt.selected = p.requiredRoles.includes(opt.value);
    });

    switchView('admin');
    switchAdminTab('projects');
}

function resetProjectForm() {
    document.getElementById('form-title').innerText = 'Add New Project';
    document.getElementById('add-project-form').reset();
    document.getElementById('ap-id').value = '';
}

async function saveProjectForm(e) {
    e.preventDefault();
    const id = document.getElementById('ap-id').value;
    const selectedRoles = Array.from(document.getElementById('ap-roles').selectedOptions).map(opt => opt.value);

    const images = [
        document.getElementById('ap-img1').value,
        document.getElementById('ap-img2').value,
        document.getElementById('ap-img3').value
    ].filter(i => i.trim() !== '');

    const payload = {
        id: id ? parseInt(id) : null,
        title: document.getElementById('ap-title').value,
        category: document.getElementById('ap-category').value,
        type: document.getElementById('ap-type').value,
        thumbnail: document.getElementById('ap-thumb').value,
        fileUrl: document.getElementById('ap-file').value,
        video: document.getElementById('ap-video').value,
        images: images,
        description: document.getElementById('ap-desc').value,
        requiredRoles: selectedRoles
    };

    const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        showToast('Project saved successfully.', 'success');
        fetchProjects();
        resetProjectForm();
        switchView('browse');
    }
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
    showToast('Project deleted permanently.', 'success');
    fetchProjects();
    switchView('browse');
}

async function loadBannedUsers() {
    const res = await fetch('/api/admin/banned');
    const list = await res.json();
    document.getElementById('banned-list').innerHTML = list.map(id => `<li>ID: ${id}</li>`).join('') || 'No banned users found.';
}

async function handleUserBan(action) {
    const userId = document.getElementById('ban-user-id').value.trim();
    if(!userId) return showToast('Please enter a User ID.', 'error');

    const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
    });

    const data = await res.json();
    if(data.success) {
        showToast(action === 'ban' ? 'User has been banned.' : 'User has been unbanned.', 'success');
        document.getElementById('ban-user-id').value = '';
        loadBannedUsers();
    }
}

function switchView(view) {
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    document.getElementById(`view-${view}`).style.display = 'block';
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    
    // Add icon based on notification type
    let icon = 'fa-info-circle';
    if(type === 'success') icon = 'fa-check-circle';
    if(type === 'error') icon = 'fa-exclamation-circle';

    t.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}