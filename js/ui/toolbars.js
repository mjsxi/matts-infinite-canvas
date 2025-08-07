// UI Toolbars and Modal Management
// Handles text toolbar, drawing toolbar, move buttons, and modal interactions

// Get toolbar elements
const textToolbar = document.getElementById('textToolbar');
const drawToolbar = document.getElementById('drawToolbar');
const codeToolbar = document.getElementById('codeToolbar');

// Text toolbar debounced save
let textUpdateTimeout = null;
let drawingUpdateTimeout = null;
let codeUpdateTimeout = null;

function debouncedSaveTextItem() {
    if (textUpdateTimeout) {
        clearTimeout(textUpdateTimeout);
    }
    textUpdateTimeout = setTimeout(() => {
        if (selectedTextItem) {
            DatabaseModule.saveItemToDatabase(selectedTextItem);
        }
    }, 300);
}

function debouncedSaveDrawingItem() {
    if (drawingUpdateTimeout) {
        clearTimeout(drawingUpdateTimeout);
    }
    drawingUpdateTimeout = setTimeout(() => {
        if (selectedItem && selectedItem.dataset.type === 'drawing') {
            DatabaseModule.saveItemToDatabase(selectedItem);
        }
    }, 300);
}

// Text Toolbar Functions
function showTextToolbar(textItem) {
    if (!isAuthenticated || !textItem.classList.contains('text-item')) return;
    
    // Hide other toolbars
    hideDrawToolbar();
    
    // Populate toolbar with current text properties
    const fontFamily = textItem.style.fontFamily || 'Antarctica';
    const fontSize = parseInt(textItem.style.fontSize) || 24;
    const fontVariation = textItem.style.getPropertyValue('font-variation-settings') || '';
    
    // Parse font variation settings to extract individual values
    let variationWeight = 400, variationWidth = 100, variationContrast = 0;
    if (fontVariation) {
        const weightMatch = fontVariation.match(/"wght"\s+(\d+)/);
        const widthMatch = fontVariation.match(/"wdth"\s+(\d+)/);
        const contrastMatch = fontVariation.match(/"CNTR"\s+(\d+)/);
        
        if (weightMatch) variationWeight = parseInt(weightMatch[1]);
        if (widthMatch) variationWidth = parseInt(widthMatch[1]);
        if (contrastMatch) variationContrast = parseInt(contrastMatch[1]);
    }
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
    
    // Set other properties
    document.getElementById('fontSize').value = fontSize;
    
    // Set font variation inputs
    document.getElementById('fontVariationWeight').value = variationWeight;
    document.getElementById('fontVariationWidth').value = variationWidth;
    document.getElementById('fontVariationContrast').value = variationContrast;
    
    document.getElementById('textColor').value = rgbToHex(textColor);
    document.getElementById('lineHeight').value = lineHeight;
    
    // Update color preview
    const colorPreview = document.getElementById('colorPreview');
    if (colorPreview) {
        colorPreview.style.backgroundColor = rgbToHex(textColor);
    }
    
    textToolbar.classList.remove('hidden');
    
    // Bind events if not already bound
    bindTextToolbarEvents();
}

function hideTextToolbar() {
    textToolbar.classList.add('hidden');
}

function handleFontFamilyChange(e) {
    if (selectedTextItem) {
        selectedTextItem.style.fontFamily = e.target.value;
        DatabaseModule.saveItemToDatabase(selectedTextItem);
    }
}

function handleFontSizeChange(e) {
    if (selectedTextItem) {
        selectedTextItem.style.fontSize = e.target.value + 'px';
        debouncedSaveTextItem();
    }
}

function handleFontWeightChange(e) {
    if (selectedTextItem) {
        selectedTextItem.style.fontWeight = e.target.value;
        DatabaseModule.saveItemToDatabase(selectedTextItem);
    }
}

function handleTextColorChange(e) {
    if (selectedTextItem) {
        selectedTextItem.style.color = e.target.value;
        // Update color preview
        const colorPreview = document.getElementById('colorPreview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = e.target.value;
        }
        DatabaseModule.saveItemToDatabase(selectedTextItem);
    }
}

function handleColorPreviewClick(e) {
    // The color input is now positioned over the preview, so no manual trigger needed
    // The click will naturally go to the underlying color input
    e.preventDefault();
    e.stopPropagation();
}

function handleLineHeightChange(e) {
    if (selectedTextItem) {
        selectedTextItem.style.lineHeight = e.target.value;
        debouncedSaveTextItem();
    }
}

function updateFontVariation() {
    if (selectedTextItem) {
        const weight = document.getElementById('fontVariationWeight').value || 400;
        const width = document.getElementById('fontVariationWidth').value || 100;
        const contrast = document.getElementById('fontVariationContrast').value || 0;
        
        const fontVariationValue = `"wght" ${weight}, "wdth" ${width}, "CNTR" ${contrast}`;
        
        selectedTextItem.style.setProperty('font-variation-settings', fontVariationValue);
        
        debouncedSaveTextItem();
    }
}

function handleFontVariationWeightChange(e) {
    updateFontVariation();
}


function handleFontVariationWidthChange(e) {
    updateFontVariation();
}

function handleFontVariationContrastChange(e) {
    updateFontVariation();
}

function bindTextToolbarEvents() {
    // Remove existing listeners to prevent duplicates
    const fontFamily = document.getElementById('fontFamily');
    const fontSize = document.getElementById('fontSize');
    const fontVariationWeight = document.getElementById('fontVariationWeight');
    const fontVariationWidth = document.getElementById('fontVariationWidth');
    const fontVariationContrast = document.getElementById('fontVariationContrast');
    const textColor = document.getElementById('textColor');
    const lineHeight = document.getElementById('lineHeight');
    
    if (fontFamily) fontFamily.removeEventListener('change', handleFontFamilyChange);
    if (fontSize) fontSize.removeEventListener('input', handleFontSizeChange);
    if (fontVariationWeight) fontVariationWeight.removeEventListener('input', handleFontVariationWeightChange);
    if (fontVariationWidth) fontVariationWidth.removeEventListener('input', handleFontVariationWidthChange);
    if (fontVariationContrast) fontVariationContrast.removeEventListener('input', handleFontVariationContrastChange);
    if (textColor) textColor.removeEventListener('input', handleTextColorChange);
    if (lineHeight) lineHeight.removeEventListener('input', handleLineHeightChange);
    
    // Add new listeners
    if (fontFamily) fontFamily.addEventListener('change', handleFontFamilyChange);
    if (fontSize) fontSize.addEventListener('input', handleFontSizeChange);
    if (fontVariationWeight) fontVariationWeight.addEventListener('input', handleFontVariationWeightChange);
    if (fontVariationWidth) fontVariationWidth.addEventListener('input', handleFontVariationWidthChange);
    if (fontVariationContrast) fontVariationContrast.addEventListener('input', handleFontVariationContrastChange);
    if (textColor) textColor.addEventListener('input', handleTextColorChange);
    if (lineHeight) lineHeight.addEventListener('input', handleLineHeightChange);
}

// Drawing Toolbar Functions
function showDrawToolbar() {
    hideTextToolbar();
    drawToolbar.classList.remove('hidden');
    
    // Bind events if not already bound
    bindDrawToolbarEvents();
}

function hideDrawToolbar() {
    drawToolbar.classList.add('hidden');
}

function handleStrokeColorChange(e) {
    if (selectedItem && selectedItem.dataset.type === 'drawing') {
        const path = selectedItem.querySelector('path');
        if (path) {
            path.setAttribute('stroke', e.target.value);
            // Update stroke color preview
            const strokeColorPreview = document.getElementById('strokeColorPreview');
            if (strokeColorPreview) {
                strokeColorPreview.style.backgroundColor = e.target.value;
            }
            debouncedSaveDrawingItem();
        }
    }
}

function handleStrokeThicknessChange(e) {
    if (selectedItem && selectedItem.dataset.type === 'drawing') {
        const path = selectedItem.querySelector('path');
        if (path) {
            path.setAttribute('stroke-width', e.target.value);
            debouncedSaveDrawingItem();
        }
    }
}

function bindDrawToolbarEvents() {
    // Remove existing listeners to prevent duplicates
    const strokeColor = document.getElementById('strokeColor');
    const strokeThickness = document.getElementById('strokeThickness');
    
    if (strokeColor) strokeColor.removeEventListener('input', handleStrokeColorChange);
    if (strokeThickness) strokeThickness.removeEventListener('input', handleStrokeThicknessChange);
    
    // Add new listeners
    if (strokeColor) strokeColor.addEventListener('input', handleStrokeColorChange);
    if (strokeThickness) strokeThickness.addEventListener('input', handleStrokeThicknessChange);
}

function debouncedSaveCodeItem() {
    if (codeUpdateTimeout) {
        clearTimeout(codeUpdateTimeout);
    }
    codeUpdateTimeout = setTimeout(() => {
        if (selectedItem && selectedItem.dataset.type === 'code') {
            DatabaseModule.saveItemToDatabase(selectedItem);
        }
    }, 300);
}

// Code Toolbar Functions
function showCodeToolbar(codeItem) {
    if (!isAuthenticated || !codeItem.classList.contains('code-item')) return;
    
    // Hide other toolbars
    hideTextToolbar();
    hideDrawToolbar();
    
    // Get current play button visibility setting
    const showPlayButton = codeItem.dataset.showPlayButton !== 'false'; // default to true
    
    // Set dropdown value
    const showPlayButtonSelect = document.getElementById('showPlayButton');
    if (showPlayButtonSelect) {
        showPlayButtonSelect.value = showPlayButton ? 'true' : 'false';
    }
    
    codeToolbar.classList.remove('hidden');
    
    // Bind events if not already bound
    bindCodeToolbarEvents();
}

function hideCodeToolbar() {
    codeToolbar.classList.add('hidden');
}

function handleShowPlayButtonChange(e) {
    if (selectedItem && selectedItem.dataset.type === 'code') {
        const showPlayButton = e.target.value === 'true';
        selectedItem.dataset.showPlayButton = showPlayButton;
        
        // Update the overlay visibility immediately
        const overlay = selectedItem.querySelector('.code-interaction-overlay');
        if (overlay) {
            if (showPlayButton) {
                // Show the play button overlay
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.pointerEvents = 'auto';
            } else {
                // Hide the play button overlay permanently
                overlay.style.display = 'none';
                overlay.style.visibility = 'hidden';
                overlay.style.pointerEvents = 'none';
                // Also ensure the item is not interactive
                selectedItem.classList.remove('interactive');
                const iframe = selectedItem.querySelector('iframe');
                if (iframe) {
                    iframe.style.pointerEvents = 'none';
                }
            }
        }
        
        debouncedSaveCodeItem();
    }
}

function bindCodeToolbarEvents() {
    // Remove existing listeners to prevent duplicates
    const showPlayButton = document.getElementById('showPlayButton');
    
    if (showPlayButton) showPlayButton.removeEventListener('change', handleShowPlayButtonChange);
    
    // Add new listeners
    if (showPlayButton) showPlayButton.addEventListener('change', handleShowPlayButtonChange);
}

// Move Buttons Functions
function showMoveButtons() {
    const bringToFrontBtn = document.getElementById('bringToFrontBtn');
    const sendToBackBtn = document.getElementById('sendToBackBtn');
    
    // Remove hidden class to start animation
    if (bringToFrontBtn) bringToFrontBtn.classList.remove('hidden');
    if (sendToBackBtn) sendToBackBtn.classList.remove('hidden');
}

function hideMoveButtons() {
    const bringToFrontBtn = document.getElementById('bringToFrontBtn');
    const sendToBackBtn = document.getElementById('sendToBackBtn');
    
    // Add hidden class to trigger animation
    if (bringToFrontBtn) bringToFrontBtn.classList.add('hidden');
    if (sendToBackBtn) sendToBackBtn.classList.add('hidden');
}

// Utility Functions
function rgbToHex(rgb) {
    // Handle hex values that are already in hex format
    if (rgb.startsWith('#')) return rgb;
    
    // Handle named colors
    if (rgb === 'black') return '#000000';
    if (rgb === 'white') return '#ffffff';
    if (rgb === 'red') return '#ff0000';
    if (rgb === 'green') return '#008000';
    if (rgb === 'blue') return '#0000ff';
    
    // Parse RGB values
    const result = rgb.match(/\d+/g);
    if (result && result.length >= 3) {
        const r = parseInt(result[0]);
        const g = parseInt(result[1]);
        const b = parseInt(result[2]);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    // Default fallback
    return '#333333';
}

function convertFontWeightToNumeric(weight) {
    const weightMap = {
        'thin': '100',
        'extra-light': '200',
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semi-bold': '600',
        'bold': '700',
        'extra-bold': '800',
        'black': '900'
    };
    
    // If it's already numeric, return it
    if (!isNaN(weight)) return weight;
    
    // Convert named weights to numeric
    return weightMap[weight.toLowerCase()] || '400';
}

// Modal Management
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showStatus(message, duration = 3000) {
    // Status message being displayed
    
    // Only show status messages for authenticated admin users
    if (!isAuthenticated) {
        return;
    }
    
    // Remove existing status messages
    const existingStatus = document.querySelector('.status-message');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // Create new status message
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    statusDiv.textContent = message;
    statusDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
        transition: opacity 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(statusDiv);
    
    // Auto-remove after duration
    setTimeout(() => {
        statusDiv.style.opacity = '0';
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 300);
    }, duration);
}

// Cleanup function for event listeners
function cleanupEventListeners() {
    // Remove text toolbar listeners
    const fontFamily = document.getElementById('fontFamily');
    const fontSize = document.getElementById('fontSize');
    const fontVariationWeight = document.getElementById('fontVariationWeight');
    const fontVariationWidth = document.getElementById('fontVariationWidth');
    const fontVariationContrast = document.getElementById('fontVariationContrast');
    const textColor = document.getElementById('textColor');
    const lineHeight = document.getElementById('lineHeight');
    
    if (fontFamily) fontFamily.removeEventListener('change', handleFontFamilyChange);
    if (fontSize) fontSize.removeEventListener('input', handleFontSizeChange);
    if (fontVariationWeight) fontVariationWeight.removeEventListener('input', handleFontVariationWeightChange);
    if (fontVariationWidth) fontVariationWidth.removeEventListener('input', handleFontVariationWidthChange);
    if (fontVariationContrast) fontVariationContrast.removeEventListener('input', handleFontVariationContrastChange);
    if (textColor) textColor.removeEventListener('input', handleTextColorChange);
    if (lineHeight) lineHeight.removeEventListener('input', handleLineHeightChange);
    
    // Remove drawing toolbar listeners
    const strokeColor = document.getElementById('strokeColor');
    const strokeThickness = document.getElementById('strokeThickness');
    
    if (strokeColor) strokeColor.removeEventListener('input', handleStrokeColorChange);
    if (strokeThickness) strokeThickness.removeEventListener('input', handleStrokeThicknessChange);
    
    // Remove code toolbar listeners
    const showPlayButton = document.getElementById('showPlayButton');
    
    if (showPlayButton) showPlayButton.removeEventListener('change', handleShowPlayButtonChange);
}

// Export module
window.ToolbarModule = {
    showTextToolbar,
    hideTextToolbar,
    showDrawToolbar,
    hideDrawToolbar,
    showCodeToolbar,
    hideCodeToolbar,
    showMoveButtons,
    hideMoveButtons,
    handleFontFamilyChange,
    handleFontSizeChange,
    handleFontVariationWeightChange,
    handleFontVariationWidthChange,
    handleFontVariationContrastChange,
    updateFontVariation,
    handleTextColorChange,
    handleColorPreviewClick,
    handleLineHeightChange,
    handleStrokeColorChange,
    handleStrokeThicknessChange,
    handleShowPlayButtonChange,
    bindTextToolbarEvents,
    bindDrawToolbarEvents,
    bindCodeToolbarEvents,
    closeModal,
    showStatus,
    cleanupEventListeners,
    rgbToHex,
    debouncedSaveTextItem,
    debouncedSaveDrawingItem,
    debouncedSaveCodeItem
};