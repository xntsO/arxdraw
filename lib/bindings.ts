import type { SceneElement } from './model.ts';

type BoundElement = { id: string; type: 'arrow' | 'text' };
function bindingId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as { elementId?: unknown }).elementId;
  return typeof id === 'string' ? id : undefined;
}

/** Restore reciprocal bindings after replacing UML shapes, without retaining old labels. */
export function repairSceneBindings(
  elements: readonly SceneElement[],
): SceneElement[] {
  const liveIds = new Set(
    elements
      .filter((element) => !element.isDeleted)
      .map((element) => element.id),
  );
  const reciprocal = new Map<string, Map<string, BoundElement>>();
  const bind = (
    targetId: string,
    source: SceneElement,
    type: BoundElement['type'],
  ) => {
    const children =
      reciprocal.get(targetId) || new Map<string, BoundElement>();
    children.set(source.id, { id: source.id, type });
    reciprocal.set(targetId, children);
  };
  const repaired = elements.map((element) => {
    const next = { ...element };
    for (const key of ['startBinding', 'endBinding'] as const) {
      const id = bindingId(element[key]);
      if (!id) continue;
      if (!liveIds.has(id) || element.isDeleted) {
        next[key] = null;
      } else if (element.type === 'arrow') {
        bind(id, element, 'arrow');
      }
    }
    if (typeof element.containerId === 'string') {
      if (!liveIds.has(element.containerId) || element.isDeleted) {
        next.containerId = null;
      } else if (element.type === 'text') {
        bind(element.containerId, element, 'text');
      }
    }
    return next;
  });
  return repaired.map((element) => {
    const children = reciprocal.get(element.id);
    // Rebuild from surviving forward references. This merges native arrows/text with
    // generated bindings and drops removed generated text IDs and stale duplicates.
    if (children?.size || element.boundElements !== undefined) {
      return {
        ...element,
        boundElements: children?.size ? [...children.values()] : null,
      };
    }
    return element;
  });
}
