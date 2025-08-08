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

function showStatus(message, duration = 5000) {
    // Status message being displayed
    
    // Only show status messages for authenticated admin users
    if (!isAuthenticated) {
        return;
    }
    
    // Create container if it doesn't exist
    let statusContainer = document.querySelector('.status-container');
    if (!statusContainer) {
        statusContainer = document.createElement('div');
        statusContainer.className = 'status-container';
        statusContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 4px;
            pointer-events: none;
        `;
        document.body.appendChild(statusContainer);
    }
    
    // Create new status message
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    
    // Create message content
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    messageSpan.style.cssText = `
        flex: 1;
        margin-right: 8px;
    `;
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.5683 5.51347C18.808 5.04851 19.3791 4.86591 19.844 5.10547C20.3091 5.34523 20.4917 5.91624 20.252 6.38129C19.8632 7.1356 19.0569 8.35683 18.0891 9.75817C17.2367 10.9924 16.2277 12.4097 15.2055 13.8474C16.035 15.7367 16.8057 17.4973 17.6774 18.7953C18.6028 20.1731 19.4293 20.7144 20.2715 20.6595C20.5307 20.6425 20.7308 20.5096 20.8885 20.2829C20.9692 20.167 21.0285 20.0379 21.0652 19.9184C21.0833 19.8596 21.0947 19.8082 21.1004 19.7676C21.1031 19.7478 21.1045 19.732 21.105 19.7204C21.1055 19.709 21.105 19.7029 21.105 19.7029C21.0713 19.181 21.4667 18.7303 21.9885 18.6963C22.5106 18.6624 22.9621 19.0586 22.996 19.5807C23.0319 20.1357 22.8263 20.8154 22.4437 21.3654C22.0391 21.9466 21.3602 22.4874 20.3954 22.5505C18.4833 22.6756 17.1143 21.3551 16.1047 19.8518C15.3062 18.6629 14.6 17.1608 13.9288 15.6497C13.0361 16.911 12.1749 18.1373 11.4393 19.2264C10.4663 20.6668 9.7539 21.8037 9.45208 22.4525C9.23138 22.9269 8.66735 23.1321 8.19298 22.9114C7.71886 22.6905 7.51347 22.1274 7.73411 21.6531C8.10985 20.8455 8.90961 19.5859 9.86931 18.1652C10.7965 16.7927 11.9134 15.2112 13.0351 13.6319C12.282 11.9406 11.5382 10.378 10.6871 9.20769C9.71292 7.86817 8.77152 7.2689 7.72856 7.33699C7.46925 7.35395 7.26924 7.48775 7.1115 7.71446C7.031 7.83023 6.97145 7.95878 6.9348 8.07805C6.91677 8.1368 6.90535 8.18826 6.89965 8.22886C6.89684 8.24891 6.89556 8.26532 6.89502 8.27697C6.89449 8.28855 6.89505 8.29401 6.89502 8.29362C6.92892 8.81562 6.53343 9.26611 6.01152 9.30021C5.48951 9.33411 5.03809 8.93867 5.00406 8.41667C4.96802 7.86167 5.17367 7.18207 5.55636 6.63201C5.96085 6.05068 6.6397 5.50906 7.60459 5.44594C9.62179 5.314 11.1053 6.56147 12.2191 8.09286C12.9977 9.16343 13.6777 10.4854 14.3062 11.8417C15.1009 10.723 15.8643 9.64554 16.5302 8.68127C17.5124 7.25917 18.2452 6.14009 18.5683 5.51347Z" fill="white"/>
        </svg>
    `;
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        opacity: 0.8;
        transition: opacity 0.2s ease;
    `;
    closeButton.onmouseover = () => closeButton.style.opacity = '1';
    closeButton.onmouseout = () => closeButton.style.opacity = '0.8';
    
    // Add click handler to close button
    closeButton.onclick = (e) => {
        e.stopPropagation();
        statusDiv.style.opacity = '0';
        statusDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 300);
    };
    
    // Style the main status div
    statusDiv.style.cssText = `
        background: rgba(30, 30, 30, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 400;
        line-height: 1.4;
        min-width: 200px;
        max-width: 350px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: auto;
        transition: all 0.3s ease;
        transform: translateX(100%);
        opacity: 0;
    `;
    
    // Append elements
    statusDiv.appendChild(messageSpan);
    statusDiv.appendChild(closeButton);
    statusContainer.appendChild(statusDiv);
    
    // Animate in
    requestAnimationFrame(() => {
        statusDiv.style.opacity = '1';
        statusDiv.style.transform = 'translateX(0)';
    });
    
    // Auto-remove after duration
    const autoRemoveTimeout = setTimeout(() => {
        statusDiv.style.opacity = '0';
        statusDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 300);
    }, duration);
    
    // Clear timeout if manually closed
    closeButton.onclick = (e) => {
        e.stopPropagation();
        clearTimeout(autoRemoveTimeout);
        statusDiv.style.opacity = '0';
        statusDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 300);
    };
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