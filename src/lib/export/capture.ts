"use client";

import html2canvas from "html2canvas";

export interface CapturedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: "JPEG";
}

// JPEG (não PNG) com escala moderada: um relatório com ~8 gráficos em PNG a
// scale:2 passava de 20MB e virava inviável de anexar num e-mail. Os
// gráficos são fundo branco + poucas cores sólidas, então JPEG a 85% fica
// visualmente idêntico por uma fração do tamanho.
export async function captureElementPng(el: HTMLElement): Promise<CapturedImage> {
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 1.5,
    logging: false,
  });
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.85),
    width: canvas.width,
    height: canvas.height,
    format: "JPEG",
  };
}

// Captura vários gráficos pelo id do elemento (ver export-charts-basket.tsx).
// Ids ausentes são ignorados — permite que cada aba peça só os gráficos que usa.
export async function captureChartsByIds(
  ids: string[],
): Promise<Record<string, CapturedImage>> {
  const result: Record<string, CapturedImage> = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[export] elemento do gráfico "${id}" não encontrado no DOM.`);
      continue;
    }
    try {
      result[id] = await captureElementPng(el);
    } catch (err) {
      console.error(`[export] falha ao capturar o gráfico "${id}":`, err);
    }
  }
  return result;
}

export async function loadImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
