import { useCallback, useContext } from "react";
import { SpatialViewContext } from "../contexts/SpatialViewContext";
import { calculateJumpToElementTransform } from "../spatialMath";

export type JumpToElement = (
  element: HTMLElement,
  options?: JumpToElementOptions
) => void;

type JumpToElementOptions = {
  padding?: number;
  animate?: boolean;
};

export const useSpatialView = () => {
  const context = useContext(SpatialViewContext);
  if (context === undefined) {
    throw new Error("useSpatialView must be used within a SpatialViewProvider");
  }
  const {
    setScale,
    setPosition,
    contentRef,
    scaleRef,
    positionRef,
    zoomDuration,
  } = context;

  const jumpToElement = useCallback(
    (element: HTMLElement, options: JumpToElementOptions = {}) => {
      const { padding = 0 } = options;

      const spatialElements = resolveSpatialElements(element, contentRef.current);
      if (!spatialElements) return;

      const { container, content } = spatialElements;
      const containerRect = container.getBoundingClientRect();

      const contentTransform = new DOMMatrix(
        getComputedStyle(content).transform
      );
      const currentScale = contentTransform.a;

      const elementRect = element.getBoundingClientRect();
      const { scale: newScale, position: newPosition } =
        calculateJumpToElementTransform({
          containerRect,
          contentRect: content.getBoundingClientRect(),
          elementRect,
          currentScale,
          padding,
        });

      const el = contentRef.current;
      if (el) el.style.transition = "transform 0.5s ease-in-out";

      scaleRef.current = newScale;
      setScale(newScale);
      positionRef.current = newPosition;
      setPosition(newPosition);
      setTimeout(() => {
        if (el) el.style.transition = `transform ${zoomDuration}ms`;
      }, 500);
    },
    [setScale, setPosition, contentRef, scaleRef, positionRef, zoomDuration]
  );
  return { ...context, jumpToElement };
};

const resolveSpatialElements = (
  element: HTMLElement,
  contentRefElement: HTMLDivElement | null
): { container: HTMLElement; content: HTMLElement } | null => {
  const container = element.closest<HTMLElement>('[style*="overflow: hidden"]');
  const content = element.closest<HTMLElement>('[style*="transform"]');
  if (container && content) return { container, content };

  if (contentRefElement?.contains(element) && contentRefElement.parentElement) {
    return {
      container: contentRefElement.parentElement,
      content: contentRefElement,
    };
  }

  return null;
};
