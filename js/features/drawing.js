// Drawing functionality module
// Handles drawing mode, SVG path creation, and drawing tool interactions

function toggleDrawMode() {
    isDrawMode = !isDrawMode;
    const drawBtn = document.getElementById('drawBtn');
    
    if (isDrawMode) {
        drawBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        ToolbarModule.showDrawToolbar();
        container.style.cursor = 'crosshair';
    } else {
        drawBtn.style.backgroundColor = '';
        ToolbarModule.hideDrawToolbar();
        container.style.cursor = '';
        removeDrawingPreview();
    }
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
        const screenPos = ViewportModule.canvasToScreen(drawingPath[i].x, drawingPath[i].y);
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
    const item = document.createElement('div');
    item.className = 'canvas-item drawing-item';
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
    item.dataset.type = 'drawing';
    
    // Create SVG element with viewBox for proper scaling and centering
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.pointerEvents = 'none';
    
    // Set viewBox - if provided from database, use it; otherwise calculate from path
    let viewBox;
    if (viewBoxData) {
        viewBox = viewBoxData;
        item.dataset.viewBox = viewBoxData;
    } else {
        // Calculate viewBox to match the actual path bounds
        const pathBounds = calculatePathBounds(pathData);
        const padding = Math.max(10, strokeThickness);
        const viewBoxWidth = pathBounds.maxX - pathBounds.minX + (padding * 2);
        const viewBoxHeight = pathBounds.maxY - pathBounds.minY + (padding * 2);
        viewBox = `${pathBounds.minX - padding} ${pathBounds.minY - padding} ${viewBoxWidth} ${viewBoxHeight}`;
        item.dataset.viewBox = viewBox;
    }
    
    svg.setAttribute('viewBox', viewBox);
    
    // Create path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeThickness);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    svg.appendChild(path);
    item.appendChild(svg);
    
    canvas.appendChild(item);
    
    if (!fromDatabase) {
        ItemsModule.selectItem(item);
        DatabaseModule.saveItemToDatabase(item);
    }
    
    return item;
}

// Helper function to calculate path bounds
function calculatePathBounds(pathData) {
    // Extract coordinates from path data
    const coords = pathData.match(/[\d.-]+/g);
    if (!coords || coords.length < 2) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (let i = 0; i < coords.length; i += 2) {
        const x = parseFloat(coords[i]);
        const y = parseFloat(coords[i + 1]);
        
        if (!isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }
    
    return { minX, minY, maxX, maxY };
}

// Helper function to smooth drawing paths (optional enhancement)
function smoothPath(points) {
    if (points.length < 3) return points;
    
    const smoothedPoints = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const current = points[i];
        const next = points[i + 1];
        
        // Simple smoothing using quadratic interpolation
        const smoothX = (prev.x + 2 * current.x + next.x) / 4;
        const smoothY = (prev.y + 2 * current.y + next.y) / 4;
        
        smoothedPoints.push({ x: smoothX, y: smoothY });
    }
    
    smoothedPoints.push(points[points.length - 1]);
    return smoothedPoints;
}

// Convert straight line path to curved Bezier path (optional enhancement)
function createBezierPath(points) {
    if (points.length < 2) return '';
    
    let pathData = `M ${points[0].x} ${points[0].y}`;
    
    if (points.length === 2) {
        pathData += ` L ${points[1].x} ${points[1].y}`;
        return pathData;
    }
    
    // Create smooth curves using quadratic Bezier curves
    for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const controlX = current.x;
        const controlY = current.y;
        const endX = (current.x + next.x) / 2;
        const endY = (current.y + next.y) / 2;
        
        pathData += ` Q ${controlX} ${controlY} ${endX} ${endY}`;
    }
    
    // Add final point
    const lastPoint = points[points.length - 1];
    pathData += ` L ${lastPoint.x} ${lastPoint.y}`;
    
    return pathData;
}

// Export module
window.DrawingModule = {
    toggleDrawMode,
    createDrawingPreview,
    updateDrawingPreview,
    removeDrawingPreview,
    createDrawingItem,
    calculatePathBounds,
    smoothPath,
    createBezierPath
};