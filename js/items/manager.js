// Item management module
// Handles item selection, manipulation, dragging, resizing

// Cache for resize handles to avoid recreation
let cachedResizeHandles = null;
let lastSelectedItemId = null;

function selectItem(item) {
    // Removed console.log for performance
    clearSelection();
    selectedItem = item;
    item.classList.add('selected');
    
    // Ensure dragging class is removed when selecting an item
    if (item.classList.contains('dragging')) {
        item.classList.remove('dragging');
    }
    
    // Removed console.log for performance
    showResizeHandles(item);
    
    // Disable draw mode when selecting any item
    if (isDrawMode) {
        isDrawMode = false;
        const drawBtn = document.getElementById('drawBtn');
        drawBtn.style.backgroundColor = '';
        container.style.cursor = '';
        DrawingModule.removeDrawingPreview();
        // Draw mode disabled when item selected
    }
    
    // Show move up/down buttons when item is selected (admin only)
    if (isAuthenticated) {
        ToolbarModule.showMoveButtons();
    }
    
    // Show text toolbar if this is a text item and user is admin
    if (item.classList.contains('text-item') && isAuthenticated) {
        selectedTextItem = item;
        ToolbarModule.showTextToolbar(item);
    }
    
    // Show draw toolbar if this is a drawing item and user is admin
    if (item.classList.contains('drawing-item') && isAuthenticated) {
        ToolbarModule.showDrawToolbar();
        // Update toolbar controls with current drawing values
        const path = item.querySelector('path');
        if (path) {
            document.getElementById('strokeColor').value = path.getAttribute('stroke') || '#333333';
            document.getElementById('strokeThickness').value = path.getAttribute('stroke-width') || '4';
        }
    }
    
    // Item selection complete
}

function clearSelection() {
    // Removed console.log for performance
    if (selectedItem) {
        selectedItem.classList.remove('selected');
        
        // Reset interactive state for code items when deselected
        if (selectedItem.classList.contains('code-item')) {
            selectedItem.classList.remove('interactive');
        }
        
        // Reset text items to non-editing mode when deselected
        if (selectedItem.classList.contains('text-item')) {
            // Save the text item before clearing selection
            DatabaseModule.saveItemToDatabase(selectedItem);
            
            selectedItem.classList.remove('editing');
            selectedItem.contentEditable = false;
            selectedItem.blur();
            // Text item blur called
            
            // Show resize handles if they were hidden
            const resizeHandles = selectedItem.querySelector('.resize-handles');
            if (resizeHandles) {
                resizeHandles.style.display = '';
            }
        }
        
        hideResizeHandles();
        selectedItem = null;
    }
    
    // Hide move up/down buttons when no item is selected
    ToolbarModule.hideMoveButtons();
    
    // Hide text toolbar
    ToolbarModule.hideTextToolbar();
    selectedTextItem = null;
    
    // Hide draw toolbar
    ToolbarModule.hideDrawToolbar();
    
    // Selection cleared
}

function showResizeHandles(item) {
    hideResizeHandles();
    
    // Only show resize handles for authenticated admin users
    if (!isAuthenticated) {
        return;
    }
    
    const itemId = item.dataset.id;
    
    // Reuse handles if same item to improve performance
    if (cachedResizeHandles && lastSelectedItemId === itemId) {
        item.appendChild(cachedResizeHandles);
        return;
    }
    
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    handles.id = 'resizeHandles';
    
    // For drawing items, only show corner handles for aspect ratio resizing
    const isDrawingItem = item.classList.contains('drawing-item');
    const positions = isDrawingItem ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
    
    // Use document fragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();
    
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.addEventListener('mousedown', (e) => startResize(e, pos), { passive: false });
        fragment.appendChild(handle);
    });
    
    // Add rotation handle
    const rotationHandle = document.createElement('div');
    rotationHandle.className = 'rotation-handle';
    rotationHandle.addEventListener('mousedown', (e) => startRotation(e), { passive: false });
    fragment.appendChild(rotationHandle);
    
    handles.appendChild(fragment);
    item.appendChild(handles);
    
    // Cache for reuse
    cachedResizeHandles = handles;
    lastSelectedItemId = itemId;
}

function hideResizeHandles() {
    const existing = document.getElementById('resizeHandles');
    if (existing) {
        existing.remove();
    }
    // Clear cache when hiding
    cachedResizeHandles = null;
    lastSelectedItemId = null;
}

function startDragging(e, item) {
    isDragging = true;
    item.classList.add('dragging');
    canvas.classList.add('dragging');
    
    const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
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
    
    const canvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
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
            DatabaseModule.saveItemToDatabase(selectedItem);
        }, 50);
        
        delete selectedItem.dragOffset;
    }
}

function deleteItem(item) {
    if (confirm('Delete this item?')) {
        DatabaseModule.deleteItemFromDatabase(item);
        item.remove();
        clearSelection();
        // Normalize z-indexes after deletion
        normalizeZIndexes();
    }
}

function startResize(e, direction) {
    e.stopPropagation();
    e.preventDefault();
    
    if (!selectedItem) {
        return;
    }
    
    isResizing = true;
    canvas.classList.add('resizing');
    
    // Store initial dimensions and position
    const initialWidth = parseFloat(selectedItem.style.width) || selectedItem.offsetWidth;
    const initialHeight = parseFloat(selectedItem.style.height) || selectedItem.offsetHeight;
    const initialLeft = parseFloat(selectedItem.style.left) || 0;
    const initialTop = parseFloat(selectedItem.style.top) || 0;
    
    // Store initial mouse position
    const startX = e.clientX;
    const startY = e.clientY;
    
    // Create resize function
    const handleResize = (e) => {
        if (!isResizing || !selectedItem) return;
        
        // Convert mouse movement to canvas coordinates
        const startCanvasPos = ViewportModule.screenToCanvas(startX, startY);
        const currentCanvasPos = ViewportModule.screenToCanvas(e.clientX, e.clientY);
        const deltaX = currentCanvasPos.x - startCanvasPos.x;
        const deltaY = currentCanvasPos.y - startCanvasPos.y;
        
        let newWidth = initialWidth;
        let newHeight = initialHeight;
        let newLeft = initialLeft;
        let newTop = initialTop;
        
        // Get current aspect ratio
        const currentAspectRatio = parseFloat(selectedItem.dataset.aspectRatio) || (initialWidth / initialHeight);
        const isImage = selectedItem.dataset.type === 'image';
        const isVideo = selectedItem.dataset.type === 'video';
        const shouldMaintainAspectRatio = isImage || isVideo || e.shiftKey;
        
        // Calculate new dimensions based on direction
        if (direction.includes('e')) {
            newWidth = Math.max(50, initialWidth + deltaX);
        }
        if (direction.includes('w')) {
            newWidth = Math.max(50, initialWidth - deltaX);
            newLeft = initialLeft + deltaX;
        }
        if (direction.includes('s')) {
            newHeight = Math.max(50, initialHeight + deltaY);
        }
        if (direction.includes('n')) {
            newHeight = Math.max(50, initialHeight - deltaY);
            newTop = initialTop + deltaY;
        }
        
        // Maintain aspect ratio if needed
        if (shouldMaintainAspectRatio) {
            if (direction.includes('e') || direction.includes('w')) {
                // Width changed, adjust height
                newHeight = newWidth / currentAspectRatio;
                if (direction.includes('n')) {
                    newTop = initialTop + (initialHeight - newHeight);
                }
            } else if (direction.includes('s') || direction.includes('n')) {
                // Height changed, adjust width
                newWidth = newHeight * currentAspectRatio;
                if (direction.includes('w')) {
                    newLeft = initialLeft + (initialWidth - newWidth);
                }
            }
        }
        
        // Apply new dimensions
        selectedItem.style.width = newWidth + 'px';
        selectedItem.style.height = newHeight + 'px';
        selectedItem.style.left = newLeft + 'px';
        selectedItem.style.top = newTop + 'px';
        
        // Update aspect ratio
        selectedItem.dataset.aspectRatio = newWidth / newHeight;
    };
    
    // Create stop resize function
    const stopResize = () => {
        isResizing = false;
        canvas.classList.remove('resizing');
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        
        if (selectedItem) {
            DatabaseModule.debouncedSaveItem(selectedItem);
        }
    };
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
}

function startRotation(e) {
    e.stopPropagation();
    e.preventDefault();
    
    if (!selectedItem) {
        return;
    }
    
    // Get item center
    const rect = selectedItem.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Get initial angle
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const currentRotation = parseFloat(selectedItem.dataset.rotation) || 0;
    
    // Create rotation function
    const handleRotation = (e) => {
        if (!selectedItem) return;
        
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const deltaAngle = angle - startAngle;
        const newRotation = currentRotation + (deltaAngle * 180 / Math.PI);
        
        selectedItem.style.transform = `rotate(${newRotation}deg)`;
        selectedItem.dataset.rotation = newRotation;
    };
    
    // Create stop rotation function
    const stopRotation = () => {
        document.removeEventListener('mousemove', handleRotation);
        document.removeEventListener('mouseup', stopRotation);
        
        if (selectedItem) {
            DatabaseModule.debouncedSaveItem(selectedItem);
        }
    };
    
    document.addEventListener('mousemove', handleRotation);
    document.addEventListener('mouseup', stopRotation);
}

function normalizeZIndexes() {
    const items = getSortedItems();
    items.forEach((item, index) => {
        item.style.zIndex = index + 1;
    });
}

function getSortedItems() {
    return Array.from(canvas.querySelectorAll('.canvas-item')).sort((a, b) => {
        const aIndex = parseInt(a.style.zIndex) || 0;
        const bIndex = parseInt(b.style.zIndex) || 0;
        return aIndex - bIndex;
    });
}

function syncZIndexesToDatabase() {
    const items = getSortedItems();
    // Syncing z-indexes to database
    items.forEach(item => {
        DatabaseModule.debouncedSaveItem(item);
    });
}

// Export module
window.ItemsModule = {
    selectItem,
    clearSelection,
    showResizeHandles,
    hideResizeHandles,
    startDragging,
    dragItem,
    stopDragging,
    deleteItem,
    startResize,
    startRotation,
    normalizeZIndexes,
    getSortedItems,
    syncZIndexesToDatabase
};