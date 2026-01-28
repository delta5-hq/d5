# @d5/tgs-player

The TGS player is built on Lottie format (which After Effects exports via Bodymovin), but with constraints:

**What it supports:**

- Vector shapes (paths, rectangles, ellipses)
- Solid fills and strokes
- Gradient fills (linear/radial)
- Transforms (position, scale, rotation, anchor)
- Trim paths
- Precompositions (nested layers)
- Layer parenting
- Keyframe interpolation with bezier easing

**What it does NOT support (common in AE exports):**

- Images/bitmaps - TGS forbids embedded images
- Masks - not implemented
- Mattes - not implemented
- Effects (blur, glow, etc.) - not implemented
- Text layers - not implemented
- 3D transforms - not implemented
- Expressions - not implemented

Currently only accepts `.tgs` files (gzipped Lottie).

## Usage

```bash
pnpm convert input.tgs output.player.js && python3 -m http.server 8888 -d output
# Open http://localhost:8888/test.html
```

```typescript
import { TgsConverter } from '@d5/tgs-player';
const result = new TgsConverter().convertFromBuffer(tgsBuffer);
```

## Framework Integration

The output is a self-contained IIFE bundle (`.player.js`) that:

1. **Exposes a global `TgsPlayer` class** - can be instantiated on any DOM element
2. **Creates pure SVG** - no external dependencies, no canvas, just DOM manipulation
3. **Works with any framework** via refs:

**React example:**
```jsx
useEffect(() => {
  const player = new TgsPlayer(animationData, 'my-container');
  player.play();
  return () => player.stop();
}, []);
```

**Angular example:**
```typescript
ngAfterViewInit() {
  this.player = new TgsPlayer(animationData, 'my-container');
  this.player.play();
}
```

**Vue example:**
```javascript
mounted() {
  this.player = new TgsPlayer(animationData, 'my-container');
  this.player.play();
}
```

The animation data JSON is embedded in the bundle, or can be passed separately. Just include the script and instantiate on a container div.

## License

MIT (BezierEaser attribution: Gaëtan Renaudeau 2014-2015)
