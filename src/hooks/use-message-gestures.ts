'use client';

import * as React from 'react';

/** Max gap between two taps to count as a double-tap. */
const DOUBLE_TAP_MS = 280;
/** Hold duration that triggers a long-press. */
const LONG_PRESS_MS = 450;
/** Finger travel (px) after which the gesture is treated as a scroll. */
const MOVE_TOLERANCE_PX = 10;

/** Taps on these descendants keep their own behaviour (links, attachments, reply quotes, retry…). */
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [data-gesture-ignore]';

interface MessageGestureOptions {
  /** Disable all gestures (e.g. deleted or system messages). */
  enabled?: boolean;
  /** Fired on a touch double-tap. */
  onDoubleTap?: () => void;
  /** Fired on a touch single tap, after the double-tap window has elapsed. */
  onTap?: () => void;
  /** Fired when a touch is held without moving. */
  onLongPress?: () => void;
}

export interface MessageGestureHandlers {
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onPointerMove: React.PointerEventHandler<HTMLElement>;
  onPointerUp: React.PointerEventHandler<HTMLElement>;
  onPointerCancel: React.PointerEventHandler<HTMLElement>;
  onClick: React.MouseEventHandler<HTMLElement>;
  onContextMenu: React.MouseEventHandler<HTMLElement>;
}

function isInteractiveTarget(event: React.SyntheticEvent<HTMLElement>): boolean {
  const target = event.target as HTMLElement | null;
  if (!target || target === event.currentTarget) return false;
  const match = target.closest(INTERACTIVE_SELECTOR);
  return Boolean(match && event.currentTarget.contains(match));
}

/**
 * Mobile-first gestures for a chat bubble:
 * - double-tap → `onDoubleTap` (e.g. thumbs-up like)
 * - single tap / long-press → `onTap` / `onLongPress` (e.g. open the action drawer)
 *
 * Gestures only respond to touch and pen input, so desktop mouse users keep
 * normal text selection and use the hover toolbar instead. Moving the finger
 * past a small threshold cancels the gesture so scrolling never opens a menu.
 */
export function useMessageGestures({
  enabled = true,
  onDoubleTap,
  onTap,
  onLongPress,
}: MessageGestureOptions): MessageGestureHandlers {
  const callbacksRef = React.useRef({ onDoubleTap, onTap, onLongPress });
  React.useEffect(() => {
    callbacksRef.current = { onDoubleTap, onTap, onLongPress };
  });

  const pointerTypeRef = React.useRef<string>('mouse');
  const originRef = React.useRef<{ x: number; y: number } | null>(null);
  const movedRef = React.useRef(false);
  const longPressFiredRef = React.useRef(false);
  const lastTapAtRef = React.useRef(0);
  const tapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTapTimer = React.useCallback(() => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  }, []);

  const clearPressTimer = React.useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      clearTapTimer();
      clearPressTimer();
    },
    [clearTapTimer, clearPressTimer]
  );

  return React.useMemo<MessageGestureHandlers>(() => {
    const isTouchLike = () => pointerTypeRef.current !== 'mouse';

    return {
      onPointerDown: (event) => {
        pointerTypeRef.current = event.pointerType;
        if (!enabled || !isTouchLike() || isInteractiveTarget(event)) return;

        originRef.current = { x: event.clientX, y: event.clientY };
        movedRef.current = false;
        longPressFiredRef.current = false;

        clearPressTimer();
        pressTimerRef.current = setTimeout(() => {
          pressTimerRef.current = null;
          if (movedRef.current || !callbacksRef.current.onLongPress) return;
          longPressFiredRef.current = true;
          clearTapTimer();
          lastTapAtRef.current = 0;
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(10);
          }
          callbacksRef.current.onLongPress();
        }, LONG_PRESS_MS);
      },

      onPointerMove: (event) => {
        const origin = originRef.current;
        if (!origin || movedRef.current) return;
        if (
          Math.abs(event.clientX - origin.x) > MOVE_TOLERANCE_PX ||
          Math.abs(event.clientY - origin.y) > MOVE_TOLERANCE_PX
        ) {
          movedRef.current = true;
          clearPressTimer();
        }
      },

      onPointerUp: () => {
        originRef.current = null;
        clearPressTimer();
      },

      onPointerCancel: () => {
        originRef.current = null;
        movedRef.current = true;
        clearPressTimer();
      },

      onClick: (event) => {
        if (!enabled || !isTouchLike() || isInteractiveTarget(event)) return;

        // The click that follows a long-press (or a scroll) must not count as a tap.
        if (longPressFiredRef.current || movedRef.current) {
          longPressFiredRef.current = false;
          return;
        }

        const now = Date.now();
        if (now - lastTapAtRef.current < DOUBLE_TAP_MS) {
          clearTapTimer();
          lastTapAtRef.current = 0;
          callbacksRef.current.onDoubleTap?.();
          return;
        }

        lastTapAtRef.current = now;
        clearTapTimer();
        tapTimerRef.current = setTimeout(() => {
          tapTimerRef.current = null;
          callbacksRef.current.onTap?.();
        }, DOUBLE_TAP_MS);
      },

      // Suppress the native touch context menu so long-press opens our drawer instead.
      onContextMenu: (event) => {
        if (enabled && isTouchLike() && !isInteractiveTarget(event)) {
          event.preventDefault();
        }
      },
    };
  }, [enabled, clearPressTimer, clearTapTimer]);
}
