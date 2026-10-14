// M15.4c — Layouts de PDF por fornecedor (configuráveis). Cada instituição ajusta rótulos/regex do relatório que o seu
// sistema exporta (Tasy, MV, outro) sem mudar código de importação. Somente alocação + identificação segura (nome, prontuário).
export type ColumnsLayout = { id: string; vendor: string; label: string; detect: string; mode: 'columns'; columns: Record<string, 'record' | 'name' | 'unit' | 'floor' | 'room' | 'bed'> };
export type RegexLayout = { id: string; vendor: string; label: string; detect: string; mode: 'regex'; line: string };
export type PdfLayout = ColumnsLayout | RegexLayout;
export const PDF_LAYOUTS: PdfLayout[] = [
  { id: 'tasy-censo-v1', vendor: 'Tasy', label: 'Tasy — censo hospitalar (colunas)', detect: 'CENSO HOSPITALAR', mode: 'columns',
    columns: { 'Prontuário': 'record', 'Paciente': 'name', 'Unidade': 'unit', 'Andar': 'floor', 'Quarto': 'room', 'Leito': 'bed' } },
  { id: 'mv-mapa-leitos-v1', vendor: 'MV', label: 'MV — mapa de leitos (linhas)', detect: 'MAPA DE LEITOS', mode: 'regex',
    line: '^Leito (?<room>[^\\s-]+)-(?<bed>\\S+)\\s+Setor: (?<unit>.+?) - (?<floor>.+?)\\s+Pront\\.: (?<record>\\S+)\\s+Paciente: (?<name>.+?)\\s+Conv\\.:' },
];
