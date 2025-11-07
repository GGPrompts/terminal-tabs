// Debug script to identify z-index and overlay issues
// Paste this into browser console to diagnose click blocking

const debugZIndex = () => {
  let clickBlocker = null;
  let originalTarget = null;

  // Add click listener with capture to detect what's blocking
  document.addEventListener('click', (e) => {
    const target = e.target;
    const rect = target.getBoundingClientRect();

    console.group('🎯 Click Debug');
    console.log('Clicked element:', target);
    console.log('Class:', target.className);
    console.log('ID:', target.id);
    console.log('Tag:', target.tagName);
    console.log('Position:', { x: rect.left, y: rect.top, width: rect.width, height: rect.height });

    // Get computed styles
    const styles = window.getComputedStyle(target);
    console.log('Computed styles:');
    console.log('  z-index:', styles.zIndex);
    console.log('  position:', styles.position);
    console.log('  pointer-events:', styles.pointerEvents);
    console.log('  opacity:', styles.opacity);
    console.log('  display:', styles.display);
    console.log('  visibility:', styles.visibility);

    // Find all ancestors with z-index
    const ancestors = [];
    let current = target;
    while (current && current !== document.body) {
      const currentStyles = window.getComputedStyle(current);
      if (currentStyles.zIndex !== 'auto' || currentStyles.position === 'fixed' || currentStyles.position === 'absolute') {
        ancestors.push({
          element: current,
          className: current.className,
          id: current.id,
          zIndex: currentStyles.zIndex,
          position: currentStyles.position,
          pointerEvents: currentStyles.pointerEvents,
        });
      }
      current = current.parentElement;
    }

    console.log('Ancestors with positioning:', ancestors);
    console.groupEnd();
  }, true);

  // Add mousemove listener to track what's under cursor
  let lastElement = null;
  document.addEventListener('mousemove', (e) => {
    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    if (elementAtPoint !== lastElement) {
      lastElement = elementAtPoint;
      // Only log if it's a button or interactive element
      if (elementAtPoint && (
        elementAtPoint.tagName === 'BUTTON' ||
        elementAtPoint.className?.includes('btn') ||
        elementAtPoint.className?.includes('control') ||
        elementAtPoint.className?.includes('terminal')
      )) {
        console.log('Hovering over:', elementAtPoint.className || elementAtPoint.tagName,
          '| z-index:', window.getComputedStyle(elementAtPoint).zIndex);
      }
    }
  });

  // Function to find all high z-index elements
  const findHighZIndexElements = () => {
    const elements = document.querySelectorAll('*');
    const highZIndexElements = [];

    elements.forEach(el => {
      const styles = window.getComputedStyle(el);
      const zIndex = parseInt(styles.zIndex);

      if (!isNaN(zIndex) && zIndex > 1000) {
        const rect = el.getBoundingClientRect();
        highZIndexElements.push({
          element: el,
          className: el.className,
          id: el.id,
          zIndex: zIndex,
          position: styles.position,
          visible: styles.display !== 'none' && styles.visibility !== 'hidden',
          bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          pointerEvents: styles.pointerEvents
        });
      }
    });

    // Sort by z-index descending
    highZIndexElements.sort((a, b) => b.zIndex - a.zIndex);

    console.group('🔍 High Z-Index Elements (>1000)');
    highZIndexElements.forEach(item => {
      console.log(`z-${item.zIndex}: ${item.className || item.id || 'unknown'} | position: ${item.position} | visible: ${item.visible} | pointer-events: ${item.pointerEvents}`);
      if (item.bounds.width > window.innerWidth * 0.8 && item.bounds.height > window.innerHeight * 0.8) {
        console.warn('  ⚠️ Large overlay detected!', item.bounds);
      }
    });
    console.groupEnd();

    return highZIndexElements;
  };

  // Function to visualize overlays
  const visualizeOverlays = () => {
    // Remove any existing debug overlays
    document.querySelectorAll('.debug-overlay-indicator').forEach(el => el.remove());

    const highZIndexElements = findHighZIndexElements();

    highZIndexElements.forEach((item, index) => {
      if (item.visible && item.pointerEvents !== 'none') {
        const indicator = document.createElement('div');
        indicator.className = 'debug-overlay-indicator';
        indicator.style.cssText = `
          position: fixed;
          left: ${item.bounds.x}px;
          top: ${item.bounds.y}px;
          width: ${item.bounds.width}px;
          height: ${item.bounds.height}px;
          border: 2px solid ${index === 0 ? 'red' : 'orange'};
          background: rgba(255, 0, 0, 0.1);
          pointer-events: none;
          z-index: 999999;
          box-sizing: border-box;
        `;

        // Add label
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          background: ${index === 0 ? 'red' : 'orange'};
          color: white;
          padding: 2px 6px;
          font-size: 12px;
          font-family: monospace;
          pointer-events: none;
        `;
        label.textContent = `z-${item.zIndex}: ${item.className?.split(' ')[0] || item.id || 'unknown'}`;
        indicator.appendChild(label);

        document.body.appendChild(indicator);
      }
    });

    console.log('📊 Overlay visualization added. Red = highest z-index, Orange = other high z-index elements');
  };

  // Check for UnifiedChat specific issues
  const checkUnifiedChat = () => {
    const unifiedChat = document.querySelector('.unified-chat');
    if (unifiedChat) {
      const rect = unifiedChat.getBoundingClientRect();
      const styles = window.getComputedStyle(unifiedChat);

      console.group('💬 UnifiedChat Analysis');
      console.log('Position:', styles.position);
      console.log('Z-index:', styles.zIndex);
      console.log('Dimensions:', { width: rect.width, height: rect.height });
      console.log('Location:', { x: rect.left, y: rect.top });
      console.log('Expanded:', unifiedChat.classList.contains('expanded'));
      console.log('Collapsed:', unifiedChat.classList.contains('collapsed'));

      // Check for overflow or invisible areas
      const scrollHeight = unifiedChat.scrollHeight;
      const clientHeight = unifiedChat.clientHeight;
      if (scrollHeight > clientHeight) {
        console.warn('⚠️ UnifiedChat has overflow:', { scrollHeight, clientHeight });
      }

      // Check embedded terminal area
      const terminalDock = document.querySelector('#terminal-dock');
      if (terminalDock) {
        const dockRect = terminalDock.getBoundingClientRect();
        console.log('Terminal Dock:', {
          width: dockRect.width,
          height: dockRect.height,
          visible: dockRect.width > 0 && dockRect.height > 0
        });
      }

      console.groupEnd();
    }
  };

  // Run all checks
  console.log('🐛 Z-Index Debug Tool Started');
  console.log('Click anywhere to see what element receives the click');
  console.log('Run these commands:');
  console.log('  findHighZIndexElements() - List all high z-index elements');
  console.log('  visualizeOverlays() - Show visual indicators for overlays');
  console.log('  checkUnifiedChat() - Analyze UnifiedChat component');

  // Make functions available globally
  window.debugZIndex = {
    findHighZIndexElements,
    visualizeOverlays,
    checkUnifiedChat,
    stopDebug: () => {
      document.querySelectorAll('.debug-overlay-indicator').forEach(el => el.remove());
      console.log('Debug mode stopped');
    }
  };

  // Initial check
  findHighZIndexElements();
  checkUnifiedChat();
};

// Export for use in browser console
if (typeof module !== 'undefined' && module.exports) {
  module.exports = debugZIndex;
} else {
  // Auto-run if pasted directly into console
  debugZIndex();
}