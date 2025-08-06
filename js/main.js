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

// Drawing state
window.currentDrawing = null;
window.drawingPath = [];
window.drawingPreview = null;

// Constants
const ADMIN_PASSWORD = 'canvas123';
const SUPABASE_URL = 'https://ruefemuqeehlqieitoma.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZWZlbXVxZWVobHFpZWl0b21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzc5ODQsImV4cCI6MjA2OTc1Mzk4NH0.Bl3Af45EF-RINH_MD5AcZITNbk4wj79cm3Znsbrpb9k';

// Initialize the application
function initializeApp() {
    console.log('Initializing Canvas App...');
    
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
    
    // Update canvas transform to ensure it's visible
    if (window.ViewportModule) {
        window.ViewportModule.updateCanvasTransform();
    }
    
    console.log('Canvas App initialized successfully');
}

function createGlobalAliases() {
    // Create global aliases for modules to access
    window.container = window.container;
    window.canvas = window.canvas;
    window.supabaseClient = window.supabaseClient;
    window.selectedItem = window.selectedItem;
    window.selectedTextItem = window.selectedTextItem;
    window.canvasTransform = window.canvasTransform;
    window.centerPoint = window.centerPoint;
    window.isSettingCenter = window.isSettingCenter;
    window.isDragging = window.isDragging;
    window.isPanning = window.isPanning;
    window.isResizing = window.isResizing;
    window.isDrawing = window.isDrawing;
    window.isDrawMode = window.isDrawMode;
    window.isAuthenticated = window.isAuthenticated;
    window.dragStart = window.dragStart;
    window.lastMousePos = window.lastMousePos;
    window.panVelocity = window.panVelocity;
    window.itemCounter = window.itemCounter;
    window.realtimeChannel = window.realtimeChannel;
    window.drawingPath = window.drawingPath;
    window.drawingPreview = window.drawingPreview;
    
    // Also create non-window aliases for easier access in modules
    globalThis.container = window.container;
    globalThis.canvas = window.canvas;
    globalThis.supabaseClient = window.supabaseClient;
    globalThis.selectedItem = window.selectedItem;
    globalThis.selectedTextItem = window.selectedTextItem;
    globalThis.canvasTransform = window.canvasTransform;
    globalThis.centerPoint = window.centerPoint;
    globalThis.isSettingCenter = window.isSettingCenter;
    globalThis.isDragging = window.isDragging;
    globalThis.isPanning = window.isPanning;
    globalThis.isResizing = window.isResizing;
    globalThis.isDrawing = window.isDrawing;
    globalThis.isDrawMode = window.isDrawMode;
    globalThis.isAuthenticated = window.isAuthenticated;
    globalThis.dragStart = window.dragStart;
    globalThis.lastMousePos = window.lastMousePos;
    globalThis.panVelocity = window.panVelocity;
    globalThis.itemCounter = window.itemCounter;
    globalThis.realtimeChannel = window.realtimeChannel;
    globalThis.drawingPath = window.drawingPath;
    globalThis.drawingPreview = window.drawingPreview;
}

function cacheElements() {
    window.container = document.getElementById('canvasContainer');
    window.canvas = document.getElementById('canvas');
    
    // Use performance module to cache other elements
    if (window.PerformanceModule) {
        window.PerformanceModule.cacheElements();
    }
}

function initializeSupabase() {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase client initialized');
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
    // Hide login modal
    closeModal('loginModal');
    
    // Show canvas interface
    const loginModal = document.getElementById('loginModal');
    const canvasInterface = document.getElementById('canvasInterface');
    
    if (loginModal) loginModal.classList.add('hidden');
    if (canvasInterface) {
        canvasInterface.style.display = 'block';
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
    console.log('Status:', message);
    // Could show toast notifications here
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

// Export global functions and variables for modules to use
window.AppGlobals = {
    // Utility functions
    showCanvas,
    closeModal,
    showStatus: (message) => window.ToolbarModule?.showStatus?.(message) || console.log(message),
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