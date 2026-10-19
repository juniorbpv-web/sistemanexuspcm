import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getMakmoCombustivelLogoBase64 } from './makmoLogoData';

/**
 * Extracts and converts a rendered Recharts SVG into a crisp, high-resolution PNG data URL.
 * Automatically injects a clean background so it looks perfect in slides and documents.
 */
export async function convertSvgElementToPng(
  svgElement: SVGSVGElement,
  options?: {
    backgroundColor?: string;
    scale?: number;
    title?: string;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const scale = options?.scale || 2; // 2x for retina/print sharpness
      const bgColor = options?.backgroundColor || '#ffffff';

      // Clone SVG to modify styles safely without affecting UI
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      const rect = svgElement.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 400;

      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

      // Ensure computed styles are preserved across all elements
      try {
        const origElements = svgElement.querySelectorAll('*');
        const cloneElements = clone.querySelectorAll('*');
        const len = Math.min(origElements.length, cloneElements.length);
        for (let i = 0; i < len; i++) {
          const orig = origElements[i];
          const cln = cloneElements[i] as HTMLElement;
          if (orig && cln) {
            const comp = window.getComputedStyle(orig);
            const fill = comp.getPropertyValue('fill');
            const stroke = comp.getPropertyValue('stroke');
            const strokeWidth = comp.getPropertyValue('stroke-width');
            const color = comp.getPropertyValue('color');
            if (fill && fill !== 'none') cln.style.fill = fill;
            if (stroke && stroke !== 'none') cln.style.stroke = stroke;
            if (strokeWidth && strokeWidth !== '0px') cln.style.strokeWidth = strokeWidth;
            if (color) cln.style.color = color;
          }
        }
      } catch {
        // Fallback gracefully
      }

      // Ensure inline styles for all text elements to prevent font loss
      const textElements = clone.querySelectorAll('text');
      textElements.forEach((t) => {
        const fill = t.getAttribute('fill');
        if (!fill || fill === 'none') {
          t.setAttribute('fill', '#334155');
        }
        t.style.fontFamily = 'Inter, system-ui, sans-serif';
      });

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clone);

      // Fix XML namespaces if needed
      if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const urlApi = window.URL || (window as unknown as { webkitURL: typeof URL }).webkitURL;
      const blobURL = urlApi.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            urlApi.revokeObjectURL(blobURL);
            reject(new Error('Canvas context could not be created'));
            return;
          }

          // Fill background
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw title if provided
          if (options?.title) {
            ctx.fillStyle = '#0f172a';
            ctx.font = `bold ${14 * scale}px Inter, sans-serif`;
            ctx.fillText(options.title, 16 * scale, 24 * scale);
          }

          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          urlApi.revokeObjectURL(blobURL);
          const pngUrl = canvas.toDataURL('image/png');
          resolve(pngUrl);
        } catch (err) {
          urlApi.revokeObjectURL(blobURL);
          reject(err);
        }
      };

      image.onerror = (err) => {
        urlApi.revokeObjectURL(blobURL);
        reject(err);
      };

      image.src = blobURL;
    } catch (err) {
      reject(err);
    }
  });
}

function loadImgAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Downloads a single chart container as a standalone PNG image file.
 */
export async function downloadChartContainerAsPng(
  containerId: string,
  filename: string,
  title?: string
): Promise<boolean> {
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Container element with id "${containerId}" not found.`);
      return false;
    }

    const svg = container.querySelector('svg.recharts-surface') as SVGSVGElement;
    if (!svg) {
      console.warn(`No SVG chart found inside #${containerId}`);
      return false;
    }

    const pngUrl = await convertSvgElementToPng(svg, {
      backgroundColor: '#ffffff',
      scale: 2.5,
      title,
    });

    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Error exporting chart to PNG:', err);
    return false;
  }
}

/**
 * Downloads a single chart container as an executive presentation-ready PDF page.
 */
export async function downloadChartContainerAsPdf(
  containerId: string,
  filename: string,
  title: string,
  subtitle?: string,
  summaryBadge?: string
): Promise<boolean> {
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Container element with id "${containerId}" not found.`);
      return false;
    }

    const svg = container.querySelector('svg.recharts-surface') as SVGSVGElement;
    if (!svg) {
      console.warn(`No SVG chart found inside #${containerId}`);
      return false;
    }

    const pngUrl = await convertSvgElementToPng(svg, {
      backgroundColor: '#ffffff',
      scale: 2.5,
    });

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 1. Corporate Header Banner (Deep Makmo Navy)
    doc.setFillColor(7, 33, 61);
    doc.rect(0, 0, pageWidth, 24, 'F');

    // Makmo Logo
    const logoDataUrl = getMakmoCombustivelLogoBase64();
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 12, 3, 18, 18);
      } catch {
        // ignore
      }
    }

    const startX = logoDataUrl ? 34 : 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(title || 'RELATÓRIO DE EFICIÊNCIA DA FROTA', startX, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(
      subtitle || 'Makmo Infraestrutura • Apresentação Executiva e Comunicação Interna',
      startX,
      16
    );

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Emissão: ${todayStr} às ${nowTime}`, pageWidth - 14, 10, { align: 'right' });
    doc.text('Confidencial • Uso Interno', pageWidth - 14, 15, { align: 'right' });

    // 2. Summary Badge if provided
    let chartTopY = 28;
    if (summaryBadge) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 27, pageWidth - 28, 8, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(summaryBadge, 18, 32.5);
      chartTopY = 38;
    }

    // 3. Render Chart Image centered on page
    const chartW = pageWidth - 28;
    const chartH = pageHeight - chartTopY - 16;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, chartTopY, chartW, chartH, 2, 2, 'FD');
    doc.addImage(pngUrl, 'PNG', 16, chartTopY + 2, chartW - 4, chartH - 4);

    // 4. Corporate Footer
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Makmo Infraestrutura • Sistema de Gestão de Frotas e Obras • Apresentação de Gráficos de Eficiência',
      14,
      pageHeight - 3
    );
    doc.text('Documento Corporativo', pageWidth - 14, pageHeight - 3, { align: 'right' });

    doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('Error exporting chart to PDF:', err);
    return false;
  }
}

export interface CombinedChartsSlideOptions {
  kpis: {
    totalLiters: number;
    totalHours: number;
    globalEfficiency: number;
    activeMachines: number;
    activeObrasCount: number;
    totalDispensesCount: number;
    totalLogsCount: number;
  };
  periodLabel?: string;
  obraFilterLabel?: string;
}

/**
 * Generates an ultra-crisp 1920x1080 (16:9 Presentation Standard) PNG slide combining
 * the executive header, KPIs, Bar Chart (Consumo vs Horas por Obra), and Pie Chart (Distribuição).
 * Ready to drop directly into PowerPoint, Google Slides, Keynote, or WhatsApp.
 */
export async function exportCombinedChartsSlidePng(
  options: CombinedChartsSlideOptions
): Promise<boolean> {
  try {
    const barSvg = document.querySelector(
      '#dashboard-bar-chart-container svg.recharts-surface'
    ) as SVGSVGElement | null;
    const pieSvg = document.querySelector(
      '#dashboard-pie-chart-container svg.recharts-surface'
    ) as SVGSVGElement | null;

    if (!barSvg && !pieSvg) {
      console.warn('Nenhum gráfico encontrado no DOM para captura.');
      return false;
    }

    const W = 1920;
    const H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // 1. Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#091528');
    bgGrad.addColorStop(0.5, '#0c1e3a');
    bgGrad.addColorStop(1, '#071220');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Top Banner
    ctx.fillStyle = '#113861'; // Makmo Navy #113861
    ctx.fillRect(0, 0, W, 115);
    ctx.fillStyle = '#20b4a7'; // Makmo Teal #20b4a7
    ctx.fillRect(0, 113, W, 2);

    // Logo
    const logoBase64 = getMakmoCombustivelLogoBase64();
    if (logoBase64) {
      try {
        const logoImg = await loadImgAsync(logoBase64);
        ctx.drawImage(logoImg, 40, 15, 85, 85);
      } catch {
        // ignore
      }
    }

    // Title & Subtitle
    ctx.font = 'bold 30px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('MAKMO INFRAESTRUTURA • EFICIÊNCIA DA FROTA POR OBRA', 145, 52);

    ctx.font = '15px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    const periodText = options.periodLabel || 'Todo o Período';
    const obraText = options.obraFilterLabel || 'Todas as Obras';
    ctx.fillText(
      `Consumo de Combustível (Diesel) & Horas Trabalhadas por Frente Operacional | Período: ${periodText} | Obra: ${obraText}`,
      145,
      86
    );

    // Date on right
    const todayStr = new Date().toLocaleDateString('pt-BR');
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`Gerado em: ${todayStr}`, W - 40, 52);
    ctx.fillStyle = '#20b4a7';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('PAINEL EXECUTIVO • APRESENTAÇÃO', W - 40, 78);
    ctx.textAlign = 'left';

    // 3. KPI Cards
    const kpiY = 138;
    const kpiH = 96;
    const kpiGap = 20;
    const kpiW = (W - 80 - 3 * kpiGap) / 4;

    const drawKpiCard = (
      x: number,
      title: string,
      value: string,
      sub: string,
      accentColor: string
    ) => {
      ctx.fillStyle = '#101d32';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, kpiY, kpiW, kpiH, 12);
      } else {
        ctx.rect(x, kpiY, kpiW, kpiH);
      }
      ctx.fill();
      ctx.strokeStyle = '#1e2e48';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Top line accent
      ctx.fillStyle = accentColor;
      ctx.fillRect(x + 12, kpiY, kpiW - 24, 3);

      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(title, x + 20, kpiY + 28);

      ctx.font = 'bold 26px Inter, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, x + 20, kpiY + 62);

      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(sub, x + 20, kpiY + 84);
    };

    drawKpiCard(
      40,
      'DIESEL CONSUMIDO TOTAL',
      `${options.kpis.totalLiters.toLocaleString('pt-BR')} L`,
      `${options.kpis.totalDispensesCount} abastecimentos registrados`,
      '#20b4a7'
    );
    drawKpiCard(
      40 + kpiW + kpiGap,
      'HORAS TRABALHADAS (FROTA)',
      `${options.kpis.totalHours.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} h`,
      `${options.kpis.totalLogsCount} apontamentos de diário`,
      '#3b82f6'
    );
    drawKpiCard(
      40 + (kpiW + kpiGap) * 2,
      'EFICIÊNCIA GLOBAL (L/H)',
      `${options.kpis.globalEfficiency.toFixed(1)} L/h`,
      'Média de litros por hora de máquina',
      '#10b981'
    );
    drawKpiCard(
      40 + (kpiW + kpiGap) * 3,
      'FROTA MOBILIZADA',
      `${options.kpis.activeMachines} Máquinas`,
      `Distribuídas em ${options.kpis.activeObrasCount} obras monitoradas`,
      '#8b5cf6'
    );

    // 4. Main Charts Area
    const chartsY = 254;
    const chartsH = 780;

    // Chart 1: Bar Chart (Left 65% width)
    const barBoxW = 1180;
    ctx.fillStyle = '#0f1a2e';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(40, chartsY, barBoxW, chartsH, 12);
    } else {
      ctx.rect(40, chartsY, barBoxW, chartsH);
    }
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Consumo de Combustível vs Horas Trabalhadas por Obra', 65, chartsY + 38);
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      'Comparativo direto entre volume consumido (Litros) e esforço de frota (Horas)',
      65,
      chartsY + 62
    );

    if (barSvg) {
      try {
        const barPngUrl = await convertSvgElementToPng(barSvg, {
          backgroundColor: '#0f1a2e',
          scale: 2,
        });
        const barImg = await loadImgAsync(barPngUrl);
        ctx.drawImage(barImg, 55, chartsY + 80, barBoxW - 30, chartsH - 95);
      } catch (err) {
        console.warn('Erro ao desenhar barSvg no slide:', err);
      }
    }

    // Chart 2: Pie Chart (Right 35% width)
    const pieBoxX = 40 + barBoxW + 20;
    const pieBoxW = W - pieBoxX - 40;
    ctx.fillStyle = '#0f1a2e';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pieBoxX, chartsY, pieBoxW, chartsH, 12);
    } else {
      ctx.rect(pieBoxX, chartsY, pieBoxW, chartsH);
    }
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Distribuição de Diesel por Obra', pieBoxX + 25, chartsY + 38);
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Proporção de litros consumidos em cada frente', pieBoxX + 25, chartsY + 62);

    if (pieSvg) {
      try {
        const piePngUrl = await convertSvgElementToPng(pieSvg, {
          backgroundColor: '#0f1a2e',
          scale: 2,
        });
        const pieImg = await loadImgAsync(piePngUrl);
        ctx.drawImage(pieImg, pieBoxX + 15, chartsY + 80, pieBoxW - 30, chartsH - 95);
      } catch (err) {
        console.warn('Erro ao desenhar pieSvg no slide:', err);
      }
    }

    // 5. Slide Footer
    ctx.fillStyle = '#051124';
    ctx.fillRect(0, H - 34, W, 34);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      'Makmo Infraestrutura • Gestão de Frotas e Obras • Painel Executivo de Eficiência Energética',
      40,
      H - 12
    );
    ctx.textAlign = 'right';
    ctx.fillText('Confidencial • Uso em Apresentações e Comunicações Internas', W - 40, H - 12);
    ctx.textAlign = 'left';

    // 6. Download file
    const slidePngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = slidePngUrl;
    link.download = `slide_eficiencia_frota_makmo_${new Date().toISOString().split('T')[0]}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Error generating slide PNG:', err);
    return false;
  }
}

export interface DashboardPdfExportOptions {
  kpis: {
    totalLiters: number;
    totalHours: number;
    globalEfficiency: number;
    activeMachines: number;
    activeObrasCount: number;
    totalDispensesCount: number;
    totalLogsCount: number;
  };
  obraData: Array<{
    obra: string;
    liters: number;
    workedHours: number;
    efficiency: number;
    activeMachines: number;
    percentOfFuel: number;
  }>;
  periodLabel?: string;
  obraFilterLabel?: string;
  userRole?: string;
}

/**
 * Generates an executive, boardroom-ready A4 Landscape PDF report of the Fleet Efficiency Dashboard,
 * complete with corporate Makmo branding, KPI summaries, embedded chart images, and consolidated data tables.
 */
export async function exportDashboardToPDF(options: DashboardPdfExportOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // 1. Corporate Header Banner (Deep Makmo Navy)
  doc.setFillColor(7, 33, 61);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Makmo Logo
  const logoDataUrl = getMakmoCombustivelLogoBase64();
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 12, 3, 20, 20);
    } catch {
      // ignore logo render warning
    }
  }

  // Header Title & Subtitle
  const startX = logoDataUrl ? 36 : 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('MAKMO INFRAESTRUTURA • DASHBOARD EXECUTIVO DE EFICIÊNCIA DA FROTA', startX, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Relatório Consolidado de Consumo de Combustível (Diesel) & Horas Trabalhadas por Obra | Período: ${
      options.periodLabel || 'Todo o Período'
    } | Frente: ${options.obraFilterLabel || 'Todas as Obras'}`,
    startX,
    16
  );

  // Emission date on top right
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Emissão: ${todayStr} às ${nowTime}`, pageWidth - 14, 10, { align: 'right' });
  doc.text('Confidencial • Uso Interno', pageWidth - 14, 15, { align: 'right' });

  // 2. Executive KPI Summary Cards
  const kpiY = 32;
  const kpiW = (pageWidth - 28 - 9) / 4; // 4 cards with 3mm gap
  const kpiH = 18;

  // Card 1: Total Diesel
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(14, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('DIESEL CONSUMIDO TOTAL', 17, kpiY + 5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${options.kpis.totalLiters.toLocaleString('pt-BR')} L`, 17, kpiY + 12);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${options.kpis.totalDispensesCount} abastecimentos registrados`, 17, kpiY + 16);

  // Card 2: Total Horas
  const card2X = 14 + kpiW + 3;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(card2X, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 78, 216);
  doc.text('HORAS TRABALHADAS (FROTA)', card2X + 3, kpiY + 5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${options.kpis.totalHours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`, card2X + 3, kpiY + 12);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${options.kpis.totalLogsCount} partes diárias registradas`, card2X + 3, kpiY + 16);

  // Card 3: Eficiência Global L/h
  const card3X = card2X + kpiW + 3;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(card3X, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(4, 120, 87);
  doc.text('EFICIÊNCIA GLOBAL (ÍNDICE L/H)', card3X + 3, kpiY + 5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${options.kpis.globalEfficiency.toFixed(1)} L/h`, card3X + 3, kpiY + 12);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Consumo médio por hora de operação', card3X + 3, kpiY + 16);

  // Card 4: Máquinas Ativas & Obras
  const card4X = card3X + kpiW + 3;
  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(139, 92, 246);
  doc.roundedRect(card4X, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(109, 40, 217);
  doc.text('MOBILIZAÇÃO & FRENTES ATIVAS', card4X + 3, kpiY + 5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${options.kpis.activeMachines} Máquinas`, card4X + 3, kpiY + 12);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Distribuídas em ${options.kpis.activeObrasCount} obras monitoradas`, card4X + 3, kpiY + 16);

  // 3. Try to capture rendered charts from DOM and inject into PDF
  let nextSectionY = 56;
  try {
    const chartBarSvg = document.querySelector('#dashboard-bar-chart-container svg.recharts-surface') as SVGSVGElement | null;
    const chartPieSvg = document.querySelector('#dashboard-pie-chart-container svg.recharts-surface') as SVGSVGElement | null;

    if (chartBarSvg || chartPieSvg) {
      const chartWidth = 130;
      const chartHeight = 65;

      if (chartBarSvg) {
        const barPng = await convertSvgElementToPng(chartBarSvg, { backgroundColor: '#ffffff', scale: 2 });
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, nextSectionY, chartWidth, chartHeight + 8, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text('CONSUMO (L) VS HORAS (H) POR OBRA', 17, nextSectionY + 5);
        doc.addImage(barPng, 'PNG', 16, nextSectionY + 7, chartWidth - 4, chartHeight - 2);
      }

      if (chartPieSvg) {
        const pieX = 14 + chartWidth + 6;
        const piePng = await convertSvgElementToPng(chartPieSvg, { backgroundColor: '#ffffff', scale: 2 });
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(pieX, nextSectionY, pageWidth - pieX - 14, chartHeight + 8, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text('DISTRIBUIÇÃO PERCENTUAL DE DIESEL', pieX + 3, nextSectionY + 5);
        doc.addImage(piePng, 'PNG', pieX + 2, nextSectionY + 7, pageWidth - pieX - 18, chartHeight - 2);
      }

      nextSectionY += chartHeight + 14;
    }
  } catch (err) {
    console.warn('Could not inject DOM chart images into PDF:', err);
  }

  // 4. Consolidated Efficiency Table by Obra (autoTable)
  const tableData = options.obraData.map((row, idx) => [
    idx + 1,
    row.obra,
    `${row.workedHours.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} h`,
    `${row.liters.toLocaleString('pt-BR')} L`,
    row.efficiency > 0 ? `${row.efficiency.toFixed(1)} L/h` : '—',
    `${row.activeMachines} máq.`,
    `${row.percentOfFuel}%`,
    row.efficiency === 0 ? 'Sem Leitura' : row.efficiency <= 18 ? 'Ótimo' : row.efficiency <= 26 ? 'Regular' : 'Atenção',
  ]);

  autoTable(doc, {
    startY: nextSectionY,
    head: [[
      '#',
      'Obra / Frente Operacional',
      'Horas Trabalhadas',
      'Diesel Consumido',
      'Eficiência (L/h)',
      'Máquinas Ativas',
      'Part. Combustível',
      'Status Eficiência',
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [7, 33, 61],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 65 },
      2: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 32 },
      3: { halign: 'right', fontStyle: 'bold', textColor: [217, 119, 6], cellWidth: 32 },
      4: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 30 },
      5: { halign: 'center', cellWidth: 28 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const text = String(data.cell.raw);
        if (text === 'Ótimo') {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (text === 'Atenção') {
          data.cell.styles.textColor = [225, 29, 72];
        } else if (text === 'Regular') {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // 5. Corporate Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Makmo Infraestrutura • Sistema de Gestão de Frotas & Obras • Dashboard Executivo de Eficiência Energética e Operacional',
      14,
      pageHeight - 3
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 3, { align: 'right' });
  }

  // Save the PDF
  doc.save(`Relatorio_Eficiencia_Frota_Makmo_${new Date().toISOString().split('T')[0]}.pdf`);
}
