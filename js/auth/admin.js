// Authentication and admin functionality module
// Handles login/logout, admin features, center point management

async function checkAuth() {
    try {
        // Check server-side authentication first
        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.authenticated && data.isAdmin) {
            isAuthenticated = true;
            updateAuthBodyClass();
            AppGlobals.showCanvas(true); // Show canvas in admin mode
            ToolbarModule.showStatus('Logged in as admin');
            
            // Show center indicator for admin users
            if (centerPoint && window.AdminModule) {
                window.AdminModule.showCenterIndicator(centerPoint.x, centerPoint.y);
            }
            return;
        }
    } catch (error) {
        console.log('Server auth check failed, checking legacy auth');
    }
    
    // Fall back to localStorage authentication for backward compatibility
    const storedAuth = localStorage.getItem('canvas_admin_auth');
    if (storedAuth) {
        try {
            const authData = JSON.parse(storedAuth);
            const now = new Date().getTime();
            const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
            
            if ((now - authData.timestamp) < expirationTime) {
                isAuthenticated = true;
                AppGlobals.showCanvas(true); // Show canvas in admin mode
                updateAuthBodyClass();
                ToolbarModule.showStatus('Logged in via legacy auth');
                
                // Show center indicator for admin users
                if (centerPoint && window.AdminModule) {
                    window.AdminModule.showCenterIndicator(centerPoint.x, centerPoint.y);
                }
                return;
            }
        } catch (e) {
            console.error('Error parsing stored auth:', e);
            localStorage.removeItem('canvas_admin_auth');
        }
    }
    
    // Default to guest mode
    isAuthenticated = false;
    AppGlobals.showCanvas(false); // Show canvas in guest mode
    updateAuthBodyClass();
    
    // Remove center indicator for guest users
    const existingIndicator = document.querySelector('.center-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
}

function updateAuthBodyClass() {
    if (isAuthenticated) {
        document.body.classList.add('authenticated');
        document.body.classList.remove('guest');
        
        // Show admin buttons, hide login button
        showAdminInterface();
        
        // Show center indicator for admin users
        if (centerPoint && window.AdminModule) {
            window.AdminModule.showCenterIndicator(centerPoint.x, centerPoint.y);
        }
    } else {
        document.body.classList.add('guest');
        document.body.classList.remove('authenticated');
        
        // Hide admin buttons, show login button  
        showGuestInterface();
        
        // Remove center indicator for guest users
        const existingIndicator = document.querySelector('.center-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }
}

function showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('adminPassword').focus();
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('adminPassword').value = '';
}

function login() {
    const password = document.getElementById('adminPassword').value;
    
    // Check if admin password is configured
    if (!AppGlobals.ADMIN_PASSWORD) {
        alert('Admin login not available in this environment');
        return;
    }
    
    if (password === AppGlobals.ADMIN_PASSWORD) {
        isAuthenticated = true;
        const timestamp = new Date().getTime();
        localStorage.setItem('canvas_admin_auth', JSON.stringify({ timestamp }));
        updateAuthBodyClass();
        closeLoginModal();
        AppGlobals.showCanvas(true); // Show canvas in admin mode
        
        // Setup real-time subscription after login
        setTimeout(() => {
            DatabaseModule.setupRealtimeSubscription();
        }, 1000);
        
        ToolbarModule.showStatus('Successfully logged in as admin');
    } else {
        alert('Invalid password');
    }
}

async function logout() {
    try {
        // Try server-side logout first
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.log('Server logout failed, using local logout');
    }
    
    // Clean up client-side state
    isAuthenticated = false;
    localStorage.removeItem('canvas_admin_auth');
    updateAuthBodyClass();
    
    // Clean up real-time subscription
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    
    // Clean up any selected items
    ItemsModule.clearSelection();
    
    // Remove center indicator when logging out
    const existingIndicator = document.querySelector('.center-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    ToolbarModule.showStatus('Logged out');
    
    // Redirect to login page after a short delay
    setTimeout(() => {
        window.location.href = '/admin/';
    }, 1000);
}

function goToAdminPage() {
    window.location.href = '/admin.html';
}

// Center Point Management
function setCenter() {
    if (isSettingCenter) {
        cancelSetCenter();
    } else {
        isSettingCenter = true;
        container.style.cursor = 'crosshair';
        ToolbarModule.showStatus('Click anywhere to set the center point');
    }
}

function setCenterPoint(x, y) {
    centerPoint = { x, y };
    isSettingCenter = false;
    container.style.cursor = 'grab';
    
    // Show center indicator
    showCenterIndicator(x, y);
    
    // Save to database
    DatabaseModule.saveCenterPoint();
    ToolbarModule.showStatus('Center point set!');
}

function cancelSetCenter() {
    isSettingCenter = false;
    container.style.cursor = 'grab';
    ToolbarModule.showStatus('Center point setting cancelled');
}

function showCenterIndicator(x, y) {
    // Remove existing indicator
    const existing = document.querySelector('.center-indicator');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.className = 'center-indicator';
    indicator.style.left = x + 'px';
    indicator.style.top = y + 'px';
    
    canvas.appendChild(indicator);
    
    // Keep the indicator visible permanently for admin users
    // No auto-hide timeout
}

// Admin Operations
function clearAll() {
    if (confirm('Clear all items? This cannot be undone.')) {
        canvas.querySelectorAll('.canvas-item').forEach(item => item.remove());
        ItemsModule.clearSelection();
        clearDatabase();
        ToolbarModule.showStatus('All items cleared');
    }
}

async function clearDatabase() {
    try {
        const { error } = await supabaseClient
            .from('canvas_items')
            .delete()
            .neq('id', 0); // Delete all items (using neq with impossible value)
        
        if (error) throw error;
        // Database successfully cleared of all items
    } catch (error) {
        console.error('Error clearing database:', error);
        ToolbarModule.showStatus('Failed to clear database - check console for details');
    }
}

function bringToFront() {
    if (!selectedItem) return;
    
    const items = ItemsModule.getSortedItems();
    const maxZIndex = Math.max(...items.map(item => parseInt(item.style.zIndex) || 1));
    selectedItem.style.zIndex = maxZIndex + 1;
    
    // Normalize z-indexes to prevent overflow
    ItemsModule.normalizeZIndexes();
    ItemsModule.syncZIndexesToDatabase();
    
    ToolbarModule.showStatus('Item brought to front');
}

function sendToBack() {
    if (!selectedItem) return;
    
    const items = ItemsModule.getSortedItems();
    const minZIndex = Math.min(...items.map(item => parseInt(item.style.zIndex) || 1));
    selectedItem.style.zIndex = Math.max(1, minZIndex - 1);
    
    // Normalize z-indexes to prevent underflow
    ItemsModule.normalizeZIndexes();
    ItemsModule.syncZIndexesToDatabase();
    
    ToolbarModule.showStatus('Item sent to back');
}

// Admin UI Management
function showAdminInterface() {
    const adminButtons = document.getElementById('adminButtons');
    const centerBtn = document.getElementById('centerBtn');
    
    if (adminButtons) adminButtons.classList.remove('hidden');
    if (centerBtn) centerBtn.classList.add('hidden');
}

function showGuestInterface() {
    const adminButtons = document.getElementById('adminButtons');
    const centerBtn = document.getElementById('centerBtn');
    
    if (adminButtons) adminButtons.classList.add('hidden');
    if (centerBtn) centerBtn.classList.remove('hidden');
}

// Session Management
function extendSession() {
    if (isAuthenticated) {
        const timestamp = new Date().getTime();
        localStorage.setItem('canvas_admin_auth', JSON.stringify({ timestamp }));
        // Admin session timestamp updated
    }
}

function checkSessionExpiration() {
    const storedAuth = localStorage.getItem('canvas_admin_auth');
    if (storedAuth && isAuthenticated) {
        try {
            const authData = JSON.parse(storedAuth);
            const now = new Date().getTime();
            const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
            
            if ((now - authData.timestamp) >= expirationTime) {
                logout();
                ToolbarModule.showStatus('Admin session expired. Please login again.');
            }
        } catch (e) {
            console.error('Error checking session expiration:', e);
        }
    }
}

// Initialize session checking (every 5 minutes)
setInterval(checkSessionExpiration, 5 * 60 * 1000);

// Export module
window.AdminModule = {
    checkAuth,
    updateAuthBodyClass,
    showLoginModal,
    closeLoginModal,
    login,
    logout,
    goToAdminPage,
    setCenter,
    setCenterPoint,
    cancelSetCenter,
    showCenterIndicator,
    clearAll,
    clearDatabase,
    bringToFront,
    sendToBack,
    showAdminInterface,
    showGuestInterface,
    extendSession,
    checkSessionExpiration
};