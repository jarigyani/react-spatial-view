# React Spatial View

A React component library that provides a powerful and flexible spatial view with smooth zooming and panning capabilities.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Jarigyani/react-spatial-view)
[![Demo(Stackblitz)](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/edit/vitejs-vite-rcw5ovqb?file=src%2FApp.tsx)

## Features

- 🖱️ Smooth zooming with mouse wheel and trackpad gestures
- 🎯 Precise panning with mouse drag
- 🎨 Customizable zoom sensitivity and constraints
- 🔄 Smooth animations with configurable duration
- 📏 Constrained panning within boundaries
- 🎮 Programmatic control through hooks
- 🎯 Jump to specific elements with animation

## Installation

```bash
npm install @jarigyani/react-spatial-view
# or
yarn add @jarigyani/react-spatial-view
```

## Basic Usage

```tsx
import { SpatialView, SpatialViewProvider } from '@jarigyani/react-spatial-view';

function App() {
  return (
    <SpatialViewProvider>
      <div style={{ width: '100vw', height: '100vh' }}>
        <SpatialView>
          {/* Your content here */}
          <div>Zoomable and pannable content</div>
        </SpatialView>
      </div>
    </SpatialViewProvider>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| zoomSensitivity | number | 0.2 | Mouse wheel zoom sensitivity |
| trackpadZoomSensitivity | number | 0.05 | Trackpad zoom sensitivity |
| excludePan | string[] | [] | Selectors for elements to exclude from panning |
| constrainPan | boolean | true | Whether to constrain panning within boundaries |
| padding | string | "0" | Padding around the content |
| minScale | number | 0.1 | Minimum zoom scale |
| maxScale | number | 5 | Maximum zoom scale |
| initialScale | number | 1 | Initial zoom scale |
| initialPosition | { x: number, y: number } | { x: 0, y: 0 } | Initial position |
| zoomDuration | number | 50 | Animation duration in milliseconds |

## Using the Hook

The `useSpatialView` hook provides programmatic control over the spatial view:

```tsx
import { useSpatialView } from '@jarigyani/react-spatial-view';

function MyComponent() {
  const { scale, position, jumpToElement } = useSpatialView();

  const handleClick = () => {
    // Jump to a specific element
    const element = document.getElementById('my-element');
    if (element) {
      jumpToElement(element, { padding: 20 });
    }
  };

  return (
    <div>
      Current scale: {scale}
      <button onClick={handleClick}>Jump to element</button>
    </div>
  );
}
```

## License

MIT
