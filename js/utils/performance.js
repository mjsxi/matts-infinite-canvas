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
    
    // Update memory usage if available (throttled)
    if (performance.memory && performanceMetrics.frameCount % 60 === 0) { // Every 60 frames
        performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
    
    // Update DOM node count (throttled)
    if (performanceMetrics.frameCount % 120 === 0) { // Every 120 frames
        performanceMetrics.domNodeCount = document.querySelectorAll('*').length;
    }
    
    // Log performance issues (throttled)
    if (performanceMetrics.frameCount % 300 === 0) { // Every 300 frames
        if (performanceMetrics.domNodeCount > 1000) {
            console.warn(`High DOM node count: ${performanceMetrics.domNodeCount}`);
        }
        
        if (performanceMetrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
            console.warn(`High memory usage: ${(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        }
    }
}

function startPerformanceMonitoring() {
    function monitorPerformance() {
        updatePerformanceMetrics();
        
        // Periodically optimize canvas (every 5 seconds)
        if (performanceMetrics.frameCount % 300 === 0) {
            optimizeCanvas();
        }
        
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
    // Throttle viewport culling to reduce performance impact
    if (optimizeCanvas.lastRun && Date.now() - optimizeCanvas.lastRun < 500) {
        return; // Skip if called within 500ms
    }
    optimizeCanvas.lastRun = Date.now();
    
    // Use requestIdleCallback for non-critical work
    if (window.requestIdleCallback) {
        requestIdleCallback(() => performViewportCulling());
    } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(performViewportCulling, 16);
    }
}

// Memory management and viewport culling
const CULLING_CONFIG = {
    VIEWPORT_MARGIN: 1500,      // Pixels margin around viewport
    DISTANT_ITEM_THRESHOLD: 3000, // Items beyond this distance are pooled
    MAX_VISIBLE_ITEMS: 100,     // Maximum visible items at once
    MEMORY_PRESSURE_THRESHOLD: 80 * 1024 * 1024, // 80MB
    CLEANUP_INTERVAL: 10000     // Cleanup every 10 seconds
};

// Item pooling for memory efficiency
const itemPool = {
    images: [],
    videos: [],
    text: [],
    code: [],
    drawing: []
};

const hiddenItems = new Map(); // Track items that are hidden but not pooled

function performViewportCulling() {
    if (!canvas) return;
    
    const items = canvas.querySelectorAll('.canvas-item');
    const viewportBounds = getViewportBounds();
    const viewportCenter = ViewportModule?.getViewportCenter() || { x: 0, y: 0 };
    
    // Batch DOM operations for better performance
    const itemsToHide = [];
    const itemsToShow = [];
    const itemsToPool = [];
    
    let visibleItemCount = 0;
    
    items.forEach(item => {
        const rect = item.getBoundingClientRect();
        const itemBounds = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
        };
        
        // Calculate distance from viewport center
        const itemCenterX = parseFloat(item.style.left) + parseFloat(item.style.width) / 2;
        const itemCenterY = parseFloat(item.style.top) + parseFloat(item.style.height) / 2;
        const distanceFromViewport = Math.sqrt(
            Math.pow(itemCenterX - viewportCenter.x, 2) + 
            Math.pow(itemCenterY - viewportCenter.y, 2)
        );
        
        // Check if item is within viewport with margin
        const isInViewport = !(
            itemBounds.right < viewportBounds.left - CULLING_CONFIG.VIEWPORT_MARGIN ||
            itemBounds.left > viewportBounds.right + CULLING_CONFIG.VIEWPORT_MARGIN ||
            itemBounds.bottom < viewportBounds.top - CULLING_CONFIG.VIEWPORT_MARGIN ||
            itemBounds.top > viewportBounds.bottom + CULLING_CONFIG.VIEWPORT_MARGIN
        );
        
        // Never hide selected items
        const isSelected = item.classList.contains('selected');
        
        if (isSelected) {
            itemsToShow.push(item);
            visibleItemCount++;
        } else if (distanceFromViewport > CULLING_CONFIG.DISTANT_ITEM_THRESHOLD) {
            // Items very far from viewport should be pooled
            itemsToPool.push(item);
        } else if (!isInViewport || visibleItemCount >= CULLING_CONFIG.MAX_VISIBLE_ITEMS) {
            // Items outside viewport or exceeding max visible items
            itemsToHide.push(item);
        } else {
            itemsToShow.push(item);
            visibleItemCount++;
        }
    });
    
    // Apply changes in batches for optimal performance
    batchDOMOperations([
        () => {
            itemsToHide.forEach(item => {
                if (item.style.visibility !== 'hidden') {
                    item.style.visibility = 'hidden';
                    hiddenItems.set(item.dataset.id, {
                        element: item,
                        timestamp: Date.now()
                    });
                }
            });
        },
        () => {
            itemsToShow.forEach(item => {
                if (item.style.visibility !== 'visible') {
                    item.style.visibility = 'visible';
                    hiddenItems.delete(item.dataset.id);
                }
            });
        },
        () => {
            // Pool very distant items to free memory
            itemsToPool.forEach(item => poolItem(item));
        }
    ]);
    
    // Log performance metrics
    if (DEBUG_MODE && (itemsToHide.length > 0 || itemsToPool.length > 0)) {
        console.log(`Viewport culling: ${visibleItemCount} visible, ${itemsToHide.length} hidden, ${itemsToPool.length} pooled`);
    }
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

// Item pooling functions for memory management
function poolItem(item) {
    if (!item || !item.dataset.type) return;
    
    const itemType = item.dataset.type;
    
    // Store item data before pooling
    const itemData = extractItemData(item);
    
    // Remove from DOM
    if (item.parentNode) {
        item.parentNode.removeChild(item);
    }
    
    // Clear heavy resources
    cleanupItemResources(item);
    
    // Add to appropriate pool
    if (itemPool[itemType]) {
        itemPool[itemType].push({
            data: itemData,
            timestamp: Date.now()
        });
        
        // Limit pool size to prevent memory leaks
        if (itemPool[itemType].length > 20) {
            itemPool[itemType].shift();
        }
    }
    
    // Remove from tracking
    hiddenItems.delete(item.dataset.id);
    
    if (DEBUG_MODE) {
        console.log(`Pooled ${itemType} item:`, item.dataset.id);
    }
}

function unpoolItem(itemType, itemData) {
    if (!itemPool[itemType] || itemPool[itemType].length === 0) {
        return null; // No pooled items available
    }
    
    const pooledItem = itemPool[itemType].pop();
    
    // Create new item from pooled data (reusing the creation logic)
    if (window.DatabaseModule && window.DatabaseModule.createItemFromData) {
        return window.DatabaseModule.createItemFromData(itemData || pooledItem.data);
    }
    
    return null;
}

function extractItemData(item) {
    return {
        id: item.dataset.id,
        x: parseFloat(item.style.left) || 0,
        y: parseFloat(item.style.top) || 0,
        width: parseFloat(item.style.width) || 100,
        height: parseFloat(item.style.height) || 100,
        item_type: item.dataset.type,
        content: getItemContentForPooling(item),
        z_index: parseInt(item.style.zIndex) || 1,
        rotation: parseFloat(item.dataset.rotation) || 0,
        border_radius: parseFloat(item.style.getPropertyValue('--item-border-radius')) || 0,
        aspect_ratio: parseFloat(item.dataset.aspectRatio) || 1,
        original_width: item.dataset.originalWidth,
        original_height: item.dataset.originalHeight,
        // Text-specific properties
        font_family: item.style.fontFamily || 'Antarctica',
        font_size: parseInt(item.style.fontSize) || 24,
        font_weight: item.style.fontWeight || 'normal',
        text_color: item.style.color || '#333333',
        line_height: parseFloat(item.style.lineHeight) || 1.15
    };
}

function getItemContentForPooling(item) {
    switch (item.dataset.type) {
        case 'image':
            const img = item.querySelector('img');
            return img ? img.src : '';
        case 'video':
            const video = item.querySelector('video');
            return video ? video.src : '';
        case 'text':
            // Remove resize handles before extracting text
            const textClone = item.cloneNode(true);
            const handles = textClone.querySelector('.resize-handles');
            if (handles) handles.remove();
            return textClone.textContent;
        case 'code':
            const iframe = item.querySelector('iframe');
            return iframe ? iframe.srcdoc : '';
        case 'drawing':
            const path = item.querySelector('path');
            return path ? path.getAttribute('d') : '';
        default:
            return '';
    }
}

function cleanupItemResources(item) {
    // Clean up heavy resources to prevent memory leaks
    const images = item.querySelectorAll('img');
    images.forEach(img => {
        if (img.src && img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }
        img.src = '';
    });
    
    const videos = item.querySelectorAll('video');
    videos.forEach(video => {
        video.pause();
        if (video.src && video.src.startsWith('blob:')) {
            URL.revokeObjectURL(video.src);
        }
        video.src = '';
        video.load(); // Reset video element
    });
    
    // Clear any custom properties that might hold references
    item.style.cssText = '';
    item.innerHTML = '';
}

// Memory pressure detection and cleanup
function checkMemoryPressure() {
    if (!performance.memory) return false;
    
    const usedMemory = performance.memory.usedJSHeapSize;
    const memoryLimit = performance.memory.jsHeapSizeLimit;
    
    return usedMemory > CULLING_CONFIG.MEMORY_PRESSURE_THRESHOLD || 
           (usedMemory / memoryLimit) > 0.8;
}

function performMemoryCleanup() {
    if (!checkMemoryPressure()) return;
    
    console.log('Memory pressure detected, performing cleanup...');
    
    // Clean up old hidden items
    const now = Date.now();
    const oldItems = [];
    
    hiddenItems.forEach((value, key) => {
        if (now - value.timestamp > 30000) { // 30 seconds
            oldItems.push(value.element);
        }
    });
    
    // Pool old hidden items
    oldItems.forEach(item => poolItem(item));
    
    // Limit pool sizes
    Object.keys(itemPool).forEach(type => {
        if (itemPool[type].length > 10) {
            itemPool[type] = itemPool[type].slice(-10); // Keep only 10 most recent
        }
    });
    
    // Force garbage collection if available
    if (window.gc) {
        window.gc();
    }
    
    console.log('Memory cleanup completed');
}

// Initialize memory monitoring
function initializeMemoryOptimizer() {
    // Periodic memory cleanup
    setInterval(() => {
        performMemoryCleanup();
    }, CULLING_CONFIG.CLEANUP_INTERVAL);
    
    // Monitor memory usage
    if (performance.memory) {
        setInterval(() => {
            const memory = performance.memory;
            if (DEBUG_MODE) {
                console.log(`Memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB / ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
            }
        }, 30000); // Log every 30 seconds
    }
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
    performViewportCulling,
    getViewportBounds,
    setupLazyLoading,
    setStorageItem,
    getStorageItem,
    clearStorageItems,
    cachedElements,
    performanceMetrics,
    
    // Memory management functions
    poolItem,
    unpoolItem,
    extractItemData,
    cleanupItemResources,
    checkMemoryPressure,
    performMemoryCleanup,
    initializeMemoryOptimizer,
    
    // Configuration
    CULLING_CONFIG
};

// Add global access for debugging
window.MemoryOptimizer = {
    itemPool,
    hiddenItems,
    checkMemoryPressure,
    performMemoryCleanup,
    initializeMemoryOptimizer
};
