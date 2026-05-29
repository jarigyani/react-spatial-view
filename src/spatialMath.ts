export type Position = {
  x: number;
  y: number;
};

export type SpatialBounds = {
  container: {
    width: number;
    height: number;
  };
  content: {
    width: number;
    height: number;
  };
};

export type JumpTargetLayout = {
  containerRect: DOMRect;
  contentRect: DOMRect;
  elementRect: DOMRect;
  currentScale: number;
  padding: number;
  maxScale?: number;
};

export const calculateNewScale = (
  currentScale: number,
  deltaY: number,
  sensitivity: number,
  minScale: number,
  maxScale: number
): number => {
  return deltaY > 0
    ? Number(
        Math.max(minScale, currentScale - sensitivity * currentScale).toFixed(3)
      )
    : Number(
        Math.min(maxScale, currentScale + sensitivity * currentScale).toFixed(3)
      );
};

export const calculateMousePosition = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  currentPosition: Position,
  scale: number
): { currentMouseX: number; currentMouseY: number } => {
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;
  return {
    currentMouseX: (mouseX - currentPosition.x) / scale,
    currentMouseY: (mouseY - currentPosition.y) / scale,
  };
};

export const calculateZoomPosition = (
  mouseX: number,
  mouseY: number,
  currentMouseX: number,
  currentMouseY: number,
  newScale: number
): Position => {
  return {
    x: mouseX - currentMouseX * newScale,
    y: mouseY - currentMouseY * newScale,
  };
};

export const calculateConstrainedPosition = (
  pos: Position,
  scale: number,
  bounds: SpatialBounds
): Position => {
  const { container, content } = bounds;
  const minX = Math.min(0, container.width - content.width * scale);
  const minY = Math.min(0, container.height - content.height * scale);
  const maxX = Math.max(0, container.width - content.width * scale);
  const maxY = Math.max(0, container.height - content.height * scale);

  return {
    x:
      content.width * scale <= container.width
        ? (container.width - content.width * scale) / 2
        : Math.min(maxX, Math.max(minX, pos.x)),
    y:
      content.height * scale <= container.height
        ? (container.height - content.height * scale) / 2
        : Math.min(maxY, Math.max(minY, pos.y)),
  };
};

export const calculateJumpToElementTransform = ({
  containerRect,
  contentRect,
  elementRect,
  currentScale,
  padding,
  maxScale = 5,
}: JumpTargetLayout): { scale: number; position: Position } => {
  const originalWidth = elementRect.width / currentScale;
  const originalHeight = elementRect.height / currentScale;

  const scaleX = (containerRect.width - padding * 2) / originalWidth;
  const scaleY = (containerRect.height - padding * 2) / originalHeight;
  const scale = Math.min(scaleX, scaleY, maxScale);

  const elementX = (elementRect.left - contentRect.left) / currentScale;
  const elementY = (elementRect.top - contentRect.top) / currentScale;

  const scaledWidth = originalWidth * scale;
  const scaledHeight = originalHeight * scale;

  return {
    scale,
    position: {
      x: (containerRect.width - scaledWidth) / 2 - elementX * scale,
      y: (containerRect.height - scaledHeight) / 2 - elementY * scale,
    },
  };
};
