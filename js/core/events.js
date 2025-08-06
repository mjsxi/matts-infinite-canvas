// Event handling module
// Handles mouse, touch, keyboard interactions and gesture recognition

// Touch gesture support
let touchStartDistance = 0;
let touchStartCenter = { x: 0, y: 0 };
let touchStartTransform = { x: 0, y: 0, scale: 1 };
let touchStartPos = { x: 0, y: 0 };
let isSingleTouchPanning = false;

// Inertia scrolling variables
let panPositions = [];
let lastPanTime = 0;
let inertiaAnimationId = null;
const MAX_PAN_POSITIONS = 5; // Limit array growth

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
    document.getElementById('fileInput').addEventListener('change', CreatorsModule.handleFileSelect);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent context menu
    container.addEventListener('contextmenu', e => e.preventDefault());
}

function handleMouseDown(e) {
    if (e.target === container || e.target === canvas) {
        if (isSettingCenter) {
            const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
            setCenterPoint(canvasPos.x, canvasPos.y);
            return;
        }
        
        if (isDrawMode && isAuthenticated) {
            // Start drawing
            isDrawing = true;
            const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
            drawingPath = [{ x: canvasPos.x, y: canvasPos.y }];
            DrawingModule.createDrawingPreview();
            ItemsModule.clearSelection();
            return;
        }
        
        // Stop any ongoing inertia animation
        stopInertiaAnimation();
        
        // Start panning
        isPanning = true;
        container.classList.add('panning');
        dragStart = { x: e.clientX, y: e.clientY };
        lastPanTime = Date.now();
        ItemsModule.clearSelection();
    } else if (e.target.closest('.canvas-item')) {
        const item = e.target.closest('.canvas-item');
        
        // Only allow item interaction for authenticated admin users
        if (isAuthenticated) {
            // Only clear selection if clicking on a different item
            if (selectedItem !== item) {
                ItemsModule.clearSelection();
            }
            
            ItemsModule.selectItem(item);
            
            // Don't start dragging if clicking on resize handles or rotation handle
            if (!e.target.closest('.resize-handle') && !e.target.closest('.rotation-handle')) {
                ItemsModule.startDragging(e, item);
            }
        }
    }
}

function handleMouseMove(e) {
    if (isDrawing) {
        const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
        drawingPath.push({ x: canvasPos.x, y: canvasPos.y });
        DrawingModule.updateDrawingPreview();
        // Don't update transform while drawing
        return;
    } else if (isPanning) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        canvasTransform.x += deltaX;
        canvasTransform.y += deltaY;
        ViewportModule.updateCanvasTransform();
        
        // Track panning velocity for inertia
        const now = Date.now();
        const timeDelta = now - lastPanTime;
        if (timeDelta > 0) {
            panVelocity.x = deltaX / timeDelta;
            panVelocity.y = deltaY / timeDelta;
        }
        lastPanTime = now;
        
        // Store position for velocity calculation (optimized)
        panPositions.push({ x: e.clientX, y: e.clientY, time: now });
        if (panPositions.length > MAX_PAN_POSITIONS) {
            panPositions.shift();
        }
        
        dragStart = { x: e.clientX, y: e.clientY };
    } else if (isDragging && selectedItem && !isResizing) {
        ItemsModule.dragItem(e);
    }
    // Note: Resize and rotation are handled by their own event listeners in the ItemsModule
    
    lastMousePos = { x: e.clientX, y: e.clientY };
}

function handleMouseUp(e) {
    if (isDrawing) {
        isDrawing = false;
        
        if (drawingPath.length > 1) {
            // Create the drawing item
            const strokeColor = document.getElementById('strokeColor').value;
            const strokeThickness = parseFloat(document.getElementById('strokeThickness').value);
            
            // Calculate bounding box
            const minX = Math.min(...drawingPath.map(p => p.x));
            const maxX = Math.max(...drawingPath.map(p => p.x));
            const minY = Math.min(...drawingPath.map(p => p.y));
            const maxY = Math.max(...drawingPath.map(p => p.y));
            
            // Create path data with original coordinates
            let pathData = `M ${drawingPath[0].x} ${drawingPath[0].y}`;
            for (let i = 1; i < drawingPath.length; i++) {
                pathData += ` L ${drawingPath[i].x} ${drawingPath[i].y}`;
            }
            
            // Keep the drawing at its original size with padding for stroke
            const padding = Math.max(10, strokeThickness);
            const containerWidth = (maxX - minX) + (padding * 2);
            const containerHeight = (maxY - minY) + (padding * 2);
            
            DrawingModule.createDrawingItem(pathData, strokeColor, strokeThickness, minX - padding, minY - padding, containerWidth, containerHeight);
        }
        
        // Clean up
        DrawingModule.removeDrawingPreview();
        drawingPath = [];
        return;
    }
    
    if (isPanning) {
        isPanning = false;
        container.classList.remove('panning');
        canvas.classList.remove('dragging');
        
        // Calculate velocity for inertia scrolling
        if (panPositions.length >= 2) {
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
        
        panPositions = [];
    }
    
    if (isDragging) {
        ItemsModule.stopDragging();
    }
    
    if (isResizing) {
        isResizing = false;
        canvas.classList.remove('resizing');
        if (selectedItem) {
            DatabaseModule.debouncedSaveItem(selectedItem);
        }
    }
}

function handleWheel(e) {
    e.preventDefault();
    
    const rect = ViewportModule.getContainerRect();
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
    
    ViewportModule.updateCanvasTransform();
}

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
            ItemsModule.selectItem(canvasItem);
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
        
        ViewportModule.updateCanvasTransform();
        
        // Track velocity for touch inertia
        const now = Date.now();
        const timeDelta = now - lastPanTime;
        if (timeDelta > 0) {
            panVelocity.x = deltaX / timeDelta;
            panVelocity.y = deltaY / timeDelta;
        }
        lastPanTime = now;
        
        // Store position for velocity calculation (optimized)
        panPositions.push({ x: touch.clientX, y: touch.clientY, time: now });
        if (panPositions.length > MAX_PAN_POSITIONS) {
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
            
            // Calculate position change
            const rect = ViewportModule.getContainerRect();
            const centerX = currentCenter.x - rect.left;
            const centerY = currentCenter.y - rect.top;
            
            const scaleRatio = newScale / touchStartTransform.scale;
            canvasTransform.x = centerX - (centerX - touchStartTransform.x) * scaleRatio;
            canvasTransform.y = centerY - (centerY - touchStartTransform.y) * scaleRatio;
            canvasTransform.scale = newScale;
            
            ViewportModule.updateCanvasTransform();
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
            ItemsModule.deleteItem(selectedItem);
        }
    } else if (e.key === 'Escape') {
        if (isSettingCenter) {
            AdminModule.cancelSetCenter();
        } else {
            ItemsModule.clearSelection();
        }
    } else if (e.key === 'z' && e.ctrlKey) {
        // Ctrl+Z to manually sync z-indexes to database
        e.preventDefault();
        ItemsModule.syncZIndexesToDatabase();
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
        ViewportModule.updateCanvasTransform();
        
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

function stopInertiaAnimation() {
    if (inertiaAnimationId) {
        cancelAnimationFrame(inertiaAnimationId);
        inertiaAnimationId = null;
    }
    panVelocity = { x: 0, y: 0 };
}

// Export module
window.EventsModule = {
    bindEvents,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleKeyDown,
    startInertiaAnimation,
    stopInertiaAnimation
};