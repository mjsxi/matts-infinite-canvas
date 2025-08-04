// Supabase Configuration
const SUPABASE_URL = 'https://ruefemuqeehlqieitoma.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZWZlbXVxZWVobHFpZWl0b21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzc5ODQsImV4cCI6MjA2OTc1Mzk4NH0.Bl3Af45EF-RINH_MD5AcZITNbk4wj79cm3Znsbrpb9k';
const ADMIN_PASSWORD = 'canvas123';

// Initialize Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Global State
let isAuthenticated = false;
let canvas, container, toolbar, textToolbar, drawToolbar;
let selectedItem = null;
let selectedTextItem = null;
let canvasTransform = { x: -9500, y: -9500, scale: 1 }; // Start centered in 20000x20000 canvas
let centerPoint = { x: 10000, y: 10000 }; // Default center
let isSettingCenter = false;
let isDragging = false;
let isPanning = false;
let isResizing = false;
let isDrawing = false;
let isDrawMode = false;
let dragStart = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };

// Drawing state
let currentDrawing = null;
let drawingPath = [];
let drawingPreview = null;

// Inertia scrolling variables
let panVelocity = { x: 0, y: 0 };
let lastPanTime = 0;
let panPositions = [];
let inertiaAnimationId = null;

// Item counter for unique IDs
let itemCounter = 0;

// Real-time subscription
let realtimeChannel = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('canvas');
    container = document.getElementById('canvasContainer');
    toolbar = document.getElementById('toolbar');
    textToolbar = document.getElementById('textToolbar');
    drawToolbar = document.getElementById('drawToolbar');
    
    checkAuth();
    bindEvents();
    bindTextToolbarEvents();
    bindDrawToolbarEvents();
});

// Authentication
function checkAuth() {
    const auth = localStorage.getItem('canvas_admin_auth');
    if (auth === 'true') {
        isAuthenticated = true;
        showCanvas(true); // Show canvas in admin mode
    } else {
        isAuthenticated = false;
        showCanvas(false); // Show canvas in guest mode
    }
    updateAuthBodyClass();
}

function updateAuthBodyClass() {
    if (isAuthenticated) {
        document.body.classList.add('authenticated');
        document.body.classList.remove('guest');
    } else {
        document.body.classList.add('guest');
        document.body.classList.remove('authenticated');
    }
}

function login() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        isAuthenticated = true;
        localStorage.setItem('canvas_admin_auth', 'true');
        updateAuthBodyClass();
        showCanvas(true); // Show canvas in admin mode
    } else {
        alert('Invalid password');
    }
}

function logout() {
    isAuthenticated = false;
    localStorage.removeItem('canvas_admin_auth');
    updateAuthBodyClass();
    
    // Clean up real-time subscription
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    
    location.reload();
}

function showLoginModal() {
    document.getElementById('adminLogin').classList.remove('hidden');
}

function showCanvas(isAdmin = false) {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('canvasContainer').classList.remove('hidden');
    document.getElementById('toolbar').classList.remove('hidden');
    
    // Show/hide admin buttons based on authentication status
    const adminButtons = document.getElementById('adminButtons');
    const loginBtn = document.getElementById('loginBtn');
    
    if (isAdmin) {
        adminButtons.classList.remove('hidden');
        loginBtn.classList.add('hidden');
    } else {
        adminButtons.classList.add('hidden');
        loginBtn.classList.remove('hidden');
    }
    
    loadCanvasData().then(() => {
        // Wait a moment before setting up real-time to avoid receiving events for items we just loaded
        setTimeout(setupRealtimeSubscription, 1000);
    });
}

// Canvas Management
function updateCanvasTransform() {
    const transform = `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`;
    canvas.style.transform = transform;
}

function screenToCanvas(screenX, screenY) {
    const rect = container.getBoundingClientRect();
    const canvasX = (screenX - rect.left - canvasTransform.x) / canvasTransform.scale;
    const canvasY = (screenY - rect.top - canvasTransform.y) / canvasTransform.scale;
    return { x: canvasX, y: canvasY };
}

function canvasToScreen(canvasX, canvasY) {
    const rect = container.getBoundingClientRect();
    const screenX = (canvasX * canvasTransform.scale) + canvasTransform.x + rect.left;
    const screenY = (canvasY * canvasTransform.scale) + canvasTransform.y + rect.top;
    return { x: screenX, y: screenY };
}

// Event Bindings
function bindEvents() {
    // Mouse events
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    // Touch events for mobile/tablet
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // File input
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent context menu
    container.addEventListener('contextmenu', e => e.preventDefault());
}

function handleMouseDown(e) {
    if (e.target === container || e.target === canvas) {
        if (isSettingCenter) {
            const canvasPos = screenToCanvas(e.clientX, e.clientY);
            setCenterPoint(canvasPos.x, canvasPos.y);
            return;
        }
        
        if (isDrawMode && isAuthenticated) {
            // Start drawing
            console.log('Starting drawing mode');
            isDrawing = true;
            const canvasPos = screenToCanvas(e.clientX, e.clientY);
            drawingPath = [{ x: canvasPos.x, y: canvasPos.y }];
            console.log('Initial drawing point:', canvasPos);
            createDrawingPreview();
            clearSelection();
            return;
        }
        
        // Stop any ongoing inertia animation
        stopInertiaAnimation();
        
        // Start panning
        isPanning = true;
        container.classList.add('panning');
        dragStart = { x: e.clientX, y: e.clientY };
        lastPanTime = Date.now();
        clearSelection();
    } else if (e.target.closest('.canvas-item')) {
        const item = e.target.closest('.canvas-item');
        
        // Only allow item interaction for authenticated admin users
        if (isAuthenticated) {
            selectItem(item);
            
            if (!e.target.closest('.resize-handle')) {
                startDragging(e, item);
            }
        }
    }
}

function handleMouseMove(e) {
    if (isDrawing) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        drawingPath.push({ x: canvasPos.x, y: canvasPos.y });
        updateDrawingPreview();
        console.log('Drawing point:', canvasPos, 'Total points:', drawingPath.length);
        // Don't update transform while drawing
        return;
    } else if (isPanning) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        canvasTransform.x += deltaX;
        canvasTransform.y += deltaY;
        updateCanvasTransform();
        
        // Track panning velocity for inertia
        const now = Date.now();
        const timeDelta = now - lastPanTime;
        if (timeDelta > 0) {
            panVelocity.x = deltaX / timeDelta;
            panVelocity.y = deltaY / timeDelta;
        }
        lastPanTime = now;
        
        // Store position for velocity calculation
        panPositions.push({ x: e.clientX, y: e.clientY, time: now });
        if (panPositions.length > 5) {
            panPositions.shift();
        }
        
        dragStart = { x: e.clientX, y: e.clientY };
    } else if (isDragging && selectedItem && !isResizing) {
        dragItem(e);
    }
    
    lastMousePos = { x: e.clientX, y: e.clientY };
}

function handleMouseUp(e) {
    if (isDrawing) {
        isDrawing = false;
        
        if (drawingPath.length > 1) {
            console.log('Creating drawing with', drawingPath.length, 'points');
            
            // Create the drawing item
            const strokeColor = document.getElementById('strokeColor').value;
            const strokeThickness = parseFloat(document.getElementById('strokeThickness').value);
            
            console.log('Drawing settings:', { strokeColor, strokeThickness });
            
            // Calculate bounding box
            const minX = Math.min(...drawingPath.map(p => p.x));
            const maxX = Math.max(...drawingPath.map(p => p.x));
            const minY = Math.min(...drawingPath.map(p => p.y));
            const maxY = Math.max(...drawingPath.map(p => p.y));
            
            console.log('Bounding box:', { minX, maxX, minY, maxY });
            
            // Use original coordinates for the path data (no adjustment needed with viewBox)
            let pathData = `M ${drawingPath[0].x} ${drawingPath[0].y}`;
            for (let i = 1; i < drawingPath.length; i++) {
                pathData += ` L ${drawingPath[i].x} ${drawingPath[i].y}`;
            }
            
            console.log('Path data:', pathData);
            
            // Keep the drawing at its original size with padding for stroke
            const padding = Math.max(10, strokeThickness);
            const containerWidth = (maxX - minX) + (padding * 2);
            const containerHeight = (maxY - minY) + (padding * 2);
            
            console.log('Container size (original scale):', { containerWidth, containerHeight });
            
            createDrawingItem(pathData, strokeColor, strokeThickness, minX - padding, minY - padding, containerWidth, containerHeight);
        } else {
            console.log('Not enough points to create drawing:', drawingPath.length);
        }
        
        // Clean up
        removeDrawingPreview();
        drawingPath = [];
        return;
    }
    
    if (isPanning) {
        isPanning = false;
        container.classList.remove('panning');
        canvas.classList.remove('dragging');
        
        // Calculate final velocity from last few positions
        if (panPositions.length >= 2) {
            const recent = panPositions.slice(-3);
            const first = recent[0];
            const last = recent[recent.length - 1];
            const timeDelta = last.time - first.time;
            
            if (timeDelta > 0) {
                panVelocity.x = (last.x - first.x) / timeDelta * 0.5; // Reduce velocity for smoother feel
                panVelocity.y = (last.y - first.y) / timeDelta * 0.5;
                
                // Start inertia animation if velocity is significant
                if (Math.abs(panVelocity.x) > 0.1 || Math.abs(panVelocity.y) > 0.1) {
                    startInertiaAnimation();
                }
            }
        }
        
        // Clear position history
        panPositions = [];
    }
    
    if (isDragging && !isResizing) {
        stopDragging();
    }
}

function handleWheel(e) {
    e.preventDefault();
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Detect pinch-to-zoom vs two-finger scroll
    const isZoomGesture = e.ctrlKey || e.metaKey || 
                         Math.abs(e.deltaZ || 0) > 0 ||
                         e.deltaMode === 1 ||
                         (Math.abs(e.deltaX) < 4 && Math.abs(e.deltaY) > 0 && Math.abs(e.deltaY % 1) > 0);
    
    if (isZoomGesture) {
        // Pinch to zoom
        const delta = e.deltaY;
        const zoomFactor = e.ctrlKey || e.metaKey ? 0.99 : 0.985; // More responsive for trackpad
        const newScale = Math.max(0.05, Math.min(5, canvasTransform.scale * (zoomFactor ** delta)));
        
        // Zoom towards mouse/cursor position
        const scaleRatio = newScale / canvasTransform.scale;
        canvasTransform.x = mouseX - (mouseX - canvasTransform.x) * scaleRatio;
        canvasTransform.y = mouseY - (mouseY - canvasTransform.y) * scaleRatio;
        canvasTransform.scale = newScale;
    } else {
        // Two-finger scroll (pan)
        const panSpeed = 1.0;
        canvasTransform.x -= e.deltaX * panSpeed;
        canvasTransform.y -= e.deltaY * panSpeed;
    }
    
    updateCanvasTransform();
}

// Touch gesture support
let touchStartDistance = 0;
let touchStartCenter = { x: 0, y: 0 };
let touchStartTransform = { x: 0, y: 0, scale: 1 };
let touchStartPos = { x: 0, y: 0 };
let isSingleTouchPanning = false;

function handleTouchStart(e) {
    if (e.touches.length === 1) {
        // Single finger - handle panning
        e.preventDefault();
        
        // Stop any ongoing inertia animation
        stopInertiaAnimation();
        
        const touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        touchStartTransform = { ...canvasTransform };
        isSingleTouchPanning = true;
        lastPanTime = Date.now();
        
        // Check if we're touching a canvas item
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const canvasItem = element?.closest('.canvas-item');
        
        if (canvasItem && !isSettingCenter) {
            // If touching an item, select it instead of panning
            selectItem(canvasItem);
            isSingleTouchPanning = false;
        }
    } else if (e.touches.length >= 2) {
        // Multi-touch - handle pinch-to-zoom
        e.preventDefault();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        // Calculate distance between touches
        touchStartDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Calculate center point
        touchStartCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
        
        // Store initial transform
        touchStartTransform = { ...canvasTransform };
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 1 && isSingleTouchPanning) {
        // Single finger panning
        e.preventDefault();
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartPos.x;
        const deltaY = touch.clientY - touchStartPos.y;
        
        canvasTransform.x = touchStartTransform.x + deltaX;
        canvasTransform.y = touchStartTransform.y + deltaY;
        
        updateCanvasTransform();
        
        // Track velocity for touch inertia
        const now = Date.now();
        const timeDelta = now - lastPanTime;
        if (timeDelta > 0) {
            panVelocity.x = deltaX / timeDelta;
            panVelocity.y = deltaY / timeDelta;
        }
        lastPanTime = now;
        
        // Store position for velocity calculation
        panPositions.push({ x: touch.clientX, y: touch.clientY, time: now });
        if (panPositions.length > 5) {
            panPositions.shift();
        }
    } else if (e.touches.length >= 2) {
        // Multi-touch pinch-to-zoom
        e.preventDefault();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        // Calculate current distance and center
        const currentDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        const currentCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
        
        if (touchStartDistance > 0) {
            // Calculate scale
            const scaleChange = currentDistance / touchStartDistance;
            const newScale = Math.max(0.05, Math.min(5, touchStartTransform.scale * scaleChange));
            
            // Calculate pan
            const panX = currentCenter.x - touchStartCenter.x;
            const panY = currentCenter.y - touchStartCenter.y;
            
            // Apply zoom towards gesture center
            const rect = container.getBoundingClientRect();
            const centerX = touchStartCenter.x - rect.left;
            const centerY = touchStartCenter.y - rect.top;
            
            const scaleRatio = newScale / touchStartTransform.scale;
            canvasTransform.x = centerX - (centerX - touchStartTransform.x) * scaleRatio + panX;
            canvasTransform.y = centerY - (centerY - touchStartTransform.y) * scaleRatio + panY;
            canvasTransform.scale = newScale;
            
            updateCanvasTransform();
        }
    }
}

function handleTouchEnd(e) {
    if (e.touches.length === 0) {
        // All touches ended
        touchStartDistance = 0;
        touchStartCenter = { x: 0, y: 0 };
        
        // Handle inertia for single touch panning
        if (isSingleTouchPanning && panPositions.length >= 2) {
            const recent = panPositions.slice(-3);
            const first = recent[0];
            const last = recent[recent.length - 1];
            const timeDelta = last.time - first.time;
            
            if (timeDelta > 0) {
                panVelocity.x = (last.x - first.x) / timeDelta * 0.5;
                panVelocity.y = (last.y - first.y) / timeDelta * 0.5;
                
                // Start inertia animation if velocity is significant
                if (Math.abs(panVelocity.x) > 0.1 || Math.abs(panVelocity.y) > 0.1) {
                    startInertiaAnimation();
                }
            }
        }
        
        isSingleTouchPanning = false;
        panPositions = [];
    } else if (e.touches.length === 1) {
        // Went from multi-touch to single touch
        touchStartDistance = 0;
        touchStartCenter = { x: 0, y: 0 };
    }
}

// Inertia animation function
function startInertiaAnimation() {
    if (inertiaAnimationId) {
        cancelAnimationFrame(inertiaAnimationId);
    }
    
    const friction = 0.95; // Decay factor
    const minVelocity = 0.1; // Minimum velocity to continue animation
    
    function animateInertia() {
        // Apply velocity
        canvasTransform.x += panVelocity.x;
        canvasTransform.y += panVelocity.y;
        updateCanvasTransform();
        
        // Apply friction
        panVelocity.x *= friction;
        panVelocity.y *= friction;
        
        // Continue animation if velocity is still significant
        if (Math.abs(panVelocity.x) > minVelocity || Math.abs(panVelocity.y) > minVelocity) {
            inertiaAnimationId = requestAnimationFrame(animateInertia);
        } else {
            inertiaAnimationId = null;
        }
    }
    
    inertiaAnimationId = requestAnimationFrame(animateInertia);
}

// Stop inertia animation when user starts panning again
function stopInertiaAnimation() {
    if (inertiaAnimationId) {
        cancelAnimationFrame(inertiaAnimationId);
        inertiaAnimationId = null;
    }
    panVelocity = { x: 0, y: 0 };
}

function handleKeyDown(e) {
    if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Don't interfere with text editing
    }
    
    // Only allow admin keyboard shortcuts
    if (!isAuthenticated) {
        return; // Guests cannot use keyboard shortcuts
    }
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItem) {
            deleteItem(selectedItem);
        }
    } else if (e.key === 'Escape') {
        if (isSettingCenter) {
            cancelSetCenter();
        } else {
            clearSelection();
        }
    } else if (e.key === 'z' && e.ctrlKey) {
        // Ctrl+Z to manually sync z-indexes to database
        e.preventDefault();
        syncZIndexesToDatabase();
    }
}

// Item Management
function selectItem(item) {
    clearSelection();
    selectedItem = item;
    item.classList.add('selected');
    showResizeHandles(item);
    
    // Show move up/down buttons when item is selected (admin only)
    if (isAuthenticated) {
        showMoveButtons();
    }
    
    // Show text toolbar if this is a text item and user is admin
    if (item.classList.contains('text-item') && isAuthenticated) {
        selectedTextItem = item;
        showTextToolbar(item);
    }
    
    // Show draw toolbar if this is a drawing item and user is admin
    if (item.classList.contains('drawing-item') && isAuthenticated) {
        showDrawToolbar();
        // Update toolbar controls with current drawing values
        const path = item.querySelector('path');
        if (path) {
            document.getElementById('strokeColor').value = path.getAttribute('stroke') || '#333333';
            document.getElementById('strokeThickness').value = path.getAttribute('stroke-width') || '4';
        }
    }
}

function clearSelection() {
    if (selectedItem) {
        selectedItem.classList.remove('selected');
        
        // Reset interactive state for code items when deselected
        if (selectedItem.classList.contains('code-item')) {
            selectedItem.classList.remove('interactive');
        }
        
        // Reset text items to non-editing mode when deselected
        if (selectedItem.classList.contains('text-item')) {
            selectedItem.classList.remove('editing');
            selectedItem.contentEditable = false;
        }
        
        hideResizeHandles();
        selectedItem = null;
    }
    
    // Hide move up/down buttons when no item is selected
    hideMoveButtons();
    
    // Hide text toolbar
    hideTextToolbar();
    selectedTextItem = null;
    
    // Hide draw toolbar
    hideDrawToolbar();
}

function showResizeHandles(item) {
    hideResizeHandles();
    
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    handles.id = 'resizeHandles';
    
    // For drawing items, only show corner handles for aspect ratio resizing
    const isDrawingItem = item.classList.contains('drawing-item');
    const positions = isDrawingItem ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
    
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.addEventListener('mousedown', (e) => startResize(e, pos));
        handles.appendChild(handle);
    });
    
    // Add rotation handle
    const rotationHandle = document.createElement('div');
    rotationHandle.className = 'rotation-handle';
    rotationHandle.addEventListener('mousedown', (e) => startRotation(e));
    handles.appendChild(rotationHandle);
    
    item.appendChild(handles);
}

function hideResizeHandles() {
    const existing = document.getElementById('resizeHandles');
    if (existing) {
        existing.remove();
    }
}

function startDragging(e, item) {
    isDragging = true;
    item.classList.add('dragging');
    canvas.classList.add('dragging');
    
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const currentLeft = parseFloat(item.style.left) || 0;
    const currentTop = parseFloat(item.style.top) || 0;
    
    // Calculate offset from mouse position to item's top-left corner
    item.dragOffset = {
        x: canvasPos.x - currentLeft,
        y: canvasPos.y - currentTop
    };
}

function dragItem(e) {
    if (!isDragging || !selectedItem) return;
    
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const newX = canvasPos.x - selectedItem.dragOffset.x;
    const newY = canvasPos.y - selectedItem.dragOffset.y;
    
    selectedItem.style.left = newX + 'px';
    selectedItem.style.top = newY + 'px';
}

function stopDragging() {
    if (isDragging && selectedItem) {
        isDragging = false;
        selectedItem.classList.remove('dragging');
        canvas.classList.remove('dragging');
        
        // Small delay to ensure any pending real-time updates don't interfere
        setTimeout(() => {
            saveItemToDatabase(selectedItem);
        }, 50);
        
        delete selectedItem.dragOffset;
    }
}

function startResize(e, direction) {
    e.stopPropagation();
    e.preventDefault();
    
    if (!selectedItem) return;
    
    isResizing = true;
    const startMousePos = { x: e.clientX, y: e.clientY };
    const itemRect = selectedItem.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Determine item types early
    const isImage = selectedItem.classList.contains('image-item');
    const isText = selectedItem.classList.contains('text-item');
    
    // Get current item dimensions in canvas coordinates
    let startWidth, startHeight;
    
    if (isText) {
        // For text items, use the current rendered width/height as starting point
        // This allows free resizing from whatever the current size is
        startWidth = itemRect.width / canvasTransform.scale;
        startHeight = itemRect.height / canvasTransform.scale;
    } else {
        // For non-text items, use explicit styles or fall back to rendered size
        startWidth = parseFloat(selectedItem.style.width) || itemRect.width / canvasTransform.scale;
        startHeight = parseFloat(selectedItem.style.height) || itemRect.height / canvasTransform.scale;
    }
    const startLeft = parseFloat(selectedItem.style.left);
    const startTop = parseFloat(selectedItem.style.top);
    
    // For images, maintain aspect ratio
    const aspectRatio = isImage ? parseFloat(selectedItem.dataset.aspectRatio) || (startWidth / startHeight) : (startWidth / startHeight);
    
    function handleResizeMove(e) {
        if (!isResizing) return;
        
        const deltaX = (e.clientX - startMousePos.x) / canvasTransform.scale;
        const deltaY = (e.clientY - startMousePos.y) / canvasTransform.scale;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        // Calculate new dimensions based on handle direction
        if (isImage) {
            // For images, ALWAYS maintain aspect ratio regardless of handle
            let sizeDelta = 0;
            
            switch (direction) {
                case 'se': // Bottom-right
                    sizeDelta = Math.max(deltaX, deltaY);
                    newWidth = Math.max(50, startWidth + sizeDelta);
                    newHeight = newWidth / aspectRatio;
                    break;
                case 'sw': // Bottom-left
                    sizeDelta = Math.max(-deltaX, deltaY);
                    newWidth = Math.max(50, startWidth + sizeDelta);
                    newHeight = newWidth / aspectRatio;
                    newLeft = startLeft + (startWidth - newWidth);
                    break;
                case 'ne': // Top-right
                    sizeDelta = Math.max(deltaX, -deltaY);
                    newWidth = Math.max(50, startWidth + sizeDelta);
                    newHeight = newWidth / aspectRatio;
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'nw': // Top-left
                    sizeDelta = Math.max(-deltaX, -deltaY);
                    newWidth = Math.max(50, startWidth + sizeDelta);
                    newHeight = newWidth / aspectRatio;
                    newLeft = startLeft + (startWidth - newWidth);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'e': // Right
                    newWidth = Math.max(50, startWidth + deltaX);
                    newHeight = newWidth / aspectRatio;
                    break;
                case 'w': // Left
                    newWidth = Math.max(50, startWidth - deltaX);
                    newHeight = newWidth / aspectRatio;
                    newLeft = startLeft + (startWidth - newWidth);
                    break;
                case 's': // Bottom
                    newHeight = Math.max(50, startHeight + deltaY);
                    newWidth = newHeight * aspectRatio;
                    break;
                case 'n': // Top
                    newHeight = Math.max(50, startHeight - deltaY);
                    newWidth = newHeight * aspectRatio;
                    newTop = startTop + (startHeight - newHeight);
                    break;
            }
        } else if (isText) {
            // For text items, allow free width and height adjustment
            switch (direction) {
                case 'e': // Right - adjust width only
                    newWidth = startWidth + deltaX;
                    newHeight = startHeight;
                    break;
                case 'w': // Left - adjust width and position
                    newWidth = startWidth - deltaX;
                    newHeight = startHeight;
                    newLeft = startLeft + deltaX;
                    break;
                case 'n': // Top - adjust height and position
                    newWidth = startWidth;
                    newHeight = startHeight - deltaY;
                    newTop = startTop + deltaY;
                    break;
                case 's': // Bottom - adjust height
                    newWidth = startWidth;
                    newHeight = startHeight + deltaY;
                    break;
                case 'se': // Bottom-right - adjust both width and height
                    newWidth = startWidth + deltaX;
                    newHeight = startHeight + deltaY;
                    break;
                case 'sw': // Bottom-left - adjust both width and height
                    newWidth = startWidth - deltaX;
                    newHeight = startHeight + deltaY;
                    newLeft = startLeft + deltaX;
                    break;
                case 'ne': // Top-right - adjust both width and height
                    newWidth = startWidth + deltaX;
                    newHeight = startHeight - deltaY;
                    newTop = startTop + deltaY;
                    break;
                case 'nw': // Top-left - adjust both width and height
                    newWidth = startWidth - deltaX;
                    newHeight = startHeight - deltaY;
                    newLeft = startLeft + deltaX;
                    newTop = startTop + deltaY;
                    break;
            }
        } else {
            // For non-images (code), allow free resizing
            switch (direction) {
                case 'se': // Bottom-right
                    newWidth = Math.max(50, startWidth + deltaX);
                    newHeight = Math.max(50, startHeight + deltaY);
                    break;
                case 'sw': // Bottom-left
                    newWidth = Math.max(50, startWidth - deltaX);
                    newHeight = Math.max(50, startHeight + deltaY);
                    newLeft = startLeft + deltaX;
                    break;
                case 'ne': // Top-right
                    newWidth = Math.max(50, startWidth + deltaX);
                    newHeight = Math.max(50, startHeight - deltaY);
                    newTop = startTop + deltaY;
                    break;
                case 'nw': // Top-left
                    newWidth = Math.max(50, startWidth - deltaX);
                    newHeight = Math.max(50, startHeight - deltaY);
                    newLeft = startLeft + deltaX;
                    newTop = startTop + deltaY;
                    break;
                case 'e': // Right
                    newWidth = Math.max(50, startWidth + deltaX);
                    break;
                case 'w': // Left
                    newWidth = Math.max(50, startWidth - deltaX);
                    newLeft = startLeft + deltaX;
                    break;
                case 's': // Bottom
                    newHeight = Math.max(50, startHeight + deltaY);
                    break;
                case 'n': // Top
                    newHeight = Math.max(50, startHeight - deltaY);
                    newTop = startTop + deltaY;
                    break;
            }
        }
        
        // Apply new dimensions and position
        selectedItem.style.width = newWidth + 'px';
        selectedItem.style.height = newHeight + 'px';
        selectedItem.style.left = newLeft + 'px';
        selectedItem.style.top = newTop + 'px';
        
        // For text items, remove any min/max constraints since we're setting explicit dimensions
        if (isText) {
            selectedItem.style.minWidth = '';
            selectedItem.style.minHeight = '';
            selectedItem.style.maxWidth = '';
            selectedItem.style.maxHeight = '';
        }
    }
    
    function handleResizeEnd() {
        if (isResizing) {
            isResizing = false;
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
            
            // Save changes to database
            saveItemToDatabase(selectedItem);
        }
    }
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
}

function startRotation(e) {
    e.stopPropagation();
    e.preventDefault();
    
    if (!selectedItem) return;
    
    const startMousePos = { x: e.clientX, y: e.clientY };
    const itemRect = selectedItem.getBoundingClientRect();
    const itemCenter = {
        x: itemRect.left + itemRect.width / 2,
        y: itemRect.top + itemRect.height / 2
    };
    
    // Get current rotation or default to 0
    const currentTransform = selectedItem.style.transform || '';
    const rotateMatch = currentTransform.match(/rotate\(([^)]+)deg\)/);
    const startRotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
    
    // Calculate initial angle
    const startAngle = Math.atan2(startMousePos.y - itemCenter.y, startMousePos.x - itemCenter.x) * (180 / Math.PI);
    
    function handleRotateMove(e) {
        // Calculate current angle
        const currentAngle = Math.atan2(e.clientY - itemCenter.y, e.clientX - itemCenter.x) * (180 / Math.PI);
        
        // Calculate rotation difference
        let angleDiff = currentAngle - startAngle;
        
        // Snap to 15-degree increments if Shift is held
        let newRotation = startRotation + angleDiff;
        if (e.shiftKey) {
            newRotation = Math.round(newRotation / 15) * 15;
        }
        
        // Apply rotation
        const otherTransforms = currentTransform.replace(/rotate\([^)]+deg\)/g, '').trim();
        const newTransform = otherTransforms ? `${otherTransforms} rotate(${newRotation}deg)` : `rotate(${newRotation}deg)`;
        selectedItem.style.transform = newTransform;
        
        // Store rotation value for database
        selectedItem.dataset.rotation = newRotation;
    }
    
    function handleRotateEnd() {
        document.removeEventListener('mousemove', handleRotateMove);
        document.removeEventListener('mouseup', handleRotateEnd);
        
        // Save changes to database
        saveItemToDatabase(selectedItem);
    }
    
    document.addEventListener('mousemove', handleRotateMove);
    document.addEventListener('mouseup', handleRotateEnd);
}

// Item Creation
function addImage() {
    document.getElementById('fileInput').click();
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        showStatus('Uploading image...');
        
        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const filename = `${timestamp}_${file.name}`;
        
        // Upload to Supabase storage
        const { data, error } = await supabaseClient.storage
            .from('canvas-media')
            .upload(filename, file);
        
        if (error) {
            console.error('Upload error:', error);
            showStatus('Failed to upload image: ' + error.message);
            return;
        }
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('canvas-media')
            .getPublicUrl(filename);
        
        if (urlData?.publicUrl) {
            console.log('Image uploaded successfully:', urlData.publicUrl);
            showStatus('Image uploaded successfully');
            createImageItem(urlData.publicUrl);
        } else {
            showStatus('Failed to get image URL');
        }
        
    } catch (error) {
        console.error('Error uploading file:', error);
        showStatus('Failed to upload image');
    }
    
    e.target.value = ''; // Reset input
}

function createImageItem(src, x = centerPoint.x, y = centerPoint.y, width = 200, height = 150, fromDatabase = false) {
    const item = document.createElement('div');
    item.className = 'canvas-item image-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.style.width = width + 'px';
    item.style.height = height + 'px';
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'image';
    
    const img = document.createElement('img');
    img.src = src;
    
    // Set a default aspect ratio initially
    item.dataset.aspectRatio = width / height;
    
    img.onload = function() {
        // Calculate and store the correct aspect ratio
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        item.dataset.aspectRatio = aspectRatio;
        
        // Only adjust size and save if not from database (new item)
        if (!fromDatabase) {
            // Adjust size to maintain aspect ratio
            if (aspectRatio > 1) {
                item.style.height = (width / aspectRatio) + 'px';
            } else {
                item.style.width = (height * aspectRatio) + 'px';
            }
            
            // Save again with correct dimensions
            saveItemToDatabase(item);
        }
    };
    
    // Handle load errors
    img.onerror = function() {
        console.error('Failed to load image:', src);
        showStatus('Failed to load image');
    };
    
    item.appendChild(img);
    canvas.appendChild(item);
    
    if (!fromDatabase) {
        selectItem(item);
        // Save immediately with initial dimensions
        saveItemToDatabase(item);
    }
    
    return item;
}

function addText() {
    createTextItem('Double-click to edit text...', centerPoint.x, centerPoint.y);
}

function createTextItem(content = 'Double-click to edit text...', x = centerPoint.x, y = centerPoint.y, width = null, height = null, fromDatabase = false) {
    const item = document.createElement('div');
    item.className = 'canvas-item text-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.contentEditable = false; // Start in non-editing mode
    item.textContent = content;
    
    // Set default text styling
    item.style.fontFamily = 'Antarctica';
    item.style.fontSize = '24px';
    item.style.fontWeight = '400';
    item.style.color = '#333333';
    item.style.lineHeight = '1.15';
    item.style.padding = '8px';
    
    // Set dimensions if provided (from database)
    if (width && width > 0) {
        item.style.width = width + 'px';
    }
    
    if (height && height > 0) {
        item.style.height = height + 'px';
    }
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'text';
    
    // Double-click to enter text editing mode
    item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        item.contentEditable = true;
        item.focus();
        item.classList.add('editing');
        
        // Select all text for easy editing
        const range = document.createRange();
        range.selectNodeContents(item);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    
    // Handle text editing
    item.addEventListener('focus', () => item.classList.add('editing'));
    item.addEventListener('blur', () => {
        item.classList.remove('editing');
        item.contentEditable = false;
        saveItemToDatabase(item);
    });
    
    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            item.blur();
        }
    });
    
    canvas.appendChild(item);
    
    if (!fromDatabase) {
        selectItem(item);
        saveItemToDatabase(item);
    }
    
    return item;
}

function addCode() {
    document.getElementById('codeModal').classList.remove('hidden');
    document.getElementById('codeInput').focus();
}

function insertCode() {
    const code = document.getElementById('codeInput').value.trim();
    if (!code) return;
    
    createCodeItem(code, centerPoint.x, centerPoint.y);
    closeModal('codeModal');
    document.getElementById('codeInput').value = '';
}

function createCodeItem(htmlContent, x = centerPoint.x, y = centerPoint.y, width = 400, height = 300, fromDatabase = false) {
    const item = document.createElement('div');
    item.className = 'canvas-item code-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.style.width = width + 'px';
    item.style.height = height + 'px';
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'code';
    
    const iframe = document.createElement('iframe');
    iframe.srcdoc = htmlContent;
    iframe.sandbox = 'allow-scripts allow-same-origin';
    
    item.appendChild(iframe);
    
    // Double-click to toggle interactivity
    item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        item.classList.toggle('interactive');
    });
    
    canvas.appendChild(item);
    
    if (!fromDatabase) {
        selectItem(item);
        saveItemToDatabase(item);
    }
    
    return item;
}

// Drawing Functions
function toggleDrawMode() {
    isDrawMode = !isDrawMode;
    const drawBtn = document.getElementById('drawBtn');
    
    console.log('Draw mode toggled:', isDrawMode, 'Authenticated:', isAuthenticated);
    
    if (isDrawMode) {
        drawBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        showDrawToolbar();
        container.style.cursor = 'crosshair';
        console.log('Draw mode enabled');
    } else {
        drawBtn.style.backgroundColor = '';
        hideDrawToolbar();
        container.style.cursor = '';
        removeDrawingPreview();
        console.log('Draw mode disabled');
    }
}

function showDrawToolbar() {
    hideTextToolbar();
    drawToolbar.classList.remove('hidden');
}

function hideDrawToolbar() {
    drawToolbar.classList.add('hidden');
}

function createDrawingPreview() {
    // Remove existing preview
    removeDrawingPreview();
    
    // Create preview SVG overlay
    drawingPreview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drawingPreview.style.position = 'fixed';
    drawingPreview.style.top = '0';
    drawingPreview.style.left = '0';
    drawingPreview.style.width = '100%';
    drawingPreview.style.height = '100%';
    drawingPreview.style.pointerEvents = 'none';
    drawingPreview.style.zIndex = '10001';
    drawingPreview.id = 'drawingPreview';
    
    document.body.appendChild(drawingPreview);
}

function updateDrawingPreview() {
    if (!drawingPreview || drawingPath.length < 2) return;
    
    // Clear existing path
    drawingPreview.innerHTML = '';
    
    // Get current stroke settings
    const strokeColor = document.getElementById('strokeColor').value;
    const strokeThickness = parseFloat(document.getElementById('strokeThickness').value);
    
    // Create path data in screen coordinates
    let pathData = '';
    for (let i = 0; i < drawingPath.length; i++) {
        const screenPos = canvasToScreen(drawingPath[i].x, drawingPath[i].y);
        if (i === 0) {
            pathData = `M ${screenPos.x} ${screenPos.y}`;
        } else {
            pathData += ` L ${screenPos.x} ${screenPos.y}`;
        }
    }
    
    // Create path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeThickness);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('opacity', '0.8');
    
    drawingPreview.appendChild(path);
}

function removeDrawingPreview() {
    if (drawingPreview) {
        drawingPreview.remove();
        drawingPreview = null;
    }
}

function createDrawingItem(pathData, strokeColor, strokeThickness, x, y, width, height, fromDatabase = false, viewBoxData = null) {
    console.log('createDrawingItem called with:', { pathData, strokeColor, strokeThickness, x, y, width, height, fromDatabase, viewBoxData });
    
    const item = document.createElement('div');
    item.className = 'canvas-item drawing-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.style.width = width + 'px';
    item.style.height = height + 'px';
    
    console.log('Item positioned at:', { left: item.style.left, top: item.style.top, width: item.style.width, height: item.style.height });
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'drawing';
    
    // Create SVG element with viewBox for proper scaling and centering
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.pointerEvents = 'none';
    
    // Set viewBox - if provided from database, use it; otherwise calculate from path
    if (viewBoxData) {
        svg.setAttribute('viewBox', viewBoxData);
        // Store viewBox data for database saving
        item.dataset.viewBox = viewBoxData;
        console.log('Using provided viewBox:', viewBoxData);
    } else {
        // Set viewBox to show the exact area of the container (1:1 scale)
        const viewBox = `${x} ${y} ${width} ${height}`;
        svg.setAttribute('viewBox', viewBox);
        item.dataset.viewBox = viewBox;
        console.log('Calculated viewBox (1:1 scale):', viewBox);
    }
    
    // Create path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeThickness);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    console.log('Path attributes:', {
        d: path.getAttribute('d'),
        stroke: path.getAttribute('stroke'),
        strokeWidth: path.getAttribute('stroke-width')
    });
    
    svg.appendChild(path);
    item.appendChild(svg);
    
    canvas.appendChild(item);
    console.log('Drawing item added to canvas');
    
    if (!fromDatabase) {
        selectItem(item);
        saveItemToDatabase(item);
    }
    
    return item;
}

function deleteItem(item) {
    if (confirm('Delete this item?')) {
        deleteItemFromDatabase(item);
        item.remove();
        clearSelection();
        // Normalize z-indexes after deletion
        normalizeZIndexes();
    }
}

// Center Point Management
function setCenter() {
    if (isSettingCenter) {
        cancelSetCenter();
    } else {
        isSettingCenter = true;
        container.style.cursor = 'crosshair';
        showStatus('Click anywhere to set the center point');
    }
}

function setCenterPoint(x, y) {
    centerPoint = { x, y };
    isSettingCenter = false;
    container.style.cursor = 'grab';
    
    // Show center indicator
    showCenterIndicator(x, y);
    
    // Save to database
    saveCenterPoint();
    showStatus('Center point set!');
}

function cancelSetCenter() {
    isSettingCenter = false;
    container.style.cursor = 'grab';
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
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.remove();
        }
    }, 3000);
}

function clearAll() {
    if (confirm('Clear all items? This cannot be undone.')) {
        canvas.querySelectorAll('.canvas-item').forEach(item => item.remove());
        clearSelection();
        clearDatabase();
    }
}

// Z-Index Management - No Duplicates System
function getSortedItems() {
    const items = Array.from(canvas.querySelectorAll('.canvas-item'));
    return items.sort((a, b) => {
        const zA = parseInt(a.style.zIndex) || 1;
        const zB = parseInt(b.style.zIndex) || 1;
        return zA - zB;
    });
}

function normalizeZIndexes() {
    const items = getSortedItems();
    console.log('Normalizing z-indexes for', items.length, 'items');
    
    items.forEach((item, index) => {
        const newZIndex = index + 1;
        const currentZIndex = parseInt(item.style.zIndex) || 1;
        if (currentZIndex !== newZIndex) {
            console.log(`Updating item ${item.dataset.id}: z-index ${currentZIndex} → ${newZIndex}`);
            item.style.zIndex = newZIndex;
            // Only save to database if the item has a valid ID (not just created)
            if (item.dataset.id) {
                saveItemToDatabase(item);
            }
        }
    });
    
    console.log('Z-index normalization complete');
}

function bringToFront() {
    if (selectedItem) {
        const items = getSortedItems();
        const currentZIndex = parseInt(selectedItem.style.zIndex) || 1;
        const maxZIndex = items.length;
        
        // If already at front, do nothing
        if (currentZIndex === maxZIndex) {
            showStatus('Item is already at the front');
            return;
        }
        
        // Set selected item to front
        selectedItem.style.zIndex = maxZIndex + 1;
        
        // Normalize all other items to have continuous z-indexes
        normalizeZIndexes();
        
        showStatus('Brought to front');
    } else {
        showStatus('Please select an item first');
    }
}

function sendToBack() {
    if (selectedItem) {
        const items = getSortedItems();
        const currentZIndex = parseInt(selectedItem.style.zIndex) || 1;
        
        // If already at back, do nothing
        if (currentZIndex === 1) {
            showStatus('Item is already at the back');
            return;
        }
        
        // Set selected item to back
        selectedItem.style.zIndex = 0;
        
        // Normalize all other items to have continuous z-indexes
        normalizeZIndexes();
        
        showStatus('Sent to back');
    } else {
        showStatus('Please select an item first');
    }
}

// Manual z-index sync function for debugging
function syncZIndexesToDatabase() {
    console.log('Manually syncing z-indexes to database...');
    const items = Array.from(canvas.querySelectorAll('.canvas-item'));
    items.forEach(item => {
        if (item.dataset.id) {
            console.log(`Syncing item ${item.dataset.id} with z-index ${item.style.zIndex}`);
            saveItemToDatabase(item);
        }
    });
    showStatus('Z-indexes synced to database');
}

// Real-time Subscription
function setupRealtimeSubscription() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }
    
    realtimeChannel = supabaseClient
        .channel('canvas_changes')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'canvas_items' },
            handleRealtimeInsert
        )
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'canvas_items' },
            handleRealtimeUpdate
        )
        .on('postgres_changes', 
            { event: 'DELETE', schema: 'public', table: 'canvas_items' },
            handleRealtimeDelete
        )
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'canvas_center' },
            handleCenterUpdate
        )
        .subscribe();
    
    console.log('Real-time subscription active');
}

function handleRealtimeInsert(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.new.id}"]`);
    if (!existingItem) {
        console.log('Real-time insert:', payload.new);
        // Mark as coming from real-time for entrance animation
        payload.new.fromRealtime = true;
        createItemFromData(payload.new);
        showStatus('New item added by another user');
    } else {
        console.log('Ignoring duplicate real-time insert for existing item:', payload.new.id);
    }
}

function handleRealtimeUpdate(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.new.id}"]`);
    if (existingItem && existingItem !== selectedItem && !isDragging) {
        updateItemFromData(existingItem, payload.new);
        showStatus('Item updated by another user');
    }
}

function handleRealtimeDelete(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.old.id}"]`);
    if (existingItem && existingItem !== selectedItem) {
        // Add exit animation
        existingItem.style.transition = 'opacity var(--transition-normal), transform var(--transition-normal)';
        existingItem.style.opacity = '0';
        existingItem.style.transform = existingItem.style.transform + ' scale(0.8)';
        
        // Remove after animation
        setTimeout(() => {
            existingItem.remove();
        }, 300);
        
        showStatus('Item deleted by another user');
    }
}

function handleCenterUpdate(payload) {
    centerPoint = { x: payload.new.x, y: payload.new.y };
    showCenterIndicator(centerPoint.x, centerPoint.y);
    showStatus('Center point updated by another user');
}

// Database Operations
async function saveItemToDatabase(item) {
    const isTextItem = item.dataset.type === 'text';
    const isDrawingItem = item.dataset.type === 'drawing';
    
    // For text items, save width/height if they have been explicitly set
    const hasExplicitWidth = isTextItem && item.style.width && item.style.width !== '';
    const hasExplicitHeight = isTextItem && item.style.height && item.style.height !== '';
    
    const itemData = {
        id: parseInt(item.dataset.id),
        x: parseFloat(item.style.left) || 0,
        y: parseFloat(item.style.top) || 0,
        item_type: item.dataset.type,
        content: getItemContent(item),
        user_id: 'admin', // Set user ID - you can customize this
        width: hasExplicitWidth ? (parseFloat(item.style.width) || null) : (isTextItem ? null : (parseFloat(item.style.width) || 100)),
        height: hasExplicitHeight ? (parseFloat(item.style.height) || null) : (isTextItem ? null : (parseFloat(item.style.height) || 100)),
        original_width: isTextItem ? null : (parseFloat(item.style.width) || 100),
        original_height: isTextItem ? null : (parseFloat(item.style.height) || 100),
        aspect_ratio: parseFloat(item.dataset.aspectRatio) || 1,
        rotation: parseFloat(item.dataset.rotation) || 0,
        z_index: parseInt(item.style.zIndex) || 1,
        border_radius: parseFloat(item.style.getPropertyValue('--item-border-radius')) || 0,
        font_family: item.style.fontFamily || 'Antarctica',
        font_size: parseInt(item.style.fontSize) || 24,
        font_weight: item.style.fontWeight || 'normal',
        text_color: item.style.color || '#333333',
        line_height: parseFloat(item.style.lineHeight) || 1.15,
        html_content: item.dataset.type === 'code' ? getItemContent(item) : (isDrawingItem ? item.dataset.viewBox : null),
        stroke_thickness: isDrawingItem ? parseFloat(item.querySelector('path')?.getAttribute('stroke-width')) || 4 : null,
        stroke_color: isDrawingItem ? item.querySelector('path')?.getAttribute('stroke') || '#333333' : null
    };
    
    // Debug logging for text items
    if (isTextItem) {
        console.log('Saving text item:', {
            id: itemData.id,
            content: itemData.content,
            width: itemData.width,
            height: itemData.height
        });
    }
    
    // Debug logging for drawing items
    if (isDrawingItem) {
        console.log('Saving drawing item:', {
            id: itemData.id,
            content: itemData.content,
            stroke_color: itemData.stroke_color,
            stroke_thickness: itemData.stroke_thickness,
            html_content: itemData.html_content,
            width: itemData.width,
            height: itemData.height
        });
    }
    
    try {
        const { error } = await supabaseClient
            .from('canvas_items')
            .upsert(itemData);
        
        if (error) {
            console.error('Database error details:', error);
            throw error;
        }
        console.log('Item saved successfully:', itemData);
    } catch (error) {
        console.error('Error saving item:', error);
        console.error('Item data that failed to save:', itemData);
        showStatus('Failed to save item - check console for details');
    }
}

async function deleteItemFromDatabase(item) {
    try {
        const { error } = await supabaseClient
            .from('canvas_items')
            .delete()
            .eq('id', item.dataset.id);
        
        if (error) throw error;
        console.log('Item deleted:', item.dataset.id);
    } catch (error) {
        console.error('Error deleting item:', error);
        showStatus('Failed to delete item - check console for details');
    }
}

async function saveCenterPoint() {
    try {
        const { error } = await supabaseClient
            .from('canvas_center')
            .upsert({
                id: 1,
                x: centerPoint.x,
                y: centerPoint.y
            });
        
        if (error) throw error;
        console.log('Center point saved:', centerPoint);
    } catch (error) {
        console.error('Error saving center point:', error);
        showStatus('Failed to save center point - check console for details');
    }
}

async function loadCanvasData() {
    console.log('Loading canvas data from Supabase...');
    showStatus('Loading canvas data...');
    
    try {
        // Test basic connection first
        const { data: connectionTest, error: connectionError } = await supabaseClient
            .from('canvas_items')
            .select('count', { count: 'exact', head: true });
        
        if (connectionError) {
            console.error('Connection test failed:', connectionError);
            showStatus('Failed to connect to database - check your Supabase configuration');
            return;
        }
        
        console.log('Database connection successful');
        
        // Load items
        const { data: items, error: itemsError } = await supabaseClient
            .from('canvas_items')
            .select('*');
        
        if (itemsError) {
            console.error('Error loading items:', itemsError);
            showStatus('Failed to load items: ' + itemsError.message);
            throw itemsError;
        }
        
        console.log('Items loaded:', items?.length || 0);
        
        // Load center point
        const { data: center, error: centerError } = await supabaseClient
            .from('canvas_center')
            .select('*')
            .eq('id', 1)
            .maybeSingle();
        
        if (centerError && centerError.code !== 'PGRST116') {
            console.error('Error loading center point:', centerError);
        } else if (center) {
            console.log('Center point loaded:', center);
            centerPoint = { x: center.x, y: center.y };
            // Center the canvas on the center point
            const containerRect = container.getBoundingClientRect();
            canvasTransform.x = containerRect.width / 2 - center.x * canvasTransform.scale;
            canvasTransform.y = containerRect.height / 2 - center.y * canvasTransform.scale;
            updateCanvasTransform();
        }
        
        // Create items
        if (items && items.length > 0) {
            let maxId = 0;
            items.forEach(itemData => {
                console.log('Creating item from data:', itemData);
                maxId = Math.max(maxId, parseInt(itemData.id));
                createItemFromData(itemData);
            });
            itemCounter = maxId;
            
            // Normalize z-indexes after loading all items
            normalizeZIndexes();
            
            showStatus(`Loaded ${items.length} items from database`);
        } else {
            console.log('No items found in database');
            showStatus('No existing items found');
        }
        
        console.log('Canvas data loaded successfully');
    } catch (error) {
        console.error('Error loading canvas data:', error);
        showStatus('Failed to load canvas data: ' + error.message);
        throw error;
    }
}

function createItemFromData(data) {
    let item;
    
    // Use item_type from database, fallback to type for compatibility
    const itemType = data.item_type || data.type;
    
    // Debug logging for text items
    if (itemType === 'text') {
        console.log('Creating text item from data:', {
            id: data.id,
            content: data.content,
            width: data.width,
            height: data.height
        });
    }
    
    switch (itemType) {
        case 'image':
            item = createImageItem(data.content, data.x, data.y, data.width, data.height, true);
            break;
        case 'text':
            item = createTextItem(data.content, data.x, data.y, data.width, data.height, true);
            break;
        case 'code':
            // Use html_content if available, fallback to content
            const codeContent = data.html_content || data.content;
            item = createCodeItem(codeContent, data.x, data.y, data.width, data.height, true);
            break;
        case 'drawing':
            item = createDrawingItem(data.content, data.stroke_color || '#333333', data.stroke_thickness || 4, data.x, data.y, data.width, data.height, true, data.html_content);
            break;
    }
    
    if (item) {
        // Override the counter since this is from database
        item.dataset.id = data.id;
        item.dataset.type = itemType;
        
        // Store aspect ratio for images
        if (data.aspect_ratio) {
            item.dataset.aspectRatio = data.aspect_ratio;
        }
        
        // Apply rotation if it exists
        if (data.rotation && data.rotation !== 0) {
            item.style.transform = `rotate(${data.rotation}deg)`;
            item.dataset.rotation = data.rotation;
        }
        
        // Apply z-index if it exists
        if (data.z_index) {
            item.style.zIndex = data.z_index;
        }
        
        // Apply text styling for text items
        if (itemType === 'text') {
            if (data.font_family) item.style.fontFamily = data.font_family;
            if (data.font_size) item.style.fontSize = data.font_size + 'px';
            if (data.font_weight) item.style.fontWeight = data.font_weight;
            if (data.text_color) item.style.color = data.text_color;
            if (data.line_height) item.style.lineHeight = data.line_height;
            
            // Debug: log the final state of the text item
            console.log('Text item created with styles:', {
                width: item.style.width,
                height: item.style.height,
                fontSize: item.style.fontSize,
                fontFamily: item.style.fontFamily
            });
        }
        
        // Apply border radius as CSS variable
        const borderRadius = data.border_radius || 0;
        item.style.setProperty('--item-border-radius', borderRadius + 'px');
        
        // Add entrance animation for new items from other users
        if (data.fromRealtime) {
            item.style.opacity = '0';
            item.style.transform = item.style.transform + ' scale(0.8)';
            
            // Animate in
            requestAnimationFrame(() => {
                item.style.transition = 'opacity var(--transition-normal), transform var(--transition-normal)';
                item.style.opacity = '1';
                item.style.transform = item.style.transform.replace(' scale(0.8)', '');
                
                // Clean up transition after animation
                setTimeout(() => {
                    item.style.transition = '';
                }, 300);
            });
        }
    }
}

function updateItemFromData(item, data) {
    // Add animation class for smooth transitions
    item.classList.add('remote-update');
    
    // Store current values for comparison
    const currentLeft = parseFloat(item.style.left) || 0;
    const currentTop = parseFloat(item.style.top) || 0;
    const currentWidth = parseFloat(item.style.width) || 0;
    const currentHeight = parseFloat(item.style.height) || 0;
    const currentRotation = parseFloat(item.dataset.rotation) || 0;
    
    // Update position and dimensions
    item.style.left = data.x + 'px';
    item.style.top = data.y + 'px';
    
    // Apply width/height - for text items, only if explicitly set in database
    const itemType = data.item_type || data.type;
    if (itemType === 'text') {
        // For text items, apply width/height only if they exist in database (explicit sizing)
        if (data.width && data.width > 0) {
            item.style.width = data.width + 'px';
            item.style.minWidth = '';
            item.style.maxWidth = '';
        }
        if (data.height && data.height > 0) {
            item.style.height = data.height + 'px';
            item.style.minHeight = '';
            item.style.maxHeight = '';
        }
    } else {
        // For non-text items, apply dimensions normally
        if (data.width) item.style.width = data.width + 'px';
        if (data.height) item.style.height = data.height + 'px';
    }
    
    // Update rotation
    if (data.rotation && data.rotation !== 0) {
        item.style.transform = `rotate(${data.rotation}deg)`;
        item.dataset.rotation = data.rotation;
    } else {
        item.style.transform = '';
        item.dataset.rotation = '0';
    }
    
    // Update z-index
    if (data.z_index) {
        item.style.zIndex = data.z_index;
    }
    
    // Update content based on type
    switch (itemType) {
        case 'text':
            if (item.textContent !== data.content) {
                item.textContent = data.content;
            }
            // Update text styling properties
            if (data.font_family) item.style.fontFamily = data.font_family;
            if (data.font_size) item.style.fontSize = data.font_size + 'px';
            if (data.font_weight) item.style.fontWeight = data.font_weight;
            if (data.text_color) item.style.color = data.text_color;
            if (data.line_height) item.style.lineHeight = data.line_height;
            
            // Update text toolbar if this item is currently selected
            if (selectedTextItem === item && isAuthenticated) {
                showTextToolbar(item);
            }
            break;
        case 'image':
            const img = item.querySelector('img');
            if (img && img.src !== data.content) {
                img.src = data.content;
            }
            break;
        case 'code':
            const iframe = item.querySelector('iframe');
            if (iframe && iframe.srcdoc !== data.content) {
                iframe.srcdoc = data.content;
            }
            break;
        case 'drawing':
            const path = item.querySelector('path');
            if (path) {
                // Update path data
                if (path.getAttribute('d') !== data.content) {
                    path.setAttribute('d', data.content);
                }
                // Update stroke color
                if (data.stroke_color && path.getAttribute('stroke') !== data.stroke_color) {
                    path.setAttribute('stroke', data.stroke_color);
                }
                // Update stroke thickness
                if (data.stroke_thickness && path.getAttribute('stroke-width') !== data.stroke_thickness.toString()) {
                    path.setAttribute('stroke-width', data.stroke_thickness);
                }
            }
            
            // Update drawing toolbar if this item is currently selected
            if (selectedItem === item && isAuthenticated && item.classList.contains('drawing-item')) {
                showDrawToolbar();
                if (path) {
                    document.getElementById('strokeColor').value = path.getAttribute('stroke') || '#333333';
                    document.getElementById('strokeThickness').value = path.getAttribute('stroke-width') || '4';
                }
            }
            break;
    }
    
    // Show a subtle indicator for significant changes
    const positionChanged = Math.abs(data.x - currentLeft) > 5 || Math.abs(data.y - currentTop) > 5;
    const sizeChanged = Math.abs(data.width - currentWidth) > 5 || Math.abs(data.height - currentHeight) > 5;
    const rotationChanged = Math.abs(data.rotation - currentRotation) > 5;
    
    if (positionChanged || sizeChanged || rotationChanged) {
        // Add a brief highlight effect
        item.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.3)';
        setTimeout(() => {
            item.style.boxShadow = '';
        }, 500);
    }
    
    // Remove animation class after transition completes
    setTimeout(() => {
        item.classList.remove('remote-update');
    }, 300); // Match the transition duration
}

function getItemContent(item) {
    switch (item.dataset.type) {
        case 'image':
            return item.querySelector('img').src;
        case 'text':
            return item.textContent;
        case 'code':
            return item.querySelector('iframe').srcdoc;
        case 'drawing':
            return item.querySelector('path').getAttribute('d');
        default:
            return '';
    }
}

async function clearDatabase() {
    try {
        const { error } = await supabaseClient
            .from('canvas_items')
            .delete()
            .neq('id', '0'); // Delete all items
        
        if (error) throw error;
        console.log('Database cleared');
    } catch (error) {
        console.error('Error clearing database:', error);
    }
}

// Utility Functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showStatus(message) {
    // Simple status implementation
    console.log('Status:', message);
    
    // Only show status messages when authenticated as admin
    if (!isAuthenticated) {
        return;
    }
    
    // You could create a toast notification here
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        white-space: nowrap;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Keyboard shortcuts for login
document.addEventListener('keydown', function(e) {
    if (e.target.id === 'adminPassword' && e.key === 'Enter') {
        login();
    }
});

// Text Toolbar Functions
let textUpdateTimeout = null;

function showTextToolbar(textItem) {
    if (!isAuthenticated || !textItem.classList.contains('text-item')) return;
    
    // Populate toolbar with current text properties
    const fontFamily = textItem.style.fontFamily || 'Antarctica';
    const fontSize = parseInt(textItem.style.fontSize) || 24;
    const fontWeight = textItem.style.fontWeight || 'normal';
    const textColor = textItem.style.color || '#333333';
    const lineHeight = parseFloat(textItem.style.lineHeight) || 1.15;
    
    // Set font family - handle both quoted and unquoted values
    const cleanFontFamily = fontFamily.replace(/['"]/g, '');
    const fontFamilySelect = document.getElementById('fontFamily');
    
    // Check if current font family exists in dropdown options
    let foundMatch = false;
    for (let option of fontFamilySelect.options) {
        if (option.value === cleanFontFamily) {
            fontFamilySelect.value = cleanFontFamily;
            foundMatch = true;
            break;
        }
    }
    
    // If no match found, add current font family as first option and select it
    if (!foundMatch) {
        const newOption = document.createElement('option');
        newOption.value = cleanFontFamily;
        newOption.textContent = cleanFontFamily;
        fontFamilySelect.insertBefore(newOption, fontFamilySelect.firstChild);
        fontFamilySelect.value = cleanFontFamily;
    }
    
    document.getElementById('fontSize').value = fontSize;
    
    // Set font weight - convert text values to numeric
    const numericWeight = convertFontWeightToNumeric(fontWeight);
    document.getElementById('fontWeight').value = numericWeight;
    
    document.getElementById('textColor').value = rgbToHex(textColor);
    document.getElementById('lineHeight').value = lineHeight;
    
    // Show toolbar
    textToolbar.classList.remove('hidden');
}

function debouncedSaveTextItem() {
    if (textUpdateTimeout) {
        clearTimeout(textUpdateTimeout);
    }
    textUpdateTimeout = setTimeout(() => {
        if (selectedTextItem) {
            saveItemToDatabase(selectedTextItem);
        }
    }, 300);
}

function hideTextToolbar() {
    textToolbar.classList.add('hidden');
}

function bindTextToolbarEvents() {
    // Font family change
    document.getElementById('fontFamily').addEventListener('change', (e) => {
        if (selectedTextItem) {
            selectedTextItem.style.fontFamily = e.target.value;
            saveItemToDatabase(selectedTextItem);
        }
    });
    
    // Font size change
    document.getElementById('fontSize').addEventListener('input', (e) => {
        if (selectedTextItem) {
            selectedTextItem.style.fontSize = e.target.value + 'px';
            debouncedSaveTextItem();
        }
    });
    
    // Font weight change
    document.getElementById('fontWeight').addEventListener('change', (e) => {
        if (selectedTextItem) {
            selectedTextItem.style.fontWeight = e.target.value;
            saveItemToDatabase(selectedTextItem);
        }
    });
    
    // Text color change
    document.getElementById('textColor').addEventListener('input', (e) => {
        if (selectedTextItem) {
            selectedTextItem.style.color = e.target.value;
            saveItemToDatabase(selectedTextItem);
        }
    });
    
    // Line height change
    document.getElementById('lineHeight').addEventListener('input', (e) => {
        if (selectedTextItem) {
            selectedTextItem.style.lineHeight = e.target.value;
            debouncedSaveTextItem();
        }
    });
}

// Drawing toolbar debounced save
let drawingUpdateTimeout = null;

function debouncedSaveDrawingItem() {
    if (drawingUpdateTimeout) {
        clearTimeout(drawingUpdateTimeout);
    }
    drawingUpdateTimeout = setTimeout(() => {
        if (selectedItem && selectedItem.dataset.type === 'drawing') {
            saveItemToDatabase(selectedItem);
        }
    }, 300);
}

function bindDrawToolbarEvents() {
    // Stroke color change
    document.getElementById('strokeColor').addEventListener('input', (e) => {
        if (selectedItem && selectedItem.dataset.type === 'drawing') {
            const path = selectedItem.querySelector('path');
            if (path) {
                path.setAttribute('stroke', e.target.value);
                debouncedSaveDrawingItem();
            }
        }
    });
    
    // Stroke thickness change
    document.getElementById('strokeThickness').addEventListener('input', (e) => {
        if (selectedItem && selectedItem.dataset.type === 'drawing') {
            const path = selectedItem.querySelector('path');
            if (path) {
                path.setAttribute('stroke-width', e.target.value);
                debouncedSaveDrawingItem();
            }
        }
    });
}

// Utility function to convert rgb color to hex
function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '#333333';
    
    return '#' + result.slice(0, 3).map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Utility function to convert font weight to numeric values
function convertFontWeightToNumeric(weight) {
    const weightMap = {
        'normal': '400',
        'bold': '700',
        'lighter': '300',
        'bolder': '700',
        'thin': '100',
        'light': '300',
        'medium': '500',
        'semi-bold': '600',
        'extra-bold': '800',
        'black': '900'
    };
    
    // If it's already numeric, return as string
    if (!isNaN(weight)) {
        return weight.toString();
    }
    
    // Convert text values to numeric
    return weightMap[weight.toLowerCase()] || '400';
}

// Smooth animation functions for move buttons
function showMoveButtons() {
    const bringToFrontBtn = document.getElementById('bringToFrontBtn');
    const sendToBackBtn = document.getElementById('sendToBackBtn');
    
    // Remove hidden class to start animation
    bringToFrontBtn.classList.remove('hidden');
    sendToBackBtn.classList.remove('hidden');
}

function hideMoveButtons() {
    const bringToFrontBtn = document.getElementById('bringToFrontBtn');
    const sendToBackBtn = document.getElementById('sendToBackBtn');
    
    // Add hidden class to trigger animation
    bringToFrontBtn.classList.add('hidden');
    sendToBackBtn.classList.add('hidden');
}