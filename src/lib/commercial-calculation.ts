export type SaleType =
  | "unidade"
  | "peca"
  | "caixa"
  | "embalagem"
  | "metro_linear"
  | "metro_quadrado"
  | "metro_cubico"
  | "peso"
  | "volume"
  | "kit";

export type UnitMeasure =
  | "un"
  | "peca"
  | "caixa"
  | "embalagem"
  | "m"
  | "m2"
  | "m3"
  | "kg"
  | "l"
  | "kit";

export interface CommercialProduct {
  id?: string;
  name: string;
  price: number;
  sale_type?: SaleType;
  unit_measure?: UnitMeasure;
  display_unit?: UnitMeasure | string | null;
  area_per_piece?: number | null;
  area_per_box?: number | null;
  area_per_package?: number | null;
  meters_per_piece?: number | null;
  meters_per_box?: number | null;
  meters_per_package?: number | null;
  volume_per_unit?: number | null;
  volume_per_package?: number | null;
  weight_per_unit?: number | null;
  weight_per_package?: number | null;
  pieces_per_box?: number | null;
  pieces_per_package?: number | null;
  linear_measure?: number | null;
  square_measure?: number | null;
  packaging_closed?: boolean | null;
  open_package_allowed?: boolean | null;
  minimum_sale_quantity?: number | null;
  sale_multiple?: number | null;
  fractional_sale_allowed?: boolean | null;
  default_loss_margin?: number | null;
  loss_margin?: number | null;
}

export interface CommercialInput {
  quantity?: number | null;
  requestedMeasurement?: number | null;
  areaDesiredM2?: number | null;
  weightDesiredKg?: number | null;
  volumeDesiredLiters?: number | null;
  cubicMetersDesired?: number | null;
  lossMargin?: number | null;
}

export interface CommercialCalculation {
  saleType: SaleType;
  unitMeasure: UnitMeasure;
  displayUnit: string;
  quantityInformadaCliente: number;
  quantityCalculatedSystem: number;
  quantityOriginal: number;
  quantityFinal: number;
  operationalQuantity: number;
  requestedMeasurement: number | null;
  areaInformedM2: number | null;
  totalAreaM2: number | null;
  weightInformedKg: number | null;
  totalWeightKg: number | null;
  volumeInformedLiters: number | null;
  totalVolumeLiters: number | null;
  cubicMetersInformed: number | null;
  totalCubicMeters: number | null;
  calculatedBoxes: number | null;
  calculatedPieces: number | null;
  calculatedPackages: number | null;
  lossMarginApplied: number | null;
  packagingClosed: boolean;
  openPackageAllowed: boolean;
  fractionalAllowed: boolean;
  minimumSaleQuantity: number | null;
  saleMultiple: number | null;
  unitPrice: number;
  subtotal: number;
  commercialRuleApplied: string;
  clientLabel: string;
  operationalLabel: string;
  warnings: string[];
  errors: string[];
}

function toFiniteNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizePositive(value: number | null | undefined) {
  const next = toFiniteNumber(value);
  return next && next > 0 ? next : null;
}

function roundStep(value: number, step: number) {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.ceil(value / step) * step;
}

function isWhole(value: number) {
  return Math.abs(value - Math.round(value)) < 1e-9;
}

function formatNumber(value: number, suffix: string) {
  return `${value.toFixed(2).replace(".", ",")} ${suffix}`;
}

export function calculateCommercialLine(product: CommercialProduct, input: CommercialInput = {}): CommercialCalculation {
  const saleType = product.sale_type ?? "unidade";
  const unitMeasure = product.unit_measure ?? "un";
  const displayUnit = String(product.display_unit ?? unitMeasure);
  const unitPrice = Number(product.price);
  const packagingClosed = Boolean(product.packaging_closed);
  const openPackageAllowed = Boolean(product.open_package_allowed);
  const fractionalAllowed =
    product.fractional_sale_allowed ??
    (saleType === "metro_linear" || saleType === "metro_quadrado" || saleType === "metro_cubico" || saleType === "peso" || saleType === "volume");
  const minimumSaleQuantity = normalizePositive(product.minimum_sale_quantity);
  const saleMultiple = normalizePositive(product.sale_multiple);
  const requestedMeasurement = normalizePositive(input.requestedMeasurement);
  const requestedArea = normalizePositive(input.areaDesiredM2);
  const requestedWeight = normalizePositive(input.weightDesiredKg);
  const requestedVolume = normalizePositive(input.volumeDesiredLiters);
  const requestedCubicMeters = normalizePositive(input.cubicMetersDesired);
  const requestedQuantity = normalizePositive(input.quantity) ?? 1;
  const margin = Math.max(0, input.lossMargin ?? product.default_loss_margin ?? product.loss_margin ?? 0);
  const warnings: string[] = [];
  const errors: string[] = [];

  const result: CommercialCalculation = {
    saleType,
    unitMeasure,
    displayUnit,
    quantityInformadaCliente: requestedQuantity,
    quantityCalculatedSystem: requestedQuantity,
    quantityOriginal: requestedQuantity,
    quantityFinal: requestedQuantity,
    operationalQuantity: requestedQuantity,
    requestedMeasurement: null,
    areaInformedM2: null,
    totalAreaM2: null,
    weightInformedKg: null,
    totalWeightKg: null,
    volumeInformedLiters: null,
    totalVolumeLiters: null,
    cubicMetersInformed: null,
    totalCubicMeters: null,
    calculatedBoxes: null,
    calculatedPieces: null,
    calculatedPackages: null,
    lossMarginApplied: margin > 0 ? margin : null,
    packagingClosed,
    openPackageAllowed,
    fractionalAllowed,
    minimumSaleQuantity,
    saleMultiple,
    unitPrice,
    subtotal: unitPrice * requestedQuantity,
    commercialRuleApplied: "quantidade_direta",
    clientLabel: `${requestedQuantity} ${displayUnit}`,
    operationalLabel: `${requestedQuantity} ${displayUnit}`,
    warnings,
    errors,
  };

  const validateFinalQuantity = (finalQuantity: number, mustBeWhole = !fractionalAllowed) => {
    if (!(finalQuantity > 0)) {
      errors.push("Informe uma quantidade valida para este produto.");
      return finalQuantity;
    }
    let next = finalQuantity;
    if (minimumSaleQuantity && next < minimumSaleQuantity) {
      next = minimumSaleQuantity;
      warnings.push(`A quantidade minima deste item e ${minimumSaleQuantity} ${displayUnit}.`);
    }
    if (saleMultiple) {
      const adjusted = roundStep(next, saleMultiple);
      if (Math.abs(adjusted - next) > 1e-9) {
        next = adjusted;
        warnings.push(`A venda deste item respeita multiplos de ${saleMultiple} ${displayUnit}.`);
      }
    }
    if (mustBeWhole && !isWhole(next)) {
      next = Math.ceil(next);
      warnings.push("A quantidade foi arredondada para respeitar a unidade comercial.");
    }
    return next;
  };

  switch (saleType) {
    case "metro_linear": {
      const meters = requestedMeasurement ?? normalizePositive(input.quantity);
      if (!meters) {
        errors.push("Informe a metragem desejada.");
        break;
      }
      result.requestedMeasurement = meters;
      result.quantityInformadaCliente = meters;
      result.quantityOriginal = meters;
      if (packagingClosed || !fractionalAllowed) {
        const metersPerPiece = normalizePositive(product.meters_per_piece) ?? normalizePositive(product.linear_measure) ?? 1;
        const pieces = validateFinalQuantity(Math.ceil(meters / metersPerPiece), true);
        result.calculatedPieces = pieces;
        result.quantityCalculatedSystem = pieces;
        result.quantityFinal = pieces;
        result.operationalQuantity = pieces;
        result.subtotal = pieces * unitPrice;
        result.commercialRuleApplied = "metro_linear_convertido_em_pecas";
        result.clientLabel = formatNumber(meters, "m");
        result.operationalLabel = `${pieces} peca${pieces === 1 ? "" : "s"}`;
      } else {
        const finalMeters = validateFinalQuantity(meters, false);
        result.quantityCalculatedSystem = finalMeters;
        result.quantityFinal = finalMeters;
        result.operationalQuantity = finalMeters;
        result.subtotal = finalMeters * unitPrice;
        result.commercialRuleApplied = "metro_linear_fracionado";
        result.clientLabel = formatNumber(meters, "m");
        result.operationalLabel = formatNumber(finalMeters, "m");
      }
      break;
    }

    case "metro_quadrado": {
      const area = requestedArea;
      if (!area) {
        errors.push("Informe a area desejada em m2.");
        break;
      }
      const totalArea = area * (1 + margin);
      result.areaInformedM2 = area;
      result.totalAreaM2 = totalArea;
      result.quantityInformadaCliente = area;
      result.quantityOriginal = area;
      warnings.push("Recomendamos considerar uma margem adicional para recortes, perdas e ajustes de instalacao.");

      if (normalizePositive(product.area_per_box) && (unitMeasure === "caixa" || packagingClosed || !fractionalAllowed)) {
        const boxArea = normalizePositive(product.area_per_box) ?? 1;
        const boxes = validateFinalQuantity(Math.ceil(totalArea / boxArea), true);
        result.calculatedBoxes = boxes;
        result.quantityCalculatedSystem = boxes;
        result.quantityFinal = boxes;
        result.operationalQuantity = boxes;
        result.totalAreaM2 = boxes * boxArea;
        result.subtotal = boxes * unitPrice;
        result.commercialRuleApplied = "metro_quadrado_convertido_em_caixas";
        result.clientLabel = formatNumber(area, "m²");
        result.operationalLabel = `${boxes} caixa${boxes === 1 ? "" : "s"}`;
      } else if (normalizePositive(product.area_per_piece) && unitMeasure === "peca") {
        const pieceArea = normalizePositive(product.area_per_piece) ?? 1;
        const pieces = validateFinalQuantity(Math.ceil(totalArea / pieceArea), true);
        result.calculatedPieces = pieces;
        result.quantityCalculatedSystem = pieces;
        result.quantityFinal = pieces;
        result.operationalQuantity = pieces;
        result.totalAreaM2 = pieces * pieceArea;
        result.subtotal = pieces * unitPrice;
        result.commercialRuleApplied = "metro_quadrado_convertido_em_pecas";
        result.clientLabel = formatNumber(area, "m²");
        result.operationalLabel = `${pieces} peca${pieces === 1 ? "" : "s"}`;
      } else {
        const finalArea = validateFinalQuantity(totalArea, false);
        result.quantityCalculatedSystem = finalArea;
        result.quantityFinal = finalArea;
        result.operationalQuantity = finalArea;
        result.totalAreaM2 = finalArea;
        result.subtotal = finalArea * unitPrice;
        result.commercialRuleApplied = "metro_quadrado_direto";
        result.clientLabel = formatNumber(area, "m²");
        result.operationalLabel = formatNumber(finalArea, "m²");
      }
      break;
    }

    case "peso": {
      const weight = requestedWeight ?? normalizePositive(input.quantity);
      if (!weight) {
        errors.push("Informe o peso desejado.");
        break;
      }
      result.weightInformedKg = weight;
      result.quantityInformadaCliente = weight;
      result.quantityOriginal = weight;
      if (packagingClosed || !fractionalAllowed) {
        const unitWeight = normalizePositive(product.weight_per_unit) ?? normalizePositive(product.weight_per_package) ?? 1;
        const packages = validateFinalQuantity(Math.ceil(weight / unitWeight), true);
        result.calculatedPackages = packages;
        result.quantityCalculatedSystem = packages;
        result.quantityFinal = packages;
        result.operationalQuantity = packages;
        result.totalWeightKg = packages * unitWeight;
        result.subtotal = packages * unitPrice;
        result.commercialRuleApplied = "peso_convertido_em_embalagens";
        result.clientLabel = formatNumber(weight, "kg");
        result.operationalLabel = `${packages} embalagem${packages === 1 ? "" : "ens"}`;
      } else {
        const finalWeight = validateFinalQuantity(weight, false);
        result.quantityCalculatedSystem = finalWeight;
        result.quantityFinal = finalWeight;
        result.operationalQuantity = finalWeight;
        result.totalWeightKg = finalWeight;
        result.subtotal = finalWeight * unitPrice;
        result.commercialRuleApplied = "peso_fracionado";
        result.clientLabel = formatNumber(weight, "kg");
        result.operationalLabel = formatNumber(finalWeight, "kg");
      }
      break;
    }

    case "volume": {
      const volume = requestedVolume ?? normalizePositive(input.quantity);
      if (!volume) {
        errors.push("Informe o volume desejado.");
        break;
      }
      result.volumeInformedLiters = volume;
      result.quantityInformadaCliente = volume;
      result.quantityOriginal = volume;
      if (packagingClosed || !fractionalAllowed) {
        const packageVolume = normalizePositive(product.volume_per_unit) ?? normalizePositive(product.volume_per_package) ?? 1;
        const packages = validateFinalQuantity(Math.ceil(volume / packageVolume), true);
        result.calculatedPackages = packages;
        result.quantityCalculatedSystem = packages;
        result.quantityFinal = packages;
        result.operationalQuantity = packages;
        result.totalVolumeLiters = packages * packageVolume;
        result.subtotal = packages * unitPrice;
        result.commercialRuleApplied = "volume_convertido_em_embalagens";
        result.clientLabel = formatNumber(volume, "L");
        result.operationalLabel = `${packages} embalagem${packages === 1 ? "" : "ens"}`;
      } else {
        const finalVolume = validateFinalQuantity(volume, false);
        result.quantityCalculatedSystem = finalVolume;
        result.quantityFinal = finalVolume;
        result.operationalQuantity = finalVolume;
        result.totalVolumeLiters = finalVolume;
        result.subtotal = finalVolume * unitPrice;
        result.commercialRuleApplied = "volume_fracionado";
        result.clientLabel = formatNumber(volume, "L");
        result.operationalLabel = formatNumber(finalVolume, "L");
      }
      break;
    }

    case "metro_cubico": {
      const cubicMeters = requestedCubicMeters ?? normalizePositive(input.quantity);
      if (!cubicMeters) {
        errors.push("Informe o volume desejado em m3.");
        break;
      }
      const finalCubic = validateFinalQuantity(cubicMeters, false);
      result.cubicMetersInformed = cubicMeters;
      result.totalCubicMeters = finalCubic;
      result.quantityInformadaCliente = cubicMeters;
      result.quantityCalculatedSystem = finalCubic;
      result.quantityOriginal = cubicMeters;
      result.quantityFinal = finalCubic;
      result.operationalQuantity = finalCubic;
      result.subtotal = finalCubic * unitPrice;
      result.commercialRuleApplied = "metro_cubico_direto";
      result.clientLabel = formatNumber(cubicMeters, "m³");
      result.operationalLabel = formatNumber(finalCubic, "m³");
      break;
    }

    case "caixa":
    case "embalagem":
    case "kit":
    case "peca":
    case "unidade":
    default: {
      const finalQuantity = validateFinalQuantity(requestedQuantity, saleType !== "caixa" ? !fractionalAllowed : true);
      result.quantityCalculatedSystem = finalQuantity;
      result.quantityFinal = finalQuantity;
      result.operationalQuantity = finalQuantity;
      result.subtotal = finalQuantity * unitPrice;
      result.commercialRuleApplied =
        packagingClosed || !fractionalAllowed ? `${saleType}_em_embalagem_fechada` : `${saleType}_direto`;
      result.clientLabel = `${requestedQuantity} ${displayUnit}`;
      result.operationalLabel = `${finalQuantity} ${displayUnit}`;
      if ((saleType === "caixa" || saleType === "embalagem") && normalizePositive(product.pieces_per_box ?? product.pieces_per_package)) {
        const pieces = finalQuantity * (normalizePositive(product.pieces_per_box ?? product.pieces_per_package) ?? 1);
        result.calculatedPieces = pieces;
      }
      if ((saleType === "caixa" || saleType === "embalagem") && packagingClosed) {
        warnings.push("A venda deste item respeita embalagem fechada.");
      }
      if ((saleType === "caixa" || saleType === "embalagem") && openPackageAllowed) {
        warnings.push("Venda fracionada permitida mediante controle comercial.");
      }
    }
  }

  if (result.quantityFinal <= 0) {
    errors.push("Não foi possível calcular uma quantidade comercial valida.");
  }

  return result;
}
