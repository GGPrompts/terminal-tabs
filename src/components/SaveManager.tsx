import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { Save, Check } from 'lucide-react';

interface SaveManagerProps {
  autoSaveInterval?: number; // seconds
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'just-saved';

export const SaveManager: React.FC<SaveManagerProps> = ({
  autoSaveInterval = 60
}) => {
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [secondsUntilSave, setSecondsUntilSave] = useState(autoSaveInterval);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  const isDirtyRef = useRef(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveStateRef = useRef<SaveState>('saved');
  const isInitialMount = useRef(true);

  // Sync saveStateRef with saveState
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  // Save function
  const performSave = useCallback(() => {
    if (saveStateRef.current === 'saving') return; // Already saving

    setSaveState('saving');

    try {
      // Get current state from store
      const state = useCanvasStore.getState();

      // Serialize to JSON
      const snapshot = {
        terminals: Array.from(state.terminals.entries()),
        cards: Array.from(state.cards.entries()),
        drawingObjects: state.drawingObjects,
        cardCategories: state.cardCategories,
        layouts: Array.from(state.layouts.entries()),
        activeLayoutId: state.activeLayoutId,
        maxZIndex: state.maxZIndex,
        selectedIds: Array.from(state.selectedIds),
        sessionManagerPanel: state.sessionManagerPanel,
        minimapSize: state.minimapSize, // Save minimap dimensions with workspace
        version: '1.0', // Schema version for future migrations
        savedAt: new Date().toISOString(),
      };

      // Save to localStorage
      localStorage.setItem('opustrator-canvas-storage', JSON.stringify(snapshot));

      // Update UI
      const now = new Date();
      setLastSaveTime(now);
      setSaveState('just-saved');
      isDirtyRef.current = false;
      setSecondsUntilSave(autoSaveInterval);

      // Flash "just-saved" state for 500ms
      setTimeout(() => {
        setSaveState('saved');
      }, 500);

    } catch (error) {
      console.error('[SaveManager] Save failed:', error);
      setSaveState('dirty'); // Revert to dirty on error
    }
  }, [autoSaveInterval]);

  // Mark as dirty when store changes
  useEffect(() => {
    // Skip initial hydration events (give file tree and store hydration time to settle)
    const skipInitial = setTimeout(() => {
      isInitialMount.current = false;
    }, 500);

    const unsubscribe = useCanvasStore.subscribe(() => {
      if (isInitialMount.current) {
        return;
      }

      if (!isDirtyRef.current) {
        isDirtyRef.current = true;
        setSaveState('dirty');
        setSecondsUntilSave(autoSaveInterval);

        // Clear existing timers
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        // Start countdown
        countdownTimerRef.current = setInterval(() => {
          setSecondsUntilSave(prev => {
            const newValue = prev - 1;
            if (newValue <= 0) {
              // Time's up, trigger save
              if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
              performSave();
              return autoSaveInterval;
            }
            return newValue;
          });
        }, 1000);

        // Set save timer as backup
        saveTimerRef.current = setTimeout(() => {
          performSave();
        }, autoSaveInterval * 1000);
      }
    });

    return () => {
      clearTimeout(skipInitial);
      unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [autoSaveInterval, performSave]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        // Synchronous save
        try {
          const state = useCanvasStore.getState();
          const snapshot = {
            terminals: Array.from(state.terminals.entries()),
            cards: Array.from(state.cards.entries()),
            drawingObjects: state.drawingObjects,
            cardCategories: state.cardCategories,
            layouts: Array.from(state.layouts.entries()),
            activeLayoutId: state.activeLayoutId,
            maxZIndex: state.maxZIndex,
            selectedIds: Array.from(state.selectedIds),
            sessionManagerPanel: state.sessionManagerPanel,
            version: '1.0',
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem('opustrator-canvas-storage', JSON.stringify(snapshot));
        } catch (error) {
          console.error('[SaveManager] Before-unload save failed:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Manual save handler
  const handleManualSave = () => {
    // Clear timers
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    // Reset countdown state
    setSecondsUntilSave(autoSaveInterval);

    performSave();
  };

  // Calculate progress (0 to 1)
  const progress = saveState === 'dirty'
    ? 1 - (secondsUntilSave / autoSaveInterval)
    : 0;

  // Tooltip text - static to avoid flash on updates
  const getTooltip = () => {
    return 'Click to Save';
  };

  // Icon color
  const getIconColor = () => {
    switch (saveState) {
      case 'saved':
        return '#6b7280'; // Gray
      case 'dirty':
        return '#f59e0b'; // Orange
      case 'saving':
        return '#3b82f6'; // Blue
      case 'just-saved':
        return '#10b981'; // Green
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      className="save-manager"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: saveState !== 'saving' ? 'pointer' : 'default',
      }}
      onClick={saveState !== 'saving' ? handleManualSave : undefined}
      title={getTooltip()}
    >
      {/* Icon container with ring */}
      <div style={{
        position: 'relative',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      >
      {/* Progress ring */}
      {saveState === 'dirty' && (
        <svg
          width="32"
          height="32"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
          }}
        >
          {/* Background ring */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="rgba(245, 158, 11, 0.2)"
            strokeWidth="3"
          />
          {/* Progress ring */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 14}`}
            strokeDashoffset={`${2 * Math.PI * 14 * (1 - progress)}`}
            style={{
              transition: 'stroke-dashoffset 1s linear',
            }}
          />
        </svg>
      )}

      {/* Spinner ring (saving state) */}
      {saveState === 'saving' && (
        <svg
          width="32"
          height="32"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'spin 1s linear infinite',
          }}
        >
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 14 * 0.75}`}
            opacity="0.8"
          />
        </svg>
      )}

      {/* Icon */}
      {saveState === 'just-saved' ? (
        <Check size={20} color={getIconColor()} strokeWidth={2.5} />
      ) : (
        <Save size={20} color={getIconColor()} strokeWidth={2} />
      )}
      </div>

      {/* Countdown text */}
      {saveState === 'dirty' && secondsUntilSave < autoSaveInterval && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#10b981',
            minWidth: '24px',
            textAlign: 'center',
          }}
        >
          {secondsUntilSave}s
        </span>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
