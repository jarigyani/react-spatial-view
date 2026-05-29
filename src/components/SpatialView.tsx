import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSpatialView } from "../hooks/useSpatialView";
import {
  calculateConstrainedPosition,
  calculateMousePosition,
  calculateNewScale,
  calculateZoomPosition,
  type Position,
} from "../spatialMath";

export {
  calculateMousePosition,
  calculateNewScale,
  calculateZoomPosition,
} from "../spatialMath";

type SpatialViewProps = {
  zoomSensitivity?: number;
  trackpadZoomSensitivity?: number;
  children: React.ReactNode;
  excludePan?: string[];
  constrainPan?: boolean;
  padding?: string;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  initialPosition?: Position;
  zoomDuration?: number;
};

export const SpatialView: React.FC<SpatialViewProps> = ({
  children,
  zoomSensitivity = 0.2,
  trackpadZoomSensitivity = 0.05,
  excludePan = [],
  constrainPan = true,
  padding = "0",
  minScale = 0.1,
  maxScale = 5,
  initialScale = 1,
  initialPosition = { x: 0, y: 0 },
  zoomDuration = 50,
}) => {
  const { setContext } = useSpatialView();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(initialScale);
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isZooming, setIsZooming] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const positionRef = useRef(position);
  const scaleRef = useRef(scale);
  const zoomTimeoutRef = useRef<number | null>(null);
  const dragTimeoutRef = useRef<number | null>(null);
  const adjustmentTimeoutRef = useRef<number | null>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);

  const contextValue = useMemo(
    () => ({
      scale,
      setScale,
      scaleRef,
      position,
      setPosition,
      positionRef,
      isZooming,
      setIsZooming,
      isDragging,
      setIsDragging,
      contentRef,
      zoomDuration,
    }),
    [scale, position, isZooming, isDragging, zoomDuration]
  );

  useEffect(() => {
    setContext(contextValue);
  }, [contextValue, setContext]);

  const updatePosition = useCallback((newPosition: Position) => {
    positionRef.current = newPosition;
    setPosition(newPosition);
  }, []);

  const updateScale = useCallback((newScale: number) => {
    scaleRef.current = newScale;
    setScale(newScale);
  }, []);

  const calculateBounds = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return null;
    const container = containerRef.current.getBoundingClientRect();
    const content = contentRef.current.getBoundingClientRect();
    const scaledContentWidth = content.width / scaleRef.current;
    const scaledContentHeight = content.height / scaleRef.current;

    return {
      container,
      content: {
        width: scaledContentWidth,
        height: scaledContentHeight,
      },
    };
  }, []);

  const constrainPosition = useCallback(
    (pos: Position, scl: number): Position => {
      const bounds = calculateBounds();
      if (!bounds || !constrainPan) return pos;
      return calculateConstrainedPosition(pos, scl, bounds);
    },
    [constrainPan, calculateBounds]
  );

  useEffect(() => {
    if (!isZooming && constrainPan) {
      if (adjustmentTimeoutRef.current) {
        clearTimeout(adjustmentTimeoutRef.current);
      }
      adjustmentTimeoutRef.current = window.setTimeout(() => {
        const adjustedPosition = constrainPosition(
          positionRef.current,
          scaleRef.current
        );
        const isPositionChanged =
          positionRef.current.x !== adjustedPosition.x ||
          positionRef.current.y !== adjustedPosition.y;
        updatePosition(adjustedPosition);
        if (!isZooming && contentRef.current && isPositionChanged) {
          contentRef.current.style.transition = "transform 0.2s ease-in-out";
          setTimeout(() => {
            if (contentRef.current) {
              contentRef.current.style.transition = `transform ${zoomDuration}ms`;
            }
          }, 200);
        }
      }, 200);
    }
    return () => {
      if (adjustmentTimeoutRef.current) {
        clearTimeout(adjustmentTimeoutRef.current);
      }
    };
  }, [
    isZooming,
    constrainPosition,
    constrainPan,
    updatePosition,
    zoomDuration,
  ]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const isPanGesture =
        Math.abs(e.deltaX) > 0 || (!e.ctrlKey && e.deltaMode === 0);
      const isMouseWheel = e.deltaMode === 0 && Math.abs(e.deltaY) >= 25;

      if ((e.ctrlKey || isMouseWheel) && !isPanGesture) {
        e.stopPropagation();
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        setIsZooming(true);

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const { currentMouseX, currentMouseY } = calculateMousePosition(
          e.clientX,
          e.clientY,
          rect,
          positionRef.current,
          scaleRef.current
        );

        const sensitivity = isMouseWheel
          ? zoomSensitivity
          : trackpadZoomSensitivity;
        const newScale = calculateNewScale(
          scaleRef.current,
          e.deltaY,
          sensitivity,
          minScale,
          maxScale
        );

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const newPosition = calculateZoomPosition(
          mouseX,
          mouseY,
          currentMouseX,
          currentMouseY,
          newScale
        );
        updatePosition(newPosition);
        updateScale(newScale);

        zoomTimeoutRef.current = window.setTimeout(() => {
          setIsZooming(false);
        }, 100);
      } else {
        setIsMoving(true);
        const newPosition = {
          x: positionRef.current.x - e.deltaX,
          y: positionRef.current.y - e.deltaY,
        };
        const adjustedPosition = constrainPosition(
          newPosition,
          scaleRef.current
        );
        updatePosition(adjustedPosition);

        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
        dragTimeoutRef.current = window.setTimeout(() => {
          setIsMoving(false);
        }, 100);
      }
    },
    [
      updatePosition,
      updateScale,
      constrainPosition,
      zoomSensitivity,
      trackpadZoomSensitivity,
      minScale,
      maxScale,
    ]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const isPanDisabled = excludePan.some(
        (selector) => target.closest(selector) !== null
      );
      if (isPanDisabled) return;

      if (e.touches.length === 1) {
        setIsDragging(true);
        dragStart.current = {
          x: e.touches[0].clientX - positionRef.current.x,
          y: e.touches[0].clientY - positionRef.current.y,
        };
      } else if (e.touches.length === 2) {
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchDistanceRef.current = distance;
        setIsZooming(true);
      }
    },
    [excludePan]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && isDragging) {
        const newPosition = {
          x: e.touches[0].clientX - dragStart.current.x,
          y: e.touches[0].clientY - dragStart.current.y,
        };
        const adjustedPosition = isZooming
          ? newPosition
          : constrainPosition(newPosition, scaleRef.current);
        updatePosition(adjustedPosition);
      } else if (
        e.touches.length === 2 &&
        lastTouchDistanceRef.current !== null
      ) {
        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const { currentMouseX, currentMouseY } = calculateMousePosition(
          centerX,
          centerY,
          rect,
          positionRef.current,
          scaleRef.current
        );

        const scaleFactor = newDistance / lastTouchDistanceRef.current;
        const newScale = Number(
          Math.min(
            maxScale,
            Math.max(minScale, scaleRef.current * scaleFactor)
          ).toFixed(3)
        );

        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;
        const newPosition = calculateZoomPosition(
          mouseX,
          mouseY,
          currentMouseX,
          currentMouseY,
          newScale
        );

        updatePosition(newPosition);
        updateScale(newScale);
        lastTouchDistanceRef.current = newDistance;
      }
    },
    [
      isDragging,
      isZooming,
      constrainPosition,
      updatePosition,
      updateScale,
      minScale,
      maxScale,
    ]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsZooming(false);
    lastTouchDistanceRef.current = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    /* v8 ignore next -- React sets DOM refs before this effect runs. */
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const isPanDisabled = excludePan.some(
        (selector) => target.closest(selector) !== null
      );
      if (isPanDisabled) return;

      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y,
      };
    },
    [excludePan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const newPosition = {
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      };

      const adjustedPosition = isZooming
        ? newPosition
        : constrainPosition(newPosition, scaleRef.current);
      updatePosition(adjustedPosition);
    },
    [isDragging, isZooming, constrainPosition, updatePosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const contentStyle = useMemo(
    () => ({
      transition:
        isDragging || isMoving ? "none" : `transform ${zoomDuration}ms`,
      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
      transformOrigin: "0 0",
      willChange: isZooming || isDragging || isMoving ? "transform" : "auto",
      filter: "none",
      WebkitTransform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
      padding: padding,
      backfaceVisibility: "hidden" as const,
      WebkitFontSmoothing: "antialiased" as const,
      textRendering: "optimizeLegibility" as const,
      width: "max-content" as const,
      height: "max-content" as const,
      imageRendering: "crisp-edges" as const,
      WebkitBackfaceVisibility: "hidden" as const,
      transformStyle: "preserve-3d" as const,
    }),
    [
      position.x,
      position.y,
      scale,
      isZooming,
      isDragging,
      isMoving,
      padding,
      zoomDuration,
    ]
  );

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative" as const,
        touchAction: "none",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragStart={handleDragStart}
    >
      <div ref={contentRef} style={contentStyle}>
        {children}
      </div>
    </div>
  );
};
