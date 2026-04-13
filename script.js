// --- INITIALIZATION & CONFIG ---
const API_BASE_URL = '/api';
let GOOGLE_API_KEY = '';
let GOOGLE_IMAGE_SEARCH_CX = '';

// Load config from backend
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/config/`);
        const config = await response.json();
        GOOGLE_API_KEY = config.google_api_key || '';
        GOOGLE_IMAGE_SEARCH_CX = config.google_image_search_cx || '';
    } catch (error) {
        console.warn('Failed to load config from backend:', error);
        // Fallback to empty values (API will be disabled)
    }
}

// --- API HELPER FUNCTIONS ---
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP Error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Error [${method} ${endpoint}]:`, error);
        throw error;
    }
}

async function getProjects() {
    try {
        const data = await apiCall('/projects/', 'GET');
        return data.projects || [];
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return [];
    }
}

async function createProject(title, desc, sector, needed, imageUrl) {
    try {
        const data = await apiCall('/projects/', 'POST', {
            title, desc, sector, needed, imageUrl
        });
        return data.project;
    } catch (error) {
        console.error('Failed to create project:', error);
        throw error;
    }
}

async function deleteProject(projectId) {
    try {
        await apiCall(`/projects/${projectId}/delete/`, 'POST');
        return true;
    } catch (error) {
        console.error('Failed to delete project:', error);
        throw error;
    }
}

async function fundProject(projectId, amount) {
    try {
        await apiCall(`/projects/${projectId}/fund/`, 'POST', { amount });
        return true;
    } catch (error) {
        console.error('Failed to fund project:', error);
        throw error;
    }
}

async function getMessages() {
    try {
        const data = await apiCall('/messages/', 'GET');
        return data.messages || [];
    } catch (error) {
        console.error('Failed to fetch messages:', error);
        return [];
    }
}

async function sendMessage(toEmail, text) {
    try {
        const data = await apiCall('/messages/', 'POST', {
            to: toEmail,
            text
        });
        return data.message;
    } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
    }
}

async function markMessagesRead(contactEmail) {
    try {
        await apiCall('/messages/read/', 'POST', { contactEmail });
        return true;
    } catch (error) {
        console.error('Failed to mark messages as read:', error);
        throw error;
    }
}

// Admin API functions
async function deleteUserAdmin(email) {
    try {
        await apiCall('/users/', 'DELETE', { email });
        return true;
    } catch (error) {
        console.error('Failed to delete user:', error);
        throw error;
    }
}

async function promoteUserAdmin(email) {
    try {
        await apiCall('/users/promote/', 'POST', { email });
        return true;
    } catch (error) {
        console.error('Failed to promote user:', error);
        throw error;
    }
}

// --- HELPERS ---
function getBadgeClass(sector) {
    if (sector === 'Medical') return 'badge-med';
    if (sector === 'Agriculture') return 'badge-agri';
    return 'badge-tech';
}

function generateDynamicImageUrl(project) {
    // Use reliable Unsplash direct image URLs based on sector
    const imagePools = {
        'technology': [
            '/static/drone.png',
            '/static/solar_backpack.png',
            '/static/vr_history.png'
        ],
        'medical': [
            '/static/prosthetic.png',
            '/static/bio_packaging.png',
            '/static/vr_history.png'
        ],
        'agriculture': [
            '/static/drone.png',
            '/static/bio_packaging.png',
            '/static/solar_backpack.png'
        ]
    };

    const sector = (project.sector || 'technology').toLowerCase();
    const pool = imagePools[sector] || imagePools['technology'];

    // Seed index using the project title to tie the image predictably to the name
    let hash = 0;
    const keyString = project.title ? project.title.toLowerCase() : Date.now().toString();
    for (let i = 0; i < keyString.length; i++) {
        hash = keyString.charCodeAt(i) + ((hash << 5) - hash);
    }
    return pool[Math.abs(hash) % pool.length];
}

function getProjectImageUrl(project) {
    // If the image is already locked and saved into the project, do NOT change it on refresh
    if (project && project.imageUrl && typeof project.imageUrl === 'string' && project.imageUrl.trim() !== '') {
        return project.imageUrl;
    }

    const specificMap = {
        'smart irrigation drone': '/static/drone.png',
        'solar backpack': '/static/solar_backpack.png',
        '3d printed prosthetic': '/static/prosthetic.png',
        'campus tutor ai': '/static/vr_history.png',
        'water harvesting system': '/static/bio_packaging.png'
    };

    const titleLower = (project && project.title ? project.title : '').toLowerCase().trim();
    if (specificMap[titleLower]) return specificMap[titleLower];
    return generateDynamicImageUrl(project);
}

async function fetchGoogleProjectImage(title, sector) {
    if (!GOOGLE_API_KEY || !GOOGLE_IMAGE_SEARCH_CX) return null;
    const query = encodeURIComponent(`${title} ${sector} project`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_IMAGE_SEARCH_CX}&searchType=image&num=1&q=${query}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn('Google image search failed:', await response.text());
            return null;
        }
        const data = await response.json();
        const item = data?.items?.[0];
        return item?.link || null;
    } catch (err) {
        console.warn('Google image search error:', err);
        return null;
    }
}

async function getCurrentUser() {
    try {
        const data = await apiCall('/me/', 'GET');
        return data.user;
    } catch (error) {
        console.error('Failed to get current user:', error);
        return null;
    }
}

// Helper to get user email synchronously from session storage (cached)
function getUserEmailSync() {
    const userStr = sessionStorage.getItem('userEmail');
    return userStr ? userStr : '';
}

// Helper to cache user email in session storage
function cacheUserEmail(email) {
    if (email) {
        sessionStorage.setItem('userEmail', email);
    }
}

async function checkAuth() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    cacheUserEmail(user.email);
    const nameDisplay = document.getElementById('user-name');
    if (nameDisplay) nameDisplay.innerText = user.name;
    return user;
}

async function logout() {
    try {
        await apiCall('/logout/', 'POST');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'login.html';
    }
}

// --- PROJECT EVALUATOR HELPERS ---
async function analyzeDescriptionSentiment(description) {
    if (!GOOGLE_API_KEY) return null;

    try {
        const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document: {
                    type: 'PLAIN_TEXT',
                    content: description
                },
                encodingType: 'UTF8'
            })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data?.documentSentiment?.score ?? null;
    } catch (err) {
        console.warn('Description sentiment analysis failed:', err);
        return null;
    }
}

function getSectorModifier(sector) {
    if (sector === 'Medical') return 0.18;
    if (sector === 'Agriculture') return 0.14;
    return 0.12;
}

function calculateBudgetEstimate(baseBudget, sector, description) {
    const lengthFactor = Math.min(description.length / 220, 1);
    const sectorModifier = getSectorModifier(sector);
    const complexityModifier = 1 + lengthFactor * 0.14;
    return Math.round(baseBudget * (1 + sectorModifier * complexityModifier) + 500);
}

function calculateSuccessScore(baseBudget, sector, description, sentimentScore) {
    let score = 58;
    score += description.length >= 80 ? 10 : 5;
    score += sector === 'Medical' ? 8 : sector === 'Technology' ? 6 : 5;
    score -= baseBudget > 50000 ? 12 : baseBudget > 20000 ? 6 : 0;
    score += sentimentScore != null ? Math.round(sentimentScore * 10) : 0;
    score += Math.min(description.length / 150, 1) * 6;
    return Math.max(26, Math.min(94, Math.round(score)));
}

function getSuccessLabel(score) {
    if (score >= 75) return 'High';
    if (score >= 55) return 'Moderate';
    return 'Low';
}

function formatRupees(amount) {
    return '₹' + amount.toLocaleString();
}

async function evaluateProjectInput(title, description, sector, budget) {
    const budgetEstimate = calculateBudgetEstimate(budget, sector, description);
    const sentimentScore = await analyzeDescriptionSentiment(description);
    const successScore = calculateSuccessScore(budget, sector, description, sentimentScore);
    const label = getSuccessLabel(successScore);

    const notes = [];
    if (budgetEstimate > budget * 1.2) {
        notes.push('The estimated budget is above the initial plan, indicating higher complexity or larger scope.');
    }
    if (successScore < 55) {
        notes.push('The success prediction is low. Refine your scope, clarify the value proposition, and reduce risk.');
    } else if (successScore < 75) {
        notes.push('Moderate success potential. Strengthen the project plan and funding visibility.');
    } else {
        notes.push('Strong project potential. Focus on execution and stakeholder alignment.');
    }
    if (sentimentScore != null) {
        notes.push(`Google sentiment analysis indicates a ${sentimentScore >= 0 ? 'positive' : 'neutral/negative'} description tone.`);
    }

    return {
        title,
        sector,
        budget,
        budgetEstimate,
        successScore,
        successLabel: label,
        notes
    };
}

function renderEvaluatorResults(result, errorMessage) {
    const container = document.getElementById('evaluator-results');
    const summary = document.getElementById('eval-summary');
    if (!container || !summary) return;

    if (errorMessage) {
        container.style.display = 'block';
        summary.innerHTML = `<p style="color:#ef4444;">${errorMessage}</p>`;
        return;
    }

    container.style.display = 'block';
    summary.innerHTML = `
        <p><strong>Project:</strong> ${result.title}</p>
        <p><strong>Sector:</strong> ${result.sector}</p>
        <p><strong>Planned Budget:</strong> ${formatRupees(result.budget)}</p>
        <p><strong>Recommended Budget:</strong> ${formatRupees(result.budgetEstimate)}</p>
        <p><strong>Success Prediction:</strong> ${result.successLabel} (${result.successScore}%)</p>
        <div style="margin-top:10px;"><strong>Recommendations</strong><ul>${result.notes.map(note => `<li>${note}</li>`).join('')}</ul></div>
    `;
}

function initEvaluator() {
    const form = document.getElementById('evaluator-form');
    if (!form) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const title = document.getElementById('eval-title').value.trim();
        const description = document.getElementById('eval-desc').value.trim();
        const sector = document.getElementById('eval-sector').value;
        const budget = Number(document.getElementById('eval-budget').value);

        if (!title || !description || !budget || budget <= 0) {
            renderEvaluatorResults(null, 'Please complete the form with a valid budget.');
            return;
        }

        renderEvaluatorResults({ title, sector, budget, budgetEstimate: 0, successScore: 0, successLabel: 'Analyzing...', notes: [] });

        try {
            const result = await evaluateProjectInput(title, description, sector, budget);
            renderEvaluatorResults(result);
        } catch (err) {
            renderEvaluatorResults(null, 'Unable to evaluate the project right now. Please try again later.');
        }
    });
}

function deleteProjectUI(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    deleteProject(projectId).then(() => {
        alert('Project deleted successfully!');
        window.location.reload();
    }).catch(err => {
        alert('Error deleting project: ' + err.message);
    });
}

// --- AUTHENTICATION LOGIC ---
async function registerUser(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const role = document.getElementById('reg-role').value;

    try {
        await apiCall('/register/', 'POST', { name, email, password, role });
        alert("Registration Successful! Please Login.");
        window.location.href = 'login.html';
    } catch (error) {
        alert("Registration failed: " + error.message);
    }
}

async function loginUser(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();

    try {
        const result = await apiCall('/login/', 'POST', { email, password });
        const user = result.user;

        // Redirect based on role
        if (user.role === 'student') {
            window.location.href = 'student_dashboard.html';
        } else if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'donor_dashboard.html';
        }
    } catch (error) {
        const errorMsg = document.getElementById('error-msg');
        errorMsg.style.display = 'block';
        errorMsg.innerText = "Invalid email or password.";
    }
}

// --- STUDENT DASHBOARD ---
async function loadStudentDash() {
    const user = await checkAuth();
    if (!user) return;

    // Show admin link if user is admin
    const adminLink = document.getElementById('admin-link');
    if (adminLink && user.role === 'admin') {
        adminLink.style.display = 'inline-block';
    }

    const projects = await getProjects() || [];

    // My Projects
    const myProjs = projects.filter(p => p.author === user.email);
    const projContainer = document.getElementById('my-projects');

    if (myProjs.length === 0) {
        projContainer.innerHTML = `<p style="text-align:center; padding:20px;">No projects posted yet.</p>`;
    } else {
        projContainer.innerHTML = myProjs.map(p => `
            <div class="card item-card project-card">
                <div class="project-image" style="background-image:url('${getProjectImageUrl(p)}'); background-color: #1e293b; background-size: cover; background-position: center;"></div>
                <div class="project-content">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div style="flex:1;">
                            <h3 style="margin:0;">${p.title}</h3>
                        </div>
                        <button onclick="deleteProject(${p.id})" style="background:none; border:none; font-size:20px; cursor:pointer; color:#ef4444; padding:5px;" title="Delete project">×</button>
                    </div>
                    <span class="badge ${getBadgeClass(p.sector)}">${p.sector}</span>
                    <p>${p.desc}</p>
                    <div class="progress-container">
                        <div class="progress-fill" style="width:${Math.min((p.raised / p.needed) * 100, 100)}%"></div>
                    </div>
                    <small>Raised: ₹${p.raised} / ₹${p.needed}</small>
                </div>
            </div>
        `).join('');
    }

    // Donor Needs
    const needsContainer = document.getElementById('donor-needs');
    if (needsContainer) {
        needsContainer.innerHTML = `<p style="text-align:center; padding:20px;">No donor needs posted yet.</p>`;
    }
}

// --- DONOR DASHBOARD ---
async function loadDonorDash() {
    const user = await checkAuth();
    if (!user) return;

    // Show admin link if user is admin
    const adminLink = document.getElementById('admin-link');
    if (adminLink && user.role === 'admin') {
        adminLink.style.display = 'inline-block';
    }

    const projects = await getProjects() || [];

    // 1. STATS
    let totalImpact = 0;
    let projectsBackedCount = 0;

    projects.forEach(p => {
        if (p.fundedBy) {
            const myFunding = p.fundedBy.filter(f => f.donorName === user.name);
            if (myFunding.length > 0) {
                projectsBackedCount++;
                myFunding.forEach(record => {
                    totalImpact += record.amount;
                });
            }
        }
    });

    const statImpact = document.getElementById('stat-impact');
    const statCount = document.getElementById('stat-count');
    if (statImpact) statImpact.innerText = '₹' + totalImpact.toLocaleString();
    if (statCount) statCount.innerText = projectsBackedCount;

    // 2. PROJECTS FEED
    const feed = document.getElementById('project-feed');
    if (feed) {
        feed.innerHTML = projects.map(p => `
            <div class="card item-card project-card">
                <div class="project-image" style="background-image:url('${getProjectImageUrl(p)}'); background-color: #1e293b; background-size: cover; background-position: center;"></div>
                <div class="project-content">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div style="flex:1;">
                            <h3 style="margin:0;">${p.title}</h3>
                        </div>
                        <button onclick="deleteProject(${p.id})" style="background:none; border:none; font-size:20px; cursor:pointer; color:#ef4444; padding:5px; flex-shrink:0;" title="Delete project">×</button>
                    </div>
                    <span class="badge ${getBadgeClass(p.sector)}">${p.sector}</span>
                    <p>${p.desc}</p>
                    <div class="progress-container">
                        <div class="progress-fill" style="width:${Math.min((p.raised / p.needed) * 100, 100)}%"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <small>Raised: <b>₹${p.raised}</b></small>
                        <small>Goal: <b>₹${p.needed}</b></small>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="fundProjectUI(${p.id})" class="btn btn-sm">Fund Project</button>
                        <button onclick="openChat('${p.author.replace(/'/g, "\\'")}', '${p.title.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline">Ask Question</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 3. MY NEEDS
    const myNeedsContainer = document.getElementById('my-needs-feed');
    if (myNeedsContainer) {
        myNeedsContainer.innerHTML = `<p style="color:gray;">No needs posted yet.</p>`;
    }
}

// --- ACTIONS ---
async function postProject(e) {
    e.preventDefault();
    try {
        const title = document.getElementById('p-title').value.trim();
        const desc = document.getElementById('p-desc').value.trim();
        const sector = document.getElementById('p-sector').value;
        const needed = Number(document.getElementById('p-needed').value);

        if (!title || !desc || !sector || !needed || needed <= 0) {
            alert('Please complete the project form with a valid budget.');
            return;
        }

        const placeholderImage = getProjectImageUrl({ title, sector });
        await createProject(title, desc, sector, needed, placeholderImage);

        alert('Project Posted! Relevant image added to your project.');
        window.location.reload();
    } catch (error) {
        console.error('Error posting project:', error);
        alert('Error posting project: ' + error.message);
    }
}

function postNeed(e) {
    e.preventDefault();
    alert("📋 Need posting feature coming soon! This will allow donors to create fulfillment needs that students can respond to.");
}

function fundProjectUI(id) {
    const amount = prompt("Enter funding amount (₹):");

    if (amount && !isNaN(amount) && parseInt(amount) > 0) {
        fundProject(id, parseInt(amount)).then(() => {
            alert(`Thank you! Funded ₹${amount}.`);
            window.location.reload();
        }).catch(err => {
            alert('Error funding project: ' + err.message);
        });
    }
}

// --- CHAT ---
let currentChatStudent = null;
function getDisplayName(email) {
    // For now, display email since we don't have a user list API
    // In production, this could call an API endpoint
    return email.split('@')[0] || email;
}

async function getChatContacts(userEmail) {
    const allMessages = await getMessages() || [];
    const contacts = new Set();
    allMessages.forEach(m => {
        if (m.from === userEmail) contacts.add(m.to);
        if (m.to === userEmail) contacts.add(m.from);
    });
    return Array.from(contacts);
}

async function getUnreadCount(userEmail, contactEmail) {
    const allMessages = await getMessages() || [];
    return allMessages.filter(m => m.to === userEmail && m.from === contactEmail && !m.read).length;
}

async function renderChatContacts() {
    const container = document.getElementById('chat-contacts-list');
    if (!container) return;

    const userEmail = getUserEmailSync();
    let contacts = await getChatContacts(userEmail);
    if (currentChatStudent && !contacts.includes(currentChatStudent)) {
        contacts.unshift(currentChatStudent);
    }

    if (contacts.length === 0) {
        container.innerHTML = '<div class="chat-placeholder">No conversations yet. Use Ask Question to start one.</div>';
        return;
    }

    const badgeMap = {};
    for (const email of contacts) {
        badgeMap[email] = await getUnreadCount(userEmail, email);
    }

    container.innerHTML = contacts.map(email => {
        const label = getDisplayName(email);
        const unread = badgeMap[email];
        const active = email === currentChatStudent ? 'active' : '';
        const badge = unread > 0 ? `<span class="contact-badge">${unread}</span>` : '';
        return `<button type="button" class="contact-item ${active}" onclick="openChat('${email}')">
                    <span>${label}</span>
                    ${badge}
                </button>`;
    }).join('');
}
async function openChat(studentEmail, projectTitle) {
    // ❌ remove auto open last chat
    currentChatStudent = studentEmail || null;

    if (currentChatStudent) {
        await markMessagesRead(currentChatStudent);
    }

    const modal = document.getElementById('chat-modal');

    if (modal) {
        modal.style.display = 'flex'; // show popup
        document.body.style.overflow = 'hidden'; // disable scroll
    }

    document.getElementById('chat-title').innerText =
        studentEmail && projectTitle ? "Chat: " + projectTitle : "Chat Center";

    const subtitleEl = document.getElementById('chat-subtitle');

    if (subtitleEl) {
        subtitleEl.innerText = currentChatStudent
            ? getDisplayName(currentChatStudent)
            : "Select a contact to start chatting.";
    }

    renderChatContacts();
    renderMessages();
}
function closeChat() {
    const modal = document.getElementById('chat-modal');

    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}
async function renderMessages() {
    if (!currentChatStudent) return;

    const allMessages = await getMessages() || [];
    const chatMsgs = allMessages.filter(m =>
        (m.from === getUserEmailSync() && m.to === currentChatStudent) ||
        (m.from === currentChatStudent && m.to === getUserEmailSync())
    );
    const container = document.getElementById('chat-messages');
    const userEmail = getUserEmailSync();

    if (chatMsgs.length === 0) {
        container.innerHTML = '<div class="chat-placeholder">No messages yet. Start the conversation.</div>';
    } else {
        container.innerHTML = chatMsgs.map(m => `
            <div class="msg ${m.from === userEmail ? 'msg-sent' : 'msg-received'}">
                <p>${m.text}</p>
                <small>${formatTime(m.timestamp)}</small>
            </div>`).join('');
    }

    container.scrollTop = container.scrollHeight;
}
async function sendMessageUI() {
    const input = document.getElementById('chat-input');
    if (!input.value || !currentChatStudent) return;

    try {
        await sendMessage(currentChatStudent, input.value);
        input.value = '';
        await renderMessages();
        await updateChatBadge();
    } catch (error) {
        alert('Error sending message: ' + error.message);
    }
}

async function updateChatBadge() {
    const badge = document.getElementById('chat-badge');
    if (!badge) return;

    const allMessages = await getMessages() || [];
    const userEmail = getUserEmailSync();
    const unread = allMessages.filter(m => m.to === userEmail && !m.read).length;
    if (unread > 0) {
        badge.innerText = unread;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// markMessagesRead is already defined in API section above
// This duplicate has been removed to avoid conflicts

function formatTime(value) {
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    initEvaluator();
});

function openEvaluator() {
    const modal = document.getElementById('evaluator-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeEvaluator() {
    const modal = document.getElementById('evaluator-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

window.addEventListener('load', () => {
    updateChatBadge();
    const chatModal = document.getElementById('chat-modal');
    if (chatModal) {
        chatModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    const evalModal = document.getElementById('evaluator-modal');
    if (evalModal) {
        evalModal.style.display = 'none';
    }
});

function switchTab(tabName) {
    document.getElementById('projects-section').style.display = 'none';
    document.getElementById('needs-section').style.display = 'none';
    document.getElementById(tabName + '-section').style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + tabName).classList.add('active');
}

// --- ADMIN PANEL ---
async function loadAdminDash() {
    const user = await checkAuth();
    if (!user || user.role !== 'admin') {
        alert('Access Denied. Admin only.');
        window.location.href = 'login.html';
        return;
    }

    const adminNameEl = document.getElementById('admin-name');
    if (adminNameEl) adminNameEl.innerText = user.name;

    await updateAdminStats();
    await loadAdminUsers();
    await loadAdminProjects();
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    Array.from(document.querySelectorAll('.tab-btn')).forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabName)) btn.classList.add('active');
    });
}

async function updateAdminStats() {
    const users = await apiCall('/users/', 'GET').then(data => data.users).catch(() => []);
    const projects = await getProjects() || [];

    let totalFunded = 0;
    projects.forEach(p => {
        if (Array.isArray(p.fundedBy)) {
            p.fundedBy.forEach(f => {
                totalFunded += f.amount || 0;
            });
        }
    });

    const adminCount = users.filter(u => u.role === 'admin').length;

    const statUsers = document.getElementById('stat-users');
    const statProjects = document.getElementById('stat-projects');
    const statFunding = document.getElementById('stat-funding');
    const statAdmins = document.getElementById('stat-admins');

    if (statUsers) statUsers.innerText = users.length;
    if (statProjects) statProjects.innerText = projects.length;
    if (statFunding) statFunding.innerText = '₹' + totalFunded.toLocaleString();
    if (statAdmins) statAdmins.innerText = adminCount;

    const studentCount = users.filter(u => u.role === 'student').length;
    const donorCount = users.filter(u => u.role === 'donor').length;

    const dist = `Students: ${studentCount} | Donors: ${donorCount} | Admins: ${adminCount}`;
    const roleDist = document.getElementById('role-dist');
    if (roleDist) roleDist.innerText = dist;
}

async function loadAdminUsers() {
    try {
        const users = await apiCall('/users/', 'GET').then(data => data.users).catch(() => []);
        const usersList = document.getElementById('users-list');

        if (users.length === 0) {
            usersList.innerHTML = '<div class="empty-state"><h3>No users found</h3></div>';
            return;
        }

        usersList.innerHTML = users.map(u => `
            <div class="user-card">
                <div class="user-info">
                    <h4>${u.name}</h4>
                    <p>✉️ ${u.email}</p>
                    <p>Role: <span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></p>
                </div>
                <div class="action-buttons">
                    ${u.role !== 'admin' ? `<button class="btn-promote" onclick="promoteUserToAdminUI('${u.email.replace(/'/g, "\\'")}')" >Promote to Admin</button>` : ''}
                    <button class="btn-delete" onclick="deleteUserUI('${u.email.replace(/'/g, "\\'")}')" >Delete User</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadAdminProjects() {
    const projects = await getProjects() || [];
    const projectsList = document.getElementById('projects-list');

    if (projects.length === 0) {
        projectsList.innerHTML = '<div class="empty-state"><h3>No projects found</h3></div>';
        return;
    }

    projectsList.innerHTML = projects.map(p => `
        <div class="project-card-admin">
            <div class="project-info">
                <h4>${p.title}</h4>
                <p>Author: ${p.author}</p>
                <p>Sector: <span class="role-badge">${p.sector}</span></p>
                <p>${p.desc}</p>
                <p style="margin-top: 8px;">
                    Progress: ₹${p.raised || 0} / ₹${p.needed}
                </p>
                <div class="progress-bar-admin">
                    <div class="progress-fill-admin" style="width:${Math.min(((p.raised || 0) / p.needed) * 100, 100)}%"></div>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn-delete" onclick="deleteAdminProject(${p.id})">Delete Project</button>
            </div>
        </div>
    `).join('');
}

function deleteUserUI(email) {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;

    deleteUserAdmin(email).then(() => {
        loadAdminUsers();
        updateAdminStats();
        alert('User deleted successfully');
    }).catch(err => {
        alert('Error deleting user: ' + err.message);
    });
}

async function deleteAdminProject(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
        await deleteProject(projectId);
        await loadAdminProjects();
        await updateAdminStats();
        alert('Project deleted successfully');
    } catch (err) {
        alert('Error deleting project: ' + err.message);
    }
}

function promoteUserToAdminUI(email) {
    if (!confirm(`Promote ${email} to Admin?`)) return;

    promoteUserAdmin(email).then(() => {
        loadAdminUsers();
        updateAdminStats();
        alert('User promoted to admin');
    }).catch(err => {
        alert('Error promoting user: ' + err.message);
    });
}

async function filterUsers(searchTerm) {
    try {
        const users = await apiCall('/users/', 'GET').then(data => data.users).catch(() => []);
        const filtered = users.filter(u =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const usersList = document.getElementById('users-list');
        if (filtered.length === 0) {
            usersList.innerHTML = '<div class="empty-state"><h3>No users found</h3></div>';
            return;
        }

        usersList.innerHTML = filtered.map(u => `
            <div class="user-card">
                <div class="user-info">
                    <h4>${u.name}</h4>
                    <p>✉️ ${u.email}</p>
                    <p>Role: <span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></p>
                </div>
                <div class="action-buttons">
                    ${u.role !== 'admin' ? `<button class="btn-promote" onclick="promoteUserToAdminUI('${u.email.replace(/'/g, "\\'")}')" >Promote to Admin</button>` : ''}
                    <button class="btn-delete" onclick="deleteUserUI('${u.email.replace(/'/g, "\\'")}')" >Delete User</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error filtering users:', error);
    }
}

async function filterProjects(searchTerm) {
    try {
        const projects = await getProjects() || [];
        const sector = document.getElementById('sector-filter')?.value || '';
        const search = searchTerm || document.getElementById('project-search')?.value || '';

        let filtered = projects;
        if (search) {
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(search.toLowerCase())
            );
        }
        if (sector) {
            filtered = filtered.filter(p => p.sector === sector);
        }

        const projectsList = document.getElementById('projects-list');
        if (filtered.length === 0) {
            projectsList.innerHTML = '<div class="empty-state"><h3>No projects found</h3></div>';
            return;
        }

        projectsList.innerHTML = filtered.map(p => `
            <div class="project-card-admin">
                <div class="project-info">
                    <h4>${p.title}</h4>
                    <p>Author: ${p.author}</p>
                    <p>Sector: <span class="role-badge">${p.sector}</span></p>
                    <p>${p.desc}</p>
                    <p style="margin-top: 8px;">
                        Progress: ₹${p.raised || 0} / ₹${p.needed}
                    </p>
                    <div class="progress-bar-admin">
                        <div class="progress-fill-admin" style="width:${Math.min(((p.raised || 0) / p.needed) * 100, 100)}%"></div>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn-delete" onclick="deleteAdminProject(${p.id})">Delete Project</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error filtering projects:', error);
    }
}
