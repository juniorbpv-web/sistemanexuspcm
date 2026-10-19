import { AppProject, AppUser } from '../types';

export const INITIAL_PROJECTS: AppProject[] = [
  {
    id: 'proj-063-064',
    code: '063/064',
    name: 'Obra 063/064 - Apoio e Manutenção',
    status: 'inactive',
    description: 'Obra de Pavimento e Recuperação',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'proj-062-pa',
    code: '062 - PA',
    name: 'Obra 062 - PA',
    status: 'active',
    description: 'Nova frente operacional - base limpa para novos registros do zero.',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
];

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'user-admin',
    name: 'Roberto Junior (Administrador)',
    email: 'admin@makmo.com.br',
    username: 'admin',
    password: '132587',
    role: 'admin',
    status: 'active',
    allowedProjects: ['all'],
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'user-gestor',
    name: 'Carlos Mendes (Gestor)',
    email: 'gestor@makmo.com.br',
    username: 'gestor',
    password: 'gestor123',
    role: 'gestor',
    status: 'active',
    allowedProjects: ['063/064', '062 - PA'],
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'user-controlador',
    name: 'Rafael Joel (Controlador)',
    email: 'controlador@makmo.com.br',
    username: 'controlador',
    password: 'controlador123',
    role: 'controlador',
    status: 'active',
    allowedProjects: ['063/064'],
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'user-visualizador',
    name: 'Mariana Duarte (Fiscal / Visualizador)',
    email: 'fiscal@makmo.com.br',
    username: 'visualizador',
    password: 'visualizador123',
    role: 'visualizador',
    status: 'active',
    allowedProjects: ['063/064'],
    createdAt: '2026-09-01T08:00:00.000Z',
  },
];
