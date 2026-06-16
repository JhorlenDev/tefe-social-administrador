export interface Cidadao {
  id: string;
  nome: string;
  nis?: string | null;
  data_nascimento?: string | null;
  telefone?: string | null;
  email?: string | null;
  naturalidade?: string | null;
  escolaridade?: string | null;
  identidade_genero?: string | null;
  cor?: string | null;
  possui_deficiencia: boolean;
  estado_civil?: string | null;
  autorizacao_uso_imagem: boolean;
  status_atualizacao: string;
  criado_em: string;
  atualizado_em: string;
  documentos?: Documento | null;
  endereco?: Endereco | null;
  socioeconomico?: Socioeconomico | null;
  membros_familia?: FamiliaMembro[];
}

export interface Documento {
  id: string;
  cpf?: string | null;
  rg?: string | null;
  rg_orgao?: string | null;
  rg_uf?: string | null;
}

export interface Endereco {
  id: string;
  logradouro: string;
  bairro?: string;
  distrito?: string | null;
  comunidade_localidade?: string | null;
  numero?: string | null;
  cep?: string | null;
  complemento?: string | null;
  tipo_localizacao?: string | null;
  situacao_imovel?: string | null;
}

export interface FamiliaMembro {
  id: string;
  nome_membro: string;
  parentesco: string;
  cpf_membro?: string | null;
  data_nascimento?: string | null;
  sexo?: string;
  escolaridade?: string | null;
  ocupacao?: string | null;
}

export interface Socioeconomico {
  id: string;
  renda_total: number;
  quantidade_pessoas_residencia: number;
  recebe_beneficio: boolean;
}

export interface Beneficio {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  atualizado_por_nome?: string;
}

export interface Beneficiario {
  id: string;
  cidadao_id: string;
  beneficio_id: string;
  status: string;
  valor_recebido?: number | null;
  data_solicitacao: string;
  cidadao_nome?: string;
  beneficio_nome?: string;
  cpf?: string;
  nis?: string;
}

export interface DashboardStats {
  total_cidadaos: number;
  total_beneficios: number;
  total_beneficiarios: number;
  cidadaos_por_status: { status_atualizacao: string; total: number }[];
  cidadaos_por_mes: { mes: string; total: number }[];
  beneficios_por_status: { status: string; total: number }[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
