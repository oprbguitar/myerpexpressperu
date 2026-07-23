import { describe, expect, it } from "vitest";
import {
  DefaultPriceResolver,
  ItemType,
  PartyType,
  PeruvianTaxCalculator,
  PurchaseStatus,
  QuotationStatus,
  SaleStatus,
  SalesOrderStatus,
  TaxCategory,
  applyBalance,
  assertItemInvariant,
  assertPartyInvariant,
  calculateStock,
  closeCashSession,
  confirmPurchase,
  confirmSale,
  confirmSalesOrder,
  normalizePartyDocument,
  normalizePartySearchName,
  transitionQuotation
} from "./index.js";

describe("dominio comercial de fase 2", () => {
  it("normaliza identidad de partes sin perder el documento significativo", () => {
    expect(normalizePartyDocument(" 20-123 456 789 ")).toBe("20123456789");
    expect(normalizePartySearchName({ legalName: " Comercial   Rivera S.A.C. " })).toBe("comercial rivera s.a.c.");
  });

  it("exige razón social y RUC estructural para una persona jurídica peruana", () => {
    expect(() => assertPartyInvariant({
      partyType: PartyType.LEGAL_ENTITY, documentType: "RUC", documentNumber: "123", legalName: ""
    })).toThrow();
    expect(() => assertPartyInvariant({
      partyType: PartyType.LEGAL_ENTITY, documentType: "RUC",
      documentNumber: "20123456789", legalName: "Empresa válida S.A.C."
    })).not.toThrow();
  });

  it("impide que un servicio administre stock", () => {
    expect(() => assertItemInvariant({
      itemType: ItemType.SERVICE, managesStock: true, unitId: "unit", purchasePrice: "0", salePrice: "80"
    })).toThrow("Los servicios no generan movimientos físicos");
  });

  it("calcula IGV y redondeo con aritmética decimal autoritativa", () => {
    const result = new PeruvianTaxCalculator().calculate([{
      quantity: "3", unitPrice: "10.005", discountRate: "0.050000",
      taxRate: "0.180000", taxCategory: TaxCategory.TAXABLE
    }]);
    expect(result).toMatchObject({
      subtotal: "30.02", discount: "1.51", taxableAmount: "28.51",
      igv: "5.13", total: "33.64", roundingDifference: "0.00"
    });
  });

  it("separa operaciones gravadas, exoneradas e inafectas", () => {
    const result = new PeruvianTaxCalculator().calculate([
      { quantity: "1", unitPrice: "100", discountRate: "0", taxRate: "0.18", taxCategory: TaxCategory.TAXABLE },
      { quantity: "1", unitPrice: "20", discountRate: "0", taxRate: "0", taxCategory: TaxCategory.EXEMPT },
      { quantity: "1", unitPrice: "10", discountRate: "0", taxRate: "0", taxCategory: TaxCategory.UNAFFECTED }
    ]);
    expect(result).toMatchObject({ taxableAmount: "100.00", exemptAmount: "20.00", unaffectedAmount: "10.00", igv: "18.00", total: "148.00" });
  });

  it("resuelve primero la lista específica del cliente", async () => {
    const resolved = await new DefaultPriceResolver().resolve({
      quantity: "10", itemDefaultPrice: "12", currency: "PEN", at: "2026-07-23",
      customerPrices: [{
        priceListId: "customer", price: "10.50", currency: "PEN", minimumQuantity: "5",
        maximumDiscountRate: "0.05", validFrom: "2026-01-01"
      }],
      defaultPrices: [{
        priceListId: "default", price: "11.00", currency: "PEN", minimumQuantity: "1",
        maximumDiscountRate: "0.02", validFrom: "2026-01-01"
      }],
      allowManualPrice: false
    });
    expect(resolved.source).toBe("CUSTOMER_PRICE_LIST");
    expect(resolved.price).toBe("10.50");
  });

  it("rechaza precio manual sin permiso", () => {
    expect(() => new DefaultPriceResolver().resolve({
      quantity: "1", itemDefaultPrice: "12", currency: "PEN", at: "2026-07-23",
      customerPrices: [], defaultPrices: [], manualPrice: "10", allowManualPrice: false
    })).toThrow("precio manual requiere permiso");
  });

  it("aplica las transiciones válidas de una cotización", () => {
    expect(transitionQuotation(QuotationStatus.DRAFT, QuotationStatus.SENT)).toBe(QuotationStatus.SENT);
    expect(() => transitionQuotation(QuotationStatus.CONVERTED, QuotationStatus.SENT)).toThrow();
  });

  it("confirma sólo agregados comerciales en borrador", () => {
    expect(confirmSalesOrder(SalesOrderStatus.DRAFT)).toBe(SalesOrderStatus.CONFIRMED);
    expect(confirmSale(SaleStatus.DRAFT)).toBe(SaleStatus.CONFIRMED);
    expect(confirmPurchase(PurchaseStatus.DRAFT)).toBe(PurchaseStatus.CONFIRMED);
    expect(() => confirmSale(SaleStatus.CONFIRMED)).toThrow();
  });

  it("aplica pagos parciales y completos sin exceder el principal", () => {
    expect(applyBalance("100.00", "0.00", "25.50")).toEqual({
      applied: "25.50", outstanding: "74.50", status: "PARTIALLY_PAID"
    });
    expect(applyBalance("100.00", "25.50", "74.50").status).toBe("PAID");
    expect(() => applyBalance("100.00", "90.00", "10.01")).toThrow("excede");
  });

  it("bloquea stock negativo por defecto", () => {
    expect(calculateStock("10", "-4.5", false)).toBe("5.500000");
    expect(() => calculateStock("1", "-2", false)).toThrow("stock negativo");
    expect(calculateStock("1", "-2", true)).toBe("-1.000000");
  });

  it("exige explicación para diferencias de caja", () => {
    expect(closeCashSession({
      openingBalance: "100", movementTotal: "25.50", countedBalance: "125.50"
    })).toEqual({ expectedBalance: "125.50", difference: "0.00" });
    expect(() => closeCashSession({
      openingBalance: "100", movementTotal: "25.50", countedBalance: "120"
    })).toThrow("requiere explicación");
  });
});
