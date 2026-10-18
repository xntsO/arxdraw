export const nativeElementKinds = [
  'actor',
  'use-case',
  'system',
  'initial',
  'final',
  'action',
  'decision',
  'choice',
  'fork',
  'swimlane',
  'state',
  'participant',
  'activation',
  'fragment',
  'loop-fragment',
  'component',
  'provided-interface',
  'required-interface',
  'port',
  'device',
  'environment',
  'artifact',
  'object',
  'package',
  'dfd-process',
  'dfd-entity',
  'dfd-store',
  'destruction',
  'note',
] as const;
export type NativeElementKind = (typeof nativeElementKinds)[number];
export const nativeRelationshipKinds = [
  'association',
  'include',
  'extend',
  'generalization',
  'flow',
  'transition',
  'message',
  'async-message',
  'return',
  'dependency',
  'assembly',
  'communication-path',
  'deploy',
  'link',
  'import',
  'merge',
  'numbered-message',
  'data-flow',
  'self-message',
  'directed-association',
  'note-link',
] as const;
export type NativeRelationshipKind = (typeof nativeRelationshipKinds)[number];
export type NativeUmlElement = {
  id: string;
  kind: NativeElementKind;
  name: string;
  description: string;
};
export type NativeUmlRelationship = {
  id: string;
  kind: NativeRelationshipKind;
  from: string;
  to: string;
  name: string;
  description: string;
};
export type NativeUmlModel = {
  elements: NativeUmlElement[];
  relationships: NativeUmlRelationship[];
};
export type NativeUmlMetadata = {
  id: string;
  kind: NativeElementKind | NativeRelationshipKind;
  role: 'node' | 'name' | 'decor' | 'edge';
  name?: string;
  labelPrefix?: string;
  labelSuffix?: string;
  viewId?: string;
};
export const isNativeElementKind = (
  value: unknown,
): value is NativeElementKind =>
  typeof value === 'string' &&
  nativeElementKinds.some((kind) => kind === value);
export const isNativeRelationshipKind = (
  value: unknown,
): value is NativeRelationshipKind =>
  typeof value === 'string' &&
  nativeRelationshipKinds.some((kind) => kind === value);
export function isNativeUmlMetadata(
  value: unknown,
): value is NativeUmlMetadata {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    !('kind' in value) ||
    (!isNativeElementKind(value.kind) &&
      !isNativeRelationshipKind(value.kind)) ||
    !('role' in value) ||
    !['node', 'name', 'decor', 'edge'].some((role) => role === value.role)
  )
    return false;
  if (value.role === 'edge' && !isNativeRelationshipKind(value.kind))
    return false;
  if (
    (value.role === 'node' || value.role === 'decor') &&
    !isNativeElementKind(value.kind)
  )
    return false;
  for (const key of ['name', 'labelPrefix', 'labelSuffix', 'viewId']) {
    const field = Object.entries(value).find(([name]) => name === key)?.[1];
    if (field !== undefined && typeof field !== 'string') return false;
  }
  return true;
}
