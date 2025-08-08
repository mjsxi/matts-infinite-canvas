// Main application coordinator
// Initializes all modules and manages global state

// Global state variables (shared across modules via window object)
window.container = null;
window.canvas = null; 
window.supabaseClient = null;
window.selectedItem = null;
window.selectedTextItem = null;
window.canvasTransform = { x: 0, y: 0, scale: 1 };
window.centerPoint = { x: 1000, y: 1000 };
window.isSettingCenter = false;
window.isDragging = false;
window.isPanning = false;
window.isResizing = false;
window.isDrawing = false;
window.isDrawMode = false;
window.isAuthenticated = false;
window.dragStart = { x: 0, y: 0 };
window.lastMousePos = { x: 0, y: 0 };
window.panVelocity = { x: 0, y: 0 };
window.itemCounter = 0;
window.realtimeChannel = null;
// Track when mobile loader became visible (approx.)
window.mobileLoaderShownAt = window.mobileLoaderShownAt || performance.now();

// Drawing state
window.currentDrawing = null;
window.drawingPath = [];
window.drawingPreview = null;

// Constants - Password loaded conditionally
const ADMIN_PASSWORD = window.LOCALHOST_ADMIN_PASSWORD || null;
const SUPABASE_URL = 'https://ruefemuqeehlqieitoma.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZWZlbXVxZWVobHFpZWl0b21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzc5ODQsImV4cCI6MjA2OTc1Mzk4NH0.Bl3Af45EF-RINH_MD5AcZITNbk4wj79cm3Znsbrpb9k';

// Initialize the application
function initializeApp() {
    // Initializing Canvas App...
    
    // Cache DOM elements
    cacheElements();
    
    // Create global variable aliases for backward compatibility
    createGlobalAliases();
    
    // Initialize Supabase client
    initializeSupabase();
    
    // Check authentication status
    checkAuth();
    
    // Bind all event listeners
    if (window.EventsModule) {
        window.EventsModule.bindEvents();
    }
    
    // Start performance monitoring
    if (window.PerformanceModule) {
        window.PerformanceModule.startPerformanceMonitoring();
    }
    
    // Initialize memory optimizer
    if (window.MemoryOptimizer) {
        window.MemoryOptimizer.initializeMemoryOptimizer();
    }
    
    // Update canvas transform to ensure it's visible
    if (window.ViewportModule) {
        window.ViewportModule.updateCanvasTransform();
    }
    
    // Handle video autoplay on mobile devices
    handleVideoAutoplay();
    
    // Add user interaction handler for mobile video autoplay
    setupMobileVideoAutoplay();
    
    // Update existing code items with new interaction system
    setTimeout(() => {
        if (window.CreatorsModule) {
            window.CreatorsModule.updateExistingCodeItems();
            window.CreatorsModule.setupCodeItemAutoPause();
        }
    }, 2000); // Wait 2 seconds for canvas data to load
    
    // Canvas App initialized successfully
}

function createGlobalAliases() {
    // Optimized: removed redundant assignments since variables are already on window
    // Only create globalThis aliases for cross-module access
    const globalVars = [
        'container', 'canvas', 'supabaseClient', 'selectedItem', 'selectedTextItem',
        'canvasTransform', 'centerPoint', 'isSettingCenter', 'isDragging', 'isPanning',
        'isResizing', 'isDrawing', 'isDrawMode', 'isAuthenticated', 'dragStart',
        'lastMousePos', 'panVelocity', 'itemCounter', 'realtimeChannel', 'drawingPath', 'drawingPreview'
    ];
    
    globalVars.forEach(varName => {
        globalThis[varName] = window[varName];
    });
}

function cacheElements() {
    window.container = document.getElementById('canvasContainer');
    window.canvas = document.getElementById('canvas');
    
    // Use performance module to cache other elements
    if (window.PerformanceModule) {
        window.PerformanceModule.cacheElements();
    }
}

function handleVideoAutoplay() {
    // Handle video autoplay issues on mobile devices
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        // Ensure videos are muted and ready to play
        video.muted = true;
        video.defaultMuted = true;
        
        // Try to play videos that are paused
        if (video.paused && !video.ended) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    // Video autoplay prevented on init
                });
            }
        }
        
        // Add event listeners for better mobile support
        video.addEventListener('canplay', function() {
            if (video.paused && !video.ended) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        // Video play prevented on canplay
                    });
                }
            }
        });
        
        video.addEventListener('pause', function() {
            // Try to resume if not ended (but not too aggressively)
            if (!video.ended) {
                setTimeout(() => {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(e => {
                            // Video resume prevented
                        });
                    }
                }, 500);
            }
        });
    });
}

function setupMobileVideoAutoplay() {
    // Handle mobile video autoplay after user interaction
    let hasUserInteracted = false;
    
    const startAllVideos = () => {
        if (hasUserInteracted) return;
        hasUserInteracted = true;
        
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.paused && !video.ended) {
                video.muted = true;
                video.defaultMuted = true;
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        // Video autoplay still prevented after user interaction
                    });
                }
            }
        });
    };
    
    // Listen for user interactions that can trigger autoplay
    const events = ['touchstart', 'click', 'scroll', 'keydown'];
    events.forEach(event => {
        document.addEventListener(event, startAllVideos, { once: true });
    });
}

function initializeSupabase() {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // Supabase client initialized
}

function checkAuth() {
    // Delegate to auth module
    if (window.AdminModule) {
        window.AdminModule.checkAuth();
    }
}

function updateAuthBodyClass() {
    if (isAuthenticated) {
        document.body.classList.add('admin');
        document.body.classList.remove('guest');
    } else {
        document.body.classList.remove('admin');
        document.body.classList.add('guest');
    }
}

function showCanvas(isAdmin = false) {
    // Show canvas interface
    const canvasContainer = document.getElementById('canvasContainer');
    
    if (canvasContainer) {
        canvasContainer.classList.remove('hidden');
        // Canvas container shown
    } else {
        console.error('Canvas container not found');
    }

    // Hide mobile loader once canvas is visible
    const mobileLoader = document.getElementById('mobileLoader');
    if (mobileLoader) {
        const MIN_VISIBLE_MS = 1500;
        const shownAt = window.mobileLoaderShownAt || performance.now();
        const elapsed = performance.now() - shownAt;
        const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
        setTimeout(() => {
            mobileLoader.style.opacity = '0';
            setTimeout(() => {
                mobileLoader.style.display = 'none';
            }, 200);
        }, delay);
    }
    
    // Show/hide admin buttons based on authentication status
    const adminButtons = document.getElementById('adminButtons');
    const centerBtn = document.getElementById('centerBtn');
    
    if (isAdmin) {
        if (adminButtons) adminButtons.classList.remove('hidden');
        if (centerBtn) centerBtn.classList.add('hidden');
    } else {
        if (adminButtons) adminButtons.classList.add('hidden');
        if (centerBtn) centerBtn.classList.remove('hidden');
    }
    
    // Load canvas data and setup real-time
    if (window.DatabaseModule) {
        window.DatabaseModule.loadCanvasData().then(() => {
            setTimeout(() => {
                window.DatabaseModule.setupRealtimeSubscription();
            }, 1000);
        });
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showStatus(message) {
    const live = document.getElementById('ariaLive');
    if (live) {
        live.textContent = message;
    }
}

// Export global functions for HTML button clicks and module access
window.addImage = () => window.CreatorsModule?.addImage();
window.addText = () => window.CreatorsModule?.addText();
window.addCode = () => window.CreatorsModule?.addCode();
window.insertCode = () => window.CreatorsModule?.insertCode();
window.login = () => window.AdminModule?.login();
window.logout = () => window.AdminModule?.logout();
window.toggleDrawMode = () => window.DrawingModule?.toggleDrawMode();
window.setCenter = () => window.AdminModule?.setCenter();
window.clearAll = () => window.AdminModule?.clearAll();
window.goToCenter = () => window.ViewportModule?.goToCenter();
window.bringToFront = () => window.AdminModule?.bringToFront();
window.sendToBack = () => window.AdminModule?.sendToBack();
window.updateCodeItems = () => window.CreatorsModule?.updateExistingCodeItems();
window.debugCodeItems = () => window.CreatorsModule?.debugCodeItemState();

// Export global functions and variables for modules to use
window.AppGlobals = {
    // Utility functions
    showCanvas,
    closeModal,
    showStatus: (message) => {
        // Announce to ARIA live region for all users
        const live = document.getElementById('ariaLive');
        if (live) live.textContent = message;
        // Show visual toast for admins
        if (isAuthenticated) window.ToolbarModule?.showStatus?.(message);
    },
    updateAuthBodyClass,
    checkAuth,
    
    // Constants
    ADMIN_PASSWORD,
    SUPABASE_URL,
    SUPABASE_KEY
};

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}