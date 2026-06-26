import QR from "qrcode";

export async function downloadQRCodePng(data: string, filename = "qrcode.png", size = 512) {
  const canvas = document.createElement("canvas");
  await QR.toCanvas(canvas, data, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: size,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadQRCodeSvg(data: string, filename = "qrcode.svg", size = 512) {
  const svg = await QR.toString(data, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: size,
  });
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
