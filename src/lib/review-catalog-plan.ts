export const REVIEW_COMBO = {
  version: "voglia-combo-97-v1",
  handle: "voglia-combo-tinte-90ml-peroxido-20vol-140ml",
  title: "Voglia · Tinte 90 ml + peróxido 20 vol 140 ml",
  amount: 97,
  regionId: "reg_01KZD6DTGVRN9TRSFJAB8XK1A1",
  channelId: "sc_01KZD6DTFPXNTG52EGDHYY00BJ",
  locationId: "sloc_01KZD6DTJKJ7T24DQ3WK2EWKR3",
  sourceProductId: "prod_01KZD6DTRZ5FRV83AZ858B7H64",
  sourceVariantId: "variant_01KZD6DTTTN2NGA4QHCTTBFTVG",
  // Only approved tone identities; never import the historical CSV stock column.
  tones: [{ code:"1", name:"Negro" }, { code:"3", name:"Castaño oscuro" }],
  testTubeQuantity: 3,
  testPeroxideQuantity: 6,
  source: "Propietaria SICARÚ 2026-10-18; data/voglia-catalog-master-final.csv, tonos APPROVED con factura NFV94388 y carta aportada",
} as const;

export function assertReviewCataloguePreflight(data: {
  regionIds:string[]; channelIds:string[]; locationIds:string[];
  sourceVariants:{id:string;sku?:string|null;manage_inventory:boolean;allow_backorder:boolean}[];
  vatRates:number[];
}) {
  if (!data.regionIds.includes(REVIEW_COMBO.regionId) || !data.channelIds.includes(REVIEW_COMBO.channelId) ||
    !data.locationIds.includes(REVIEW_COMBO.locationId) || !data.vatRates.includes(16)) throw new Error("Review catalogue context changed; no changes applied.");
  const tube=data.sourceVariants.find(variant=>variant.id===REVIEW_COMBO.sourceVariantId);
  if (!tube || tube.sku!=="VOGLIA-TINTE-90ML" || !tube.manage_inventory || tube.allow_backorder) throw new Error("The original tube could not be verified; no changes applied.");
}
