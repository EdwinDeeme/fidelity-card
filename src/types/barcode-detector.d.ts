declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

declare interface Window {
  BarcodeDetector: typeof BarcodeDetector;
}
