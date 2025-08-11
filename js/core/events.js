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

// Touch performance optimization
let touchUpdateFrame = null;
let pendingTouchUpdate = null;
let lastTouchUpdateTime = 0;
const TOUCH_THROTTLE_INTERVAL = 16; // 60fps throttling

// Selection box variables
let selectionBox = null;
let selectionBoxStart = { x: 0, y: 0 };
let isSelecting = false;

function bindEvents() {
    // Mouse events
    container.addEventListener('mousedown', handleMouseDown, { passive: true });
    document.addEventListener('mousemove', handleMouseMoveRaf, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    // Touch events for mobile/tablet with optimized passive settings
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMoveThrottled, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // File input
    document.getElementById('fileInput').addEventListener('change', CreatorsModule.handleFileSelect);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent context menu
    container.addEventListener('contextmenu', e => e.preventDefault());
}

function handleMouseDown(e) {
    // Check for center setting first - allow clicking anywhere on canvas including items
    if (isSettingCenter) {
        const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
        setCenterPoint(canvasPos.x, canvasPos.y);
        return;
    }
    
    if (e.target === container || e.target === canvas) {
        
        if (isDrawMode && isAuthenticated) {
            // Start drawing
            isDrawing = true;
            const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
            drawingPath = [{ x: canvasPos.x, y: canvasPos.y }];
            DrawingModule.createDrawingPreview();
            ItemsModule.clearSelection();
            return;
        }
        
        // Check if admin wants to start selection box (not holding cmd/ctrl)
        if (isAuthenticated && !e.metaKey && !e.ctrlKey) {
            // Stop any ongoing inertia animation
            stopInertiaAnimation();
            
            // Start selection box
            isSelecting = true;
            const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
            selectionBoxStart = { x: canvasPos.x, y: canvasPos.y };
            createSelectionBox(canvasPos.x, canvasPos.y);
            
            // Clear existing selection unless holding shift
            if (!e.shiftKey) {
                ItemsModule.clearSelection();
            }
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
            // Handle resize and rotation handles first - they take precedence
            if (e.target.closest('.resize-handle') || e.target.closest('.rotation-handle')) {
                // Only clear selection if clicking on a different item
                if (selectedItem !== item) {
                    ItemsModule.clearSelection();
                }
                ItemsModule.selectItem(item);
                return;
            }
            
            // If in drawing mode and clicking on canvas item (not handles), start drawing
            if (isDrawMode) {
                isDrawing = true;
                const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
                drawingPath = [{ x: canvasPos.x, y: canvasPos.y }];
                DrawingModule.createDrawingPreview();
                ItemsModule.clearSelection();
                return;
            }
            
            // Normal item interaction (selection and dragging)
            // Handle multi-select with cmd/ctrl key
            if (e.metaKey || e.ctrlKey) {
                // Toggle selection
                if (selectedItems.includes(item)) {
                    // Remove from selection
                    const index = selectedItems.indexOf(item);
                    selectedItems.splice(index, 1);
                    item.classList.remove('selected');
                    if (selectedItem === item) {
                        selectedItem = selectedItems[0] || null;
                    }
                } else {
                    // Add to selection
                    ItemsModule.selectItem(item, true);
                }
                return;
            }
            
            // If item is already part of a multi-selection, start group drag without altering selection
            const domSelectedItems = Array.from(document.querySelectorAll('.canvas-item.selected'));
            if ((selectedItems?.length || 0) > 1 || domSelectedItems.length > 1) {
                // Only start group drag if the clicked item is part of the selected set
                if (selectedItems.includes(item) || item.classList.contains('selected')) {
                    ItemsModule.startDragging(e, item);
                    return;
                }
            }
            
            // If holding shift, add to selection (do not clear)
            if (e.shiftKey) {
                ItemsModule.selectItem(item, true);
                ItemsModule.startDragging(e, item);
                return;
            }
            
            // Default behavior: select single item (clear others if different)
            if (selectedItem !== item) {
                ItemsModule.clearSelection();
            }
            ItemsModule.selectItem(item);
            ItemsModule.startDragging(e, item);
        }
    }
}

// rAF-throttled mousemove
let lastMouseMoveEvent = null;
let mouseMoveScheduled = false;

function handleMouseMove(e) {
    if (isDrawing) {
        const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
        drawingPath.push({ x: canvasPos.x, y: canvasPos.y });
        DrawingModule.updateDrawingPreview();
        // Don't update transform while drawing
        return;
    } else if (isSelecting) {
        const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
        updateSelectionBox(canvasPos.x, canvasPos.y);
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

function handleMouseMoveRaf(e) {
    lastMouseMoveEvent = e;
    if (mouseMoveScheduled) return;
    mouseMoveScheduled = true;
    requestAnimationFrame(() => {
        mouseMoveScheduled = false;
        if (!lastMouseMoveEvent) return;
        const evt = lastMouseMoveEvent;
        lastMouseMoveEvent = null;
        handleMouseMove(evt);
    });
}

function handleMouseUp(e) {
    if (isSelecting) {
        isSelecting = false;
        const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
        
        // Select items in the box
        const box = {
            startX: selectionBoxStart.x,
            startY: selectionBoxStart.y,
            endX: canvasPos.x,
            endY: canvasPos.y
        };
        ItemsModule.selectItemsInBox(box);
        
        // Remove selection box
        removeSelectionBox();
        return;
    }
    
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
        // Check for center setting first - allow touching anywhere on canvas including items
        if (isSettingCenter) {
            e.preventDefault();
            const touch = e.touches[0];
            const canvasPos = ViewportModule.screenToCanvas(touch.clientX, touch.clientY);
            setCenterPoint(canvasPos.x, canvasPos.y);
            return;
        }
        
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
        // If tapping the code play overlay, do not start panning to allow tap to toggle interactivity
        const codeOverlay = element?.closest('.code-interaction-overlay');
        if (codeOverlay) {
            isSingleTouchPanning = false;
            return;
        }
        const canvasItem = element?.closest('.canvas-item');
        
        if (canvasItem && !isSettingCenter) {
            // Only select items for admins; guests should continue panning
            if (isAuthenticated) {
                ItemsModule.selectItem(canvasItem);
                isSingleTouchPanning = false;
            }
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

// Throttled touch move handler for 60fps performance
function handleTouchMoveThrottled(e) {
    // Store the latest touch event
    pendingTouchUpdate = e;
    
    // Only process if enough time has passed
    const now = performance.now();
    if (now - lastTouchUpdateTime >= TOUCH_THROTTLE_INTERVAL) {
        processTouchMove();
    } else if (!touchUpdateFrame) {
        // Schedule next update
        touchUpdateFrame = requestAnimationFrame(() => {
            processTouchMove();
            touchUpdateFrame = null;
        });
    }
}

function processTouchMove() {
    if (!pendingTouchUpdate) return;
    
    const e = pendingTouchUpdate;
    lastTouchUpdateTime = performance.now();
    
    handleTouchMove(e);
    pendingTouchUpdate = null;
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
        
        // Use throttled canvas transform update
        scheduleCanvasTransformUpdate();
        
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
            
            // Use throttled canvas transform update
            scheduleCanvasTransformUpdate();
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
        if (selectedItems.length > 1) {
            ItemsModule.deleteSelectedItems();
        } else if (selectedItem) {
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

// Throttled canvas transform updates for smooth 60fps performance
let canvasTransformUpdateFrame = null;
let pendingCanvasTransformUpdate = false;

function scheduleCanvasTransformUpdate() {
    if (canvasTransformUpdateFrame) return; // Already scheduled
    
    canvasTransformUpdateFrame = requestAnimationFrame(() => {
        if (ViewportModule?.updateCanvasTransform) {
            ViewportModule.updateCanvasTransform();
        }
        canvasTransformUpdateFrame = null;
        pendingCanvasTransformUpdate = false;
    });
    pendingCanvasTransformUpdate = true;
}

// Selection box functions
function createSelectionBox(startX, startY) {
    removeSelectionBox(); // Remove any existing box
    
    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.position = 'absolute';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.border = '2px dashed #007acc';
    selectionBox.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.zIndex = '10000';
    
    canvas.appendChild(selectionBox);
}

function updateSelectionBox(currentX, currentY) {
    if (!selectionBox) return;
    
    const left = Math.min(selectionBoxStart.x, currentX);
    const top = Math.min(selectionBoxStart.y, currentY);
    const width = Math.abs(currentX - selectionBoxStart.x);
    const height = Math.abs(currentY - selectionBoxStart.y);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
}

function removeSelectionBox() {
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
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
    handleTouchMoveThrottled,
    handleTouchEnd,
    handleKeyDown,
    startInertiaAnimation,
    stopInertiaAnimation,
    scheduleCanvasTransformUpdate
};