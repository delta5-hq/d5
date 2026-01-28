# @d5/tgs-player

Minimal TGS/Lottie to standalone SVG animation converter.

## Architecture

```
src/
├── index.ts              # Public API exports
├── cli.ts                # CLI entry point
├── parser/               # TGS/Lottie parsing
│   ├── lottie-types.ts   # Type definitions
│   ├── tgs-decompressor.ts
│   └── metadata-extractor.ts
├── converter/            # Conversion orchestration
│   ├── tgs-converter.ts  # Main converter class
│   └── types.ts          # Options and result types
├── generator/            # Code generation
│   ├── standalone-generator.ts
│   ├── data-serializer.ts
│   └── runtime-bundler.ts
└── runtime/              # Embeddable player runtime
    ├── bezier-easer.ts   # MIT - Gaëtan Renaudeau
    ├── interpolator.ts   # Keyframe interpolation
    ├── svg-builder.ts    # SVG DOM construction
    └── player.ts         # Animation controller
```

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
