// Supabase Configuration
const SUPABASE_URL = 'https://ruefemuqeehlqieitoma.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZWZlbXVxZWVobHFpZWl0b21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzc5ODQsImV4cCI6MjA2OTc1Mzk4NH0.Bl3Af45EF-RINH_MD5AcZITNbk4wj79cm3Znsbrpb9k';
const ADMIN_PASSWORD = 'canvas123';

// Initialize Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Global State
let isAuthenticated = false;
let canvas, container, toolbar;
let selectedItem = null;
let canvasTransform = { x: -9500, y: -9500, scale: 1 }; // Start centered in 20000x20000 canvas
let centerPoint = { x: 10000, y: 10000 }; // Default center
let isSettingCenter = false;
let isDragging = false;
let isPanning = false;
let isResizing = false;
let dragStart = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };

// Item counter for unique IDs
let itemCounter = 0;

// Real-time subscription
let realtimeChannel = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('canvas');
    container = document.getElementById('canvasContainer');
    toolbar = document.getElementById('toolbar');
    
    checkAuth();
    bindEvents();
});

// Authentication
function checkAuth() {
    const auth = localStorage.getItem('canvas_admin_auth');
    if (auth === 'true') {
        showCanvas();
    } else {
        showLogin();
    }
}

function login() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        isAuthenticated = true;
        localStorage.setItem('canvas_admin_auth', 'true');
        showCanvas();
    } else {
        alert('Invalid password');
    }
}

function logout() {
    isAuthenticated = false;
    localStorage.removeItem('canvas_admin_auth');
    
    // Clean up real-time subscription
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    
    location.reload();
}

function showLogin() {
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('canvasContainer').classList.add('hidden');
    document.getElementById('toolbar').classList.add('hidden');
}

function showCanvas() {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('canvasContainer').classList.remove('hidden');
    document.getElementById('toolbar').classList.remove('hidden');
    
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
        
        // Start panning
        isPanning = true;
        container.classList.add('panning');
        dragStart = { x: e.clientX, y: e.clientY };
        clearSelection();
    } else if (e.target.closest('.canvas-item')) {
        const item = e.target.closest('.canvas-item');
        selectItem(item);
        
        if (!e.target.closest('.resize-handle')) {
            startDragging(e, item);
        }
    }
}

function handleMouseMove(e) {
    if (isPanning) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        canvasTransform.x += deltaX;
        canvasTransform.y += deltaY;
        updateCanvasTransform();
        dragStart = { x: e.clientX, y: e.clientY };
    } else if (isDragging && selectedItem && !isResizing) {
        dragItem(e);
    }
    
    lastMousePos = { x: e.clientX, y: e.clientY };
}

function handleMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        container.classList.remove('panning');
        canvas.classList.remove('dragging');
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
        
        const touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        touchStartTransform = { ...canvasTransform };
        isSingleTouchPanning = true;
        
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
        isSingleTouchPanning = false;
    } else if (e.touches.length === 1) {
        // Went from multi-touch to single touch
        touchStartDistance = 0;
        touchStartCenter = { x: 0, y: 0 };
    }
}

function handleKeyDown(e) {
    if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Don't interfere with text editing
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
    }
}

// Item Management
function selectItem(item) {
    clearSelection();
    selectedItem = item;
    item.classList.add('selected');
    showResizeHandles(item);
}

function clearSelection() {
    if (selectedItem) {
        selectedItem.classList.remove('selected');
        hideResizeHandles();
        selectedItem = null;
    }
}

function showResizeHandles(item) {
    hideResizeHandles();
    
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    handles.id = 'resizeHandles';
    
    // Add resize handles
    const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
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
        saveItemToDatabase(selectedItem);
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
    
    // Get current item dimensions in canvas coordinates
    const startWidth = parseFloat(selectedItem.style.width) || itemRect.width / canvasTransform.scale;
    const startHeight = parseFloat(selectedItem.style.height) || itemRect.height / canvasTransform.scale;
    const startLeft = parseFloat(selectedItem.style.left);
    const startTop = parseFloat(selectedItem.style.top);
    
    // For images, maintain aspect ratio
    const isImage = selectedItem.classList.contains('image-item');
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
        } else {
            // For non-images (text, code), allow free resizing
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
    
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
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
    createTextItem('Click to edit text...', centerPoint.x, centerPoint.y);
}

function createTextItem(content = 'Click to edit text...', x = centerPoint.x, y = centerPoint.y, fromDatabase = false) {
    const item = document.createElement('div');
    item.className = 'canvas-item text-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.contentEditable = true;
    item.textContent = content;
    
    // Set default text styling
    item.style.fontFamily = 'Sans-serif';
    item.style.fontSize = '24px';
    item.style.fontWeight = 'normal';
    item.style.color = '#333333';
    item.style.lineHeight = '1.15';
    item.style.minWidth = '100px';
    item.style.minHeight = '30px';
    item.style.padding = '8px';
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
    }
    item.dataset.type = 'text';
    
    // Handle text editing
    item.addEventListener('focus', () => item.classList.add('editing'));
    item.addEventListener('blur', () => {
        item.classList.remove('editing');
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
    
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
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

function deleteItem(item) {
    if (confirm('Delete this item?')) {
        deleteItemFromDatabase(item);
        item.remove();
        clearSelection();
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

// Z-Index Management
function bringToFront() {
    if (selectedItem) {
        // Get all canvas items
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        
        // Find current z-index of selected item
        const currentZIndex = parseInt(selectedItem.style.zIndex) || 1;
        
        // Find the highest z-index among all items
        const maxZIndex = Math.max(...items.map(item => parseInt(item.style.zIndex) || 1));
        
        // Set selected item to front
        selectedItem.style.zIndex = maxZIndex + 1;
        
        // Update database with new z-index
        saveItemToDatabase(selectedItem);
        
        showStatus('Brought to front');
    } else {
        showStatus('Please select an item first');
    }
}

function sendToBack() {
    if (selectedItem) {
        // Get all canvas items
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        
        // Find the lowest z-index among all items
        const minZIndex = Math.min(...items.map(item => parseInt(item.style.zIndex) || 1));
        
        // Set selected item to back
        selectedItem.style.zIndex = minZIndex - 1;
        
        // Update database with new z-index
        saveItemToDatabase(selectedItem);
        
        showStatus('Sent to back');
    } else {
        showStatus('Please select an item first');
    }
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
        createItemFromData(payload.new);
        showStatus('New item added by another user');
    } else {
        console.log('Ignoring duplicate real-time insert for existing item:', payload.new.id);
    }
}

function handleRealtimeUpdate(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.new.id}"]`);
    if (existingItem && existingItem !== selectedItem) {
        updateItemFromData(existingItem, payload.new);
        showStatus('Item updated by another user');
    }
}

function handleRealtimeDelete(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.old.id}"]`);
    if (existingItem && existingItem !== selectedItem) {
        existingItem.remove();
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
    const itemData = {
        id: parseInt(item.dataset.id),
        x: parseFloat(item.style.left) || 0,
        y: parseFloat(item.style.top) || 0,
        item_type: item.dataset.type,
        content: getItemContent(item),
        user_id: 'admin', // Set user ID - you can customize this
        width: parseFloat(item.style.width) || 100,
        height: parseFloat(item.style.height) || 100,
        original_width: parseFloat(item.style.width) || 100,
        original_height: parseFloat(item.style.height) || 100,
        aspect_ratio: parseFloat(item.dataset.aspectRatio) || 1,
        rotation: parseFloat(item.dataset.rotation) || 0,
        z_index: parseInt(item.style.zIndex) || 1,
        border_radius: parseFloat(item.style.getPropertyValue('--item-border-radius')) || 0,
        font_family: item.style.fontFamily || 'Sans-serif',
        font_size: parseInt(item.style.fontSize) || 24,
        font_weight: item.style.fontWeight || 'normal',
        text_color: item.style.color || '#333333',
        line_height: parseFloat(item.style.lineHeight) || 1.15,
        html_content: item.dataset.type === 'code' ? getItemContent(item) : null
    };
    
    try {
        const { error } = await supabaseClient
            .from('canvas_items')
            .upsert(itemData);
        
        if (error) throw error;
        console.log('Item saved:', itemData);
    } catch (error) {
        console.error('Error saving item:', error);
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
    
    switch (itemType) {
        case 'image':
            item = createImageItem(data.content, data.x, data.y, data.width, data.height, true);
            break;
        case 'text':
            item = createTextItem(data.content, data.x, data.y, true);
            break;
        case 'code':
            // Use html_content if available, fallback to content
            const codeContent = data.html_content || data.content;
            item = createCodeItem(codeContent, data.x, data.y, data.width, data.height, true);
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
        }
        
        // Apply border radius as CSS variable
        const borderRadius = data.border_radius || 0;
        item.style.setProperty('--item-border-radius', borderRadius + 'px');
    }
}

function updateItemFromData(item, data) {
    // Update position and dimensions
    item.style.left = data.x + 'px';
    item.style.top = data.y + 'px';
    
    if (data.width) item.style.width = data.width + 'px';
    if (data.height) item.style.height = data.height + 'px';
    
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
    const itemType = data.item_type || data.type;
    switch (itemType) {
        case 'text':
            if (item.textContent !== data.content) {
                item.textContent = data.content;
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
    }
}

function getItemContent(item) {
    switch (item.dataset.type) {
        case 'image':
            return item.querySelector('img').src;
        case 'text':
            return item.textContent;
        case 'code':
            return item.querySelector('iframe').srcdoc;
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
    
    // You could create a toast notification here
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
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