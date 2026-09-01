import catalogJson from "./catalog.json";

export type AssetKind = "brand" | "icon" | "illustration" | "texture";

export interface AssetDefinition {
  readonly id: string;
  readonly kind: AssetKind;
  readonly path: string;
  readonly description: string;
}

export const assetCatalog = catalogJson.assets as readonly AssetDefinition[];
