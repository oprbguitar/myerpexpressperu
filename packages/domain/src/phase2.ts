import { DomainValidationError, type DomainEvent } from "./index.js";

export enum PartyType {
  NATURAL_PERSON = "NATURAL_PERSON",
  LEGAL_ENTITY = "LEGAL_ENTITY"
}

export enum PartyRoleCode {
  CUSTOMER = "CUSTOMER",
  SUPPLIER = "SUPPLIER",
  TRANSPORT_PROVIDER = "TRANSPORT_PROVIDER",
  CONTACT = "CONTACT"
}

export enum ItemType {
  PRODUCT = "PRODUCT",
  SERVICE = "SERVICE",
  CONSUMABLE = "CONSUMABLE",
  RAW_MATERIAL = "RAW_MATERIAL",
  SPARE_PART = "SPARE_PART",
  DIGITAL_PRODUCT = "DIGITAL_PRODUCT"
}

export enum TaxCategory {
  TAXABLE = "TAXABLE",
  EXEMPT = "EXEMPT",
  UNAFFECTED = "UNAFFECTED",
  FREE = "FREE"
}

export enum QuotationStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  CONVERTED = "CONVERTED",
  CANCELLED = "CANCELLED"
}

export enum SalesOrderStatus {
  DRAFT = "DRAFT",
  CONFIRMED = "CONFIRMED",
  PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED",
  FULFILLED = "FULFILLED",
  CANCELLED = "CANCELLED"
}

export enum SaleStatus {
  DRAFT = "DRAFT",
  CONFIRMED = "CONFIRMED",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  CANCELLED = "CANCELLED"
}

export enum PurchaseStatus {
  DRAFT = "DRAFT",
  CONFIRMED = "CONFIRMED",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  CANCELLED = "CANCELLED"
}

export enum PaymentDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND"
}

export enum PaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  CARD = "CARD",
  DIGITAL_WALLET = "DIGITAL_WALLET",
  CHECK = "CHECK",
  OTHER = "OTHER"
}

export enum StockMovementType {
  OPENING = "OPENING",
  PURCHASE_RECEIPT = "PURCHASE_RECEIPT",
  SALE_ISSUE = "SALE_ISSUE",
  TRANSFER_OUT = "TRANSFER_OUT",
  TRANSFER_IN = "TRANSFER_IN",
  CUSTOMER_RETURN = "CUSTOMER_RETURN",
  SUPPLIER_RETURN = "SUPPLIER_RETURN",
  POSITIVE_ADJUSTMENT = "POSITIVE_ADJUSTMENT",
  NEGATIVE_ADJUSTMENT = "NEGATIVE_ADJUSTMENT"
}

abstract class NormalizedText {
  protected constructor(protected readonly value: string) {}
  toString(): string { return this.value; }
}

function normalizeName(raw: string, minimum: number, maximum: number, code: string): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < minimum || value.length > maximum) {
    throw new DomainValidationError(code, `El valor debe tener entre ${minimum} y ${maximum} caracteres.`);
  }
  return value;
}

export class PartyName extends NormalizedText {
  static create(raw: string) { return new PartyName(normalizeName(raw, 2, 200, "PARTY_NAME_INVALID")); }
}
export class LegalName extends NormalizedText {
  static create(raw: string) { return new LegalName(normalizeName(raw, 2, 200, "LEGAL_NAME_INVALID")); }
}
export class CommercialName extends NormalizedText {
  static create(raw: string) { return new CommercialName(normalizeName(raw, 2, 200, "COMMERCIAL_NAME_INVALID")); }
}
export class ForeignDocumentNumber extends NormalizedText {
  static create(raw: string) {
    const value = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length < 3 || value.length > 30) {
      throw new DomainValidationError("FOREIGN_DOCUMENT_INVALID", "El documento extranjero no es válido.");
    }
    return new ForeignDocumentNumber(value);
  }
}
export class Address extends NormalizedText {
  static create(raw: string) { return new Address(normalizeName(raw, 3, 500, "ADDRESS_INVALID")); }
}

export function normalizePartyDocument(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizePartySearchName(input: {
  legalName?: string | null | undefined;
  commercialName?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
}): string {
  return [input.legalName, input.firstName, input.lastName, input.commercialName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-PE");
}

export function assertPartyInvariant(input: {
  partyType: PartyType;
  documentType?: "RUC" | "DNI" | "FOREIGN" | "NONE" | undefined;
  documentNumber?: string | undefined;
  legalName?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
}): void {
  if (input.partyType === PartyType.LEGAL_ENTITY && !input.legalName?.trim()) {
    throw new DomainValidationError("LEGAL_NAME_REQUIRED", "Una persona jurídica requiere razón social.");
  }
  if (input.documentType === "RUC" && !/^\d{11}$/.test(input.documentNumber ?? "")) {
    throw new DomainValidationError("RUC_INVALID", "El RUC debe contener exactamente 11 dígitos.");
  }
  if (input.documentType === "DNI" && !/^\d{8}$/.test(input.documentNumber ?? "")) {
    throw new DomainValidationError("DNI_INVALID", "El DNI debe contener exactamente 8 dígitos.");
  }
  if (
    input.partyType === PartyType.NATURAL_PERSON &&
    !input.firstName?.trim() &&
    !input.lastName?.trim()
  ) {
    throw new DomainValidationError("PERSON_NAME_REQUIRED", "Una persona natural requiere nombres o apellidos.");
  }
}

export function assertItemInvariant(input: {
  itemType: ItemType;
  managesStock: boolean;
  unitId?: string | null | undefined;
  purchasePrice: string;
  salePrice: string;
}): void {
  if (input.itemType === ItemType.SERVICE && input.managesStock) {
    throw new DomainValidationError("SERVICE_STOCK_FORBIDDEN", "Los servicios no generan movimientos físicos.");
  }
  if (input.managesStock && !input.unitId) {
    throw new DomainValidationError("STOCK_UNIT_REQUIRED", "Un producto con stock requiere unidad de medida.");
  }
  if (parseDecimal(input.purchasePrice, 6) < 0n || parseDecimal(input.salePrice, 6) < 0n) {
    throw new DomainValidationError("PRICE_NEGATIVE", "Los precios no pueden ser negativos.");
  }
}

export function parseDecimal(raw: string, scale: number): bigint {
  const value = raw.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new DomainValidationError("DECIMAL_INVALID", `Importe decimal inválido: ${raw}.`);
  const fraction = match[3] ?? "";
  if (fraction.length > scale) {
    throw new DomainValidationError("DECIMAL_SCALE_EXCEEDED", `El valor admite como máximo ${scale} decimales.`);
  }
  const factor = 10n ** BigInt(scale);
  const units = BigInt(match[2]!) * factor + BigInt(fraction.padEnd(scale, "0") || "0");
  return match[1] === "-" ? -units : units;
}

export function formatDecimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const whole = absolute / factor;
  const fraction = (absolute % factor).toString().padStart(scale, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function roundDivideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new DomainValidationError("DIVISOR_INVALID", "El divisor debe ser positivo.");
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  return sign * ((absolute + denominator / 2n) / denominator);
}

export interface TaxCalculationLine {
  readonly quantity: string;
  readonly unitPrice: string;
  readonly discountRate: string;
  readonly taxRate: string;
  readonly taxCategory: TaxCategory;
}

export interface TaxCalculationResult {
  readonly subtotal: string;
  readonly discount: string;
  readonly taxableAmount: string;
  readonly exemptAmount: string;
  readonly unaffectedAmount: string;
  readonly igv: string;
  readonly total: string;
  readonly roundingDifference: string;
  readonly lines: readonly {
    subtotal: string; discount: string; taxAmount: string; total: string;
  }[];
}

export interface TaxCalculator {
  calculate(input: readonly TaxCalculationLine[]): TaxCalculationResult;
}

export class PeruvianTaxCalculator implements TaxCalculator {
  calculate(input: readonly TaxCalculationLine[]): TaxCalculationResult {
    let subtotal = 0n;
    let discount = 0n;
    let taxable = 0n;
    let exempt = 0n;
    let unaffected = 0n;
    let igv = 0n;
    let total = 0n;
    const lines = input.map((line) => {
      const quantity = parseDecimal(line.quantity, 6);
      const price = parseDecimal(line.unitPrice, 6);
      const discountRate = parseDecimal(line.discountRate, 6);
      const taxRate = parseDecimal(line.taxRate, 6);
      if (quantity <= 0n || price < 0n || discountRate < 0n || discountRate > 1_000_000n || taxRate < 0n || taxRate > 1_000_000n) {
        throw new DomainValidationError("TAX_INPUT_INVALID", "Cantidad, precio, descuento o impuesto inválido.");
      }
      const grossMicros = roundDivideHalfUp(quantity * price, 1_000_000n);
      const grossCents = roundDivideHalfUp(grossMicros, 10_000n);
      const netMicros = roundDivideHalfUp(grossMicros * (1_000_000n - discountRate), 1_000_000n);
      const netCents = roundDivideHalfUp(netMicros, 10_000n);
      const discountCents = grossCents - netCents;
      const taxCents = line.taxCategory === TaxCategory.TAXABLE
        ? roundDivideHalfUp(netCents * taxRate, 1_000_000n)
        : 0n;
      const lineTotal = line.taxCategory === TaxCategory.FREE ? 0n : netCents + taxCents;
      subtotal += grossCents;
      discount += line.taxCategory === TaxCategory.FREE ? grossCents : discountCents;
      if (line.taxCategory === TaxCategory.TAXABLE) taxable += netCents;
      if (line.taxCategory === TaxCategory.EXEMPT) exempt += netCents;
      if (line.taxCategory === TaxCategory.UNAFFECTED) unaffected += netCents;
      igv += taxCents;
      total += lineTotal;
      return {
        subtotal: formatDecimal(grossCents, 2),
        discount: formatDecimal(line.taxCategory === TaxCategory.FREE ? grossCents : discountCents, 2),
        taxAmount: formatDecimal(taxCents, 2),
        total: formatDecimal(lineTotal, 2)
      };
    });
    const expected = taxable + exempt + unaffected + igv;
    return {
      subtotal: formatDecimal(subtotal, 2),
      discount: formatDecimal(discount, 2),
      taxableAmount: formatDecimal(taxable, 2),
      exemptAmount: formatDecimal(exempt, 2),
      unaffectedAmount: formatDecimal(unaffected, 2),
      igv: formatDecimal(igv, 2),
      total: formatDecimal(total, 2),
      roundingDifference: formatDecimal(total - expected, 2),
      lines
    };
  }
}

export interface ResolvedPrice {
  readonly price: string;
  readonly currency: string;
  readonly source: "CUSTOMER_PRICE_LIST" | "DEFAULT_PRICE_LIST" | "ITEM_DEFAULT" | "MANUAL";
  readonly priceListId?: string | undefined;
  readonly maximumDiscountRate: string;
  readonly validFrom?: string | undefined;
  readonly validUntil?: string | undefined;
}

export interface ResolvePriceInput {
  readonly quantity: string;
  readonly itemDefaultPrice: string;
  readonly currency: string;
  readonly customerPrices: readonly PriceCandidate[];
  readonly defaultPrices: readonly PriceCandidate[];
  readonly manualPrice?: string | undefined;
  readonly allowManualPrice: boolean;
  readonly at: string;
}

export interface PriceCandidate {
  readonly priceListId: string;
  readonly price: string;
  readonly currency: string;
  readonly minimumQuantity: string;
  readonly maximumDiscountRate: string;
  readonly validFrom: string;
  readonly validUntil?: string | undefined;
}

function activePrice(candidates: readonly PriceCandidate[], quantity: bigint, at: string): PriceCandidate | undefined {
  return candidates
    .filter((candidate) =>
      parseDecimal(candidate.minimumQuantity, 6) <= quantity &&
      candidate.validFrom <= at &&
      (!candidate.validUntil || candidate.validUntil >= at)
    )
    .sort((left: PriceCandidate, right: PriceCandidate) =>
      Number(parseDecimal(right.minimumQuantity, 6) - parseDecimal(left.minimumQuantity, 6))
    )[0];
}

export class DefaultPriceResolver {
  resolve(input: ResolvePriceInput): ResolvedPrice {
    const quantity = parseDecimal(input.quantity, 6);
    if (quantity <= 0n) throw new DomainValidationError("QUANTITY_INVALID", "La cantidad debe ser positiva.");
    const customer = activePrice(input.customerPrices, quantity, input.at);
    if (customer) return {
      price: customer.price, currency: customer.currency, source: "CUSTOMER_PRICE_LIST",
      priceListId: customer.priceListId, maximumDiscountRate: customer.maximumDiscountRate,
      validFrom: customer.validFrom, validUntil: customer.validUntil
    };
    const company = activePrice(input.defaultPrices, quantity, input.at);
    if (company) return {
      price: company.price, currency: company.currency, source: "DEFAULT_PRICE_LIST",
      priceListId: company.priceListId, maximumDiscountRate: company.maximumDiscountRate,
      validFrom: company.validFrom, validUntil: company.validUntil
    };
    if (input.manualPrice !== undefined) {
      if (!input.allowManualPrice) throw new DomainValidationError("MANUAL_PRICE_FORBIDDEN", "El precio manual requiere permiso.");
      if (parseDecimal(input.manualPrice, 6) < 0n) throw new DomainValidationError("PRICE_NEGATIVE", "El precio no puede ser negativo.");
      return { price: input.manualPrice, currency: input.currency, source: "MANUAL", maximumDiscountRate: "1.000000" };
    }
    return {
      price: input.itemDefaultPrice, currency: input.currency, source: "ITEM_DEFAULT",
      maximumDiscountRate: "0.000000"
    };
  }
}

const quotationTransitions: Readonly<Record<QuotationStatus, readonly QuotationStatus[]>> = {
  DRAFT: [QuotationStatus.SENT, QuotationStatus.CANCELLED],
  SENT: [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED, QuotationStatus.CANCELLED],
  ACCEPTED: [QuotationStatus.CONVERTED, QuotationStatus.CANCELLED],
  REJECTED: [],
  EXPIRED: [],
  CONVERTED: [],
  CANCELLED: []
};

export function transitionQuotation(current: QuotationStatus, target: QuotationStatus): QuotationStatus {
  if (!quotationTransitions[current].includes(target)) {
    throw new DomainValidationError("QUOTATION_TRANSITION_INVALID", `No se puede pasar de ${current} a ${target}.`);
  }
  return target;
}

export function confirmSalesOrder(status: SalesOrderStatus): SalesOrderStatus {
  if (status !== SalesOrderStatus.DRAFT) {
    throw new DomainValidationError("SALES_ORDER_CONFIRM_INVALID", "Sólo un pedido en borrador puede confirmarse.");
  }
  return SalesOrderStatus.CONFIRMED;
}

export function confirmSale(status: SaleStatus): SaleStatus {
  if (status !== SaleStatus.DRAFT) {
    throw new DomainValidationError("SALE_CONFIRM_INVALID", "Sólo una venta en borrador puede confirmarse.");
  }
  return SaleStatus.CONFIRMED;
}

export function confirmPurchase(status: PurchaseStatus): PurchaseStatus {
  if (status !== PurchaseStatus.DRAFT) {
    throw new DomainValidationError("PURCHASE_CONFIRM_INVALID", "Sólo una compra en borrador puede confirmarse.");
  }
  return PurchaseStatus.CONFIRMED;
}

export function applyBalance(principal: string, applied: string, payment: string): {
  applied: string; outstanding: string; status: "OPEN" | "PARTIALLY_PAID" | "PAID";
} {
  const principalCents = parseDecimal(principal, 2);
  const appliedCents = parseDecimal(applied, 2);
  const paymentCents = parseDecimal(payment, 2);
  if (paymentCents <= 0n || appliedCents + paymentCents > principalCents) {
    throw new DomainValidationError("PAYMENT_EXCEEDS_BALANCE", "El pago excede el saldo pendiente.");
  }
  const nextApplied = appliedCents + paymentCents;
  const outstanding = principalCents - nextApplied;
  return {
    applied: formatDecimal(nextApplied, 2),
    outstanding: formatDecimal(outstanding, 2),
    status: outstanding === 0n ? "PAID" : "PARTIALLY_PAID"
  };
}

export function calculateStock(current: string, signedMovement: string, allowNegative: boolean): string {
  const next = parseDecimal(current, 6) + parseDecimal(signedMovement, 6);
  if (next < 0n && !allowNegative) {
    throw new DomainValidationError("NEGATIVE_STOCK_FORBIDDEN", "La operación produciría stock negativo.");
  }
  return formatDecimal(next, 6);
}

export function closeCashSession(input: {
  openingBalance: string;
  movementTotal: string;
  countedBalance: string;
  differenceReason?: string | undefined;
}): { expectedBalance: string; difference: string } {
  const expected = parseDecimal(input.openingBalance, 2) + parseDecimal(input.movementTotal, 2);
  const counted = parseDecimal(input.countedBalance, 2);
  const difference = counted - expected;
  if (difference !== 0n && !input.differenceReason?.trim()) {
    throw new DomainValidationError("CASH_DIFFERENCE_REASON_REQUIRED", "La diferencia de caja requiere explicación.");
  }
  return { expectedBalance: formatDecimal(expected, 2), difference: formatDecimal(difference, 2) };
}

export interface InternalEventBus {
  publish(events: readonly DomainEvent[]): Promise<void>;
  subscribe(type: string, handler: (event: DomainEvent) => Promise<void>): void;
}

export class InMemoryEventBus implements InternalEventBus {
  private readonly handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();
  subscribe(type: string, handler: (event: DomainEvent) => Promise<void>): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }
  async publish(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(event.type) ?? []) await handler(event);
    }
  }
}
