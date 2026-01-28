export interface ConversionOptions {
  outputFormat: 'standalone' | 'module';
  minify: boolean;
  embedAnimation: boolean;
  targetId?: string;
}

export interface ConversionResult {
  code: string;
  sourceMap?: string;
  metadata: {
    originalSize: number;
    outputSize: number;
    layerCount: number;
    duration: number;
  };
}

export const DEFAULT_OPTIONS: ConversionOptions = {
  outputFormat: 'standalone',
  minify: false,
  embedAnimation: true,
};
