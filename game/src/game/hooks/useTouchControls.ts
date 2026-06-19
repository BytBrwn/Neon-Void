import { useRef, useCallback } from "react";
import type { InputState } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InputMode = "touch" | "mouse";

type LeftTouchState = {
  id: number;
  originX: number;
  originY: number;
};

export type JoystickVisual = {
  originX: number;
  originY: number;
  stickX: number;
  stickY: number;
  active: boolean;
};

export type RightThumbVisual = {
  x: number;
  y: number;
  active: boolean;
};

type TouchAimState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JOYSTICK_DEAD_ZONE = 14;
const JOYSTICK_MAX_RADIUS = 52;
const FIRE_GRACE_MS = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number; width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top, width: rect.width, height: rect.height };
}

function clearTouchArrowKeys(keys: Set<string>, touchArrowKeys: Set<string>): void {
  for (const code of touchArrowKeys) keys.delete(code);
  touchArrowKeys.clear();
}

function applyJoystickToKeys(
  keys: Set<string>,
  touchArrowKeys: Set<string>,
  dx: number,
  dy: number,
): void {
  clearTouchArrowKeys(keys, touchArrowKeys);
  const dist = Math.hypot(dx, dy);
  if (dist < JOYSTICK_DEAD_ZONE) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const threshold = 0.38;
  if (nx < -threshold) { keys.add("ArrowLeft"); touchArrowKeys.add("ArrowLeft"); }
  else if (nx > threshold) { keys.add("ArrowRight"); touchArrowKeys.add("ArrowRight"); }
  if (ny < -threshold) { keys.add("ArrowUp"); touchArrowKeys.add("ArrowUp"); }
  else if (ny > threshold) { keys.add("ArrowDown"); touchArrowKeys.add("ArrowDown"); }
}

function clampJoystickDelta(dx: number, dy: number): { dx: number; dy: number } {
  const dist = Math.hypot(dx, dy);
  if (dist <= JOYSTICK_MAX_RADIUS || dist === 0) return { dx, dy };
  const scale = JOYSTICK_MAX_RADIUS / dist;
  return { dx: dx * scale, dy: dy * scale };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type TouchControlsResult = {
  inputModeRef: React.MutableRefObject<InputMode>;
  joystickVisualRef: React.MutableRefObject<JoystickVisual>;
  rightThumbVisualRef: React.MutableRefObject<RightThumbVisual>;
  touchAimRef: React.MutableRefObject<TouchAimState>;
  fireGraceUntilRef: React.MutableRefObject<number>;
  rightTouchIdRef: React.MutableRefObject<number | null>;
  handleTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  handleTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  handleTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void;
};

export function useTouchControls(
  inputRef: React.MutableRefObject<InputState>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
): TouchControlsResult {
  const inputModeRef = useRef<InputMode>("mouse");
  const leftTouchRef = useRef<LeftTouchState | null>(null);
  const rightTouchIdRef = useRef<number | null>(null);
  const fireGraceUntilRef = useRef(0);
  const touchArrowKeysRef = useRef<Set<string>>(new Set());
  const touchAimRef = useRef<TouchAimState>({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const rightThumbVisualRef = useRef<RightThumbVisual>({ x: 0, y: 0, active: false });
  const joystickVisualRef = useRef<JoystickVisual>({
    originX: 0, originY: 0, stickX: 0, stickY: 0, active: false,
  });

  const releaseLeftTouch = useCallback(() => {
    leftTouchRef.current = null;
    clearTouchArrowKeys(inputRef.current.keys, touchArrowKeysRef.current);
    joystickVisualRef.current.active = false;
  }, [inputRef]);

  const releaseRightTouch = useCallback(() => {
    rightTouchIdRef.current = null;
    rightThumbVisualRef.current.active = false;
    fireGraceUntilRef.current = performance.now() + FIRE_GRACE_MS;
  }, []);

  const updateLeftTouch = useCallback(
    (point: { x: number; y: number }) => {
      const left = leftTouchRef.current;
      if (!left) return;
      const rawDx = point.x - left.originX;
      const rawDy = point.y - left.originY;
      const { dx, dy } = clampJoystickDelta(rawDx, rawDy);
      joystickVisualRef.current = {
        originX: left.originX,
        originY: left.originY,
        stickX: left.originX + dx,
        stickY: left.originY + dy,
        active: true,
      };
      applyJoystickToKeys(inputRef.current.keys, touchArrowKeysRef.current, dx, dy);
    },
    [inputRef],
  );

  const updateRightTouch = useCallback((point: { x: number; y: number }) => {
    touchAimRef.current.targetX = point.x;
    touchAimRef.current.targetY = point.y;
    rightThumbVisualRef.current = { x: point.x, y: point.y, active: true };
    fireGraceUntilRef.current = 0;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      inputModeRef.current = "touch";
      const canvas = canvasRef.current;
      if (!canvas) return;
      for (const touch of Array.from(event.changedTouches)) {
        const point = canvasPoint(canvas, touch.clientX, touch.clientY);
        const onLeft = point.x < point.width * 0.5;
        if (onLeft && !leftTouchRef.current) {
          leftTouchRef.current = { id: touch.identifier, originX: point.x, originY: point.y };
          updateLeftTouch(point);
        } else if (!onLeft && rightTouchIdRef.current === null) {
          rightTouchIdRef.current = touch.identifier;
          touchAimRef.current.x = point.x;
          touchAimRef.current.y = point.y;
          updateRightTouch(point);
        }
      }
    },
    [canvasRef, updateLeftTouch, updateRightTouch],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      inputModeRef.current = "touch";
      const canvas = canvasRef.current;
      if (!canvas) return;
      for (const touch of Array.from(event.changedTouches)) {
        const point = canvasPoint(canvas, touch.clientX, touch.clientY);
        const left = leftTouchRef.current;
        if (left && touch.identifier === left.id) {
          updateLeftTouch(point);
          continue;
        }
        if (touch.identifier === rightTouchIdRef.current) {
          updateRightTouch(point);
        }
      }
    },
    [canvasRef, updateLeftTouch, updateRightTouch],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        if (leftTouchRef.current?.id === touch.identifier) releaseLeftTouch();
        if (rightTouchIdRef.current === touch.identifier) releaseRightTouch();
      }
    },
    [releaseLeftTouch, releaseRightTouch],
  );

  return {
    inputModeRef,
    joystickVisualRef,
    rightThumbVisualRef,
    touchAimRef,
    fireGraceUntilRef,
    rightTouchIdRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
