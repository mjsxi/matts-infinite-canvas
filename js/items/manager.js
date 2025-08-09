// Item management module
// Handles item selection, manipulation, dragging, resizing

// Cache for resize handles to avoid recreation
let cachedResizeHandles = null;
let lastSelectedItemId = null;

function selectItem(item, addToSelection = false) {
    // Removed console.log for performance
    if (!addToSelection) {
        clearSelection();
    }
    
    // Reset all code blocks to non-interactive state when selecting any item
    const allCodeItems = document.querySelectorAll('.code-item');
    allCodeItems.forEach(codeItem => {
        if (codeItem !== item) { // Don't reset the item we're selecting
            codeItem.classList.remove('interactive');
            const iframe = codeItem.querySelector('iframe');
            if (iframe) {
                iframe.style.pointerEvents = 'none';
            }
            
            // Restore the play button overlay (only if showPlayButton is not disabled)
            const overlay = codeItem.querySelector('.code-interaction-overlay');
            if (overlay && codeItem.dataset.showPlayButton !== 'false') {
                overlay.style.display = 'flex';
                overlay.style.opacity = '0.9';
                overlay.style.visibility = 'visible';
                overlay.style.pointerEvents = 'auto';
            }
        }
    });
    
    // Add to selection arrays
    if (!selectedItems.includes(item)) {
        selectedItems.push(item);
    }
    selectedItem = item; // Keep track of primary selection
    item.classList.add('selected');
    
    // Update visual indicators for multi-selection
    updateMultiSelectionIndicators();
    
    // Ensure dragging class is removed when selecting an item
    if (item.classList.contains('dragging')) {
        item.classList.remove('dragging');
    }
    
    // Removed console.log for performance
    showResizeHandles(item);
    
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
            const strokeColor = path.getAttribute('stroke') || '#333333';
            document.getElementById('strokeColor').value = strokeColor;
            document.getElementById('strokeThickness').value = path.getAttribute('stroke-width') || '8';
            
            // Update stroke color preview
            const strokeColorPreview = document.getElementById('strokeColorPreview');
            if (strokeColorPreview) {
                strokeColorPreview.style.backgroundColor = strokeColor;
            }
        }
    }
    
    // Show code toolbar if this is a code item and user is admin
    if (item.classList.contains('code-item') && isAuthenticated) {
        ToolbarModule.showCodeToolbar(item);
    }
    
    // Item selection complete
}

function clearSelection() {
    // Reset all code blocks to non-interactive state when clearing selection
    const allCodeItems = document.querySelectorAll('.code-item');
    allCodeItems.forEach(codeItem => {
        codeItem.classList.remove('interactive');
        const iframe = codeItem.querySelector('iframe');
        if (iframe) {
            iframe.style.pointerEvents = 'none';
        }
        
        // Restore the play button overlay (only if showPlayButton is not disabled)
        const overlay = codeItem.querySelector('.code-interaction-overlay');
        if (overlay && codeItem.dataset.showPlayButton !== 'false') {
            overlay.style.display = 'flex';
            overlay.style.opacity = '0.9';
            overlay.style.visibility = 'visible';
            overlay.style.pointerEvents = 'auto';
        }
    });
    
    // Clear all selected items
    selectedItems.forEach(item => {
        item.classList.remove('selected');
        
        // Reset interactive state for code items when deselected
        if (item.classList.contains('code-item')) {
            item.classList.remove('interactive');
            const iframe = item.querySelector('iframe');
            if (iframe) {
                iframe.style.pointerEvents = 'none';
            }
            
            // Restore the play button overlay (only if showPlayButton is not disabled)
            const overlay = item.querySelector('.code-interaction-overlay');
            if (overlay && item.dataset.showPlayButton !== 'false') {
                overlay.style.display = 'flex';
                overlay.style.opacity = '0.9';
                overlay.style.visibility = 'visible';
                overlay.style.pointerEvents = 'auto';
            }
        }
        
        // Reset text items to non-editing mode when deselected
        if (item.classList.contains('text-item')) {
            // Save the text item before clearing selection
            DatabaseModule.saveItemToDatabase(item);
            
            item.classList.remove('editing');
            item.contentEditable = false;
            item.blur();
            
            // Show resize handles if they were hidden
            const resizeHandles = item.querySelector('.resize-handles');
            if (resizeHandles) {
                resizeHandles.style.display = '';
            }
        }
    });
    
    hideResizeHandles();
    selectedItem = null;
    selectedItems = [];
    
    // Clear multi-selection indicators
    updateMultiSelectionIndicators();
    
    // Hide move up/down buttons when no item is selected
    ToolbarModule.hideMoveButtons();
    
    // Hide text toolbar
    ToolbarModule.hideTextToolbar();
    selectedTextItem = null;
    
    // Hide draw toolbar
    ToolbarModule.hideDrawToolbar();
    
    // Hide code toolbar
    ToolbarModule.hideCodeToolbar();
    
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

function selectItemsInBox(box) {
    const items = canvas.querySelectorAll('.canvas-item');
    const boxLeft = Math.min(box.startX, box.endX);
    const boxRight = Math.max(box.startX, box.endX);
    const boxTop = Math.min(box.startY, box.endY);
    const boxBottom = Math.max(box.startY, box.endY);
    
    items.forEach(item => {
        const itemLeft = parseFloat(item.style.left) || 0;
        const itemTop = parseFloat(item.style.top) || 0;
        const itemWidth = parseFloat(item.style.width) || item.offsetWidth;
        const itemHeight = parseFloat(item.style.height) || item.offsetHeight;
        const itemRight = itemLeft + itemWidth;
        const itemBottom = itemTop + itemHeight;
        
        // Check if item intersects with selection box
        if (itemLeft < boxRight && itemRight > boxLeft && itemTop < boxBottom && itemBottom > boxTop) {
            selectItem(item, true);
        }
    });
}

function deleteSelectedItems() {
    if (selectedItems.length === 0) return;
    
    const count = selectedItems.length;
    if (confirm(`Delete ${count} selected item${count > 1 ? 's' : ''}?`)) {
        selectedItems.forEach(item => {
            DatabaseModule.deleteItemFromDatabase(item);
            item.remove();
        });
        clearSelection();
        normalizeZIndexes();
    }
}

function updateMultiSelectionIndicators() {
    // Clear all multi-selection indicators
    const allItems = canvas.querySelectorAll('.canvas-item');
    allItems.forEach(item => {
        item.removeAttribute('data-multi-selected');
    });
    
    // Add indicators for multi-selected items
    if (selectedItems.length > 1) {
        selectedItems.forEach(item => {
            item.setAttribute('data-multi-selected', 'true');
        });
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
    selectItemsInBox,
    deleteSelectedItems,
    updateMultiSelectionIndicators,
    startResize,
    startRotation,
    normalizeZIndexes,
    getSortedItems,
    syncZIndexesToDatabase
};