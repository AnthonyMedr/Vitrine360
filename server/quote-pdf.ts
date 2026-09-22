import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import type { DbQuoteRequest, DbQuoteRequestItem } from "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const LOGO_PATH = path.join(projectRoot, "public", "assets", "brand", "gamel-icon-512.png");

const ISSUER = {
  tradeName: "GAMEL Distribuidora",
  legalName: "GARANHUNS METAL LTDA",
  cnpj: "64.156.323/0001-51",
  address: "Rua Vereador Paulo Francisco Gomes, s/n, Lote Serra Branca, Quadra II, Lote 7, Magano, Garanhuns/PE, CEP 55294-770",
  phone: "(87) 98139-0957",
  email: "comercial@gamelmetal.com",
  site: "www.gamelmetal.com",
};

// Cores extraídas das mesmas variáveis HSL usadas no site (src/index.css: --foreground, --primary/--accent)
// para que o PDF reflita a identidade visual real da GAMEL, não uma paleta improvisada.
const BRAND_INK = "#1a2b3c";
const BRAND_MUTED = "#5c6470";
const BRAND_ACCENT = "#ff661a";
const BRAND_BORDER = "#e2ddd2";
const BRAND_SURFACE = "#faf7f1";

// A4 = 595.28 x 841.89pt. Margens de 56pt (~20mm) em todos os lados; nenhum texto é
// desenhado sem um `width` explícito relativo a essas constantes, para nunca ultrapassar
// a área útil da página (a causa raiz do corte lateral do layout anterior).
const PAGE_LEFT = 56;
const PAGE_RIGHT = 539;
const PAGE_BOTTOM_MARGIN = 56;
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT;

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatCnpj(value: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 14) return value || null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

// Formatação apenas de exibição — nunca altera o valor original armazenado.
// Reconhece celular/fixo brasileiro (com ou sem +55/DDI 55); qualquer formato
// não reconhecido (ex.: numero internacional) é devolvido como veio, sem quebrar.
function formatPhoneDisplay(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) digits = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND_INK).text(text, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
}

function drawDivider(doc: PDFKit.PDFDocument) {
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor(BRAND_BORDER).lineWidth(1).stroke();
}

function drawTopBand(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, doc.page.width, 6).fill(BRAND_ACCENT);
}

// Cabecalho completo (pagina 1) com logo, razao social e identificacao da solicitacao.
function drawFullHeader(doc: PDFKit.PDFDocument, request: DbQuoteRequest, hasLogo: boolean) {
  drawTopBand(doc);
  doc.y = 32;

  const logoSize = 40;
  if (hasLogo) {
    doc.image(LOGO_PATH, PAGE_LEFT, doc.y, { width: logoSize, height: logoSize });
  }
  const headerTextX = hasLogo ? PAGE_LEFT + logoSize + 14 : PAGE_LEFT;
  const headerTextY = doc.y + (hasLogo ? 2 : 0);
  doc.font("Helvetica-Bold").fontSize(17).fillColor(BRAND_INK).text(ISSUER.tradeName, headerTextX, headerTextY, { width: PAGE_RIGHT - headerTextX });
  doc.font("Helvetica").fontSize(8.5).fillColor(BRAND_MUTED)
    .text(ISSUER.legalName, headerTextX, doc.y + 1, { width: PAGE_RIGHT - headerTextX })
    .text(`CNPJ: ${formatCnpj(ISSUER.cnpj)}`, headerTextX, doc.y, { width: PAGE_RIGHT - headerTextX });

  doc.y = Math.max(doc.y, headerTextY + logoSize) + 4;
  doc.font("Helvetica").fontSize(8.5).fillColor(BRAND_MUTED)
    .text(ISSUER.address, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH })
    .text(`${ISSUER.phone}  ·  ${ISSUER.email}  ·  ${ISSUER.site}`, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });

  doc.moveDown(0.9);
  drawDivider(doc);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(15).fillColor(BRAND_ACCENT).text("COMPROVANTE DE SOLICITAÇÃO DE ORÇAMENTO", PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BRAND_INK).text("Status: Solicitação recebida — aguardando análise comercial", PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(BRAND_MUTED)
    .text(`Protocolo: ${request.protocol}`, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH })
    .text(`Emitido em: ${formatDateTime(request.created_at)}`, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(1.1);
}

// Cabecalho compacto (paginas seguintes) — so o essencial para reidentificar o documento.
function drawCompactHeader(doc: PDFKit.PDFDocument, request: DbQuoteRequest) {
  drawTopBand(doc);
  doc.y = 28;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND_INK).text(ISSUER.tradeName, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.font("Helvetica").fontSize(9).fillColor(BRAND_MUTED).text(`Protocolo: ${request.protocol}`, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.6);
  drawDivider(doc);
  doc.moveDown(0.8);
}

// Garante espaco vertical antes de desenhar um bloco; se nao houver, cria nova pagina
// com cabecalho compacto (nunca deixa um bloco ser cortado entre o fim do texto e o rodape).
function ensureSpace(doc: PDFKit.PDFDocument, request: DbQuoteRequest, requiredHeight: number) {
  const bottomLimit = doc.page.height - PAGE_BOTTOM_MARGIN;
  if (doc.y + requiredHeight > bottomLimit) {
    doc.addPage();
    drawCompactHeader(doc, request);
  }
}

function renderTwoColumnField(doc: PDFKit.PDFDocument, leftLabel: string, leftValue: string, rightLabel: string | null, rightValue: string | null) {
  const gap = 20;
  const colWidth = (CONTENT_WIDTH - gap) / 2;
  const rightX = PAGE_LEFT + colWidth + gap;
  const rowY = doc.y;

  doc.font("Helvetica").fontSize(8);
  const leftLabelHeight = doc.heightOfString(leftLabel, { width: colWidth });
  doc.fillColor(BRAND_MUTED).text(leftLabel, PAGE_LEFT, rowY, { width: colWidth });
  doc.font("Helvetica").fontSize(10);
  const leftValueHeight = doc.heightOfString(leftValue, { width: colWidth });
  doc.fillColor(BRAND_INK).text(leftValue, PAGE_LEFT, rowY + leftLabelHeight + 1, { width: colWidth });
  const leftHeight = leftLabelHeight + 1 + leftValueHeight;

  let rightHeight = 0;
  if (rightLabel && rightValue) {
    doc.font("Helvetica").fontSize(8);
    const rightLabelHeight = doc.heightOfString(rightLabel, { width: colWidth });
    doc.fillColor(BRAND_MUTED).text(rightLabel, rightX, rowY, { width: colWidth });
    doc.font("Helvetica").fontSize(10);
    const rightValueHeight = doc.heightOfString(rightValue, { width: colWidth });
    doc.fillColor(BRAND_INK).text(rightValue, rightX, rowY + rightLabelHeight + 1, { width: colWidth });
    rightHeight = rightLabelHeight + 1 + rightValueHeight;
  }

  doc.y = rowY + Math.max(leftHeight, rightHeight) + 8;
}

export function generateQuoteRequestPdf(request: DbQuoteRequest, items: DbQuoteRequestItem[]): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", bufferPages: true, margins: { top: 0, bottom: PAGE_BOTTOM_MARGIN, left: PAGE_LEFT, right: PAGE_LEFT } });
  const hasLogo = fs.existsSync(LOGO_PATH);

  drawFullHeader(doc, request, hasLogo);

  sectionHeading(doc, "Dados do solicitante");
  const phoneDisplay = formatPhoneDisplay(request.customer_phone);
  renderTwoColumnField(doc, "NOME", request.customer_name, "EMPRESA", request.company_name || null);
  renderTwoColumnField(doc, "TELEFONE/WHATSAPP", phoneDisplay, "E-MAIL", request.customer_email || null);
  const cnpjLine = request.cnpj ? formatCnpj(request.cnpj) : null;
  renderTwoColumnField(doc, "CIDADE/UF", `${request.city}${request.state ? ` / ${request.state}` : ""}`, cnpjLine ? "CNPJ" : null, cnpjLine);
  doc.moveDown(0.4);

  sectionHeading(doc, "Itens solicitados");

  const colItem = PAGE_LEFT;
  const colQty = 380;
  const colUnit = 450;
  const headerRowHeight = 22;

  function drawItemsTableHeader() {
    const tableTop = doc.y;
    doc.rect(PAGE_LEFT, tableTop, CONTENT_WIDTH, headerRowHeight).fill(BRAND_SURFACE);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND_MUTED);
    doc.text("PRODUTO", colItem + 8, tableTop + 7, { width: colQty - colItem - 16 });
    doc.text("QTD.", colQty, tableTop + 7, { width: colUnit - colQty - 8, align: "right" });
    doc.text("UNIDADE", colUnit, tableTop + 7, { width: PAGE_RIGHT - colUnit - 8, align: "right" });
    doc.y = tableTop + headerRowHeight;
    drawDivider(doc);
    doc.moveDown(0.5);
  }

  drawItemsTableHeader();
  doc.font("Helvetica").fontSize(10).fillColor(BRAND_INK);

  for (const item of items) {
    const nameWidth = colQty - colItem - 16;
    const subLines: Array<{ label: string; value: string }> = [];
    if (item.sku_snapshot) subLines.push({ label: "Ref.", value: item.sku_snapshot });
    if (item.variant_label_snapshot) subLines.push({ label: "Variação", value: item.variant_label_snapshot });
    if (item.notes) subLines.push({ label: "Obs.", value: item.notes });

    doc.font("Helvetica").fontSize(10);
    const nameHeight = doc.heightOfString(item.product_name_snapshot, { width: nameWidth });
    doc.font("Helvetica-Oblique").fontSize(8.5);
    const subLinesHeight = subLines.reduce(
      (sum, line) => sum + doc.heightOfString(`${line.label}: ${line.value}`, { width: PAGE_RIGHT - colItem - 8 }) + 2,
      0,
    );
    const rowHeight = Math.max(nameHeight, 12) + subLinesHeight + 14;

    ensureSpace(doc, request, rowHeight);

    const rowY = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor(BRAND_INK);
    doc.text(item.product_name_snapshot, colItem + 8, rowY, { width: nameWidth });
    const afterNameY = doc.y;
    doc.text(String(item.quantity), colQty, rowY, { width: colUnit - colQty - 8, align: "right" });
    doc.text(item.unit || "un", colUnit, rowY, { width: PAGE_RIGHT - colUnit - 8, align: "right" });
    doc.y = Math.max(afterNameY, doc.y);

    for (const line of subLines) {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(BRAND_MUTED).text(`${line.label}: ${line.value}`, colItem + 8, doc.y, { width: PAGE_RIGHT - colItem - 8 });
    }
    doc.font("Helvetica").fontSize(10).fillColor(BRAND_INK);

    doc.moveDown(0.6);
    drawDivider(doc);
    doc.moveDown(0.4);
  }
  doc.moveDown(0.6);

  if (request.message) {
    doc.font("Helvetica").fontSize(10);
    const messageHeight = doc.heightOfString(request.message, { width: CONTENT_WIDTH });
    ensureSpace(doc, request, messageHeight + 30);
    sectionHeading(doc, "Mensagem do solicitante");
    doc.font("Helvetica").fontSize(10).fillColor(BRAND_INK).text(request.message, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(1.1);
  }

  const commercialNoticeText =
    "Este documento confirma exclusivamente o recebimento da solicitação de orçamento e não constitui proposta comercial, pedido, venda, " +
    "reserva de mercadoria ou confirmação de preço, disponibilidade, prazo, frete ou condição de pagamento. Preços, disponibilidade, prazos, " +
    "frete e condições de pagamento serão definidos pela equipe comercial da GAMEL após análise da solicitação e informados posteriormente ao solicitante.";
  doc.font("Helvetica").fontSize(9.5);
  const commercialNoticeHeight = doc.heightOfString(commercialNoticeText, { width: CONTENT_WIDTH });
  ensureSpace(doc, request, commercialNoticeHeight + 30);
  sectionHeading(doc, "Informações sobre a solicitação");
  doc.font("Helvetica").fontSize(9.5).fillColor(BRAND_MUTED).text(commercialNoticeText, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(1.4);

  const footerText =
    `Documento gerado automaticamente pelo site ${ISSUER.site} · Protocolo ${request.protocol}. ` +
    "Este comprovante não substitui a proposta comercial formal, que será emitida pela equipe comercial após contato. " +
    `Privacidade: ${ISSUER.site}/politicas`;
  doc.font("Helvetica").fontSize(8.5);
  const footerHeight = doc.heightOfString(footerText, { width: CONTENT_WIDTH });
  ensureSpace(doc, request, footerHeight + 16);
  drawDivider(doc);
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(8.5).fillColor(BRAND_MUTED).text(footerText, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH });

  // Numeracao "Pagina X de Y" so e possivel apos saber o total de paginas — bufferPages
  // mantem as paginas ja desenhadas acessiveis para essa passagem final antes de doc.end().
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i += 1) {
    doc.switchToPage(pageRange.start + i);
    doc.font("Helvetica").fontSize(8).fillColor(BRAND_MUTED).text(
      `Página ${i + 1} de ${pageRange.count}`,
      PAGE_LEFT,
      doc.page.height - PAGE_BOTTOM_MARGIN - 14,
      { width: CONTENT_WIDTH, align: "right", lineBreak: false },
    );
  }

  doc.end();
  return doc;
}
