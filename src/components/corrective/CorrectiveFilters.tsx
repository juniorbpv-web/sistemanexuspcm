import React, { useState } from 'react';
import {
  Search,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Calendar,
  Truck,
  Wrench,
  CheckCircle2,
  Building,
} from 'lucide-react';
import { CorrectiveFilterState, Equipment, CorrectiveMaintenance } from '../../types';

interface CorrectiveFiltersProps {
  filters: CorrectiveFilterState;
  onFilterChange: (filters: CorrectiveFilterState) => void;
  onResetFilters: () => void;
  records: CorrectiveMaintenance[];
  equipments: Equipment[];
  totalMatches: number;
}

export const CorrectiveFilters: React.FC<CorrectiveFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  records,
  equipments,
  totalMatches,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Extract distinct dynamic options
  const plates = Array.from(
    new Set([
      ...equipments.map((e) => e.plate || e.prefix).filter(Boolean),
      ...records.map((r) => r.plate || r.prefix).filter(Boolean),
    ])
  ).sort();

  const suppliers = Array.from(
    new Set([
      ...equipments.map((e) => e.supplier).filter(Boolean),
      ...records.map((r) => r.supplier).filter(Boolean),
    ])
  ).sort();

  const equipmentTypes = Array.from(
    new Set([
      ...equipments.map((e) => e.type).filter(Boolean),
      ...records.map((r) => r.equipmentType).filter(Boolean),
    ])
  ).sort();

  const brands = Array.from(
    new Set([
      ...equipments.map((e) => e.brand).filter(Boolean),
      ...records.map((r) => r.brand).filter(Boolean),
    ])
  ).sort();

  const models = Array.from(
    new Set([
      ...equipments.map((e) => e.model).filter(Boolean),
      ...records.map((r) => r.model).filter(Boolean),
    ])
  ).sort();

  const locations = Array.from(
    new Set([
      ...equipments.map((e) => e.location).filter(Boolean),
      ...records.map((r) => r.location).filter(Boolean),
    ])
  ).sort();

  const failureTypes = Array.from(
    new Set([
      'Sistema hidráulico',
      'Sistema elétrico',
      'Motor',
      'Transmissão',
      'Pneus',
      'Freios',
      'Arrefecimento',
      'Lubrificação',
      'Estrutural / Chassi',
      'Material Rodante',
      'Implemento / Caçamba / Lâmina',
      'Outro',
      ...records.map((r) => r.failureType).filter(Boolean),
    ])
  ).sort();

  const mechanics = Array.from(
    new Set(records.map((r) => r.mechanic).filter(Boolean))
  ).sort();

  const statuses = [
    'Aberta',
    'Em Análise',
    'Concluída',
    'Em manutenção',
    'Aguardando peça',
    'Aguardando fornecedor',
    'Cancelada',
  ];

  const countAberta = records.filter((r) => r.status === 'Aberta').length;
  const countEmAnalise = records.filter((r) => r.status === 'Em Análise').length;
  const countConcluida = records.filter((r) => r.status === 'Concluída').length;

  const handleFieldChange = (field: keyof CorrectiveFilterState, val: string) => {
    onFilterChange({
      ...filters,
      [field]: val,
    });
  };

  const hasActiveFilters =
    filters.searchTerm ||
    filters.startDate ||
    filters.endDate ||
    filters.supplier ||
    filters.prefix ||
    filters.equipmentType ||
    filters.brand ||
    filters.model ||
    filters.location ||
    filters.status ||
    filters.failureType ||
    filters.mechanic;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm mb-6 transition-colors">
      {/* Top Search & Primary Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Quick Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="corrective-search-input"
            type="text"
            value={filters.searchTerm}
            onChange={(e) => handleFieldChange('searchTerm', e.target.value)}
            placeholder="🔍 Pesquisar por O.S., Prefixo, Equipamento, Placa, Fornecedor ou Falha..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={() => handleFieldChange('searchTerm', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-200 dark:bg-slate-700 rounded-full w-4 h-4 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>

        {/* Primary Filter 1: Status da OS */}
        <div className="w-full md:w-52">
          <select
            id="filter-corrective-status"
            value={filters.status}
            onChange={(e) => handleFieldChange('status', e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-sm text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">Status da OS: Todos</option>
            {statuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Primary Filter 2: Placa */}
        <div className="w-full md:w-40">
          <select
            id="filter-corrective-prefix"
            value={filters.prefix}
            onChange={(e) => handleFieldChange('prefix', e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
          >
            <option value="">Placa: Todas</option>
            {plates.map((plt) => (
              <option key={plt} value={plt}>
                {plt}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle Advanced Filters Button */}
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${
            isAdvancedOpen || hasActiveFilters
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Filtros Avançados</span>
          {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900/50 transition-colors whitespace-nowrap"
            title="Limpar todos os filtros"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {/* Quick Status Filter Pills (Atalho Rápido para Status da OS: Aberta, Em Análise, Concluída) */}
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto pb-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1.5 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Status da OS:
        </span>

        {/* Todas */}
        <button
          type="button"
          onClick={() => handleFieldChange('status', '')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            filters.status === ''
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs ring-1 ring-slate-900/10'
              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <span>Todas</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filters.status === ''
                ? 'bg-white/20 dark:bg-black/20 text-white dark:text-slate-900'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {records.length}
          </span>
        </button>

        {/* Aberta */}
        <button
          type="button"
          onClick={() => handleFieldChange('status', 'Aberta')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            filters.status === 'Aberta'
              ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/30 font-bold'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span>Aberta</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filters.status === 'Aberta'
                ? 'bg-white/25 text-white'
                : 'bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
            }`}
          >
            {countAberta}
          </span>
        </button>

        {/* Em Análise */}
        <button
          type="button"
          onClick={() => handleFieldChange('status', 'Em Análise')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            filters.status === 'Em Análise'
              ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-600/30 font-bold'
              : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 hover:bg-sky-100 dark:hover:bg-sky-900/40'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
          <span>Em Análise</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filters.status === 'Em Análise'
                ? 'bg-white/25 text-white'
                : 'bg-sky-200/70 dark:bg-sky-900/60 text-sky-900 dark:text-sky-200'
            }`}
          >
            {countEmAnalise}
          </span>
        </button>

        {/* Concluída */}
        <button
          type="button"
          onClick={() => handleFieldChange('status', 'Concluída')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            filters.status === 'Concluída'
              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30 font-bold'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span>Concluída</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filters.status === 'Concluída'
                ? 'bg-white/25 text-white'
                : 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            {countConcluida}
          </span>
        </button>
      </div>

      {/* Advanced Filters Expandable Grid */}
      {isAdvancedOpen && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-fadeIn">
          {/* Data Inicial */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFieldChange('startDate', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFieldChange('endDate', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Fornecedor */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Fornecedor / Locadora
            </label>
            <select
              value={filters.supplier}
              onChange={(e) => handleFieldChange('supplier', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Equipamento (Tipo) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Tipo de Equipamento
            </label>
            <select
              value={filters.equipmentType}
              onChange={(e) => handleFieldChange('equipmentType', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {equipmentTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Obra */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Obra / Localização
            </label>
            <select
              value={filters.location}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Falha */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Tipo de Falha
            </label>
            <select
              value={filters.failureType}
              onChange={(e) => handleFieldChange('failureType', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas as Falhas</option>
              {failureTypes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Marca */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Marca
            </label>
            <select
              value={filters.brand}
              onChange={(e) => handleFieldChange('brand', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas as Marcas</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Modelo
            </label>
            <select
              value={filters.model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos os Modelos</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Mecânico Responsável */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Mecânico Responsável
            </label>
            <select
              value={filters.mechanic}
              onChange={(e) => handleFieldChange('mechanic', e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos os Mecânicos / Oficinas</option>
              {mechanics.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Matching Count Strip */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>
            Exibindo <strong>{totalMatches}</strong> de <strong>{records.length}</strong> corretivas
          </span>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Filtro ativo
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          Dica: Clique na placa da máquina na tabela para ver o histórico individual completo.
        </div>
      </div>
    </div>
  );
};
