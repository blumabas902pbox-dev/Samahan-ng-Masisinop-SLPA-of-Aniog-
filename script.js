// script.js - USWAG SLP Interactive Functions, Strict Modal Validation & Dynamic Gallery

// >>> Put the address of your PHP host here (the place where process_register.php is uploaded) <<<
const PHP_HOST = 'https://YOUR-PHP-HOST.example';   // <-- the ONLY line to edit (your PHP + MySQL host)
const API_URL = location.hostname.endsWith('github.io') ? PHP_HOST + '/process_register.php' : 'process_register.php';

function showWelcomeAlert() {
    const isAcknowledged = localStorage.getItem('uswag_welcome_acknowledged');
    const modal = document.getElementById('welcomeAlertModal');
    
    if (!isAcknowledged && modal) {
        modal.style.display = 'flex';
    }
}

function dismissModal() {
    const modal = document.getElementById('welcomeAlertModal');
    if (modal) {
        modal.style.display = 'none';
        localStorage.setItem('uswag_welcome_acknowledged', 'true');
    }
}

function closeRoleModal() {
    const roleModal = document.getElementById('roleModal');
    if (roleModal) {
        roleModal.style.display = 'none';
    }
}

function closeWarningModal() {
    const warningModal = document.getElementById('warningModal');
    if (warningModal) {
        warningModal.style.display = 'none';
    }
}

// Function to prevent weak passwords
function isWeakPassword(password) {
    const lowerPwd = password.toLowerCase();
    const commonWeak = ['password', '12345678', '123456789', 'qwertyui', 'qwertyuiop', 'admin123', '11111111', '12341234'];
    if (commonWeak.includes(lowerPwd)) return true;
    if (/(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)/.test(lowerPwd)) return true;
    if (/^(.)\1+$/.test(password)) return true;
    if (/(qwer|asdf|zxcv|abcd|1q2w)/.test(lowerPwd)) return true;
    return false;
}

function triggerConfettiBurst() {
    if (typeof confetti === 'function') {
        const successIcon = document.querySelector('.success-icon-wrapper');
        let originParams = { x: 0.5, y: 0.5 }; 

        if (successIcon) {
            const rect = successIcon.getBoundingClientRect();
            originParams = {
                x: (rect.left + (rect.width / 2)) / window.innerWidth,
                y: (rect.top + (rect.height / 2)) / window.innerHeight
            };
        }

        confetti({
            particleCount: 350,
            spread: 360,
            startVelocity: 35,
            gravity: 0.6,
            ticks: 250,
            origin: originParams
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    showWelcomeAlert();
    
    // --- 1. Role Selection Modal Logic ---
    const roleDisplay = document.getElementById('roleDisplay');
    const roleModal = document.getElementById('roleModal');
    const roleInput = document.getElementById('role');
    const roleOptions = document.querySelectorAll('.role-option');

    if (roleDisplay && roleModal) {
        roleDisplay.addEventListener('click', function(e) {
            e.preventDefault();
            roleModal.style.display = 'flex';
        });
    }

    roleOptions.forEach(option => {
        option.addEventListener('click', function() {
            const selectedRole = this.getAttribute('data-role');
            if (roleInput) roleInput.value = selectedRole;
            if (roleDisplay) {
                roleDisplay.value = selectedRole;
                roleDisplay.classList.remove('input-error'); 
            }
            closeRoleModal();
        });
    });

    // --- 2. Password Visibility Toggle Logic ---
    const togglePassword = document.getElementById('togglePassword');
    const passwordField = document.getElementById('password-field');

    if (togglePassword && passwordField) {
        togglePassword.addEventListener('click', function() {
            const isPassword = passwordField.getAttribute('type') === 'password';
            passwordField.setAttribute('type', isPassword ? 'text' : 'password');
            this.classList.toggle('fa-eye', !isPassword);
            this.classList.toggle('fa-eye-slash', isPassword);
        });
    }

    // --- 3. Form Validation & Async Submission ---
    const regForm = document.getElementById('regForm');
    const submitBtn = document.getElementById('submitBtn');
    const usernameInput = document.getElementById('username');
    const addressInput = document.getElementById('address'); 
    const contactInput = document.getElementById('contact_number');

    if (regForm) {
        const allInputs = regForm.querySelectorAll('input');
        allInputs.forEach(input => {
            input.addEventListener('input', function() {
                this.classList.remove('input-error');
                if (submitBtn) {
                    submitBtn.style.backgroundColor = "var(--secondary-color)";
                }
            });
        });

        regForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const warningModal = document.getElementById('warningModal');
            const warningMessage = document.getElementById('warningMessage');

            function triggerWarning(msg, invalidInputs = []) {
                invalidInputs.forEach(input => {
                    if (input) input.classList.add('input-error');
                });

                if (warningModal && warningMessage) {
                    warningMessage.innerText = msg;
                    warningModal.style.display = 'flex';
                } else {
                    alert(msg);
                }

                if (submitBtn) {
                    submitBtn.style.backgroundColor = "var(--accent-color)";
                    submitBtn.style.color = "#FFFFFF";
                }
            }

            allInputs.forEach(input => input.classList.remove('input-error'));

            const usernameVal = usernameInput ? usernameInput.value.trim() : '';
            const addressVal = addressInput ? addressInput.value.trim() : '';
            const contactVal = contactInput ? contactInput.value.trim() : '';
            const roleVal = roleInput ? roleInput.value.trim() : '';
            const passwordVal = passwordField ? passwordField.value : '';

            let invalidElements = [];

            if (!usernameVal) invalidElements.push(usernameInput);
            if (!addressVal) invalidElements.push(addressInput);
            if (!contactVal) invalidElements.push(contactInput);
            if (!roleVal) invalidElements.push(roleDisplay);
            if (!passwordVal) invalidElements.push(passwordField);

            if (!usernameVal || !addressVal || !contactVal || !roleVal || !passwordVal) {
                triggerWarning("Please fill in all required fields and select a System Role.", invalidElements);
                return;
            }

            const contactRegex = /^\d{11}$/;
            if (!contactRegex.test(contactVal)) {
                triggerWarning("Contact number must strictly be exactly 11 digits (e.g., 09071128654).", [contactInput]);
                return;
            }

            if (passwordVal.length < 8) {
                triggerWarning("Account password must strictly be at least 8 characters long.", [passwordField]);
                return;
            }

            if (isWeakPassword(passwordVal)) {
                triggerWarning("Your password is too weak. Please avoid common combinations (like '1234'), repeated characters, or simple words.", [passwordField]);
                return;
            }

            if (submitBtn) submitBtn.disabled = true;

            apiPost({
                action: 'register',
                username: usernameVal,
                address: addressVal,
                contact_number: contactVal,
                role: roleVal,
                password: passwordVal
            })
            .then(({ ok, data }) => {
                if (ok && data.status === 'success') {
                    localStorage.setItem('uswag_token', data.token);
                    localStorage.setItem('uswag_role', data.role);
                    window.location.href = data.redirect || 'thankyou.html';
                } else {
                    triggerWarning(data.error || 'Registration failed. Please try again.');
                }
            })
            .catch(() => {
                triggerWarning('Cannot reach the server. Registration needs an internet connection, please try again.');
            })
            .finally(() => { if (submitBtn) submitBtn.disabled = false; });
        });
    }

    // --- 4. Video Sound Toggle Logic ---
    const tutorialVideo = document.getElementById('tutorialVideo');
    const muteToggle = document.getElementById('muteToggle');

    if (tutorialVideo && muteToggle) {
        muteToggle.addEventListener('click', function() {
            if (tutorialVideo.muted) {
                tutorialVideo.muted = false;
                muteToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            } else {
                tutorialVideo.muted = true;
                muteToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            }
        });
    }

    // Checking successful redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'success') {
        setTimeout(triggerConfettiBurst, 150); 
    }

    // --- 5. Initialize All Compact Galleries ---
    initGallery();
});

// =========================================================================
// Multi-Instance Gallery & Lightbox Logic
// =========================================================================

function initGallery() {
    const wrappers = document.querySelectorAll('.gallery-wrapper');
    if (wrappers.length === 0) return;

    wrappers.forEach(wrapper => {
        // Track unique position state for each gallery slider instance
        wrapper.dataset.galleryPos = "0";

        const slider = wrapper.querySelector('.gallery-slider');
        const arrows = wrapper.querySelectorAll('.gal-arrow');
        const prevBtn = arrows[0];
        const nextBtn = arrows[1];

        if (!slider) return;

        if (prevBtn) prevBtn.addEventListener('click', () => moveGallery(wrapper, -1));
        if (nextBtn) nextBtn.addEventListener('click', () => moveGallery(wrapper, 1));
    });

    window.addEventListener('resize', () => {
        wrappers.forEach(wrapper => {
            wrapper.dataset.galleryPos = "0";
            renderGallerySlide(wrapper);
        });
    });
}

function moveGallery(wrapper, direction) {
    const slider = wrapper.querySelector('.gallery-slider');
    if (!slider || slider.children.length === 0) return;

    const isMobile = window.innerWidth <= 768;
    const visibleCount = isMobile ? 1 : 4; 
    
    // Prevent negative bounds if total images are fewer than visible slots
    const maxIndex = Math.max(0, slider.children.length - visibleCount);

    let currentPos = parseInt(wrapper.dataset.galleryPos || "0", 10);
    currentPos += direction;

    if (currentPos < 0) currentPos = 0;
    if (currentPos > maxIndex) currentPos = maxIndex;

    wrapper.dataset.galleryPos = currentPos;
    renderGallerySlide(wrapper);
}

function renderGallerySlide(wrapper) {
    const slider = wrapper.querySelector('.gallery-slider');
    if (!slider || slider.children.length === 0) return;

    const currentPos = parseInt(wrapper.dataset.galleryPos || "0", 10);
    const imgWidth = slider.children[0].getBoundingClientRect().width;
    const gap = 12; // Must match CSS gap

    const translateX = (imgWidth + gap) * currentPos;
    slider.style.transform = `translateX(-${translateX}px)`;
}

// Lightbox Modal functions (shared seamlessly across all sliders)
function openImageModal(imgUrl) {
    const modal = document.getElementById('imageLightboxModal');
    const modalImg = document.getElementById('lightboxImage');
    if (modal && modalImg) {
        modalImg.src = imgUrl;
        modal.style.display = 'flex';
    }
}

function closeLightbox() {
    const modal = document.getElementById('imageLightboxModal');
    if (modal) modal.style.display = 'none';
}


// =========================================================================
// API helper + Offline Sales Queue (browser storage -> PHP -> MySQL)
// =========================================================================

async function apiPost(payload) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON reply */ }
    return { ok: res.ok, status: res.status, data };
}

async function uswagLogin(contact, password) {
    const { ok, data } = await apiPost({ action: 'login', contact_number: contact, password });
    if (ok) {
        localStorage.setItem('uswag_token', data.token);
        localStorage.setItem('uswag_role', data.role);
        syncSales();
    }
    return { ok, error: data.error };
}

function readQueue(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
}
function writeQueue(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
}

// sale = { status: 'Paid' | 'Pending', items: [{ product_id, quantity, unit_price }] }
function queueSale(sale) {
    if (localStorage.getItem('uswag_role') !== 'Seller') {
        alert('Only Seller accounts can record sales.');
        return false;
    }
    const q = readQueue('pendingSales');
    q.push({
        ...sale,
        client_id: crypto.randomUUID(),          // prevents duplicates on the server
        sale_date: new Date().toISOString(),
        was_offline: !navigator.onLine
    });
    writeQueue('pendingSales', q);
    syncSales();
    return true;
}

let syncing = false;
async function syncSales() {
    const token = localStorage.getItem('uswag_token');
    const q = readQueue('pendingSales');
    if (syncing || !token || !q.length || !navigator.onLine) return;

    syncing = true;
    try {
        const batch = q.slice(0, 100);
        const { ok, data } = await apiPost({ action: 'sync_sales', token, sales: batch });
        if (ok) {
            const rejected = data.rejected || [];
            const done = new Set([...(data.saved || []), ...rejected.map(r => r.client_id)]);
            writeQueue('pendingSales', q.filter(s => !done.has(s.client_id)));

            if (rejected.length) {   // keep rejected sales so the seller can review them
                const failed = readQueue('failedSales');
                rejected.forEach(r => {
                    const original = batch.find(s => s.client_id === r.client_id);
                    failed.push({ ...original, reason: r.reason });
                });
                writeQueue('failedSales', failed);
            }
        }
    } catch (e) {
        /* offline or server down: sales stay queued and retry later */
    } finally {
        syncing = false;
    }
}

window.addEventListener('online', syncSales);
document.addEventListener('DOMContentLoaded', syncSales);
setInterval(syncSales, 60000);


// =========================================================================
// Login, live catalog (Buyer + Seller) and Seller tools
// =========================================================================

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initLogin() {
    const btn = document.getElementById('loginBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const msg = document.getElementById('loginMsg');
        const contact = document.getElementById('login_contact').value.trim();
        const pw = document.getElementById('login_password').value;
        msg.textContent = '';
        if (!/^\d{11}$/.test(contact) || !pw) { msg.textContent = 'Enter your 11-digit contact number and password.'; return; }
        btn.disabled = true;
        try {
            const r = await uswagLogin(contact, pw);
            if (r.ok) window.location.href = 'portfolio.html'; else msg.textContent = r.error || 'Login failed.';
        } catch (e) {
            msg.textContent = 'Cannot reach the server. Login needs an internet connection.';
        }
        btn.disabled = false;
    });
}

async function initPortfolio() {
    const bar = document.getElementById('accountBar');
    if (!bar) return;
    const token = localStorage.getItem('uswag_token');
    const role = localStorage.getItem('uswag_role');

    bar.innerHTML = token
        ? `Logged in as <strong>${esc(role)}</strong> &middot; <a href="#" id="logoutLink">Log out</a>`
        : `<a href="register.html#login">Log in</a> or <a href="register.html">register</a> to contact sellers.`;
    const out = document.getElementById('logoutLink');
    if (out) out.addEventListener('click', e => {
        e.preventDefault();
        ['uswag_token', 'uswag_role', 'uswagDash'].forEach(k => localStorage.removeItem(k));
        location.reload();
    });

    try {
        const { ok, data } = await apiPost({ action: 'list_catalog', token });
        if (ok && data.products && data.products.length) {
            document.getElementById('liveTitle').style.display = 'block';
            document.getElementById('liveGallery').innerHTML = data.products.map(p => `
                <div class="card-box" style="padding:15px;margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
                    <div>
                        <h3 style="margin-top:0;font-size:1.1rem;">${esc(p.product_name)}</h3>
                        <p style="margin-bottom:5px;font-size:0.9rem;"><strong>Category:</strong> ${esc(p.category_name)}</p>
                        <p style="margin-bottom:5px;font-size:0.9rem;">&#8369;${Number(p.unit_price).toFixed(2)} / ${esc(p.unit_of_measure)} | Stock: ${Number(p.current_stock)} ${esc(p.unit_of_measure)}</p>
                        <p style="margin-bottom:0;font-size:0.9rem;">Seller: ${esc(p.seller_name)}</p>
                    </div>
                    ${p.contact_number
                        ? `<a href="tel:${esc(p.contact_number)}" class="btn-inquire"><i class="fa-solid fa-phone"></i> Call ${esc(p.contact_number)}</a>`
                        : `<a href="register.html#login" class="btn-inquire">Log in to contact seller</a>`}
                </div>`).join('');
        }
    } catch (e) { /* offline: the built-in gallery below still shows */ }

    if (token && role === 'Seller') initSellerPanel();
}

async function initSellerPanel() {
    const panel = document.getElementById('sellerPanel');
    let d = null;
    try {
        const r = await apiPost({ action: 'dashboard', token: localStorage.getItem('uswag_token') });
        if (r.ok) { d = r.data; localStorage.setItem('uswagDash', JSON.stringify(d)); }
        else if (r.status === 401) { panel.innerHTML = '<div class="card-box">Session expired. <a href="register.html#login">Log in again</a>.</div>'; return; }
    } catch (e) { /* offline */ }
    if (!d) { try { d = JSON.parse(localStorage.getItem('uswagDash')); } catch (e) {} }   // cached copy works offline
    if (!d) { panel.innerHTML = '<div class="card-box">Could not load your seller tools. Please check your connection.</div>'; return; }

    const opt = (list, id, name) => list.map(x => `<option value="${x[id]}">${esc(x[name])}</option>`).join('');
    panel.innerHTML = `
        <div class="card-box">
            <h3>Record a sale</h3>
            <p style="font-size:0.9rem;margin-bottom:10px;">Balance: <strong>&#8369;${Number(d.balance).toFixed(2)}</strong> &middot; Waiting to sync: <strong id="pendingCount">${readQueue('pendingSales').length}</strong></p>
            ${d.products.length ? `
            <div class="form-group"><label>Product</label><select id="ss_product">${d.products.map(p => `<option value="${p.product_id}" data-price="${p.unit_price}">${esc(p.product_name)} (${Number(p.current_stock)} ${esc(p.unit_of_measure)})</option>`).join('')}</select></div>
            <div class="form-group"><label>Quantity</label><input type="number" id="ss_qty" min="0" step="any"></div>
            <div class="form-group"><label>Price per unit</label><input type="number" id="ss_price" min="0" step="any"></div>
            <div class="form-group"><label>Payment</label><select id="ss_status"><option>Paid</option><option>Pending</option></select></div>
            <p id="ssMsg" style="font-size:0.9rem;margin-bottom:10px;"></p>
            <button type="button" id="ssBtn" class="btn-submit">Save sale</button>` : '<p>Add a product first.</p>'}
        </div>
        <div class="card-box">
            <h3>Add a product</h3>
            <div class="form-group"><label>Product name</label><input type="text" id="sp_name" maxlength="100"></div>
            <div class="form-group"><label>Category</label><select id="sp_cat">${opt(d.categories, 'category_id', 'category_name')}</select></div>
            <div class="form-group"><label>Unit (kg, sack, piece)</label><input type="text" id="sp_unit" maxlength="20" value="kg"></div>
            <div class="form-group"><label>Price per unit</label><input type="number" id="sp_price" min="0" step="any"></div>
            <div class="form-group"><label>Starting stock</label><input type="number" id="sp_stock" min="0" step="any" value="0"></div>
            <p id="spMsg" style="font-size:0.9rem;margin-bottom:10px;"></p>
            <button type="button" id="spBtn" class="btn-submit">Add product</button>
        </div>`;

    const sel = document.getElementById('ss_product');
    if (sel) {
        const fill = () => { document.getElementById('ss_price').value = sel.selectedOptions[0].dataset.price; };
        sel.addEventListener('change', fill); fill();
        document.getElementById('ssBtn').addEventListener('click', () => {
            const qty = parseFloat(document.getElementById('ss_qty').value);
            const price = parseFloat(document.getElementById('ss_price').value);
            const msg = document.getElementById('ssMsg');
            if (!(qty > 0) || !(price >= 0)) { msg.textContent = 'Enter a quantity and price.'; return; }
            queueSale({ status: document.getElementById('ss_status').value, items: [{ product_id: +sel.value, quantity: qty, unit_price: price }] });
            document.getElementById('ss_qty').value = '';
            document.getElementById('pendingCount').textContent = readQueue('pendingSales').length;
            msg.textContent = navigator.onLine ? 'Saved and sending...' : 'Saved on this phone. It will send when you are back online.';
        });
    }
    document.getElementById('spBtn').addEventListener('click', async () => {
        const msg = document.getElementById('spMsg');
        try {
            const r = await apiPost({
                action: 'add_product', token: localStorage.getItem('uswag_token'),
                product_name: document.getElementById('sp_name').value, category_id: +document.getElementById('sp_cat').value,
                unit_of_measure: document.getElementById('sp_unit').value, unit_price: document.getElementById('sp_price').value,
                stock: document.getElementById('sp_stock').value
            });
            if (r.ok) initSellerPanel(); else msg.textContent = r.data.error || 'Could not add the product.';
        } catch (e) { msg.textContent = 'Adding products needs an internet connection.'; }
    });
}

document.addEventListener('DOMContentLoaded', () => { initLogin(); initPortfolio(); });