export type MemberKind = 'attributes' | 'operations';
export type Visibility = '' | '+' | '-' | '#' | '~';
export type MemberFields = {
  visibility: Visibility;
  name: string;
  type: string;
  parameters: string;
};
export type MemberRow = { raw: string; fields: MemberFields | null };

// Only signatures we can represent completely enter the structured editor.
// Unrecognized syntax remains verbatim and can always be edited as text.
export function parseMember(raw: string, kind: MemberKind): MemberRow {
  const signature = raw.trim();
  const match =
    kind === 'attributes'
      ? /^([+\-#~]?)\s*([A-Za-z_$][\w$]*)\s*(?::\s*([^={}]+))?$/.exec(signature)
      : /^([+\-#~]?)\s*([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*(?::\s*([^={}]+))?$/.exec(
          signature,
        );
  if (!match) return { raw, fields: null };
  return {
    raw,
    fields: {
      visibility: match[1] as Visibility,
      name: match[2],
      parameters: kind === 'operations' ? match[3] : '',
      type: (kind === 'operations' ? match[4] : match[3])?.trim() || '',
    },
  };
}
export function memberRows(value: string, kind: MemberKind): MemberRow[] {
  return value ? value.split('\n').map((line) => parseMember(line, kind)) : [];
}
export function formatMember(fields: MemberFields, kind: MemberKind): string {
  const prefix = fields.visibility ? `${fields.visibility} ` : '';
  const parameters = kind === 'operations' ? `(${fields.parameters})` : '';
  const type = fields.type ? `: ${fields.type}` : '';
  return `${prefix}${fields.name}${parameters}${type}`;
}
export function updateMember(
  row: MemberRow,
  patch: Partial<MemberFields>,
  kind: MemberKind,
): MemberRow {
  if (!row.fields) return row;
  const fields = { ...row.fields, ...patch };
  return { raw: formatMember(fields, kind), fields };
}
export function appendMember(rows: MemberRow[], kind: MemberKind): MemberRow[] {
  const base = kind === 'attributes' ? 'attribute' : 'operation';
  const names = new Set(rows.map((row) => row.fields?.name));
  let index = 1;
  while (names.has(`${base}${index}`)) index++;
  const fields: MemberFields = {
    visibility: kind === 'attributes' ? '-' : '+',
    name: `${base}${index}`,
    type: kind === 'attributes' ? 'String' : 'void',
    parameters: '',
  };
  return [...rows, { fields, raw: formatMember(fields, kind) }];
}
export function serializeMembers(rows: MemberRow[]): string {
  return rows.map((row) => row.raw).join('\n');
}
