import { Equipment, DailyLog, FuelDispense, FuelEntry, ConvoyPlate, PreventivePlan, PreventiveRecord } from '../types';
import { OFFICIAL_FLEET_DATA } from './fleetData';
import { OFFICIAL_DAILY_LOGS } from './officialDailyLogs';
import { INITIAL_PREVENTIVE_PLANS, INITIAL_PREVENTIVE_RECORDS } from './initialPreventiveData';
import {
  OFFICIAL_RTW_DISPENSES,
  OFFICIAL_DZA_DISPENSES,
  OFFICIAL_SPF_DISPENSES,
  OFFICIAL_ALL_DISPENSES,
  OFFICIAL_FUEL_ENTRIES,
} from './officialFuelData';

export const CONVOY_LIST: { plate: ConvoyPlate; name: string; description: string }[] = [
  { plate: 'RTW1C01', name: 'Comboio RTW1C01', description: 'Caminhão Comboio RTW1C01' },
  { plate: 'DZA7G30', name: 'Comboio DZA7G30', description: 'Caminhão Comboio DZA7G30' },
  { plate: 'SPF2C66', name: 'Comboio SPF2C66', description: 'Caminhão Comboio SPF2C66' },
];

export const INITIAL_EQUIPMENTS: Equipment[] = OFFICIAL_FLEET_DATA;

export const INITIAL_LOGS: DailyLog[] = OFFICIAL_DAILY_LOGS;

export { INITIAL_PREVENTIVE_PLANS, INITIAL_PREVENTIVE_RECORDS };
export { INITIAL_CORRECTIVE_MAINTENANCES } from './initialCorrectiveData';

export const COMMON_EQUIPMENT_TYPES = [
  'BOBCAT',
  'CAMINHÃO APOIO CS',
  'CAMINHÃO APOIO SUP',
  'CAMINHÃO BASCULANTE',
  'CAMINHÃO COMBOIO',
  'CAMINHÃO ESPARGIDOR',
  'CAMINHÃO OFICINA',
  'CAMINHÃO PIPA',
  'CAMINHÃO PRANCHA',
  'CAMINHÃO TBR',
  'ESCAVADEIRA HIDRÁULICA',
  'ESCAVADEIRA HIDRÁULICA 20TON',
  'FRESADORA',
  'MICRO-ÔNIBUS',
  'MICRO-ÔNIBUS-VAN',
  'MINI FRESADORA',
  'MOTONIVELADORA',
  'ONIBUS',
  'PÁ CARREGADEIRA',
  'PLATAFORMA',
  'RECICLADORA',
  'RETROESCAVADEIRA',
  'ROLO CHAPA TANDER',
  'ROLO COMPACTADOR - MINI',
  'ROLO COMPACTADOR 9 PNEUS 24TON',
  'ROLO COMPACTADOR 9 PNEUS 27TON',
  'ROLO PÉ DE CARNEIRO 10TON',
  'SEMI REBOQUE',
  'TRATOR DE ESTEIRA',
  'VASSOURA MECÂNICA',
  'VEÍCULO LEVE',
  'VIBRO ACABADORA',
  'Outro',
];

export const INITIAL_FUEL_ENTRIES: FuelEntry[] = OFFICIAL_FUEL_ENTRIES;

export const INITIAL_FUEL_DISPENSES: FuelDispense[] = OFFICIAL_ALL_DISPENSES;

export { OFFICIAL_RTW_DISPENSES, OFFICIAL_DZA_DISPENSES, OFFICIAL_SPF_DISPENSES, OFFICIAL_ALL_DISPENSES, OFFICIAL_FUEL_ENTRIES };
