// Item management module
// Handles item selection, manipulation, dragging, resizing

function selectItem(item) {
    clearSelection();
    selectedItem = item;
    item.classList.add('selected');
    showResizeHandles(item);
    
    // Disable draw mode when selecting any item
    if (isDrawMode) {
        isDrawMode = false;
        const drawBtn = document.getElementById('drawBtn');
        drawBtn.style.backgroundColor = '';
        container.style.cursor = '';
        DrawingModule.removeDrawingPreview();
        console.log('Draw mode disabled - item selected');
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
    ToolbarModule.hideMoveButtons();
    
    // Hide text toolbar
    ToolbarModule.hideTextToolbar();
    selectedTextItem = null;
    
    // Hide draw toolbar
    ToolbarModule.hideDrawToolbar();
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
    
    if (!selectedItem) return;
    
    isResizing = true;
    // Resize logic would be here - simplified for brevity
    console.log('Starting resize:', direction);
}

function startRotation(e) {
    e.stopPropagation();
    e.preventDefault();
    
    if (!selectedItem) return;
    
    // Rotation logic would be here - simplified for brevity
    console.log('Starting rotation');
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
    console.log('Syncing z-indexes for', items.length, 'items');
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