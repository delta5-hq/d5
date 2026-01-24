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
# CLI
pnpm convert input.tgs output.js

# Programmatic
import { TgsConverter } from '@d5/tgs-player';

const converter = new TgsConverter();
const result = converter.convertFromBuffer(tgsBuffer);
```

## License

MIT (BezierEaser attribution: Gaëtan Renaudeau 2014-2015)
