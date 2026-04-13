const API_BASE = '';
const mockProjects = [
    { id: 1, title: "Smart Irrigation Drone", sector: "Agriculture", desc: "Autonomous drone monitoring.", needed: 5000, raised: 3200, author: "student@test.com", fundedBy: [], imageUrl: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&h=400&fit=crop" },
    { id: 2, title: "3D Printed Prosthetic", sector: "Medical", desc: "Affordable prosthetics.", needed: 1500, raised: 1500, author: "jane@test.com", fundedBy: [], imageUrl: "https://images.unsplash.com/photo-1576091160550-112173f7f869?w=800&h=400&fit=crop" }
];

const mockNeeds = [];
const mockMessages = [
    { id: 1, from: "donor@test.com", to: "student@test.com", text: "Hi! I am interested in your project budget details.", timestamp: new Date().toISOString(), read: false },
    { id: 2, from: "student@test.com", to: "donor@test.com", text: "Thank you! I will share the plan details right away.", timestamp: new Date().toISOString(), read: false }
];

const mockUsers = [
    { name: "Demo Student", email: "student@test.com", password: "123", role: "student" },
    { name: "Demo Donor", email: "donor@test.com", password: "123", role: "donor" },
    { name: "Admin", email: "admin@test.com", password: "123", role: "admin" }
];

// Load Google API keys from environment or backend
let GOOGLE_API_KEY = '';
let GOOGLE_IMAGE_SEARCH_CX = '';

async function loadConfig() {
    try {
        const response = await fetch('/api/config/');
        const config = await response.json();
        GOOGLE_API_KEY = config.google_api_key || '';
        GOOGLE_IMAGE_SEARCH_CX = config.google_image_search_cx || '';
    } catch (error) {
        console.warn('Failed to load config:', error);
    }
}

if (!localStorage.getItem('users')) localStorage.setItem('users', JSON.stringify(mockUsers));
if (!localStorage.getItem('projects')) localStorage.setItem('projects', JSON.stringify(mockProjects));
if (!localStorage.getItem('needs')) localStorage.setItem('needs', JSON.stringify(mockNeeds));
if (!localStorage.getItem('messages')) localStorage.setItem('messages', JSON.stringify(mockMessages));

function getBadgeClass(sector) {
    if (sector === 'Medical') return 'badge-med';
    if (sector === 'Agriculture') return 'badge-agri';
    return 'badge-tech';
}

function generateDynamicImageUrl(project) {
    const sector = (project.sector || 'technology').toLowerCase();

    // Fallback sector keywords for the API
    const keywordMap = {
        'technology': 'technology,computer,robot',
        'medical': 'medical,hospital,doctor',
        'agriculture': 'agriculture,farming,field'
    };
    const keyword = keywordMap[sector] || 'technology';

    // Force a unique image per project ID, or random if fresh
    const hash = project.id ? Math.abs(project.id) : Date.now();
    return `https://loremflickr.com/800/400/${keyword}?random=${hash}`;
}

function getProjectImageUrl(project) {
    let img = project ? project.imageUrl : null;
    if (img && typeof img === 'string') {
        // Accept valid known image domains
        if (img.includes('unsplash') || img.includes('source=') || img.includes('static/') || img.includes('loremflickr')) {
            return img;
        }
    }

    const specificMap = {
        'smart irrigation drone': 'https://images.unsplash.com/photo-1625246333195-78d9c38ad576?w=800&h=400&fit=crop',
        'solar backpack': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
        '3d printed prosthetic': 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=800&h=400&fit=crop',
        'campus tutor ai': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=400&fit=crop',
        'water harvesting system': 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800&h=400&fit=crop'
    };

    const titleLower = ((project && project.title) ? project.title : '').toLowerCase().trim();
    if (specificMap[titleLower]) return specificMap[titleLower];

    const fallback = generateDynamicImageUrl(project);
    return fallback ? fallback : 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop';
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

async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
        await requestJson(`/api/projects/${projectId}/delete/`, { method: 'POST' });
        window.location.reload();
    } catch (err) {
        alert('Failed to delete project: ' + (err.error || 'Unknown error'));
    }
}

async function requestJson(url, options = {}) {
    const opts = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        ...options,
    };
    const response = await fetch(API_BASE + url, opts);
    const data = await response.json();
    if (!response.ok) {
        throw data;
    }
    return data;
}

async function checkAuth() {
    try {
        const data = await requestJson('/api/me/');
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        try {
            const usersData = await requestJson('/api/users/');
            if (usersData && usersData.users) {
                // Merge api users into local storage for dynamic name resolution
                const localUsers = JSON.parse(localStorage.getItem('users')) || [];
                const merged = [...localUsers];
                for (let apiUser of usersData.users) {
                    if (!merged.find(u => u.email === apiUser.email)) {
                        merged.push(apiUser);
                    }
                }
                localStorage.setItem('users', JSON.stringify(merged));
            }
        } catch (e) {
            console.warn("Could not fetch remote users", e);
        }

        const nameDisplay = document.getElementById('user-name');
        if (nameDisplay) nameDisplay.innerText = data.user.name;
        return data.user;
    } catch (err) {
        if (window.location.pathname.includes('student-dashboard') || window.location.pathname.includes('donor-dashboard')) {
            window.location.href = '/login/';
        }
        return null;
    }
}

async function logout() {
    try {
        await requestJson('/api/logout/', { method: 'POST' });
    } catch (err) {
        console.warn('Logout error', err);
    }
    localStorage.removeItem('currentUser');
    window.location.href = '/login/';
}

async function registerUser(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const role = document.getElementById('reg-role').value;
    const error = document.getElementById('register-error');
    error.style.display = 'none';

    try {
        await requestJson('/api/register/', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role }),
        });
        alert('Registration successful! Please log in.');
        window.location.href = '/login/';
    } catch (err) {
        error.style.display = 'block';
        error.innerText = err.error || 'Registration failed';
    }
}

async function loginUser(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    const errorMsg = document.getElementById('error-msg');
    errorMsg.style.display = 'none';

    try {
        const data = await requestJson('/api/login/', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        const user = data.user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        if (user.role === 'admin') {
            window.location.href = '/admin-dashboard/';
        } else if (user.role === 'student') {
            window.location.href = '/student-dashboard/';
        } else {
            window.location.href = '/donor-dashboard/';
        }
    } catch (err) {
        errorMsg.style.display = 'block';
        errorMsg.innerText = err.error || 'Invalid email or password.';
    }
}

function loadStudentDash() {
    checkAuth().then(async user => {
        if (!user) return;
        const adminLink = document.getElementById('admin-link');
        if (adminLink && user.role === 'admin') {
            adminLink.style.display = 'inline-block';
        }
        let projects = [];
        try {
            const res = await requestJson('/api/projects/');
            projects = res.projects || [];
        } catch (e) { console.error(e); }
        const needs = JSON.parse(localStorage.getItem('needs')) || [];
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

        const needsContainer = document.getElementById('donor-needs');
        if (needsContainer) {
            needsContainer.innerHTML = needs.map(n => `
                <div class="card item-card" style="border-left: 4px solid var(--primary);">
                    <h3>${n.title}</h3>
                    <small>by ${n.donor}</small>
                    <p>${n.desc}</p>
                </div>
            `).join('');
        }
    });
}

function loadDonorDash() {
    checkAuth().then(async user => {
        if (!user) return;
        const adminLink = document.getElementById('admin-link');
        if (adminLink && user.role === 'admin') {
            adminLink.style.display = 'inline-block';
        }
        let projects = [];
        try {
            const res = await requestJson('/api/projects/');
            projects = res.projects || [];
        } catch (e) { console.error(e); }
        const needs = JSON.parse(localStorage.getItem('needs')) || [];

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

        const feed = document.getElementById('project-feed');
        if (feed) {
            feed.innerHTML = projects.map(p => `
                <div class="card item-card project-card">
                    <div class="project-image" style="background-image:url('${getProjectImageUrl(p)}'); background-color: #1e293b; background-size: cover; background-position: center;"></div>
                    <div class="project-content">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
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
                            <button onclick="fundProject(${p.id})" class="btn btn-sm">Fund Project</button>
                            <button onclick="openChat('${p.author}', '${p.title}')" class="btn btn-sm btn-outline">Ask Question</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const myNeeds = needs.filter(n => n.donor === user.name);
        const myNeedsContainer = document.getElementById('my-needs-feed');
        if (myNeedsContainer) {
            if (myNeeds.length === 0) {
                myNeedsContainer.innerHTML = `<p style="color:gray;">No needs posted yet.</p>`;
            } else {
                myNeedsContainer.innerHTML = myNeeds.map(n => `
                    <div class="card item-card" style="border-left: 4px solid orange;">
                        <h3>${n.title}</h3>
                        <p>${n.desc}</p>
                    </div>
                `).join('');
            }
        }
    });
}

async function postProject(e) {
    e.preventDefault();
    try {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user) {
            alert('Please login first.');
            window.location.href = 'login.html';
            return;
        }

        const title = document.getElementById('p-title').value.trim();
        const desc = document.getElementById('p-desc').value.trim();
        const sector = document.getElementById('p-sector').value;
        const needed = Number(document.getElementById('p-needed').value);

        if (!title || !desc || !sector || !needed || needed <= 0) {
            alert('Please complete the project form with a valid budget.');
            return;
        }

        let liveImageUrl = await fetchGoogleProjectImage(title, sector);
        const placeholderImage = liveImageUrl || getProjectImageUrl({ title, sector });

        await requestJson('/api/projects/', {
            method: 'POST',
            body: JSON.stringify({
                title,
                desc,
                sector,
                needed,
                imageUrl: placeholderImage
            })
        });

        alert('Project Posted! Relevant image added to your project.');
        window.location.reload();
    } catch (error) {
        console.error('Error posting project:', error);
        alert('Error posting project: ' + error.message);
    }
}

function postNeed(e) {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const title = document.getElementById('n-title').value;
    const desc = document.getElementById('n-desc').value;
    const sector = document.getElementById('n-sector').value;

    const needs = JSON.parse(localStorage.getItem('needs')) || [];
    needs.unshift({ id: Date.now(), title, desc, sector, donor: user.name });

    localStorage.setItem('needs', JSON.stringify(needs));
    alert("Need Posted!");
    window.location.reload();
}

async function fundProject(id) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const amount = prompt("Enter funding amount (₹):");

    if (amount && !isNaN(amount) && parseInt(amount) > 0) {
        try {
            await requestJson(`/api/projects/${id}/fund/`, {
                method: 'POST',
                body: JSON.stringify({ amount: parseInt(amount) })
            });
            alert(`Thank you! Funded ₹${amount}.`);
            window.location.reload();
        } catch (err) {
            alert('Funding failed: ' + (err.error || 'Unknown error'));
        }
    }
}

let currentChatStudent = null;
function getDisplayName(email) {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email);
    return user ? user.name : email;
}

function getChatContacts(userEmail) {
    const allMessages = JSON.parse(localStorage.getItem('messages')) || [];
    const contacts = new Set();
    allMessages.forEach(m => {
        if (m.from === userEmail && m.to && m.to !== 'null') contacts.add(m.to);
        if (m.to === userEmail && m.from && m.from !== 'null') contacts.add(m.from);
    });
    return Array.from(contacts);
}

function getUnreadCount(userEmail, contactEmail) {
    const allMessages = JSON.parse(localStorage.getItem('messages')) || [];
    return allMessages.filter(m => m.to === userEmail && m.from === contactEmail && !m.read).length;
}

function renderChatContacts() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const container = document.getElementById('chat-contacts-list');
    if (!user || !container) return;

    let contacts = getChatContacts(user.email);
    if (currentChatStudent && !contacts.includes(currentChatStudent)) {
        contacts.unshift(currentChatStudent);
    }

    if (contacts.length === 0) {
        container.innerHTML = '<div class="chat-placeholder">No conversations yet. Use Ask Question to start one.</div>';
        return;
    }

    container.innerHTML = contacts.map(email => {
        const label = getDisplayName(email);
        const unread = getUnreadCount(user.email, email);
        const active = email === currentChatStudent ? 'active' : '';
        const badge = unread > 0 ? `<span class="contact-badge">${unread}</span>` : '';
        return `<button type="button" class="contact-item ${active}" onclick="openChat('${email}')">
                    <span>${label}</span>
                    ${badge}
                </button>`;
    }).join('');
}

function openChat(studentEmail, projectTitle) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    currentChatStudent = studentEmail || currentChatStudent;

    if (currentChatStudent) {
        markMessagesRead(currentChatStudent);
    }

    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    document.getElementById('chat-title').innerText =
        studentEmail && projectTitle ? "Chat: " + projectTitle : "Chat Center";

    const subtitleEl = document.getElementById('chat-subtitle');
    if (subtitleEl) {
        subtitleEl.innerText = currentChatStudent
            ? currentChatStudent
            : "Select a contact to view messages.";
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

function renderMessages() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    const allMessages = JSON.parse(localStorage.getItem('messages')) || [];
    const chatMsgs = allMessages.filter(m =>
        (m.from === user.email && m.to === currentChatStudent) ||
        (m.from === currentChatStudent && m.to === user.email)
    );
    const container = document.getElementById('chat-messages');

    if (chatMsgs.length === 0) {
        container.innerHTML = '<div class="chat-placeholder">No messages yet. Start the conversation.</div>';
    } else {
        container.innerHTML = chatMsgs.map(m => `
            <div class="msg ${m.from === user.email ? 'msg-sent' : 'msg-received'}">
                <p>${m.text}</p>
                <small>${formatTime(m.timestamp)}</small>
            </div>`).join('');
    }

    container.scrollTop = container.scrollHeight;
}

async function syncMessages() {
    try {
        const res = await requestJson('/api/messages/');
        if (res && res.messages) {
            // Remove any bad records with null from legacy tests
            const cleanMsgs = res.messages.filter(m => m.to && m.to !== 'null' && m.from && m.from !== 'null');
            localStorage.setItem('messages', JSON.stringify(cleanMsgs));
        }
    } catch (e) { console.error('Failed to sync messages:', e); }
    updateChatBadge();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input.value) return;
    if (!currentChatStudent || currentChatStudent === 'null') {
        alert("Please select a valid contact to chat with.");
        return;
    }
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
        alert("Please login to send a message.");
        window.location.href = '/login/';
        return;
    }

    try {
        await requestJson('/api/messages/', {
            method: 'POST',
            body: JSON.stringify({
                to: currentChatStudent,
                text: input.value
            })
        });
        input.value = '';
        await syncMessages();
        renderMessages();
    } catch (err) {
        alert('Failed to send message: ' + (err.error || 'Unknown error'));
    }
}

function updateChatBadge() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const badge = document.getElementById('chat-badge');
    if (!user || !badge) return;

    const allMessages = JSON.parse(localStorage.getItem('messages')) || [];
    const unread = allMessages.filter(m => m.to === user.email && !m.read).length;
    if (unread > 0) {
        badge.innerText = unread;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function markMessagesRead(contactEmail) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || !contactEmail || contactEmail === 'null') return;

    try {
        await requestJson('/api/messages/read/', {
            method: 'POST',
            body: JSON.stringify({ contactEmail: contactEmail })
        });
        await syncMessages();
        renderChatContacts();
    } catch (e) { console.error(e); }
}

function getLastContact(userEmail) {
    const allMessages = JSON.parse(localStorage.getItem('messages')) || [];
    const conversations = allMessages.filter(m => m.from === userEmail || m.to === userEmail);
    if (!conversations.length) return null;
    const recent = conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return recent.from === userEmail ? recent.to : recent.from;
}

function formatTime(value) {
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- PROJECT EVALUATOR HELPERS ---
async function analyzeDescriptionSentiment(description) {
    if (!GOOGLE_API_KEY) return null;
    try {
        const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document: { type: 'PLAIN_TEXT', content: description }, encodingType: 'UTF8' })
        });
        if (!response.ok) return null;
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

    return { title, sector, budget, budgetEstimate, successScore, successLabel: label, notes };
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
        <p style="color:white; margin-bottom:6px;"><strong>Project:</strong> ${result.title}</p>
        <p style="color:white; margin-bottom:6px;"><strong>Sector:</strong> ${result.sector}</p>
        <p style="color:white; margin-bottom:6px;"><strong>Planned Budget:</strong> ${formatRupees(result.budget)}</p>
        <p style="color:white; margin-bottom:6px;"><strong>Recommended Budget:</strong> ${formatRupees(result.budgetEstimate)}</p>
        <p style="color:white; margin-bottom:6px;"><strong>Success Prediction:</strong> ${result.successLabel} (${result.successScore}%)</p>
        <div style="margin-top:10px; color:white;"><strong>Recommendations</strong><ul style="margin-top:5px; padding-left:20px;">${result.notes.map(note => `<li style="margin-bottom:4px;">${note}</li>`).join('')}</ul></div>
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
    if (window.location.pathname.includes('student-dashboard') || window.location.pathname.includes('donor-dashboard')) {
        checkAuth();
    }
    syncMessages();
    const chatModal = document.getElementById('chat-modal');
    if (chatModal) {
        chatModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    const evalModal = document.getElementById('evaluator-modal');
    if (evalModal) {
        evalModal.style.display = 'none';
    }
    initEvaluator();
});

function switchTab(tabName) {
    document.getElementById('projects-section').style.display = 'none';
    document.getElementById('needs-section').style.display = 'none';
    document.getElementById(tabName + '-section').style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
}

// --- ADMIN PANEL ---
async function loadAdminDash() {
    try {
        const data = await requestJson('/api/me/');
        if (!data.user || data.user.role !== 'admin') {
            alert('Access Denied. Admin only.');
            window.location.href = '/login/';
            return;
        }

        const adminNameEl = document.getElementById('admin-name');
        if (adminNameEl) adminNameEl.innerText = data.user.name;

        updateAdminStats();
        loadAdminUsers();
        loadAdminProjects();
    } catch (err) {
        window.location.href = '/login/';
    }
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
    let projects = window.adminProjectsData;
    if (!projects) {
        try {
            const res = await requestJson('/api/projects/');
            projects = res.projects || [];
            window.adminProjectsData = projects;
        } catch (e) { projects = []; }
    }

    let totalFunded = 0;
    projects.forEach(p => {
        if (Array.isArray(p.fundedBy)) {
            p.fundedBy.forEach(f => {
                totalFunded += f.amount || 0;
            });
        }
    });

    requestJson('/api/users/').then(data => {
        const users = data.users || [];
        const adminCount = users.filter(u => u.role === 'admin').length;
        const studentCount = users.filter(u => u.role === 'student').length;
        const donorCount = users.filter(u => u.role === 'donor').length;

        document.getElementById('stat-users').innerText = users.length;
        document.getElementById('stat-admins').innerText = adminCount;

        const dist = `Students: ${studentCount} | Donors: ${donorCount} | Admins: ${adminCount}`;
        const roleDist = document.getElementById('role-dist');
        if (roleDist) roleDist.innerText = dist;
    }).catch(err => console.error(err));

    document.getElementById('stat-projects').innerText = projects.length;
    document.getElementById('stat-funding').innerText = '₹' + totalFunded.toLocaleString();
}

async function loadAdminUsers() {
    try {
        const data = await requestJson('/api/users/');
        const users = data.users || [];
        window.adminUsersData = users; // cache for filter
        renderAdminUsers(users);
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

function renderAdminUsers(users) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
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
                ${u.role !== 'admin' ? `<button class="btn-promote" onclick="promoteUserToAdmin('${u.email}')">Promote to Admin</button>` : ''}
                <button class="btn-delete" onclick="deleteUser('${u.email}')">Delete User</button>
            </div>
        </div>
    `).join('');
}

async function deleteUser(email) {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    try {
        await requestJson('/api/users/', { method: 'DELETE', body: JSON.stringify({ email }) });
        loadAdminUsers();
        updateAdminStats();
        alert('User deleted successfully');
    } catch (err) {
        alert(err.error || 'Failed to delete user');
    }
}

async function promoteUserToAdmin(email) {
    if (!confirm(`Promote ${email} to Admin?`)) return;
    try {
        await requestJson('/api/users/promote/', { method: 'POST', body: JSON.stringify({ email }) });
        loadAdminUsers();
        updateAdminStats();
        alert('User promoted to admin');
    } catch (err) {
        alert(err.error || 'Failed to promote user');
    }
}

function filterUsers(searchTerm) {
    const users = window.adminUsersData || [];
    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    renderAdminUsers(filtered);
}

async function loadAdminProjects() {
    try {
        const res = await requestJson('/api/projects/');
        const projects = res.projects || [];
        window.adminProjectsData = projects;
        renderAdminProjects(projects);
    } catch (err) {
        console.error('Failed to load admin projects:', err);
    }
}

function renderAdminProjects(projects) {
    const projectsList = document.getElementById('projects-list');
    if (!projectsList) return;

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

async function deleteAdminProject(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
        await requestJson(`/api/projects/${projectId}/delete/`, { method: 'POST' });
        loadAdminProjects();
        updateAdminStats();
        alert('Project deleted successfully');
    } catch (err) {
        alert('Failed to delete project: ' + (err.error || 'Unknown error'));
    }
}

function filterProjects(searchTerm = '') {
    const projects = window.adminProjectsData || [];
    const sector = document.getElementById('sector-filter')?.value || '';
    let search = '';

    // Sometimes it's called from onchange without a searchTerm, or with an event
    if (typeof searchTerm === 'string') {
        search = searchTerm;
    } else {
        search = document.getElementById('project-search')?.value || '';
    }

    let filtered = projects;
    if (search) {
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(search.toLowerCase())
        );
    }
    if (sector) {
        filtered = filtered.filter(p => p.sector === sector);
    }

    renderAdminProjects(filtered);
}
