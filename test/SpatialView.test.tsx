/// <reference types="@testing-library/jest-dom/vitest" />

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	SpatialView,
	SpatialViewContext,
	type SpatialViewContextType,
	SpatialViewProvider,
	calculateMousePosition,
	calculateNewScale,
	calculateZoomPosition,
	useSpatialView,
} from "../src";

const rect = (
	left: number,
	top: number,
	width: number,
	height: number,
): DOMRect =>
	({
		x: left,
		y: top,
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		toJSON: () => ({}),
	}) as DOMRect;

const mockRect = (
	element: Element,
	left: number,
	top: number,
	width: number,
	height: number,
) =>
	vi
		.spyOn(element, "getBoundingClientRect")
		.mockReturnValue(rect(left, top, width, height));

const renderSpatialView = (
	props: Partial<React.ComponentProps<typeof SpatialView>> = {},
	child: React.ReactNode = <button type="button">Target</button>,
) => {
	const view = render(
		<SpatialViewProvider>
			<SpatialView {...props}>{child}</SpatialView>
		</SpatialViewProvider>,
	);

	const target = screen.getByText("Target");
	const content = target.parentElement as HTMLElement;
	const container = content.parentElement as HTMLElement;
	return { ...view, container, content, target };
};

class TestDOMMatrix {
	a: number;

	constructor(transform: string) {
		const matrix = transform.match(/matrix\(([^,]+)/);
		const scale = transform.match(/scale\(([^)]+)/);
		this.a = matrix ? Number(matrix[1]) : scale ? Number(scale[1]) : 1;
	}
}

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("SpatialView", () => {
	it("renders children inside the provider", () => {
		render(
			<SpatialViewProvider>
				<SpatialView>
					<button type="button">Target</button>
				</SpatialView>
			</SpatialViewProvider>,
		);

		expect(screen.getByRole("button", { name: "Target" })).toBeInTheDocument();
	});

	it("applies initial scale, position, padding, and zoom duration", () => {
		const { content } = renderSpatialView({
			initialScale: 2,
			initialPosition: { x: 12, y: 24 },
			padding: "8px",
			zoomDuration: 75,
		});

		expect(content).toHaveStyle({
			padding: "8px",
			transform: "translate(12px, 24px) scale(2)",
			transition: "transform 75ms",
		});
	});

	it("drags with mouse and stops dragging on mouse up and mouse leave", () => {
		const { container, content } = renderSpatialView();
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.mouseDown(container, { clientX: 50, clientY: 50 });
		fireEvent.mouseMove(container, { clientX: 20, clientY: 25 });

		expect(content).toHaveStyle({
			transform: "translate(-30px, -25px) scale(1)",
			transition: "none",
			willChange: "transform",
		});

		fireEvent.mouseUp(container);
		expect(content).toHaveStyle({ transition: "transform 50ms" });

		fireEvent.mouseDown(container, { clientX: 50, clientY: 50 });
		fireEvent.mouseLeave(container);
		expect(content).toHaveStyle({ transition: "transform 50ms" });
	});

	it("ignores mouse movement before dragging starts", () => {
		const { container, content } = renderSpatialView();
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.mouseMove(container, { clientX: 20, clientY: 25 });

		expect(content).toHaveStyle({
			transform: "translate(0px, 0px) scale(1)",
		});
	});

	it("does not start mouse or touch panning from excluded elements", () => {
		const { container, content, target } = renderSpatialView(
			{ excludePan: [".no-pan"] },
			<button className="no-pan" type="button">
				Target
			</button>,
		);
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.mouseDown(target, { clientX: 50, clientY: 50 });
		fireEvent.mouseMove(container, { clientX: 20, clientY: 25 });
		fireEvent.touchStart(target, { touches: [{ clientX: 50, clientY: 50 }] });
		fireEvent.touchMove(container, { touches: [{ clientX: 20, clientY: 25 }] });

		expect(content).toHaveStyle({
			transform: "translate(0px, 0px) scale(1)",
		});
	});

	it("allows unconstrained mouse panning when constrainPan is false", () => {
		const { container, content } = renderSpatialView({ constrainPan: false });
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.mouseDown(container, { clientX: 50, clientY: 50 });
		fireEvent.mouseMove(container, { clientX: 120, clientY: 130 });

		expect(content).toHaveStyle({
			transform: "translate(70px, 80px) scale(1)",
		});
	});

	it("does not constrain mouse panning while zooming", () => {
		const ZoomToggle = () => {
			const { setIsZooming } = useSpatialView();
			return (
				<button type="button" onClick={() => setIsZooming(true)}>
					Target
				</button>
			);
		};
		const { container, content, target } = renderSpatialView(
			{},
			<ZoomToggle />,
		);
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.click(target);
		fireEvent.mouseDown(container, { clientX: 50, clientY: 50 });
		fireEvent.mouseMove(container, { clientX: 120, clientY: 130 });

		expect(content).toHaveStyle({
			transform: "translate(70px, 80px) scale(1)",
		});
	});

	it("prevents native drag behavior", () => {
		const { container } = renderSpatialView();
		const event = new Event("dragstart", { bubbles: true, cancelable: true });

		container.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it("pans with a wheel gesture and clears the moving state", () => {
		vi.useFakeTimers();
		const { container, content } = renderSpatialView();
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.wheel(container, {
			deltaX: 10,
			deltaY: 15,
			deltaMode: 0,
			clientX: 0,
			clientY: 0,
		});
		fireEvent.wheel(container, {
			deltaX: 5,
			deltaY: 5,
			deltaMode: 1,
			clientX: 0,
			clientY: 0,
		});
		fireEvent.wheel(container, {
			deltaX: 0,
			deltaY: 5,
			deltaMode: 0,
			clientX: 0,
			clientY: 0,
		});

		expect(content).toHaveStyle({
			transform: "translate(-15px, -25px) scale(1)",
			transition: "none",
		});

		act(() => {
			vi.advanceTimersByTime(100);
		});

		expect(content).toHaveStyle({ transition: "transform 50ms" });
	});

	it("zooms with ctrl wheel gestures using trackpad and mouse sensitivity", () => {
		vi.useFakeTimers();
		const { container, content } = renderSpatialView();
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.wheel(container, {
			ctrlKey: true,
			deltaY: -10,
			deltaMode: 0,
			clientX: 50,
			clientY: 50,
		});

		expect(content).toHaveStyle({
			transform: "translate(-2.5px, -2.5px) scale(1.05)",
			willChange: "transform",
		});

		fireEvent.wheel(container, {
			ctrlKey: true,
			deltaY: -25,
			deltaMode: 0,
			clientX: 50,
			clientY: 50,
		});

		expect(content).toHaveStyle({
			transform: "translate(-13px, -13px) scale(1.26)",
		});

		act(() => {
			vi.advanceTimersByTime(100);
		});

		expect(content).toHaveStyle({ willChange: "auto" });
	});

	it("centers smaller content after constrained adjustment", () => {
		vi.useFakeTimers();
		const { container, content } = renderSpatialView({
			initialPosition: { x: -500, y: -500 },
		});
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 50, 40);

		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(content).toHaveStyle({
			transform: "translate(25px, 30px) scale(1)",
			transition: "transform 0.2s ease-in-out",
		});

		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(content).toHaveStyle({ transition: "transform 50ms" });
	});

	it("cleans up a pending constrained adjustment on unmount", () => {
		vi.useFakeTimers();
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
		const { unmount } = render(
			<SpatialViewProvider>
				<SpatialView>
					<button type="button">Target</button>
				</SpatialView>
			</SpatialViewProvider>,
		);

		unmount();

		expect(clearTimeoutSpy).toHaveBeenCalled();
	});

	it("skips transition restoration when content unmounts first", () => {
		vi.useFakeTimers();
		const { container, content, unmount } = renderSpatialView({
			initialPosition: { x: -500, y: -500 },
		});
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 50, 40);

		act(() => {
			vi.advanceTimersByTime(200);
		});
		unmount();
		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(content.isConnected).toBe(false);
	});

	it("handles stale native listeners after unmount", () => {
		const listeners = new Map<string, EventListener>();
		const originalAddEventListener = HTMLElement.prototype.addEventListener;
		vi.spyOn(HTMLElement.prototype, "addEventListener").mockImplementation(
			function (
				this: HTMLElement,
				type: string,
				listener: EventListenerOrEventListenerObject,
				options?: boolean | AddEventListenerOptions,
			) {
				if (typeof listener === "function") {
					listeners.set(type, listener);
				}
				return originalAddEventListener.call(this, type, listener, options);
			},
		);

		const { container, unmount } = renderSpatialView();
		const touchStart = listeners.get("touchstart");
		const touchMove = listeners.get("touchmove");
		const wheel = listeners.get("wheel");
		expect(touchStart).toBeDefined();
		expect(touchMove).toBeDefined();
		expect(wheel).toBeDefined();

		act(() => {
			touchStart?.({
				target: container,
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 0, clientY: 100 },
				],
			} as unknown as Event);
		});
		unmount();

		expect(() => {
			wheel?.({
				preventDefault: vi.fn(),
				stopPropagation: vi.fn(),
				ctrlKey: true,
				deltaX: 0,
				deltaY: -1,
				deltaMode: 0,
				clientX: 0,
				clientY: 0,
			} as unknown as Event);
			wheel?.({
				preventDefault: vi.fn(),
				stopPropagation: vi.fn(),
				ctrlKey: false,
				deltaX: 0,
				deltaY: 10,
				deltaMode: 1,
				clientX: 0,
				clientY: 0,
			} as unknown as Event);
			touchMove?.({
				preventDefault: vi.fn(),
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 0, clientY: 200 },
				],
			} as unknown as Event);
		}).not.toThrow();
	});

	it("drags and ends with touch gestures", () => {
		const { container, content } = renderSpatialView();
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.touchStart(container, {
			touches: [{ clientX: 50, clientY: 50 }],
		});
		fireEvent.touchMove(container, { touches: [{ clientX: 20, clientY: 25 }] });

		expect(content).toHaveStyle({
			transform: "translate(-30px, -25px) scale(1)",
			transition: "none",
		});

		fireEvent.touchEnd(container);
		expect(content).toHaveStyle({ transition: "transform 50ms" });

		fireEvent.touchStart(container, {
			touches: [{ clientX: 50, clientY: 50 }],
		});
		fireEvent.touchCancel(container);
		expect(content).toHaveStyle({ transition: "transform 50ms" });
	});

	it("does not constrain touch panning while zooming", () => {
		const ZoomToggle = () => {
			const { setIsZooming } = useSpatialView();
			return (
				<button type="button" onClick={() => setIsZooming(true)}>
					Target
				</button>
			);
		};
		const { container, content, target } = renderSpatialView(
			{},
			<ZoomToggle />,
		);
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.click(target);
		fireEvent.touchStart(container, {
			touches: [{ clientX: 50, clientY: 50 }],
		});
		fireEvent.touchMove(container, {
			touches: [{ clientX: 120, clientY: 130 }],
		});

		expect(content).toHaveStyle({
			transform: "translate(70px, 80px) scale(1)",
		});
	});

	it("pinch zooms around the touch center", () => {
		const { container, content } = renderSpatialView();
		mockRect(container, 0, 0, 100, 100);
		mockRect(content, 0, 0, 300, 300);

		fireEvent.touchStart(container, {
			touches: [
				{ clientX: 0, clientY: 0 },
				{ clientX: 0, clientY: 100 },
			],
		});
		fireEvent.touchStart(container, {
			touches: [
				{ clientX: 0, clientY: 0 },
				{ clientX: 0, clientY: 100 },
				{ clientX: 100, clientY: 100 },
			],
		});
		fireEvent.touchMove(container, {
			touches: [
				{ clientX: 0, clientY: 0 },
				{ clientX: 0, clientY: 200 },
			],
		});

		expect(content).toHaveStyle({
			transform: "translate(0px, -100px) scale(2)",
			willChange: "transform",
		});
	});

	it("jumps to an element and restores the configured transition", () => {
		vi.useFakeTimers();
		vi.stubGlobal("DOMMatrix", TestDOMMatrix);

		const JumpTarget = () => {
			const { jumpToElement, scale, position } = useSpatialView();
			return (
				<>
					<button
						type="button"
						onClick={(event) =>
							jumpToElement(event.currentTarget, { padding: 10 })
						}
					>
						Target
					</button>
					/output {scale} {position.x} {position.y}
				</>
			);
		};

		const { container, content, target } = renderSpatialView(
			{ zoomDuration: 80 },
			<JumpTarget />,
		);
		mockRect(container, 0, 0, 200, 100);
		mockRect(content, 0, 0, 300, 300);
		mockRect(target, 10, 20, 20, 10);

		fireEvent.click(target);

		expect(screen.getByText("/output 5 0 -75")).toBeInTheDocument();
		expect(content).toHaveStyle({
			transition: "transform 0.5s ease-in-out",
		});

		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(content).toHaveStyle({ transition: "transform 80ms" });
	});

	it("returns early when jump target has no spatial containers", () => {
		const JumpOutside = () => {
			const { jumpToElement, scale, position } = useSpatialView();
			return (
				<>
					<button
						type="button"
						onClick={() =>
							jumpToElement(document.createElement("button"), { padding: 10 })
						}
					>
						Target
					</button>
					/output {scale} {position.x} {position.y}
				</>
			);
		};

		renderSpatialView({}, <JumpOutside />);

		fireEvent.click(screen.getByText("Target"));

		expect(screen.getByText("/output 1 0 0")).toBeInTheDocument();
	});

	it("returns early when jump target has no transformed content container", () => {
		const JumpWithoutContent = () => {
			const { jumpToElement, scale, position } = useSpatialView();
			return (
				<>
					<button
						type="button"
						onClick={() => {
							const container = document.createElement("div");
							container.style.overflow = "hidden";
							const child = document.createElement("button");
							container.appendChild(child);
							jumpToElement(child);
						}}
					>
						Target
					</button>
					/output {scale} {position.x} {position.y}
				</>
			);
		};

		renderSpatialView({}, <JumpWithoutContent />);

		fireEvent.click(screen.getByText("Target"));

		expect(screen.getByText("/output 1 0 0")).toBeInTheDocument();
	});

	it("jumps without transition updates when the content ref is empty", () => {
		vi.useFakeTimers();
		vi.stubGlobal("DOMMatrix", TestDOMMatrix);
		const setScale = vi.fn();
		const setPosition = vi.fn();
		const scaleRef = { current: 1 };
		const positionRef = { current: { x: 0, y: 0 } };

		const HookConsumer = () => {
			const { jumpToElement } = useSpatialView();
			return (
				<button
					type="button"
					onClick={(event) => jumpToElement(event.currentTarget)}
				>
					Target
				</button>
			);
		};

		render(
			<SpatialViewContext.Provider
				value={{
					scale: 1,
					setScale,
					scaleRef,
					position: { x: 0, y: 0 },
					setPosition,
					positionRef,
					isZooming: false,
					setIsZooming: vi.fn(),
					isDragging: false,
					setIsDragging: vi.fn(),
					contentRef: { current: null },
					zoomDuration: 60,
					setContext: vi.fn(),
				}}
			>
				<div style={{ overflow: "hidden" }}>
					<div style={{ transform: "scale(1)" }}>
						<HookConsumer />
					</div>
				</div>
			</SpatialViewContext.Provider>,
		);

		const target = screen.getByText("Target");
		const content = target.parentElement as HTMLElement;
		const container = content.parentElement as HTMLElement;
		mockRect(container, 0, 0, 200, 100);
		mockRect(content, 0, 0, 300, 300);
		mockRect(target, 10, 20, 20, 10);

		fireEvent.click(target);
		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(setScale).toHaveBeenCalledWith(5);
		expect(setPosition).toHaveBeenCalledWith({ x: 0, y: -75 });
		expect(scaleRef.current).toBe(5);
		expect(positionRef.current).toEqual({ x: 0, y: -75 });
	});

	it("jumps using the registered content ref without depending on inline style selectors", () => {
		vi.useFakeTimers();
		vi.stubGlobal("DOMMatrix", TestDOMMatrix);
		const setScale = vi.fn();
		const setPosition = vi.fn();
		const scaleRef = { current: 1 };
		const positionRef = { current: { x: 0, y: 0 } };
		const contentRef: React.RefObject<HTMLDivElement | null> = {
			current: null,
		};

		const HookConsumer = () => {
			const { jumpToElement } = useSpatialView();
			return (
				<div ref={contentRef}>
					<button
						type="button"
						onClick={(event) =>
							jumpToElement(event.currentTarget, { padding: 10 })
						}
					>
						Target
					</button>
				</div>
			);
		};

		render(
			<SpatialViewContext.Provider
				value={{
					scale: 1,
					setScale,
					scaleRef,
					position: { x: 0, y: 0 },
					setPosition,
					positionRef,
					isZooming: false,
					setIsZooming: vi.fn(),
					isDragging: false,
					setIsDragging: vi.fn(),
					contentRef,
					zoomDuration: 60,
					setContext: vi.fn(),
				}}
			>
				<section>
					<HookConsumer />
				</section>
			</SpatialViewContext.Provider>,
		);

		const target = screen.getByText("Target");
		const content = target.parentElement as HTMLElement;
		const container = content.parentElement as HTMLElement;
		mockRect(container, 0, 0, 200, 100);
		mockRect(content, 0, 0, 300, 300);
		mockRect(target, 10, 20, 20, 10);

		fireEvent.click(target);

		expect(setScale).toHaveBeenCalledWith(5);
		expect(setPosition).toHaveBeenCalledWith({ x: 0, y: -75 });
	});

	it("throws when the hook receives an undefined context", () => {
		const HookConsumer = () => {
			useSpatialView();
			return null;
		};
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		expect(() =>
			render(
				<SpatialViewContext.Provider
					value={undefined as unknown as SpatialViewContextType}
				>
					<HookConsumer />
				</SpatialViewContext.Provider>,
			),
		).toThrow("useSpatialView must be used within a SpatialViewProvider");

		consoleError.mockRestore();
	});

	it("exposes default context values and no-op setters", () => {
		render(
			<SpatialViewContext.Consumer>
				{(value) => (
					<button
						type="button"
						onClick={() => {
							value.setScale(2);
							value.setPosition({ x: 1, y: 2 });
							value.setIsZooming(true);
							value.setIsDragging(true);
							value.setContext({
								scale: 2,
								setScale: value.setScale,
								scaleRef: value.scaleRef,
								position: { x: 1, y: 2 },
								setPosition: value.setPosition,
								positionRef: value.positionRef,
								isZooming: true,
								setIsZooming: value.setIsZooming,
								isDragging: true,
								setIsDragging: value.setIsDragging,
								contentRef: value.contentRef,
								zoomDuration: value.zoomDuration,
							});
						}}
					>
						{value.scale} {value.position.x} {String(value.isZooming)}{" "}
						{String(value.isDragging)}
					</button>
				)}
			</SpatialViewContext.Consumer>,
		);

		fireEvent.click(screen.getByRole("button"));

		expect(screen.getByRole("button")).toHaveTextContent("1 0 false false");
	});
});

describe("spatial calculations", () => {
	it("clamps zoom scale within the configured range", () => {
		expect(calculateNewScale(1, -1, 0.2, 0.5, 2)).toBe(1.2);
		expect(calculateNewScale(1, 1, 0.8, 0.5, 2)).toBe(0.5);
		expect(calculateNewScale(2, -1, 0.8, 0.5, 2)).toBe(2);
		expect(calculateNewScale(1, 1, 0.2, 0.5, 2)).toBe(0.8);
	});

	it("calculates mouse and zoom positions", () => {
		const rect = {
			left: 10,
			top: 20,
		} as DOMRect;

		const mouse = calculateMousePosition(30, 70, rect, { x: 5, y: 10 }, 5);

		expect(mouse).toEqual({ currentMouseX: 3, currentMouseY: 8 });
		expect(calculateZoomPosition(20, 50, 3, 8, 2)).toEqual({
			x: 14,
			y: 34,
		});
	});
});
