/// <reference types="@testing-library/jest-dom/vitest" />

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	SpatialView,
	SpatialViewProvider,
	calculateMousePosition,
	calculateNewScale,
	calculateZoomPosition,
} from "../src";

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
});

describe("spatial calculations", () => {
	it("clamps zoom scale within the configured range", () => {
		expect(calculateNewScale(1, -1, 0.2, 0.5, 2)).toBe(1.2);
		expect(calculateNewScale(1, 1, 0.8, 0.5, 2)).toBe(0.5);
		expect(calculateNewScale(2, -1, 0.8, 0.5, 2)).toBe(2);
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
