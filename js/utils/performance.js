// Performance monitoring and utility functions
// Handles caching, performance metrics, and optimization utilities

// Performance monitoring
let performanceMetrics = {
    frameCount: 0,
    lastFrameTime: 0,
    averageFrameTime: 0,
    memoryUsage: 0,
    domNodeCount: 0
};

// Cached elements for performance
const cachedElements = {};

function cacheElements() {
    cachedElements.fileInput = document.getElementById('fileInput');
    cachedElements.adminPassword = document.getElementById('adminPassword');
    cachedElements.adminLogin = document.getElementById('adminLogin');
    cachedElements.canvasContainer = document.getElementById('canvasContainer');
    cachedElements.adminButtons = document.getElementById('adminButtons');
    cachedElements.loginBtn = document.getElementById('loginBtn');
    cachedElements.codeModal = document.getElementById('codeModal');
    cachedElements.codeInput = document.getElementById('codeInput');
    cachedElements.mobileGradient = document.getElementById('mobileGradient');
}

function updatePerformanceMetrics() {
    const now = performance.now();
    const frameTime = now - performanceMetrics.lastFrameTime;
    
    performanceMetrics.frameCount++;
    performanceMetrics.lastFrameTime = now;
    performanceMetrics.averageFrameTime = 
        (performanceMetrics.averageFrameTime * (performanceMetrics.frameCount - 1) + frameTime) / performanceMetrics.frameCount;
    
    // Update memory usage if available
    if (performance.memory) {
        performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
    
    // Update DOM node count
    performanceMetrics.domNodeCount = document.querySelectorAll('*').length;
    
    // Log performance issues
    // Frame time warning disabled
    
    if (performanceMetrics.domNodeCount > 1000) {
        console.warn(`High DOM node count: ${performanceMetrics.domNodeCount}`);
    }
    
    if (performanceMetrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
        console.warn(`High memory usage: ${(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }
}

function startPerformanceMonitoring() {
    function monitorPerformance() {
        updatePerformanceMetrics();
        requestAnimationFrame(monitorPerformance);
    }
    requestAnimationFrame(monitorPerformance);
}

function getPerformanceReport() {
    return {
        averageFrameTime: performanceMetrics.averageFrameTime.toFixed(2),
        fps: (1000 / performanceMetrics.averageFrameTime).toFixed(1),
        domNodes: performanceMetrics.domNodeCount,
        memoryMB: performanceMetrics.memoryUsage ? (performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2) : 'N/A',
        totalFrames: performanceMetrics.frameCount
    };
}

// Debouncing utility
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttling utility
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Batch DOM operations to prevent layout thrashing
function batchDOMOperations(operations) {
    requestAnimationFrame(() => {
        operations.forEach(operation => operation());
    });
}

// Optimized element creation
function createElement(tag, className, styles = {}) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    
    Object.assign(element.style, styles);
    
    return element;
}

// Memory cleanup utilities
function cleanupEventListeners() {
    // Remove global event listeners
    document.removeEventListener('mousemove', EventsModule?.handleMouseMove);
    document.removeEventListener('mouseup', EventsModule?.handleMouseUp);
    document.removeEventListener('keydown', EventsModule?.handleKeyDown);
    
    // Remove container event listeners
    if (container) {
        container.removeEventListener('mousedown', EventsModule?.handleMouseDown);
        container.removeEventListener('wheel', EventsModule?.handleWheel);
        container.removeEventListener('touchstart', EventsModule?.handleTouchStart);
        container.removeEventListener('touchmove', EventsModule?.handleTouchMove);
        container.removeEventListener('touchend', EventsModule?.handleTouchEnd);
        container.removeEventListener('contextmenu', e => e.preventDefault());
    }
    
    // Cleanup toolbar event listeners
    ToolbarModule?.cleanupEventListeners();
    
    console.log('Event listeners cleaned up');
}

// Image optimization utilities
function resizeImage(file, maxWidth, maxHeight, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Canvas optimization utilities
function optimizeCanvas() {
    // Remove invisible items (outside viewport with significant margin)
    const items = canvas.querySelectorAll('.canvas-item');
    const viewportBounds = getViewportBounds();
    const margin = 1000; // 1000px margin
    
    items.forEach(item => {
        const rect = item.getBoundingClientRect();
        const itemBounds = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
        };
        
        const isVisible = !(
            itemBounds.right < viewportBounds.left - margin ||
            itemBounds.left > viewportBounds.right + margin ||
            itemBounds.bottom < viewportBounds.top - margin ||
            itemBounds.top > viewportBounds.bottom + margin
        );
        
        if (!isVisible && !item.classList.contains('selected')) {
            item.style.visibility = 'hidden';
        } else {
            item.style.visibility = 'visible';
        }
    });
}

function getViewportBounds() {
    const rect = ViewportModule?.getContainerRect() || container.getBoundingClientRect();
    return {
        left: 0,
        top: 0,
        right: rect.width,
        bottom: rect.height
    };
}

// Lazy loading utilities
function setupLazyLoading() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                    observer.unobserve(img);
                }
            }
        });
    }, {
        rootMargin: '50px'
    });
    
    return observer;
}

// Local storage utilities with size limits
function setStorageItem(key, value, maxSize = 5 * 1024 * 1024) { // 5MB default
    try {
        const serialized = JSON.stringify(value);
        if (serialized.length > maxSize) {
            console.warn(`Storage item ${key} exceeds size limit`);
            return false;
        }
        localStorage.setItem(key, serialized);
        return true;
    } catch (e) {
        console.error('Failed to set storage item:', e);
        return false;
    }
}

function getStorageItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Failed to get storage item:', e);
        return defaultValue;
    }
}

function clearStorageItems(prefix) {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
        }
    });
}

// Export module
window.PerformanceModule = {
    cacheElements,
    updatePerformanceMetrics,
    startPerformanceMonitoring,
    getPerformanceReport,
    debounce,
    throttle,
    batchDOMOperations,
    createElement,
    cleanupEventListeners,
    resizeImage,
    optimizeCanvas,
    getViewportBounds,
    setupLazyLoading,
    setStorageItem,
    getStorageItem,
    clearStorageItems,
    cachedElements,
    performanceMetrics
};// Cache busting: Wed Aug  6 04:10:47 EDT 2025
