// Server-side authentication module for Vercel deployment
// Handles login/logout with JWT tokens and HTTP-only cookies

let currentUser = null;

// Check authentication status on page load
async function checkServerAuth() {
    try {
        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            isAuthenticated = true;
            
            // Set global user ID for canvas items (keeping compatibility)
            window.currentUserId = data.user.username;
            
            updateAuthBodyClass();
            AppGlobals.showCanvas(data.user.isAdmin);
            
            if (data.user.isAdmin && centerPoint && window.AdminModule) {
                window.AdminModule.showCenterIndicator(centerPoint.x, centerPoint.y);
            }
            
            ToolbarModule.showStatus(`Logged in as ${data.user.username}`);
        } else {
            currentUser = null;
            isAuthenticated = false;
            window.currentUserId = null;
            updateAuthBodyClass();
            AppGlobals.showCanvas(false);
        }
        
        return data.authenticated;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Login with username/password
async function serverLogin(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            isAuthenticated = true;
            
            // Set global user ID for canvas items (keeping compatibility)
            window.currentUserId = data.user.username;
            
            updateAuthBodyClass();
            AppGlobals.showCanvas(data.user.isAdmin);
            
            // Setup real-time subscription after login
            setTimeout(() => {
                DatabaseModule.setupRealtimeSubscription();
            }, 1000);
            
            ToolbarModule.showStatus(`Successfully logged in as ${data.user.username}`);
            return { success: true };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Network error' };
    }
}

// Register new user
async function serverRegister(username, password, email) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password, email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            ToolbarModule.showStatus('Registration successful! Please login.');
            return { success: true };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: 'Network error' };
    }
}

// Logout
async function serverLogout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            currentUser = null;
            isAuthenticated = false;
            window.currentUserId = null;
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
            
            ToolbarModule.showStatus('Logged out successfully');
            AppGlobals.showCanvas(false);
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Get current user info
function getCurrentUser() {
    return currentUser;
}

// Check if current user is admin
function isCurrentUserAdmin() {
    return currentUser && currentUser.isAdmin;
}

// Show enhanced login modal with registration option
function showServerLoginModal() {
    document.getElementById('serverLoginModal').classList.remove('hidden');
    document.getElementById('serverUsername').focus();
}

function closeServerLoginModal() {
    document.getElementById('serverLoginModal').classList.add('hidden');
    document.getElementById('serverLoginForm').reset();
    document.getElementById('serverRegisterForm').reset();
    document.getElementById('loginTab').classList.add('active');
    document.getElementById('registerTab').classList.remove('active');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
}

// Handle login form submission
async function handleServerLogin(event) {
    event.preventDefault();
    const username = document.getElementById('serverUsername').value;
    const password = document.getElementById('serverPassword').value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    const result = await serverLogin(username, password);
    
    if (result.success) {
        closeServerLoginModal();
    } else {
        alert(result.error || 'Login failed');
    }
}

// Handle registration form submission
async function handleServerRegister(event) {
    event.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const email = document.getElementById('registerEmail').value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    const result = await serverRegister(username, password, email);
    
    if (result.success) {
        alert('Registration successful! Please login.');
        // Switch to login tab
        document.getElementById('loginTab').click();
    } else {
        alert(result.error || 'Registration failed');
    }
}

// Tab switching for login/register
function switchToLogin() {
    document.getElementById('loginTab').classList.add('active');
    document.getElementById('registerTab').classList.remove('active');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
}

function switchToRegister() {
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('registerTab').classList.add('active');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

// Export server auth module
window.ServerAuth = {
    checkServerAuth,
    serverLogin,
    serverRegister,
    serverLogout,
    getCurrentUser,
    isCurrentUserAdmin,
    showServerLoginModal,
    closeServerLoginModal,
    handleServerLogin,
    handleServerRegister,
    switchToLogin,
    switchToRegister
};