import { FuelDispense } from '../types';
import { CONSOLIDATED_810_DISPENSES } from './consolidated810FuelData';
import { OFFICIAL_FUEL_ENTRIES } from './officialFuelEntries';

export const OFFICIAL_RTW_DISPENSES: FuelDispense[] = CONSOLIDATED_810_DISPENSES.filter(
  (d) => d.convoyPlate === 'RTW1C01'
);

export const OFFICIAL_DZA_DISPENSES: FuelDispense[] = CONSOLIDATED_810_DISPENSES.filter(
  (d) => d.convoyPlate === 'DZA7G30'
);

export const OFFICIAL_SPF_DISPENSES: FuelDispense[] = CONSOLIDATED_810_DISPENSES.filter(
  (d) => d.convoyPlate === 'SPF2C66'
);

export const OFFICIAL_ALL_DISPENSES: FuelDispense[] = CONSOLIDATED_810_DISPENSES;

export { OFFICIAL_FUEL_ENTRIES };
