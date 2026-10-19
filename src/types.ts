export type EquipmentFileCategory =
  | 'CRLV'
  | 'Contrato'
  | 'Laudo'
  | 'Manual'
  | 'Foto'
  | 'Manutenção'
  | 'Nota Fiscal'
  | 'Planilha Excel'
  | 'Relatório PDF'
  | 'Outro';

export interface EquipmentFile {
  id: string;
  equipmentId?: string;
  name: string; // Ex: CRLV_2026.pdf, Relatorio.xlsx
  fileType: 'PDF' | 'EXCEL' | 'XLSX' | 'XLS' | 'CSV' | 'JPEG' | 'JPG' | 'PNG';
  mimeType: string;
  size: number; // bytes
  uploadedAt: string; // ISO string
  category: EquipmentFileCategory;
  notes?: string;
  dataUrl: string; // Base64 data URL
  obra_id?: string;
  location?: string;
}

export interface Equipment {
  id: string;
  type: string; // Equipamento (ex: Retroescavadeira, Caminhão, etc.)
  equipmentType?: string; // Tipo de equipamento (sinônimo/padronizado)
  plate?: string; // Placa (ex: BRA2E19)
  prefix?: string; // Prefixo (ex: RET-01, ESC-05)
  model?: string; // Modelo (ex: 416F2, PC200)
  brand?: string; // Marca (ex: Caterpillar, Komatsu)
  supplier?: string; // Fornecedor / Locadora / Frota Própria
  location: string; // Obra / Localização
  chassis?: string; // 8. Chassi do equipamento
  mobilizationDate?: string; // Data de Mobilização (YYYY-MM-DD ou DD/MM/AAAA)
  demobilizationDate?: string; // 9. Data de Desmobilização (YYYY-MM-DD ou DD/MM/AAAA)
  photoUrl?: string; // Foto do Equipamento (Data URL ou URL de imagem)
  obra_id?: string; // Referência técnica da Obra (Tenant)
  projectId?: string;
  // Campos complementares e compatibilidade:
  code: string; // Código/identificador único de referência (Placa ou Prefixo)
  brandModel?: string; // Marca e Modelo combinados (legado)
  operator?: string; // Operador/Motorista responsável
  currentHourMeter: number; // Último Horímetro registrado (horas)
  lastHourMeterDate?: string; // Data do Último Horímetro (YYYY-MM-DD)
  currentKm?: number; // Última Quilometragem registrada (KM)
  lastKmDate?: string; // Data da Última Quilometragem (YYYY-MM-DD)
  measurementValue?: number; // Valor da Medição contratada/base (R$) para desconto
  equipmentStatus?: 'OPERACIONAL' | 'MANUTENCAO' | 'STANDBY' | 'DESMOBILIZADO' | string; // Status do Equipamento
  createdAt: string;
  updatedAt: string;
  files?: EquipmentFile[]; // Anexos / Arquivos do equipamento
}

export interface DailyLog {
  id: string;
  equipmentId?: string;
  equipmentCode: string; // Placa/Prefixo
  equipmentType?: string;
  equipmentBrandModel?: string;
  date: string; // YYYY-MM-DD
  operator: string;
  location: string;
  obra_id?: string;
  projectId?: string;
  initialHourMeter: number;
  finalHourMeter: number;
  workedHours: number; // Final - Inicial
  maintenanceHours: number; // Opcional (0 se não informado)
  notes?: string;
  createdAt: string;
}

export type ConvoyPlate = 'RTW1C01' | 'DZA7G30' | 'SPF2C66' | 'SFC2C66' | string;

export interface AppConvoy {
  id: string;
  plate: string;
  name: string;
  prefix?: string;
  driver?: string;
  capacity?: number;
  description?: string;
  location?: string;
  obra_id?: string;
  projectId?: string;
  createdAt: string;
}

export interface FuelDispense {
  id: string;
  convoyPlate: ConvoyPlate; // RTW1C01 | DZA7G30 | SPF2C66
  equipmentCode: string; // Prefixo / Placa do equipamento abastecido (puxado da base)
  equipmentType?: string; // Tipo da máquina (ex: Retroescavadeira, Caminhão)
  equipmentId?: string;
  supplier?: string; // Fornecedor / Locadora / Frota Própria
  location?: string; // Obra do equipamento (ex: 063/064, 062 - PA)
  obra_id?: string;
  projectId?: string;
  date: string; // YYYY-MM-DD
  initialMeter: number; // Hora/Km Iniciante (leitura inicial da bomba)
  finalMeter: number; // Hora/Km Encerrante (leitura final da bomba)
  liters: number; // Calculado automaticamente (Encerrante - Iniciante)
  equipmentMeter?: number; // Horímetro ou Km atual da máquina/equipamento abastecido
  equipmentMeterUnit?: 'HORAS' | 'KM'; // Tipo de unidade do equipamento (Horímetro 'HORAS' ou Odômetro 'KM')
  operator?: string; // Operador/Responsável (opcional)
  notes?: string;
  createdAt: string;
}

export interface FuelEntry {
  id: string;
  date: string; // YYYY-MM-DD
  liters: number; // Volume de litros recebidos no tanque/bomba
  totalValue?: number; // Valor Total da entrada em Reais (R$)
  unitPrice?: number; // Preço unitário calculado por litro (R$/L)
  supplier?: string; // Fornecedor / Distribuidora
  invoiceNumber?: string; // Nota fiscal
  destination?: string; // Destino (ex: Tanque Central, Comboio RTW1C01, etc.)
  location?: string; // Obra de destino
  obra_id?: string;
  projectId?: string;
  responsible?: string; // Responsável pelo recebimento
  notes?: string;
  createdAt: string;
  attachmentUrl?: string; // Base64 data URL ou URL do anexo (PDF ou JPEG/JPG)
  attachmentName?: string; // Nome do arquivo (ex: NF_12345.pdf)
  attachmentType?: 'PDF' | 'JPEG' | 'JPG';
  attachmentSize?: number; // Tamanho em bytes
}

export type FuelSubTab =
  | 'convoy-rtw1c01'
  | 'convoy-dza7g30'
  | 'convoy-spf2c66'
  | 'convoy-sfc2c66'
  | 'diesel-summary'
  | (string & {});

export type ActiveTab =
  | 'database'
  | 'daily-log'
  | 'fuel-control'
  | 'invoices'
  | 'preventive-maintenance'
  | 'measurement-deduction'
  | 'corrective-maintenance';

export interface FuelInvoiceFile {
  id: string;
  name: string; // Ex: NF_001.pdf
  fileType: 'PDF' | 'JPEG' | 'JPG';
  mimeType: string; // application/pdf, image/jpeg
  size: number; // bytes
  uploadedAt: string; // ISO string
  formattedDate: string; // Ex: 08/09/2026 ou 08/09/2026 14:30
  dataUrl: string; // Base64 data url
  notes?: string;
  invoiceNumber?: string;
  location?: string;
  obra_id?: string;
  projectId?: string;
}

export type UserRole =
  | 'admin'
  | 'gestor'
  | 'controlador'
  | 'visualizador'
  | 'developer'
  | 'user';

export interface AppProject {
  id: string; // e.g. 'proj-064'
  code: string; // e.g. 'SCP 064'
  name: string; // e.g. 'Obra 064'
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string; // Nome completo
  email: string;
  username: string; // Login de usuário
  password: string; // Senha de acesso
  role: UserRole;
  status: 'active' | 'inactive';
  allowedProjects: string[]; // ['all'] ou lista de códigos ex: ['SCP 062', 'SCP 063', 'SCP 064']
  createdAt: string;
  updatedAt?: string;
}

export interface CurrentSession {
  user: AppUser;
  selectedProject: string; // Código da obra (ex: 'SCP 064') ou 'all' (Todas as obras)
  loginTime: string;
}

export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
  loginTime: string;
}

// ==========================================
// PCM - CONTROLE DE MANUTENÇÃO PREVENTIVA
// ==========================================

export type PreventiveIntervalType =
  | '250 Horas'
  | '500 Horas'
  | '750 Horas'
  | '1.000 Horas'
  | '2.000 Horas'
  | '5.000 Horas'
  | '10.000 KM'
  | '20.000 KM'
  | '30.000 KM'
  | 'Outro';

export type PreventiveUnit = 'HORAS' | 'KM';

export type PreventiveStatus = 'EM_DIA' | 'FAZER_REVISAO' | 'PROXIMA' | 'ATENCAO' | 'VENCIDA';

export interface AlertThresholds {
  hoursWarning: number; // Ex: 100 horas (Fazer Revisão quando <= 100)
  hoursUrgent: number; // Ex: 50 horas
  kmWarning: number; // Ex: 2000 km (Fazer Revisão quando <= 2000)
  kmUrgent: number; // Ex: 1000 km
}

export interface PreventivePlan {
  id: string; // ID único do plano de preventiva
  equipmentId: string; // ID do equipamento na base
  equipmentCode: string; // Prefixo ou placa
  location?: string;
  obra_id?: string;
  projectId?: string;
  intervalType: PreventiveIntervalType;
  intervalUnit: PreventiveUnit; // 'HORAS' | 'KM'
  intervalValue: number; // ex: 250, 500, 10000
  customIntervalValue?: number; // preenchido se intervalType === 'Outro'
  
  // Dados da Última Revisão
  lastReviewDate: string; // YYYY-MM-DD
  lastReviewHourMeter?: number; // Horímetro da última revisão
  lastReviewKm?: number; // KM da última revisão
  lastReviewNotes?: string;

  // Limiares de alerta específicos (opcional, senão usa defaults globais)
  customThresholds?: {
    warning: number;
    urgent: number;
  };

  createdAt: string;
  updatedAt: string;
}

export interface PreventiveAttachment {
  id: string;
  name: string; // Nome do arquivo
  fileType: string;
  mimeType: string;
  size: number;
  dataUrl?: string; // Base64 data URL
  uploadedAt: string;
}

export interface PreventiveRecord {
  id: string;
  equipmentId: string;
  equipmentCode: string; // Prefixo ou placa
  equipmentType?: string; // Tipo de máquina
  equipmentBrandModel?: string; // Marca/Modelo
  supplier?: string;
  location?: string;
  obra_id?: string;
  projectId?: string;
  date: string; // Data da revisão realizada (YYYY-MM-DD)
  hourMeter?: number; // Horímetro no momento da revisão
  km?: number; // KM no momento da revisão
  intervalType: PreventiveIntervalType | string;
  intervalValue: number;
  intervalUnit: PreventiveUnit;
  nextReviewValue: number; // Próxima revisão calculada
  type: string; // Tipo de preventiva (ex: Preventiva 250h, Troca de Óleo e Filtros, etc.)
  servicesPerformed: string; // Descrição dos serviços realizados
  partsReplaced?: string; // Peças, filtros e lubrificantes utilizados
  responsible: string; // Responsável / Mecânico
  workOrderNumber?: string; // Número da Ordem de Serviço
  cost?: number; // Custo estimado ou valor da nota (R$)
  notes?: string; // Observações
  attachments?: PreventiveAttachment[]; // Fotos, documentos, OS/PDF
  createdAt: string;
}

export interface PreventiveCalculation {
  equipmentId: string;
  equipmentCode: string;
  equipment: Equipment;
  plan: PreventivePlan;
  unit: PreventiveUnit;
  currentValue: number; // Último Horímetro ou KM atual
  lastReadingDate: string; // Data da leitura atual
  lastReviewValue: number; // Horímetro ou KM da última revisão
  lastReviewDate: string; // Data da última revisão
  intervalValue: number;
  nextReviewValue: number; // lastReviewValue + intervalValue
  remainingValue: number; // nextReviewValue - currentValue
  isOverdue: boolean;
  overdueValue: number; // se excedente: currentValue - nextReviewValue, senão 0
  status: PreventiveStatus;
  statusLabel: 'EM DIA' | 'FAZER REVISÃO' | 'PRÓXIMA DA REVISÃO' | 'ATENÇÃO' | 'VENCIDA';
  statusColor: 'emerald' | 'amber' | 'orange' | 'rose';
}

// ==========================================
// DESCONTO EM MEDIÇÃO (DIAS PARADOS)
// ==========================================

export type MeasurementDeductionStatus =
  | 'PARADO'
  | 'EM ANÁLISE'
  | 'FINALIZADO'
  | 'DESCONTO CALCULADO'
  | 'DESCONTO APLICADO';

export type StoppageReason =
  | 'Aguardando manutenção'
  | 'Falha mecânica'
  | 'Falha elétrica'
  | 'Aguardando peça'
  | 'Aguardando operador'
  | 'Aguardando fornecedor'
  | 'Aguardando mobilização'
  | 'Acidente'
  | 'Equipamento indisponível'
  | 'Outros';

export interface DeductionAuditLog {
  id: string;
  timestamp: string; // ISO string
  user: string;
  action: 'CRIAÇÃO' | 'EDIÇÃO' | 'ENCERRAMENTO' | 'MUDANÇA_STATUS' | 'EXCLUSÃO';
  description: string;
}

export interface MeasurementDeduction {
  id: string;
  // Identificação do Equipamento (da base existente)
  equipmentId: string;
  prefix: string; // Prefixo do equipamento (ex: MC005, RET-01)
  equipmentType: string; // Equipamento (ex: BOBCAT, CAMINHÃO PIPA)
  type?: string;
  brand?: string;
  model?: string;
  brandModel?: string;
  supplier: string; // Fornecedor / Locadora
  location: string; // Obra Atual
  obra_id?: string;
  projectId?: string;
  operator?: string; // Operador (caso exista)
  plate?: string; // Placa (caso exista)

  // Dados Financeiros e de Paralisação
  measurementValue: number; // Valor da Medição (R$)
  dailyRate: number; // Valor da Diária = measurementValue / 30
  startDate: string; // Data Inicial da Paralisação (YYYY-MM-DD)
  endDate?: string; // Data Final da Paralisação (YYYY-MM-DD, vazio se ainda parado)
  isOngoing: boolean; // Equipamento continua parado (sem data final definida)
  stoppedDays: number; // Quantidade de Dias Parados
  discountValue: number; // Valor do Desconto = dailyRate * stoppedDays

  // Motivo e Observação
  reason: StoppageReason | string;
  notes?: string;
  status: MeasurementDeductionStatus;

  // Auditoria e Histórico
  createdBy: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  closedAt?: string; // ISO string de quando a paralisação foi encerrada
  closedBy?: string;
  history: DeductionAuditLog[];
}

export interface DeductionFilterState {
  startDate: string;
  endDate: string;
  location: string;
  supplier: string;
  prefix: string;
  equipmentType: string;
  status: string;
  reason: string;
  searchTerm: string;
}

// ==========================================
// CORRETIVAS REALIZADAS (PCM CORRETIVAS)
// ==========================================

export type CorrectiveStatus =
  | 'Aberta'
  | 'Em Análise'
  | 'Concluída'
  | 'Em manutenção'
  | 'Aguardando peça'
  | 'Aguardando fornecedor'
  | 'Cancelada';

export type CorrectiveFailureType =
  | 'Sistema hidráulico'
  | 'Sistema elétrico'
  | 'Motor'
  | 'Transmissão'
  | 'Pneus'
  | 'Freios'
  | 'Arrefecimento'
  | 'Lubrificação'
  | 'Estrutural / Chassi'
  | 'Material Rodante'
  | 'Implemento / Caçamba / Lâmina'
  | 'Outro';

export interface CorrectivePhoto {
  id: string;
  name: string;
  dataUrl: string; // Base64 data URL
  size?: number; // bytes
  uploadedAt: string; // ISO string
  isHeavyAttachment?: boolean;
}

export interface CorrectiveMaintenance {
  id: string;
  osNumber: string; // Número da O.S. (ex: OS-2026-081)
  equipmentId?: string; // ID na Base de Dados de Equipamentos
  prefix: string; // Prefixo (ex: MC005, CAF51, CBA73)
  equipmentType: string; // Tipo de equipamento (ex: BOBCAT, CAMINHÃO BASCULANTE)
  brand?: string; // Marca (ex: CATERPILLAR, VOLKSWAGEN)
  model?: string; // Modelo (ex: CAT 246D3)
  plate?: string; // Placa (ex: BRA2E19)
  supplier: string; // Fornecedor / Locadora / Frota Própria
  location: string; // Obra Atual
  obra_id?: string;
  projectId?: string;
  operator?: string; // Operador responsável
  
  // Datas e Horímetros
  openDate: string; // Data da abertura da O.S. (YYYY-MM-DD)
  completionDate?: string; // Data da realização/conclusão (YYYY-MM-DD)
  openMeter?: number; // Horímetro/KM na abertura
  completionMeter?: number; // Horímetro/KM na conclusão
  meterUnit?: 'HORAS' | 'KM'; // Unidade de medida
  
  // Falha e Diagnóstico
  failureType: CorrectiveFailureType | string; // Categoria da falha
  affectedSystem?: string; // Sistema/Componente afetado específico
  problemDescription: string; // Descrição detalhada do problema
  diagnosis?: string; // Diagnóstico técnico
  servicePerformed: string; // Serviço realizado
  replacedParts?: string; // Peças substituídas
  mechanic: string; // Mecânico responsável
  stoppedDays: number; // Tempo de máquina parada (Dias)
  stoppedHours?: number; // Tempo de máquina parada (Horas)
  
  // Controle
  status: CorrectiveStatus;
  notes?: string;
  photos: CorrectivePhoto[];
  
  // Metadados
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface CorrectiveFilterState {
  startDate: string;
  endDate: string;
  supplier: string;
  prefix: string;
  equipmentType: string;
  brand: string;
  model: string;
  location: string;
  status: string;
  failureType: string;
  mechanic: string;
  searchTerm: string;
}

// ==========================================
// INTEGRAÇÃO GMAIL - RELATÓRIOS AUTOMÁTICOS (06:00)
// ==========================================

export interface GmailIntegrationConfig {
  enabled: boolean;
  sendHour: number; // 6 (06:00 da manhã)
  sendMinute: number; // 0
  primaryEmail: string; // 'roberto.junior@makmo.com.br'
  additionalEmails: string[]; // Lista de e-mails adicionais gerenciados apenas pelo admin
  lastSentDate?: string; // 'YYYY-MM-DD'
  lastSentAt?: string; // ISO string
  lastStatus?: 'success' | 'error' | 'idle';
  lastLog?: string;
  senderEmail?: string;
}

export interface GmailSendResult {
  success: boolean;
  message: string;
  messageId?: string;
  recipients?: string[];
  sentAt?: string;
  details?: {
    totalEquipments: number;
    totalConvoys: number;
    obrasCount: number;
  };
}



