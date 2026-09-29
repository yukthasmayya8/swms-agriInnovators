declare module "shapefile" {
  export function open(source: Buffer | string): Promise<{
    read(): Promise<{ done: boolean; value?: { type: string; geometry: any; properties: any } }>;
  }>;
}
