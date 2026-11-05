import ExcelJS from "exceljs";
import { SALES_HEADERS, saleRow } from "./sales.js";

const OLIVE = "FF556B2F";
const KES = '"KES" #,##0';
const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;

// Excel has no time zones, so store the Kenya clock time.
function kenyaDate(iso) {
  return iso ? new Date(Date.parse(iso) + KENYA_OFFSET_MS) : null;
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: OLIVE } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

function salesSheet(workbook, orders) {
  const sheet = workbook.addWorksheet("Sales", { views: [{ state: "frozen", ySplit: 1 }] });
  const widths = [18, 18, 22, 16, 24, 50, 7, 13, 13, 13, 15, 18, 15, 16, 40, 16];
  sheet.columns = SALES_HEADERS.map((header, i) => ({ header, width: widths[i] }));
  styleHeader(sheet.getRow(1));

  for (const order of orders) {
    const row = saleRow(order);
    row[0] = kenyaDate(order.payment.paidAt || order.createdAt);
    sheet.addRow(row);
  }

  sheet.getColumn(1).numFmt = "dd/mm/yyyy hh:mm";
  for (const col of [8, 9, 10, 11]) sheet.getColumn(col).numFmt = KES;
  sheet.getColumn(6).alignment = { wrapText: true, vertical: "top" };
  sheet.autoFilter = { from: "A1", to: { row: 1, column: SALES_HEADERS.length } };

  // Totals row with formulas, so it stays right if you edit the sheet.
  if (orders.length) {
    const last = orders.length + 1;
    const total = sheet.addRow([]);
    total.getCell(1).value = "TOTAL";
    for (const [col, letter] of [[7, "G"], [8, "H"], [9, "I"], [10, "J"], [11, "K"]]) {
      total.getCell(col).value = { formula: `SUM(${letter}2:${letter}${last})` };
    }
    total.font = { bold: true };
    total.border = { top: { style: "thin" } };
  }
  return sheet;
}

function summarySheet(workbook, orders, products) {
  const sheet = workbook.addWorksheet("Summary");
  sheet.columns = [{ width: 34 }, { width: 14 }, { width: 18 }];

  const paid = orders.filter((o) => o.payment.status === "paid");
  const revenue = paid.reduce((sum, o) => sum + (o.payment.amountReceived || 0), 0);
  const caps = paid.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  sheet.addRow(["Olive Caps sales report"]).font = { bold: true, size: 14 };
  sheet.addRow(["Created", kenyaDate(new Date().toISOString())]).getCell(2).numFmt = "dd/mm/yyyy hh:mm";
  sheet.addRow([]);
  sheet.addRow(["Paid orders", paid.length]);
  sheet.addRow(["Caps sold", caps]);
  sheet.addRow(["Money received", revenue]).getCell(2).numFmt = KES;
  sheet.addRow(["Average order", paid.length ? Math.round(revenue / paid.length) : 0]).getCell(2).numFmt = KES;
  sheet.addRow([]);

  // Best sellers: how many of each cap were sold and for how much.
  const byProduct = new Map();
  for (const order of paid) {
    for (const line of order.items) {
      const entry = byProduct.get(line.productId) || { name: line.name, qty: 0, total: 0 };
      entry.qty += line.quantity;
      entry.total += line.lineTotal;
      byProduct.set(line.productId, entry);
    }
  }
  styleHeader(sheet.addRow(["Best sellers", "Sold", "Sales"]));
  [...byProduct.values()]
    .sort((a, b) => b.qty - a.qty)
    .forEach((p) => (sheet.addRow([p.name, p.qty, p.total]).getCell(3).numFmt = KES));
  sheet.addRow([]);

  // Sales per category.
  const categoryOf = new Map(products.map((p) => [p.id, p.category]));
  const byCategory = new Map();
  for (const order of paid) {
    for (const line of order.items) {
      const cat = categoryOf.get(line.productId) || "Other";
      const entry = byCategory.get(cat) || { qty: 0, total: 0 };
      entry.qty += line.quantity;
      entry.total += line.lineTotal;
      byCategory.set(cat, entry);
    }
  }
  styleHeader(sheet.addRow(["Category", "Sold", "Sales"]));
  [...byCategory.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([cat, v]) => (sheet.addRow([cat, v.qty, v.total]).getCell(3).numFmt = KES));
  return sheet;
}

function stockSheet(workbook, products) {
  const sheet = workbook.addWorksheet("Stock", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Cap", width: 40 },
    { header: "Category", width: 16 },
    { header: "Price (KES)", width: 13 },
    { header: "Wholesale (KES)", width: 16 },
    { header: "In stock", width: 10 },
    { header: "Colours", width: 50 },
  ];
  styleHeader(sheet.getRow(1));
  for (const p of products) {
    const row = sheet.addRow([p.name, p.category, p.price, p.wholesalePrice ?? "", p.stock, p.colours.join(", ")]);
    // Highlight caps that are running low.
    if (p.stock <= 5) row.getCell(5).font = { bold: true, color: { argb: p.stock === 0 ? "FFB3261E" : "FFA86B00" } };
  }
  sheet.getColumn(3).numFmt = KES;
  sheet.getColumn(4).numFmt = KES;
  sheet.autoFilter = { from: "A1", to: "F1" };
  return sheet;
}

export async function salesWorkbook(orders, products) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Olive Caps";
  workbook.created = new Date();
  salesSheet(workbook, orders);
  summarySheet(workbook, orders, products);
  stockSheet(workbook, products);
  return workbook.xlsx.writeBuffer();
}
