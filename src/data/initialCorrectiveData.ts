import { CorrectiveMaintenance, CorrectivePhoto } from '../types';

// Helper to create lightweight, realistic photo placeholders
function createMaintenancePhotoSvg(title: string, tag: string, colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#0f172a"/>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    </pattern>
    <rect width="600" height="400" fill="url(#grid)"/>
    
    <circle cx="300" cy="180" r="70" fill="none" stroke="${colorHex}" stroke-width="4" stroke-dasharray="8,6"/>
    <path d="M 270 180 L 330 180 M 300 150 L 300 210" stroke="${colorHex}" stroke-width="4" stroke-linecap="round"/>
    <rect x="250" y="130" width="100" height="100" rx="16" fill="rgba(255,255,255,0.03)" stroke="${colorHex}" stroke-width="2"/>
    
    <rect x="30" y="30" width="160" height="28" rx="6" fill="${colorHex}" fill-opacity="0.2" stroke="${colorHex}" stroke-width="1"/>
    <text x="110" y="49" fill="#f8fafc" font-family="monospace, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">EVIDÊNCIA TÉCNICA</text>
    
    <rect x="410" y="30" width="160" height="28" rx="6" fill="rgba(255,255,255,0.1)"/>
    <text x="490" y="48" fill="#94a3b8" font-family="monospace, sans-serif" font-size="11" text-anchor="middle">${tag}</text>
    
    <text x="300" y="310" fill="#f8fafc" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">${title}</text>
    <text x="300" y="335" fill="#94a3b8" font-family="sans-serif" font-size="12" text-anchor="middle">REGISTRO DE MANUTENÇÃO CORRETIVA PCM MAKMO</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_CORRECTIVE_MAINTENANCES: CorrectiveMaintenance[] = [
  {
    id: 'os-2026-003',
    osNumber: 'OS-2026-003',
    equipmentId: 'eq-056',
    prefix: 'CMI70',
    plate: 'RTP8I70',
    equipmentType: 'CAMINHÃO PRANCHA',
    brand: 'VOLKSWAGEN',
    model: 'VW/26.420 CTC 6X4',
    supplier: 'VIA BRASIL',
    location: 'SCP 064',
    obra_id: '063/064',
    projectId: 'proj-063-064',
    openDate: '2026-10-01',
    completionDate: '2026-10-01',
    failureType: 'Sistema elétrico',
    affectedSystem: 'BATERIA 150 AMP',
    problemDescription: 'Bateria 150 AMP sem carga / com defeito elétrico',
    diagnosis: 'Bateria 150 AMP danificada sem retenção de carga',
    servicePerformed: 'SUBSTITUIDO',
    replacedParts: 'BATERIA 150 AMP',
    mechanic: 'Lindomar',
    stoppedDays: 1,
    stoppedHours: 8,
    status: 'Concluída',
    photos: [
      {
        id: 'photo-cmi70-1',
        name: 'Bateria 150 AMP - Inspeção',
        dataUrl: createMaintenancePhotoSvg('Bateria 150 AMP - Inspeção', 'CMI70 - FOTO 1', '#20b4a7'),
        uploadedAt: '2026-10-01T08:30:00.000Z',
      },
      {
        id: 'photo-cmi70-2',
        name: 'Desmontagem e Terminais',
        dataUrl: createMaintenancePhotoSvg('Desmontagem e Terminais', 'CMI70 - FOTO 2', '#3b82f6'),
        uploadedAt: '2026-10-01T09:15:00.000Z',
      },
      {
        id: 'photo-cmi70-3',
        name: 'Nova Bateria Instalada',
        dataUrl: createMaintenancePhotoSvg('Nova Bateria Instalada', 'CMI70 - FOTO 3', '#10b981'),
        uploadedAt: '2026-10-01T11:00:00.000Z',
      },
      {
        id: 'photo-cmi70-4',
        name: 'Teste de Partida e Alternador OK',
        dataUrl: createMaintenancePhotoSvg('Teste Final de Carga OK', 'CMI70 - FOTO 4', '#10b981'),
        uploadedAt: '2026-10-01T11:30:00.000Z',
      },
    ],
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T16:00:00.000Z',
  },
  {
    id: 'os-2026-002-cl30',
    osNumber: 'OS-2026-002',
    equipmentId: 'eq-042',
    prefix: 'CL30',
    plate: 'DZA7G30',
    equipmentType: 'CAMINHÃO COMBOIO',
    brand: 'VOLKSWAGEN',
    model: 'EURO 17.180',
    supplier: 'AD LOCAÇÃO',
    location: 'SCP 064',
    obra_id: '063/064',
    projectId: 'proj-063-064',
    openDate: '2026-09-24',
    completionDate: '2026-09-24',
    failureType: 'Lubrificação',
    affectedSystem: 'Lubrificação',
    problemDescription: 'Lubrificação periódica e engraxamento dos componentes do comboio',
    diagnosis: 'Pontos e pinos necessitando graxa',
    servicePerformed: 'feito a lubrificação do equipamento.',
    mechanic: 'PEO',
    stoppedDays: 0,
    stoppedHours: 2,
    status: 'Concluída',
    photos: [],
    createdAt: '2026-09-24T08:00:00.000Z',
    updatedAt: '2026-09-24T10:00:00.000Z',
  },
  {
    id: 'os-2026-002-cbh38',
    osNumber: 'OS-2026-002',
    equipmentId: 'eq-021',
    prefix: 'CBH38',
    plate: 'RUU7H38',
    equipmentType: 'CAMINHÃO BASCULANTE',
    brand: 'VOLKSWAGEN',
    model: 'VW 17190 4X2',
    supplier: 'VIA BRASIL',
    location: 'SCP 063',
    obra_id: '063/064',
    projectId: 'proj-063-064',
    openDate: '2026-09-24',
    completionDate: '',
    failureType: 'Pneus',
    affectedSystem: 'Pneus',
    problemDescription: 'Pneu avariado em operação no trecho da obra',
    diagnosis: 'Necessidade de troca pelo estepe na borracharia',
    servicePerformed: 'NA BORRACHARIA PARA FAZER A TROCA PELO STEEP',
    mechanic: 'ALLISSON',
    stoppedDays: 0,
    stoppedHours: 0,
    status: 'Aberta',
    photos: [
      {
        id: 'photo-cbh38-1',
        name: 'Pneu Danificado no Trecho',
        dataUrl: createMaintenancePhotoSvg('Pneu Avariado em Operação', 'CBH38 - FOTO 1', '#ef4444'),
        uploadedAt: '2026-09-24T09:10:00.000Z',
      },
      {
        id: 'photo-cbh38-2',
        name: 'Envio à Borracharia',
        dataUrl: createMaintenancePhotoSvg('Envio à Borracharia SCP 063', 'CBH38 - FOTO 2', '#20b4a7'),
        uploadedAt: '2026-09-24T09:40:00.000Z',
      },
      {
        id: 'photo-cbh38-3',
        name: 'Troca pelo Estepe',
        dataUrl: createMaintenancePhotoSvg('Troca pelo Estepe em Andamento', 'CBH38 - FOTO 3', '#3b82f6'),
        uploadedAt: '2026-09-24T10:15:00.000Z',
      },
    ],
    createdAt: '2026-09-24T09:00:00.000Z',
    updatedAt: '2026-09-24T11:00:00.000Z',
  },
];
