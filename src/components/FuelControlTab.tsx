import React, { useState, useMemo, useEffect } from 'react';
import { Equipment, FuelDispense, FuelEntry, FuelSubTab, UserRole, AppConvoy, AppProject } from '../types';
import { ConvoyDispenseView } from './ConvoyDispenseView';
import { DieselSummaryView } from './DieselSummaryView';
import { Truck, BarChart3, Plus, X, AlertCircle, Building2, User, Fuel } from 'lucide-react';
import {
  formatLiters,
  getConvoyFuelSummary,
  loadCustomConvoys,
  saveCustomConvoys,
  getConvoysForProject,
} from '../utils/storage';

interface FuelControlTabProps {
  equipments: Equipment[];
  dispenses: FuelDispense[];
  entries: FuelEntry[];
  onSaveDispense: (dispense: Omit<FuelDispense, 'id' | 'createdAt'>) => { success: boolean; message: string };
  onUpdateDispense?: (dispense: FuelDispense) => { success: boolean; message: string };
  onDeleteDispense: (id: string) => void;
  onSaveEntry: (entry: Omit<FuelEntry, 'id' | 'createdAt'>) => { success: boolean; message: string };
  onUpdateEntry?: (entry: FuelEntry) => { success: boolean; message: string };
  onDeleteEntry: (id: string) => void;
  onExportCSV: () => void;
  onResetFuelData?: () => void;
  onRestoreFuelDefaults?: () => void;
  userRole?: UserRole;
  userName?: string;
  selectedProject?: string;
  projects?: AppProject[];
  allDispenses?: FuelDispense[];
  allEntries?: FuelEntry[];
}

export const FuelControlTab: React.FC<FuelControlTabProps> = ({
  equipments,
  dispenses,
  entries,
  onSaveDispense,
  onUpdateDispense,
  onDeleteDispense,
  onSaveEntry,
  onUpdateEntry,
  onDeleteEntry,
  onExportCSV,
  onResetFuelData,
  onRestoreFuelDefaults,
  userRole = 'developer',
  userName,
  selectedProject = 'all',
  projects,
  allDispenses,
  allEntries,
}) => {
  // Convoys associated with the current project
  // Obra 062 - PA and all future new works start without RTW1C01, DZA7G30 and SPF2C66
  const [convoys, setConvoys] = useState<AppConvoy[]>(() => getConvoysForProject(selectedProject));

  // Sync convoys whenever selectedProject changes
  useEffect(() => {
    const list = getConvoysForProject(selectedProject);
    setConvoys(list);
  }, [selectedProject]);

  const [activeSubTab, setActiveSubTab] = useState<FuelSubTab>(() => {
    const list = getConvoysForProject(selectedProject);
    if (list.length > 0) {
      return `convoy-${list[0].plate.toLowerCase()}`;
    }
    return 'diesel-summary';
  });

  // Keep activeSubTab in sync if current subtab no longer exists
  useEffect(() => {
    if (activeSubTab === 'diesel-summary') return;
    const exists = convoys.some(
      (c) =>
        `convoy-${c.plate.toLowerCase()}` === activeSubTab.toLowerCase() ||
        c.plate.toLowerCase() === activeSubTab.toLowerCase()
    );
    if (!exists) {
      if (convoys.length > 0) {
        setActiveSubTab(`convoy-${convoys[0].plate.toLowerCase()}`);
      } else {
        setActiveSubTab('diesel-summary');
      }
    }
  }, [convoys, activeSubTab]);

  // Modal State for Registering a New Convoy
  const [isNewConvoyModalOpen, setIsNewConvoyModalOpen] = useState(false);
  const [convoyPlate, setConvoyPlate] = useState('');
  const [convoyPrefix, setConvoyPrefix] = useState('');
  const [convoyName, setConvoyName] = useState('');
  const [convoyDriver, setConvoyDriver] = useState('');
  const [convoyCapacity, setConvoyCapacity] = useState('5000');
  const [convoyError, setConvoyError] = useState<string | null>(null);

  // Convoy specific balances and statistics map
  const convoySummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getConvoyFuelSummary>>();
    convoys.forEach((c) => {
      map.set(c.plate.toUpperCase(), getConvoyFuelSummary(c.plate, entries, dispenses));
    });
    return map;
  }, [convoys, entries, dispenses]);

  const totalEntriesLiters = useMemo(
    () => entries.reduce((acc, curr) => acc + (curr.liters || 0), 0),
    [entries]
  );
  const totalDispensesLiters = useMemo(
    () => dispenses.reduce((acc, curr) => acc + (curr.liters || 0), 0),
    [dispenses]
  );
  const totalCurrentBalance = Number((totalEntriesLiters - totalDispensesLiters).toFixed(1));

  const getSaldoBadgeClass = (balance: number, isActive: boolean) => {
    if (balance === 0) {
      return isActive
        ? 'bg-slate-700 text-white font-bold'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
    }
    const isAbove2k = balance >= 2000;
    if (isActive) {
      return isAbove2k
        ? 'bg-emerald-800 text-white font-bold shadow-2xs'
        : 'bg-rose-800 text-white font-bold shadow-2xs';
    }
    return isAbove2k
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30';
  };

  const handleCreateConvoy = (e: React.FormEvent) => {
    e.preventDefault();
    setConvoyError(null);

    const cleanPlate = convoyPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanPlate || cleanPlate.length < 5) {
      setConvoyError('Informe uma placa válida para o comboio (mínimo 5 caracteres).');
      return;
    }

    // Check if plate already exists in current list
    if (convoys.some((c) => c.plate.toUpperCase() === cleanPlate)) {
      setConvoyError(`Já existe um comboio cadastrado com a placa ${cleanPlate}.`);
      return;
    }

    const currentTargetObra = selectedProject === 'all' ? '062 - PA' : selectedProject;
    const newConvoy: AppConvoy = {
      id: `convoy-custom-${Date.now()}`,
      plate: cleanPlate,
      name: convoyName.trim() || `Comboio ${cleanPlate}`,
      prefix: convoyPrefix.trim() || undefined,
      driver: convoyDriver.trim() || undefined,
      capacity: Number(convoyCapacity) || 5000,
      description: `Caminhão Comboio ${cleanPlate} • ${convoyName.trim() || 'Gestão de Frotas'}`,
      location: currentTargetObra,
      obra_id: currentTargetObra,
      createdAt: new Date().toISOString(),
    };

    const existingCustom = loadCustomConvoys();
    const updatedCustom = [...existingCustom, newConvoy];
    saveCustomConvoys(updatedCustom);

    const updatedConvoys = getConvoysForProject(selectedProject);
    setConvoys(updatedConvoys);
    setActiveSubTab(`convoy-${cleanPlate.toLowerCase()}`);

    // Reset and close
    setConvoyPlate('');
    setConvoyPrefix('');
    setConvoyName('');
    setConvoyDriver('');
    setConvoyCapacity('5000');
    setIsNewConvoyModalOpen(false);
  };

  // Find currently active convoy object
  const activeConvoy = useMemo(() => {
    return convoys.find(
      (c) =>
        `convoy-${c.plate.toLowerCase()}` === activeSubTab.toLowerCase() ||
        c.plate.toLowerCase() === activeSubTab.toLowerCase()
    );
  }, [convoys, activeSubTab]);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Sub-Tabs Navigation & Convoy Actions */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-1.5 border border-[#dcdfe4] dark:border-[#333333] shadow-xs">
        <div className="flex flex-wrap items-center gap-1">
          {/* List of convoys for this obra */}
          {convoys.map((convoy, idx) => {
            const isTabActive =
              activeSubTab.toLowerCase() === `convoy-${convoy.plate.toLowerCase()}` ||
              activeSubTab.toLowerCase() === convoy.plate.toLowerCase();
            const summary = convoySummaries.get(convoy.plate.toUpperCase()) || {
              balance: 0,
            };

            return (
              <button
                key={convoy.id || convoy.plate}
                id={`subtab-convoy-${convoy.plate.toLowerCase()}`}
                type="button"
                onClick={() => setActiveSubTab(`convoy-${convoy.plate.toLowerCase()}`)}
                className={`flex-1 min-w-[180px] flex items-center justify-between p-2 sm:px-3 sm:py-2.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  isTabActive
                    ? 'bg-amber-500 text-black shadow-xs'
                    : 'text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#262626] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Truck className="w-4 h-4 shrink-0" />
                  <div className="text-left truncate">
                    <span className="block font-industrial tracking-wide truncate">
                      {convoy.name || `Comboio ${convoy.plate}`}
                    </span>
                    <span className="text-[10px] font-normal opacity-80 block truncate">
                      {convoy.prefix ? `${convoy.prefix} • ` : ''}Aba {idx + 1} • Abastecimentos
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ml-1 shrink-0 ${getSaldoBadgeClass(
                    summary.balance,
                    isTabActive
                  )}`}
                >
                  Saldo: {formatLiters(summary.balance)} L
                </span>
              </button>
            );
          })}

          {/* Lançamento de Diesel (Resumo Geral) */}
          <button
            id="subtab-diesel-summary"
            type="button"
            onClick={() => setActiveSubTab('diesel-summary')}
            className={`flex-1 min-w-[180px] flex items-center justify-between p-2 sm:px-3 sm:py-2.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'diesel-summary'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#262626] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <BarChart3 className="w-4 h-4 shrink-0" />
              <div className="text-left truncate">
                <span className="block font-industrial tracking-wide truncate">
                  Lançamento de Diesel
                </span>
                <span className="text-[10px] font-normal opacity-80 block truncate">
                  Aba {convoys.length + 1} • Resumo Geral
                </span>
              </div>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ml-1 shrink-0 ${getSaldoBadgeClass(
                totalCurrentBalance,
                activeSubTab === 'diesel-summary'
              )}`}
            >
              Saldo: {formatLiters(totalCurrentBalance)} L
            </span>
          </button>

          {/* Botão Cadastrar Comboio */}
          <button
            type="button"
            id="btn-open-cadastrar-comboio"
            onClick={() => {
              setConvoyError(null);
              setIsNewConvoyModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
            title="Cadastrar Novo Caminhão Comboio para esta obra"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Comboio</span>
          </button>
        </div>
      </div>

      {/* Empty State Banner when no convoys are registered for this obra */}
      {convoys.length === 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[#111827] dark:text-white">
                Nenhum comboio pré-cadastrado nesta obra
              </div>
              <div className="text-[#4b5563] dark:text-[#9ca3af] mt-0.5">
                A Gestão de Frotas desta obra inicia limpa. Clique em "Cadastrar Comboio" para registrar os veículos de abastecimento que operam aqui.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsNewConvoyModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Cadastrar Primeiro Comboio</span>
          </button>
        </div>
      )}

      {/* Sub-tab Content: Convoy Dispense View */}
      {activeConvoy && (
        <ConvoyDispenseView
          key={activeConvoy.plate}
          convoyPlate={activeConvoy.plate}
          convoyName={activeConvoy.name || `Comboio ${activeConvoy.plate}`}
          convoyDescription={
            activeConvoy.description ||
            `Caminhão Comboio ${activeConvoy.plate} • Makmo Infraestrutura`
          }
          equipments={equipments}
          dispenses={dispenses}
          entries={entries}
          onSaveDispense={onSaveDispense}
          onUpdateDispense={onUpdateDispense}
          onDeleteDispense={onDeleteDispense}
          onSaveEntry={onSaveEntry}
          onExportCSV={onExportCSV}
          userRole={userRole}
        />
      )}

      {/* Sub-tab Content: Diesel Summary View */}
      {activeSubTab === 'diesel-summary' && (
        <DieselSummaryView
          entries={entries}
          dispenses={dispenses}
          allDispenses={allDispenses}
          allEntries={allEntries}
          projects={projects}
          selectedProject={selectedProject}
          equipments={equipments}
          onSaveEntry={onSaveEntry}
          onUpdateEntry={onUpdateEntry}
          onDeleteEntry={onDeleteEntry}
          onUpdateDispense={onUpdateDispense}
          onDeleteDispense={onDeleteDispense}
          onExportCSV={onExportCSV}
          onResetFuelData={onResetFuelData}
          onRestoreFuelDefaults={onRestoreFuelDefaults}
          userRole={userRole}
          userName={userName}
        />
      )}

      {/* Modal Cadastrar Comboio */}
      {isNewConvoyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black font-industrial uppercase text-base text-slate-900 dark:text-white">
                    Cadastrar Novo Comboio
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Obra:{' '}
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {selectedProject === 'all' ? '062 - PA (ou Obra Ativa)' : selectedProject}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewConvoyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {convoyError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{convoyError}</span>
              </div>
            )}

            <form onSubmit={handleCreateConvoy} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Placa */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Placa do Veículo <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: BRA2E19"
                    value={convoyPlate}
                    onChange={(e) => setConvoyPlate(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-500 uppercase"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400">Identificador da placa Mercosul ou convencional.</span>
                </div>

                {/* Prefixo */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Prefixo Interno
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CMB-04"
                    value={convoyPrefix}
                    onChange={(e) => setConvoyPrefix(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-500 uppercase"
                  />
                  <span className="text-[10px] text-slate-400">Código de frota operacional.</span>
                </div>
              </div>

              {/* Nome / Identificação */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Nome do Comboio / Modelo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Comboio Mercedes-Benz Atego 2428"
                  value={convoyName}
                  onChange={(e) => setConvoyName(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Motorista / Responsável */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Motorista / Operador
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Valdir Santos"
                    value={convoyDriver}
                    onChange={(e) => setConvoyDriver(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Capacidade Tanque */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Capacidade Tanque (Litros)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    placeholder="Ex: 5000"
                    value={convoyCapacity}
                    onChange={(e) => setConvoyCapacity(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewConvoyModalOpen(false)}
                  className="h-8 px-3.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-750 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Comboio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
