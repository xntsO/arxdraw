'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  CaptureUpdateAction,
  exportToBlob,
  exportToSvg,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw';
import type {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles,
  BinaryFileData,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import '@excalidraw/excalidraw/index.css';
import {
  Box,
  Braces,
  Download,
  FolderOpen,
  FilePlus2,
  GitBranch,
  Plus,
  Redo2,
  Undo2,
  X,
  Pencil,
  Trash2,
  Network,
  Copy,
  ArrowLeft,
  Check,
  CircleAlert,
  Palette,
  BookOpen,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNativeSlots } from './native-slots';
import { CodeTools } from './code-tools';
import { CourseLabs } from './course-labs';
import { createCourseLab } from '@/lib/course-runtime';
import { MemberEditor } from './member-editor';
import {
  diagramKinds,
  practiceTools,
  symbolSkeletons,
  exampleSkeletons,
  exampleTitle,
  isPracticeConnector,
} from '@/lib/practice';
import type { PracticeDiagramKind } from '@/lib/practice';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  createProject,
  createBlankProject,
  parseProject,
  removeClassifier,
  removeDiagram,
  updateClassifier,
  relationshipKinds,
  projectDiagnostics,
  duplicateDiagram,
  mergeProjects,
  uid,
} from '@/lib/model';
import type {
  Project,
  Classifier,
  Relationship,
  Diagram,
  DiagramKind,
  ProjectDiagnostic,
  NativeUmlElement,
  NativeUmlRelationship,
  SceneElement,
} from '@/lib/model';
import { renderProject } from '@/lib/scene';
import {
  reconcileDuplicatedClasses,
  reconcileClassRelationships,
} from '@/lib/scene-model';
import {
  nativeUmlMetadata,
  reconcileNativeUmlScene,
  updateNativeUmlElement,
  updateNativeUmlRelationship,
  removeNativeUmlElement,
  removeNativeUmlRelationship,
  nativeUmlViewSkeletons,
} from '@/lib/native-model';
import './arxdraw.css';

const STORAGE = 'arxdraw.project.v1';
type Notice = {
  message: string;
  tone?: 'error';
  action?: { label: string; run: () => void };
};
type SaveState = 'saving' | 'saved' | 'downloaded' | 'error';
const saveLabels: Record<SaveState, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  downloaded: 'Downloaded',
  error: 'Not saved',
};
const saveTitles: Record<SaveState, string> = {
  saving: 'Saving to this browser…',
  saved:
    'Saved in this browser. Use Save project (Ctrl+S) to keep a file copy.',
  downloaded: 'Saved in this browser and downloaded as a project file.',
  error:
    'Browser storage is unavailable. Click to download a project file now.',
};
const kindLabel = (kind: DiagramKind = 'class') =>
  kind === 'class'
    ? 'Class'
    : diagramKinds.find((item) => item.id === kind)?.label || 'Diagram';
const classifierLetter = (kind: Classifier['kind']) =>
  kind === 'interface' ? 'I' : kind === 'abstract' ? 'A' : 'C';
const sameClass = (a: Classifier, b?: Classifier) =>
  !!b &&
  a.name === b.name &&
  a.kind === b.kind &&
  a.attributes === b.attributes &&
  a.operations === b.operations &&
  a.description === b.description;
const sameRelationship = (a: Relationship, b?: Relationship) =>
  !!b &&
  a.from === b.from &&
  a.to === b.to &&
  a.kind === b.kind &&
  a.label === b.label &&
  a.sourceMultiplicity === b.sourceMultiplicity &&
  a.targetMultiplicity === b.targetMultiplicity &&
  a.navigable === b.navigable;
const matches = (query: string, ...values: (string | undefined)[]) =>
  !query.trim() ||
  values.some((value) =>
    value?.toLowerCase().includes(query.trim().toLowerCase()),
  );
function openError(e: unknown, file: string) {
  const reason =
    e instanceof SyntaxError
      ? 'The file is not valid JSON, so it is not an ArxDraw project.'
      : e instanceof Error
        ? e.message
        : 'The file could not be read.';
  return `Could not open “${file}”. ${reason}`;
}
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select
        value={value}
        onValueChange={(v) => v && onChange(v)}
        items={options}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function canvasViewport(d: Diagram) {
  return {
    ...(d.viewport || {
      scrollX: 0,
      scrollY: 0,
      viewBackgroundColor: '#ffffff',
    }),
    zoom: {
      value: Math.min(
        30,
        Math.max(0.1, d.viewport?.zoom.value || 1),
      ) as AppState['zoom']['value'],
    },
  };
}
function cleanViewport(s: AppState) {
  return {
    scrollX: s.scrollX,
    scrollY: s.scrollY,
    zoom: { value: s.zoom.value },
    viewBackgroundColor: s.viewBackgroundColor,
  };
}
type NativeConnector = {
  kind?: string;
  classKind?: Relationship['kind'];
  label?: { text?: string; fontSize?: number; fontFamily?: number };
  /** Set once a click-by-click arrow is underway. */
  arrowId?: string;
};
type NativeItem = NativeUmlElement | NativeUmlRelationship;
const isNativeLink = (item: NativeItem): item is NativeUmlRelationship =>
  'from' in item;
const sameNative = (a: NativeItem, b?: NativeItem) =>
  !!b && a.name === b.name && a.description === b.description;
const nativeItem = (p: Project, id?: string): NativeItem | undefined =>
  id
    ? p.nativeModel?.elements.find((e) => e.id === id) ||
      p.nativeModel?.relationships.find((r) => r.id === id)
    : undefined;
const nativeKindLabel = (kind: string) =>
  kind[0].toUpperCase() + kind.slice(1).replaceAll('-', ' ');
const nativeIdOf = (e: ExcalidrawElement) =>
  nativeUmlMetadata(e as unknown as SceneElement)?.id;
// Arrow notation for drawing class relationships with the native arrow tool.
const classConnectorStyle = (kind: Relationship['kind']) => ({
  startArrowhead:
    kind === 'composition'
      ? 'diamond'
      : kind === 'aggregation'
        ? 'diamond_outline'
        : null,
  endArrowhead:
    kind === 'inheritance' || kind === 'realization'
      ? 'triangle_outline'
      : kind === 'dependency'
        ? 'arrow'
        : null,
  strokeStyle:
    kind === 'dependency' || kind === 'realization' ? 'dashed' : 'solid',
});
/** Bring the active diagram's views in line with the shared models. */
function reconcileScene(
  p: Project,
  defaultKind?: Relationship['kind'],
): Project {
  const id = p.activeDiagramId;
  const next = reconcileClassRelationships(
    reconcileDuplicatedClasses(p, id),
    id,
    defaultKind ? { defaultKind } : {},
  );
  return reconcileNativeUmlScene(next, id);
}
const sceneKey = (elements: readonly ExcalidrawElement[]) =>
  elements.map((e) => `${e.id}:${e.versionNonce}:${e.isDeleted}`).join('|');
function loadWorkspace() {
  let error = '';
  let p = createProject();
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) p = parseProject(saved);
  } catch {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) localStorage.setItem(STORAGE + '.recovery', saved);
    } catch {}
    error =
      'The saved project could not be opened. A recovery copy was kept in browser storage, and an example workspace is open.';
  }
  let dark = false;
  try {
    dark = localStorage.getItem('arxdraw.theme') === 'dark';
  } catch {}
  return { project: renderProject(p), error, dark };
}
export default function ArxDraw() {
  const [workspace] = useState(loadWorkspace);
  const [project, setProject] = useState<Project>(workspace.project);
  const ref = useRef(project);
  // The project as last rendered; ref.current runs ahead during canvas edits.
  const shown = useRef(project);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const slots = useNativeSlots(root);
  const [panel, setPanel] = useState(false);
  const [tool, setTool] = useState('selection');
  const [panelTab, setPanelTab] = useState<'tools' | 'model' | 'diagrams'>(
    'tools',
  );
  const [placement, setPlacement] = useState<Classifier['kind'] | null>(null);
  const [paletteKind, setPaletteKind] = useState<DiagramKind>(
    workspace.project.diagrams.find(
      (d) => d.id === workspace.project.activeDiagramId,
    )?.kind || 'class',
  );
  const [practicePlacement, setPracticePlacement] = useState<string | null>(
    null,
  );
  const [newDiagramKind, setNewDiagramKind] = useState<DiagramKind>('class');
  const [newDiagramContent, setNewDiagramContent] = useState('blank');
  const [codeOpen, setCodeOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [checkResults, setCheckResults] = useState<ProjectDiagnostic[] | null>(
    null,
  );
  const [dark, setDark] = useState(workspace.dark);
  const [editClass, setEditClass] = useState<Classifier | null>(null);
  const [rel, setRel] = useState<Relationship | null>(null);
  const [nativeEdit, setNativeEdit] = useState<NativeItem | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [dialog, setDialog] = useState<'diagram' | 'rename' | null>(null);
  const [text, setText] = useState('');
  const [renameTarget, setRenameTarget] = useState<'project' | 'diagram'>(
    'diagram',
  );
  const [renameId, setRenameId] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [diagramQuery, setDiagramQuery] = useState('');
  const [styleMode, setStyleMode] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [notice, setNotice] = useState<Notice | null>(
    workspace.error ? { message: workspace.error, tone: 'error' } : null,
  );
  const [historyState, setHistoryState] = useState({ past: 0, future: 0 });
  const past = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    baseline = useRef<Project | null>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applying = useRef(false),
    loaded = useRef(true),
    lastSignature = useRef(''),
    lastScene = useRef<string | null>(null),
    lastSelection = useRef('');
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  const fileInput = useRef<HTMLInputElement>(null),
    mergeFile = useRef(false);
  // The UML connector tool behind the active native arrow tool.
  const nativeConnector = useRef<NativeConnector | null>(null);
  const sync = useCallback(
    () =>
      setHistoryState({
        past: past.current.length,
        future: future.current.length,
      }),
    [],
  );
  const flash = useCallback(
    (message: string, options: Omit<Notice, 'message'> = {}) => {
      setNotice({ message, ...options });
    },
    [],
  );
  useEffect(() => {
    // Errors stay until dismissed so they can be read in full.
    if (!notice || notice.tone === 'error') return;
    const t = setTimeout(() => setNotice(null), notice.action ? 8000 : 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const storageFailed = useRef(false),
    pendingChange = useRef(false);
  // Quiet saves (scrolling, zooming) keep the visible save state unchanged.
  const persist = useCallback(
    (quiet = false) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!quiet) {
        pendingChange.current = true;
        setSaveState('saving');
      }
      saveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE, JSON.stringify(ref.current));
          storageFailed.current = false;
          const changed = pendingChange.current;
          pendingChange.current = false;
          setSaveState((state) =>
            changed || state === 'error' ? 'saved' : state,
          );
        } catch {
          setSaveState('error');
          if (!storageFailed.current)
            flash(
              'Browser storage is unavailable or full. Changes are not saved automatically; save your project to a file.',
              { tone: 'error' },
            );
          storageFailed.current = true;
        }
      }, 650);
    },
    [flash],
  );
  useEffect(() => {
    if (saveState !== 'error') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);
  const flushHistory = useCallback(() => {
    if (historyTimer.current) clearTimeout(historyTimer.current);
    if (baseline.current) {
      past.current.push(baseline.current);
      if (past.current.length > 35) past.current.shift();
      baseline.current = null;
      future.current = [];
      sync();
    }
  }, [sync]);
  const apply = useCallback(
    (next: Project, fit = false, keepSelection = false) => {
      applying.current = true;
      if (next.activeDiagramId !== ref.current.activeDiagramId) {
        setEditClass(null);
        setRel(null);
        setNativeEdit(null);
        setPlacement(null);
        setPracticePlacement(null);
        setPaletteKind(
          next.diagrams.find((d) => d.id === next.activeDiagramId)?.kind ||
            'class',
        );
        nativeConnector.current = null;
        setStyleMode(false);
      } else {
        // Canvas text edits and undo change the model under an open form. Follow
        // them unless the form holds unapplied edits.
        const before = shown.current;
        setEditClass((previous) => {
          if (!previous) return previous;
          const old = before.classes.find((c) => c.id === previous.id);
          const updated = next.classes.find((c) => c.id === previous.id);
          if (!old) return previous;
          if (!updated) return null;
          return sameClass(previous, old) && !sameClass(previous, updated)
            ? { ...updated }
            : previous;
        });
        setRel((previous) => {
          if (!previous) return previous;
          const old = before.relationships.find((r) => r.id === previous.id);
          const updated = next.relationships.find((r) => r.id === previous.id);
          if (!old) return previous;
          if (!updated) return null;
          return sameRelationship(previous, old) &&
            !sameRelationship(previous, updated)
            ? { ...updated }
            : previous;
        });
        setNativeEdit((previous) => {
          if (!previous) return previous;
          const old = nativeItem(before, previous.id);
          const updated = nativeItem(next, previous.id);
          if (!old) return previous;
          if (!updated) return null;
          return sameNative(previous, old) && !sameNative(previous, updated)
            ? { ...updated }
            : previous;
        });
      }
      ref.current = next;
      shown.current = next;
      setProject(next);
      lastSignature.current = '';
      const d = next.diagrams.find((d) => d.id === next.activeDiagramId)!;
      api.current?.updateScene({
        elements: d.elements as ExcalidrawElement[],
        appState: {
          ...canvasViewport(d),
          selectedElementIds: keepSelection
            ? api.current?.getAppState().selectedElementIds || {}
            : {},
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      // An applied scene is not a new user edit; keep it out of undo history.
      if (api.current)
        lastScene.current = sceneKey(
          api.current.getSceneElementsIncludingDeleted(),
        );
      api.current?.addFiles(Object.values(next.files) as BinaryFileData[]);
      if (fit)
        requestAnimationFrame(() =>
          api.current?.scrollToContent(d.elements as ExcalidrawElement[], {
            fitToViewport: true,
            viewportZoomFactor: 0.78,
          }),
        );
      requestAnimationFrame(() => {
        applying.current = false;
      });
      persist();
    },
    [persist],
  );
  const commit = useCallback(
    (next: Project, fit = false) => {
      flushHistory();
      past.current.push(structuredClone(ref.current));
      future.current = [];
      sync();
      // Inserted native symbols and examples join the shared native model.
      let reconciled = next;
      try {
        reconciled = next.diagrams.reduce(
          (p, d) => reconcileNativeUmlScene(p, d.id),
          next,
        );
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Unable to update the model.', {
          tone: 'error',
        });
      }
      apply(renderProject(reconciled), fit);
    },
    [apply, flash, flushHistory, sync],
  );
  const undo = useCallback(
    (redo = false) => {
      flushHistory();
      const source = redo ? future.current : past.current;
      const target = redo ? past.current : future.current;
      const next = source.pop();
      if (next) {
        target.push(structuredClone(ref.current));
        apply(next);
        sync();
      }
    },
    [apply, flushHistory, sync],
  );
  useEffect(() => {
    const save = () => {
      if (!loaded.current) return;
      try {
        localStorage.setItem(STORAGE, JSON.stringify(ref.current));
      } catch {
        /* UI already offers a file download. */
      }
    };
    window.addEventListener('pagehide', save);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (historyTimer.current) clearTimeout(historyTimer.current);
    };
  }, [flash]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('arxdraw.theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  const onChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      state: AppState,
      files: BinaryFiles,
    ) => {
      if (applying.current || !loaded.current) return;
      setTool(state.activeTool.type);
      const chosen = elements.find(
        (e) => state.selectedElementIds[e.id] && !e.isDeleted,
      );
      const modelId = chosen?.customData?.modelId;
      const relationshipId = chosen?.customData?.relationshipId;
      const native = chosen && nativeItem(ref.current, nativeIdOf(chosen));
      const customTool = state.activeTool.type === 'custom';
      const modelSelected =
        state.activeTool.type === 'selection' &&
        !!(modelId || relationshipId || native);
      const selection = Object.keys(state.selectedElementIds).sort().join();
      if (selection !== lastSelection.current) {
        lastSelection.current = selection;
        setStyleMode(false);
        setHasSelection(!!selection);
      }
      setPanel(customTool || modelSelected);
      if (modelSelected) {
        setPanelTab('tools');
        const c = ref.current.classes.find((c) => c.id === modelId);
        const r = ref.current.relationships.find(
          (r) => r.id === relationshipId,
        );
        setEditClass((previous) =>
          c ? (previous?.id === c.id ? previous : { ...c }) : null,
        );
        setRel((previous) =>
          r ? (previous?.id === r.id ? previous : { ...r }) : null,
        );
        setNativeEdit((previous) =>
          native && !c && !r
            ? previous?.id === native.id
              ? previous
              : { ...native }
            : null,
        );
      } else if (!customTool) {
        setEditClass(null);
        setRel(null);
        setNativeEdit(null);
        setPlacement(null);
        setPracticePlacement(null);
      }
      const sceneSignature = sceneKey(elements);
      const signature = sceneSignature + JSON.stringify(cleanViewport(state));
      if (signature === lastSignature.current) return;
      lastSignature.current = signature;
      // Scrolling and zooming are saved but are not undoable edits.
      // The first scene after mounting is the starting point, not an edit.
      const viewportOnly =
        lastScene.current === null || sceneSignature === lastScene.current;
      lastScene.current = sceneSignature;
      const prev = ref.current;
      if (!viewportOnly) {
        if (!baseline.current) baseline.current = structuredClone(prev);
        if (historyTimer.current) clearTimeout(historyTimer.current);
        historyTimer.current = setTimeout(flushHistory, 450);
      }
      let next = {
        ...prev,
        files: { ...prev.files, ...files },
        diagrams: prev.diagrams.map((d) =>
          d.id === prev.activeDiagramId
            ? {
                ...d,
                elements: elements as unknown as Diagram['elements'],
                viewport: cleanViewport(state),
              }
            : d,
        ),
      };
      let modelChanged = false;
      if (!state.editingTextElement) {
        // Bindings are provisional while a pointer gesture is underway.
        const gesture =
          state.cursorButton === 'down' ||
          !!state.newElement ||
          !!state.multiElement ||
          !!state.resizingElement;
        let reconciled = next;
        try {
          reconciled = gesture
            ? reconcileDuplicatedClasses(next, next.activeDiagramId)
            : reconcileScene(next);
        } catch (e) {
          flash(
            e instanceof Error ? e.message : 'Unable to update the model.',
            {
              tone: 'error',
            },
          );
        }
        if (reconciled !== next) {
          next = reconciled;
          modelChanged = true;
        }
        for (const e of elements) {
          const data = e.customData;
          if (data?.relationshipId && e.type === 'arrow' && e.isDeleted) {
            const d = next.diagrams.find((d) => d.id === next.activeDiagramId)!;
            if (d.relationshipIds.includes(data.relationshipId)) {
              next = {
                ...next,
                diagrams: next.diagrams.map((x) =>
                  x.id === d.id
                    ? {
                        ...x,
                        relationshipIds: x.relationshipIds.filter(
                          (id) => id !== data.relationshipId,
                        ),
                      }
                    : x,
                ),
              };
              modelChanged = true;
            }
          }
          if (e.type === 'text') {
            const container = e.containerId
              ? elements.find((item) => item.id === e.containerId)
              : undefined;
            const relationshipId =
              data?.relationshipId || container?.customData?.relationshipId;
            const field =
              data?.role === 'sourceMultiplicity' ||
              data?.role === 'targetMultiplicity'
                ? data.role
                : container?.customData?.relationshipId
                  ? 'label'
                  : null;
            if (
              relationshipId &&
              field &&
              !elements.some(
                (item) =>
                  item.type === 'arrow' &&
                  item.isDeleted &&
                  item.customData?.relationshipId === relationshipId,
              )
            ) {
              const current = next.relationships.find(
                (r) => r.id === relationshipId,
              );
              if (
                current &&
                current[
                  field as 'label' | 'sourceMultiplicity' | 'targetMultiplicity'
                ] !== (e.isDeleted ? '' : e.text.trim())
              ) {
                next = {
                  ...next,
                  relationships: next.relationships.map((r) =>
                    r.id === relationshipId
                      ? { ...r, [field]: e.isDeleted ? '' : e.text.trim() }
                      : r,
                  ),
                };
                modelChanged = true;
              }
            }
          }
          if (!data?.modelId) continue;
          if (
            e.type === 'text' &&
            !e.isDeleted &&
            ['name', 'attributes', 'operations'].includes(data.role)
          ) {
            const c = next.classes.find((c) => c.id === data.modelId);
            const field = data.role as 'name' | 'attributes' | 'operations';
            const value = e.text.trim();
            if (c && c[field].trim() !== value) {
              next = updateClassifier(next, c.id, { [field]: value });
              modelChanged = true;
            }
          }
          if (data.role === 'box' && e.isDeleted) {
            const d = next.diagrams.find((d) => d.id === next.activeDiagramId)!;
            if (d.classIds.includes(data.modelId)) {
              next = {
                ...next,
                diagrams: next.diagrams.map((x) =>
                  x.id === d.id
                    ? {
                        ...x,
                        classIds: x.classIds.filter(
                          (id) => id !== data.modelId,
                        ),
                      }
                    : x,
                ),
              };
              modelChanged = true;
            }
          }
        }
      }
      ref.current = next;
      persist(viewportOnly);
      if (modelChanged) {
        queueMicrotask(() => apply(renderProject(next), false, true));
      }
    },
    [apply, flash, flushHistory, persist],
  );
  function switchDiagram(id: string) {
    if (id === ref.current.activeDiagramId) return;
    flushHistory();
    setPaletteKind(
      ref.current.diagrams.find((d) => d.id === id)?.kind || 'class',
    );
    setPracticePlacement(null);
    setPlacement(null);
    const next = renderProject({ ...ref.current, activeDiagramId: id });
    apply(next, !next.diagrams.find((d) => d.id === id)?.viewport);
  }
  function stepDiagram(delta: number) {
    const { diagrams, activeDiagramId } = ref.current;
    const index = diagrams.findIndex((d) => d.id === activeDiagramId);
    const target =
      diagrams[(index + delta + diagrams.length) % diagrams.length];
    if (target.id === activeDiagramId) return;
    switchDiagram(target.id);
    flash(`${target.name} · ${kindLabel(target.kind)} diagram`);
  }
  function copyDiagram(id: string) {
    try {
      commit(duplicateDiagram(ref.current, id));
      const copy = ref.current.diagrams.find(
        (d) => d.id === ref.current.activeDiagramId,
      )!;
      setPaletteKind(copy.kind || 'class');
      flash(`“${copy.name}” created. Class diagrams share the same model.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Unable to copy this diagram.', {
        tone: 'error',
      });
    }
  }
  function deleteDiagram(d: Diagram) {
    const next = removeDiagram(ref.current, d.id);
    const active = next.diagrams.find(
      (diagram) => diagram.id === next.activeDiagramId,
    )!;
    commit(next, !active.viewport && active.elements.length > 0);
    flash(`“${d.name}” deleted.`, {
      action: { label: 'Undo', run: () => undo() },
    });
  }
  function selectOnCanvas(test: (e: ExcalidrawElement) => boolean) {
    api.current?.setActiveTool({ type: 'selection' });
    setTool('selection');
    const els = api.current?.getSceneElements().filter(test) || [];
    api.current?.updateScene({
      appState: {
        selectedElementIds: Object.fromEntries(els.map((e) => [e.id, true])),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    if (els.length) api.current?.scrollToContent(els, { animate: true });
    return els.length > 0;
  }
  function showDiagnostic(issue: ProjectDiagnostic) {
    setCheckResults(null);
    const p = ref.current;
    const diagramId = issue.diagramIds.includes(p.activeDiagramId)
      ? p.activeDiagramId
      : issue.diagramIds[0];
    if (diagramId) switchDiagram(diagramId);
    const relationshipId = issue.relationshipIds[0],
      classId = issue.classIds[0],
      nativeId =
        issue.nativeRelationshipIds?.[0] ?? issue.nativeElementIds?.[0];
    requestAnimationFrame(() => {
      const shown =
        !!diagramId &&
        (relationshipId
          ? selectOnCanvas(
              (e) =>
                e.type === 'arrow' &&
                e.customData?.relationshipId === relationshipId,
            )
          : classId
            ? selectOnCanvas((e) => e.customData?.modelId === classId)
            : !!nativeId && selectOnCanvas((e) => nativeIdOf(e) === nativeId));
      if (shown) return;
      // Not drawn on any diagram: edit it in the Model section instead.
      const c = ref.current.classes.find((c) => c.id === classId);
      const r = ref.current.relationships.find((r) => r.id === relationshipId);
      const n = nativeItem(ref.current, nativeId);
      if (!c && !r && !n) return;
      openUml('model');
      setRel(r ? { ...r } : null);
      setEditClass(!r && c ? { ...c } : null);
      setNativeEdit(!r && !c && n ? { ...n } : null);
    });
  }
  function selectNative(id: string) {
    return selectOnCanvas((e) => nativeIdOf(e) === id);
  }
  /** Draw another view of a shared native element on the active diagram. */
  function addNativeView(id: string) {
    const s = api.current?.getAppState();
    const zoom = s?.zoom.value || 1;
    const x = s ? -s.scrollX + s.width / 2 / zoom - 70 : 100,
      y = s ? -s.scrollY + s.height / 2 / zoom - 40 : 100;
    try {
      const added = convertToExcalidrawElements(
        nativeUmlViewSkeletons(
          ref.current,
          id,
          x,
          y,
        ) as ExcalidrawElementSkeleton[],
        { regenerateIds: false },
      );
      const p = ref.current;
      commit({
        ...p,
        diagrams: p.diagrams.map((d) =>
          d.id === p.activeDiagramId
            ? {
                ...d,
                elements: [...d.elements, ...added] as Diagram['elements'],
              }
            : d,
        ),
      });
      requestAnimationFrame(() => selectNative(id));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Unable to add this element.', {
        tone: 'error',
      });
    }
  }
  function diagramWithContent(
    p: Project,
    kind: DiagramKind,
    name: string,
    example: boolean,
  ): Project {
    const id = uid();
    const label =
      name ||
      (kind === 'class'
        ? 'Class diagram'
        : diagramKinds.find((item) => item.id === kind)?.label || 'Diagram');
    if (kind === 'class' && example) {
      const seed = createProject();
      const classMap = new Map(seed.classes.map((c) => [c.id, uid()]));
      const relationshipMap = new Map(
        seed.relationships.map((r) => [r.id, uid()]),
      );
      const names = new Set(p.classes.map((c) => c.name));
      const classes = seed.classes.map((c) => {
        let name = c.name,
          index = 2;
        while (names.has(name)) name = `${c.name}${index++}`;
        names.add(name);
        return { ...c, id: classMap.get(c.id)!, name };
      });
      const relationships = seed.relationships.map((r) => ({
        ...r,
        id: relationshipMap.get(r.id)!,
        from: classMap.get(r.from)!,
        to: classMap.get(r.to)!,
      }));
      return {
        ...p,
        classes: [...p.classes, ...classes],
        relationships: [...p.relationships, ...relationships],
        activeDiagramId: id,
        diagrams: [
          ...p.diagrams,
          {
            id,
            kind,
            name: label,
            classIds: classes.map((c) => c.id),
            relationshipIds: relationships.map((r) => r.id),
            elements: [],
          },
        ],
      };
    }
    const elements =
      example && kind !== 'class'
        ? (convertToExcalidrawElements(
            exampleSkeletons(kind) as ExcalidrawElementSkeleton[],
            { regenerateIds: false },
          ) as unknown as Diagram['elements'])
        : [];
    return {
      ...p,
      activeDiagramId: id,
      diagrams: [
        ...p.diagrams,
        { id, kind, name: label, classIds: [], relationshipIds: [], elements },
      ],
    };
  }
  function createDiagram(kind: DiagramKind, name: string, example: boolean) {
    if (ref.current.diagrams.length >= 100) {
      flash('This project has reached 100 diagrams. Start a new project.');
      return;
    }
    commit(diagramWithContent(ref.current, kind, name, example), example);
    setPaletteKind(kind);
  }
  function addPracticeExamples() {
    let next = ref.current;
    if (next.diagrams.length + diagramKinds.length + 1 > 100) {
      flash('Start a new project to add all examples.');
      return;
    }
    next = diagramWithContent(next, 'class', 'Class · Online shop', true);
    const first = next.activeDiagramId;
    for (const kind of diagramKinds)
      next = diagramWithContent(
        next,
        kind.id,
        `${kind.label} · ${exampleTitle(kind.id)}`,
        true,
      );
    commit({ ...next, activeDiagramId: first }, true);
    setPaletteKind('class');
    openUml('diagrams');
  }
  function selectPracticeTool(id: string) {
    setPlacement(null);
    if (isPracticeConnector(id)) {
      const arrow = symbolSkeletons(id, 0, 0).find(
        (element) => element.type === 'arrow',
      )!;
      nativeConnector.current = { kind: id, label: arrow.label };
      setPracticePlacement(null);
      api.current?.updateScene({
        appState: {
          currentItemStartArrowhead: (arrow.startArrowhead ||
            null) as AppState['currentItemStartArrowhead'],
          currentItemEndArrowhead: (arrow.endArrowhead ||
            null) as AppState['currentItemEndArrowhead'],
          currentItemStrokeStyle: (arrow.strokeStyle ||
            'solid') as AppState['currentItemStrokeStyle'],
          currentItemRoughness: 0,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      api.current?.setActiveTool({ type: 'arrow' });
      setTool('arrow');
      setPanel(false);
    } else {
      nativeConnector.current = null;
      setPracticePlacement(id);
      setTool('custom');
      api.current?.setActiveTool({ type: 'custom', customType: `uml-${id}` });
    }
  }
  function selectClassConnector(kind: Relationship['kind']) {
    setPlacement(null);
    setPracticePlacement(null);
    nativeConnector.current = { classKind: kind };
    const style = classConnectorStyle(kind);
    api.current?.updateScene({
      appState: {
        currentItemStartArrowhead:
          style.startArrowhead as AppState['currentItemStartArrowhead'],
        currentItemEndArrowhead:
          style.endArrowhead as AppState['currentItemEndArrowhead'],
        currentItemStrokeStyle:
          style.strokeStyle as AppState['currentItemStrokeStyle'],
        currentItemRoughness: 0,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.current?.setActiveTool({ type: 'arrow' });
    setTool('arrow');
    setPanel(false);
    flash(`Drag from one class to another to draw a ${kind}.`);
  }
  function addPracticeSymbol(id: string, position: { x: number; y: number }) {
    const added = convertToExcalidrawElements(
      symbolSkeletons(
        id,
        position.x,
        position.y,
      ) as ExcalidrawElementSkeleton[],
      { regenerateIds: false },
    );
    const p = ref.current;
    commit({
      ...p,
      diagrams: p.diagrams.map((d) =>
        d.id === p.activeDiagramId
          ? { ...d, elements: [...d.elements, ...added] as Diagram['elements'] }
          : d,
      ),
    });
    setPracticePlacement(null);
    api.current?.setActiveTool({ type: 'selection' });
    requestAnimationFrame(() =>
      api.current?.updateScene({
        appState: {
          selectedElementIds: Object.fromEntries(
            added.map((e) => [e.id, true]),
          ),
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      }),
    );
  }
  function saveFile() {
    flushHistory();
    const name = ref.current.name.replace(/[^a-z0-9_-]+/gi, '-') || 'project';
    download(
      new Blob([JSON.stringify(ref.current, null, 2)], {
        type: 'application/json',
      }),
      `${name}.arxdraw`,
    );
    const retryBrowserSave = storageFailed.current;
    setSaveState((state) =>
      state === 'saving' || retryBrowserSave ? state : 'downloaded',
    );
    if (retryBrowserSave) persist();
    flash(`Project file “${name}.arxdraw” downloaded.`);
  }
  function startNewProject(saveCurrent: boolean) {
    if (saveCurrent) saveFile();
    // Keep the previous project in the existing project-level undo history.
    applying.current = true;
    api.current?.resetScene();
    commit(createBlankProject());
    closeUml();
    setDialog(null);
    setNewProjectOpen(false);
    setNotice(null);
  }
  async function openFile(file: File, merge: boolean) {
    try {
      if (file.size > 40_000_000)
        throw new Error('Choose a project smaller than 40 MB.');
      const incoming = parseProject(await file.text());
      const p = renderProject(
        merge ? mergeProjects(ref.current, incoming) : incoming,
      );
      commit(p, true);
      setPaletteKind(
        p.diagrams.find((d) => d.id === p.activeDiagramId)?.kind || 'class',
      );
      flash(
        merge
          ? `Added ${incoming.diagrams.length} diagram${incoming.diagrams.length === 1 ? '' : 's'} from “${file.name}”.`
          : `Opened “${file.name}”.`,
        { action: { label: 'Undo', run: () => undo() } },
      );
    } catch (e) {
      flash(openError(e, file.name), { tone: 'error' });
    }
  }
  function chooseFile(merge: boolean) {
    mergeFile.current = merge;
    fileInput.current?.click();
  }
  function moveDiagram(id: string, direction: -1 | 1) {
    const p = ref.current;
    const index = p.diagrams.findIndex((diagram) => diagram.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= p.diagrams.length) return;
    const diagrams = [...p.diagrams];
    const moved = diagrams.splice(index, 1)[0];
    if (!moved) return;
    diagrams.splice(target, 0, moved);
    commit({ ...p, diagrams });
  }
  function addClass(
    kind: Classifier['kind'] = 'class',
    position?: { x: number; y: number },
  ) {
    const p = ref.current;
    const id = uid();
    const base = kind === 'interface' ? 'Interface' : 'Class';
    let n = p.classes.length + 1;
    while (p.classes.some((c) => c.name === `${base}${n}`)) n++;
    const c: Classifier = {
      id,
      name: `${base}${n}`,
      kind,
      attributes: '- id: UUID',
      operations: '+ operation(): void',
      description: '',
    };
    const next = {
      ...p,
      classes: [...p.classes, c],
      diagrams: p.diagrams.map((d) =>
        d.id === p.activeDiagramId
          ? {
              ...d,
              classIds: [...d.classIds, id],
              elements: position
                ? [
                    ...d.elements,
                    {
                      id: `placement-${id}`,
                      type: 'rectangle',
                      ...position,
                      width: 250,
                      height: 200,
                      customData: { modelId: id, role: 'box', arxdraw: true },
                    },
                  ]
                : d.elements,
            }
          : d,
      ),
    };
    commit(next, !position);
    setPlacement(null);
    api.current?.setActiveTool({ type: 'selection' });
    requestAnimationFrame(() => showClass(id));
    setEditClass(c);
    setRel(null);
    setNativeEdit(null);
    setPanel(true);
  }
  function showClass(id: string) {
    const p = ref.current;
    const d = p.diagrams.find((d) => d.id === p.activeDiagramId)!;
    if (!d.classIds.includes(id)) {
      commit(
        {
          ...p,
          diagrams: p.diagrams.map((x) =>
            x.id === d.id ? { ...x, classIds: [...x.classIds, id] } : x,
          ),
        },
        true,
      );
      flash('Class added.');
      requestAnimationFrame(() => showClass(id));
      return;
    }
    selectOnCanvas((e) => e.customData?.modelId === id);
  }
  function newRelationship() {
    const p = ref.current;
    const d = p.diagrams.find((d) => d.id === p.activeDiagramId)!;
    if (d.classIds.length < 1) {
      flash('Add a class to this diagram first.');
      return;
    }
    setPlacement(null);
    setEditClass(null);
    setPanel(true);
    setPanelTab('tools');
    api.current?.setActiveTool({ type: 'custom', customType: 'uml' });
    setRel({
      id: uid(),
      from: d.classIds[0],
      to: d.classIds[1] || d.classIds[0],
      kind: 'association',
      label: '',
      sourceMultiplicity: '',
      targetMultiplicity: '',
    });
  }
  function saveRelationship() {
    if (!rel) return;
    const p = ref.current;
    const exists = p.relationships.some((r) => r.id === rel.id);
    commit({
      ...p,
      relationships: exists
        ? p.relationships.map((r) => (r.id === rel.id ? rel : r))
        : [...p.relationships, rel],
      // Only draw it where both ends are visible.
      diagrams: p.diagrams.map((d) =>
        d.id === p.activeDiagramId &&
        d.classIds.includes(rel.from) &&
        d.classIds.includes(rel.to)
          ? {
              ...d,
              relationshipIds: Array.from(
                new Set([...d.relationshipIds, rel.id]),
              ),
            }
          : d,
      ),
    });
    setRel(null);
    setNativeEdit(null);
  }
  async function exportImage(type: 'png' | 'svg') {
    if (!api.current) return;
    try {
      const opts = {
        elements: api.current.getSceneElements(),
        appState: { ...api.current.getAppState(), exportBackground: true },
        files: api.current.getFiles(),
      };
      const blob =
        type === 'png'
          ? await exportToBlob({ ...opts, mimeType: 'image/png' })
          : new Blob([(await exportToSvg(opts)).outerHTML], {
              type: 'image/svg+xml',
            });
      download(
        blob,
        `${ref.current.diagrams.find((d) => d.id === ref.current.activeDiagramId)!.name}.${type}`,
      );
    } catch {
      flash('Image export failed. Try downloading the project instead.', {
        tone: 'error',
      });
    }
  }
  const active = project.diagrams.find(
    (d) => d.id === project.activeDiagramId,
  )!;
  /** Model reconciliation once a canvas gesture or click-by-click arrow ends. */
  function finishGesture(
    connector: NativeConnector | null,
    isNew: (id: string) => boolean,
    movedGenerated = false,
  ) {
    const p = ref.current;
    const d = p.diagrams.find((item) => item.id === p.activeDiagramId)!;
    let next = p;
    if (connector?.kind) {
      const arrow = api.current
        ?.getSceneElements()
        .find((item) => item.type === 'arrow' && isNew(item.id));
      if (arrow) {
        const label = connector.label?.text ? connector.label : null;
        const seeded = {
          ...arrow,
          customData: {
            ...arrow.customData,
            uml: {
              id: uid(),
              kind: connector.kind,
              role: 'edge',
              name: label?.text ?? '',
            },
          },
        };
        const decorated = label
          ? convertToExcalidrawElements(
              [{ ...seeded, label }] as ExcalidrawElementSkeleton[],
              { regenerateIds: false },
            )
          : [seeded];
        const ids = new Set(decorated.map((item) => item.id));
        next = {
          ...p,
          diagrams: p.diagrams.map((item) =>
            item.id === d.id
              ? {
                  ...item,
                  elements: [
                    ...d.elements.filter((element) => !ids.has(element.id)),
                    ...decorated,
                  ] as Diagram['elements'],
                }
              : item,
          ),
        };
      }
    }
    try {
      next = reconcileScene(next, connector?.classKind);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Unable to update the model.', {
        tone: 'error',
      });
    }
    if (
      connector?.classKind &&
      next.diagrams
        .find((item) => item.id === next.activeDiagramId)
        ?.elements.some(
          (e) =>
            e.type === 'arrow' &&
            !e.isDeleted &&
            isNew(e.id) &&
            !e.customData?.relationshipId,
        )
    )
      flash(
        `Start and end the arrow on two classes to create a ${connector.classKind}. Unconnected arrows stay drawings.`,
      );
    if (next !== p || movedGenerated) apply(renderProject(next), false, true);
  }
  const options = project.classes
    .filter(
      (c) =>
        active.classIds.includes(c.id) ||
        c.id === rel?.from ||
        c.id === rel?.to,
    )
    .map((c) => ({ value: c.id, label: c.name }));
  const className = (id: string) =>
    project.classes.find((c) => c.id === id)?.name || 'Missing classifier';
  const modelClass = editClass
    ? project.classes.find((c) => c.id === editClass.id)
    : undefined;
  const classDirty = !!editClass && !sameClass(editClass, modelClass);
  const modelRel = rel
    ? project.relationships.find((r) => r.id === rel.id)
    : undefined;
  const relDirty = !!rel && !sameRelationship(rel, modelRel);
  const matchingClasses = project.classes.filter((c) =>
    matches(modelQuery, c.name, c.kind, c.attributes, c.operations),
  );
  const classesHere = matchingClasses.filter((c) =>
    active.classIds.includes(c.id),
  );
  const classesElsewhere = matchingClasses.filter(
    (c) => !active.classIds.includes(c.id),
  );
  const relationshipsHere = project.relationships.filter(
    (r) =>
      active.relationshipIds.includes(r.id) &&
      matches(modelQuery, r.label, r.kind, className(r.from), className(r.to)),
  );
  const matchingDiagrams = project.diagrams.filter((d) =>
    matches(diagramQuery, d.name, kindLabel(d.kind)),
  );
  const activeIndex = project.diagrams.indexOf(active);
  const classDiagram = (active.kind || 'class') === 'class';
  const nativeElements = project.nativeModel?.elements || [],
    nativeLinks = project.nativeModel?.relationships || [];
  const nativeName = (id: string) =>
    nativeElements.find((e) => e.id === id)?.name || 'Missing element';
  const matchingNative = nativeElements.filter((e) =>
    matches(modelQuery, e.name, nativeKindLabel(e.kind), e.description),
  );
  const nativeHere = matchingNative.filter((e) =>
    active.nativeElementIds?.includes(e.id),
  );
  const nativeElsewhere = matchingNative.filter(
    (e) => !active.nativeElementIds?.includes(e.id),
  );
  const nativeLinksHere = nativeLinks.filter(
    (r) =>
      active.nativeRelationshipIds?.includes(r.id) &&
      matches(
        modelQuery,
        r.name,
        nativeKindLabel(r.kind),
        nativeName(r.from),
        nativeName(r.to),
      ),
  );
  const modelNative = nativeEdit
    ? nativeItem(project, nativeEdit.id)
    : undefined;
  const nativeDirty = !!nativeEdit && !sameNative(nativeEdit, modelNative);
  const nativeOnActive =
    !!nativeEdit &&
    (isNativeLink(nativeEdit)
      ? !!active.nativeRelationshipIds?.includes(nativeEdit.id)
      : !!active.nativeElementIds?.includes(nativeEdit.id));
  function openUml(tab: 'tools' | 'model' | 'diagrams' = 'tools') {
    setTool('custom');
    setPanelTab(tab);
    setPanel(true);
    setStyleMode(false);
    setEditClass(null);
    setRel(null);
    setNativeEdit(null);
    setPlacement(null);
    setPracticePlacement(null);
    api.current?.updateScene({
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.current?.setActiveTool({ type: 'custom', customType: 'uml' });
  }
  function closeUml() {
    setTool('selection');
    setPanel(false);
    setStyleMode(false);
    setPlacement(null);
    setEditClass(null);
    setRel(null);
    setNativeEdit(null);
    api.current?.updateScene({
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.current?.setActiveTool({ type: 'selection' });
  }
  function place(kind: Classifier['kind']) {
    setTool('custom');
    setPlacement(kind);
    setPracticePlacement(null);
    setEditClass(null);
    setRel(null);
    setNativeEdit(null);
    api.current?.setActiveTool({ type: 'custom', customType: `uml-${kind}` });
  }
  const classRow = (c: Classifier) => {
    const here = active.classIds.includes(c.id);
    return (
      <div className="arx-model-row" key={c.id}>
        <button
          onClick={() => showClass(c.id)}
          title={here ? `Select ${c.name} on the canvas` : `Add ${c.name} here`}
        >
          <span className="arx-class-letter" aria-hidden="true">
            {classifierLetter(c.kind)}
          </span>
          <span>{c.name}</span>
          {!here && <Plus size={13} aria-label="Add to this diagram" />}
        </button>
        <button
          aria-label={`Edit ${c.name}`}
          title={`Edit ${c.name}`}
          onClick={() => {
            setEditClass({ ...c });
            setRel(null);
            setNativeEdit(null);
          }}
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  };
  const nativeRow = (e: NativeUmlElement, here: boolean) => (
    <div className="arx-model-row" key={e.id}>
      <button
        onClick={() => (here ? selectNative(e.id) : addNativeView(e.id))}
        title={
          here
            ? `Select ${e.name} on the canvas`
            : `Add a view of ${e.name} here`
        }
      >
        <span className="arx-row-text">
          <span>{e.name || 'Unnamed'}</span>
          <small>{nativeKindLabel(e.kind)}</small>
        </span>
        {!here && <Plus size={13} aria-label="Add to this diagram" />}
      </button>
      <button
        aria-label={`Edit ${e.name}`}
        title={`Edit ${e.name}`}
        onClick={() => {
          setNativeEdit({ ...e });
          setEditClass(null);
          setRel(null);
        }}
      >
        <Pencil size={13} />
      </button>
    </div>
  );
  const panelContent = styleMode ? (
    <section
      className="Island arx-properties arx-style-bar"
      aria-label="UML properties"
    >
      <button
        className="arx-row"
        aria-pressed="true"
        onClick={() => setStyleMode(false)}
      >
        <ArrowLeft size={16} />
        <span>UML properties</span>
      </button>
    </section>
  ) : (
    <section className="Island arx-properties" aria-label="UML properties">
      <div className="arx-panel-heading">
        {(editClass || rel || nativeEdit) && (
          <button
            className="arx-close"
            aria-label="Back to model"
            title="Back to model"
            onClick={() => openUml('model')}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <span className="arx-heading-text">
          {editClass ? (
            <>
              <span>{editClass.name.trim() || 'Unnamed classifier'}</span>
              <small>
                {editClass.kind === 'abstract'
                  ? 'Abstract class'
                  : editClass.kind === 'interface'
                    ? 'Interface'
                    : 'Class'}
              </small>
            </>
          ) : rel ? (
            <>
              <span>{modelRel ? 'Relationship' : 'New relationship'}</span>
              <small>
                {className(rel.from)} → {className(rel.to)}
              </small>
            </>
          ) : nativeEdit ? (
            <>
              <span>{nativeEdit.name.trim() || 'Unnamed'}</span>
              <small>
                {nativeKindLabel(nativeEdit.kind)}
                {isNativeLink(nativeEdit) &&
                  ` · ${nativeName(nativeEdit.from)} → ${nativeName(nativeEdit.to)}`}
              </small>
            </>
          ) : (
            'UML'
          )}
        </span>
        {(editClass || rel || nativeEdit) && hasSelection && (
          <button
            className="arx-close"
            aria-label="Colors and stroke"
            title="Colors and stroke"
            onClick={() => setStyleMode(true)}
          >
            <Palette size={16} />
          </button>
        )}
        <button
          className="arx-close"
          aria-label="Close UML properties"
          title="Close (Esc)"
          onClick={closeUml}
        >
          <X size={16} />
        </button>
      </div>
      {!editClass && !rel && !nativeEdit && (
        <Tabs
          value={panelTab}
          onValueChange={(value) =>
            setPanelTab(value as 'tools' | 'model' | 'diagrams')
          }
        >
          <TabsList className="arx-panel-tabs" aria-label="UML sections">
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
          </TabsList>
          <TabsContent value="tools">
            <Choice
              label="Diagram tools"
              value={paletteKind}
              onChange={(value) => {
                setPaletteKind(value as DiagramKind);
                setPlacement(null);
                setPracticePlacement(null);
              }}
              options={[
                { value: 'class', label: 'Class' },
                ...diagramKinds.map((kind) => ({
                  value: kind.id,
                  label: kind.label,
                })),
              ]}
            />
            {paletteKind === 'class' ? (
              <>
                <fieldset>
                  <legend>Classifier</legend>
                  <div className="arx-tool-list">
                    <button
                      className={placement === 'class' ? 'active' : ''}
                      aria-pressed={placement === 'class'}
                      onClick={() => place('class')}
                    >
                      <Box size={16} />
                      Class
                    </button>
                    <button
                      className={placement === 'interface' ? 'active' : ''}
                      aria-pressed={placement === 'interface'}
                      onClick={() => place('interface')}
                    >
                      <Braces size={16} />
                      Interface
                    </button>
                    <button
                      className={placement === 'abstract' ? 'active' : ''}
                      aria-pressed={placement === 'abstract'}
                      onClick={() => place('abstract')}
                    >
                      <Box size={16} />
                      Abstract class
                    </button>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Draw relationship</legend>
                  <div className="arx-tool-list">
                    {relationshipKinds.map((kind) => (
                      <button
                        key={kind}
                        title={`Drag from one class to another to draw a ${kind}`}
                        onClick={() => selectClassConnector(kind)}
                      >
                        <GitBranch size={14} />
                        {kind[0].toUpperCase() + kind.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button className="arx-row" onClick={newRelationship}>
                    <Plus size={16} />
                    Relationship form…
                  </button>
                </fieldset>
              </>
            ) : (
              <div className="arx-tool-list arx-practice-tools">
                {practiceTools(paletteKind as PracticeDiagramKind).map(
                  (item) => (
                    <button
                      key={item.id}
                      className={practicePlacement === item.id ? 'active' : ''}
                      aria-pressed={practicePlacement === item.id}
                      onClick={() => selectPracticeTool(item.id)}
                    >
                      <Plus size={14} />
                      {item.label}
                    </button>
                  ),
                )}
              </div>
            )}
            {(placement || practicePlacement) && (
              <output className="arx-hint">
                Click on the canvas to place. Press Esc to cancel.
              </output>
            )}
          </TabsContent>
          <TabsContent value="model">
            <Input
              type="search"
              className="arx-search"
              aria-label="Filter model"
              placeholder="Filter model…"
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
            />
            {(classDiagram || classesHere.length > 0) && (
              <fieldset>
                <legend>Classes here · {classesHere.length}</legend>
                <div className="arx-list">{classesHere.map(classRow)}</div>
                {!classesHere.length && (
                  <p className="arx-hint">
                    {modelQuery ? 'No matches.' : 'No classes on this diagram.'}
                  </p>
                )}
                <button className="arx-row" onClick={() => addClass('class')}>
                  <Plus size={14} />
                  New class
                </button>
              </fieldset>
            )}
            {classDiagram && classesElsewhere.length > 0 && (
              <fieldset>
                <legend>Other model classes · {classesElsewhere.length}</legend>
                <div className="arx-list">{classesElsewhere.map(classRow)}</div>
              </fieldset>
            )}
            {(classDiagram || relationshipsHere.length > 0) && (
              <fieldset>
                <legend>
                  Class relationships · {relationshipsHere.length}
                </legend>
                {relationshipsHere.map((r) => (
                  <button
                    className="arx-row"
                    key={r.id}
                    onClick={() => {
                      if (
                        !selectOnCanvas(
                          (e) =>
                            e.type === 'arrow' &&
                            e.customData?.relationshipId === r.id,
                        )
                      ) {
                        setRel({ ...r });
                        setEditClass(null);
                        setNativeEdit(null);
                      }
                    }}
                  >
                    <GitBranch size={14} />
                    <span className="arx-row-text">
                      <span>
                        {className(r.from)} → {className(r.to)}
                      </span>
                      <small>
                        {r.kind}
                        {r.label && ` · ${r.label}`}
                      </small>
                    </span>
                  </button>
                ))}
                {!relationshipsHere.length && (
                  <p className="arx-hint">
                    {modelQuery ? 'No matches.' : 'No relationships here.'}
                  </p>
                )}
              </fieldset>
            )}
            {(!classDiagram || nativeHere.length > 0) && (
              <fieldset>
                <legend>Elements here · {nativeHere.length}</legend>
                <div className="arx-list">
                  {nativeHere.map((e) => nativeRow(e, true))}
                </div>
                {!nativeHere.length && (
                  <p className="arx-hint">
                    {modelQuery
                      ? 'No matches.'
                      : 'Place UML symbols from Tools to add model elements.'}
                  </p>
                )}
              </fieldset>
            )}
            {!classDiagram && nativeElsewhere.length > 0 && (
              <fieldset>
                <legend>Other model elements · {nativeElsewhere.length}</legend>
                <div className="arx-list">
                  {nativeElsewhere.map((e) => nativeRow(e, false))}
                </div>
              </fieldset>
            )}
            {(!classDiagram || nativeLinksHere.length > 0) && (
              <fieldset>
                <legend>Links here · {nativeLinksHere.length}</legend>
                {nativeLinksHere.map((r) => (
                  <button
                    className="arx-row"
                    key={r.id}
                    onClick={() => {
                      if (!selectNative(r.id)) {
                        setNativeEdit({ ...r });
                        setEditClass(null);
                        setRel(null);
                      }
                    }}
                  >
                    <GitBranch size={14} />
                    <span className="arx-row-text">
                      <span>
                        {nativeName(r.from)} → {nativeName(r.to)}
                      </span>
                      <small>
                        {nativeKindLabel(r.kind)}
                        {r.name && ` · ${r.name}`}
                      </small>
                    </span>
                  </button>
                ))}
                {!nativeLinksHere.length && (
                  <p className="arx-hint">
                    {modelQuery
                      ? 'No matches.'
                      : 'Draw a UML connector between two symbols.'}
                  </p>
                )}
              </fieldset>
            )}
          </TabsContent>
          <TabsContent value="diagrams">
            {project.diagrams.length > 4 && (
              <Input
                type="search"
                className="arx-search"
                aria-label="Filter diagrams"
                placeholder="Filter diagrams"
                value={diagramQuery}
                onChange={(e) => setDiagramQuery(e.target.value)}
              />
            )}
            <div className="arx-list">
              {matchingDiagrams.map((d) => (
                <div className="arx-model-row" key={d.id}>
                  <button
                    className={d.id === active.id ? 'active' : ''}
                    aria-current={d.id === active.id ? 'page' : undefined}
                    title={`${d.name} · ${kindLabel(d.kind)} diagram`}
                    onClick={() => switchDiagram(d.id)}
                  >
                    <Network size={15} />
                    <span className="arx-row-text">
                      <span>{d.name}</span>
                      <small>{kindLabel(d.kind)}</small>
                    </span>
                  </button>
                  <button
                    aria-label={`Rename ${d.name}`}
                    title="Rename"
                    onClick={() => {
                      setRenameTarget('diagram');
                      setRenameId(d.id);
                      setText(d.name);
                      setDialog('rename');
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    aria-label={`Duplicate ${d.name}`}
                    title="Duplicate"
                    onClick={() => copyDiagram(d.id)}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    aria-label={`Move ${d.name} up`}
                    title="Move up"
                    disabled={project.diagrams[0]?.id === d.id}
                    onClick={() => moveDiagram(d.id, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    aria-label={`Move ${d.name} down`}
                    title="Move down"
                    disabled={project.diagrams.at(-1)?.id === d.id}
                    onClick={() => moveDiagram(d.id, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    className="arx-diagram-delete"
                    aria-label={`Delete ${d.name}`}
                    title="Delete"
                    onClick={() => deleteDiagram(d)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {!matchingDiagrams.length && (
                <p className="arx-hint">No diagrams match.</p>
              )}
            </div>
            <button
              className="arx-row"
              onClick={() => {
                setText('');
                setNewDiagramKind(paletteKind);
                setNewDiagramContent('blank');
                setDialog('diagram');
              }}
            >
              <Plus size={16} />
              New diagram
            </button>
            <p className="arx-hint">
              <kbd>Alt</kbd>+<kbd>PgUp</kbd> / <kbd>PgDn</kbd> switches
              diagrams.
            </p>
          </TabsContent>
        </Tabs>
      )}
      {editClass && (
        <form
          className="arx-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editClass.name.trim()) return;
            commit(
              updateClassifier(ref.current, editClass.id, {
                ...editClass,
                name: editClass.name.trim(),
              }),
            );
            setEditClass({ ...editClass, name: editClass.name.trim() });
            // Keep the panel open after the scene redraw clears the selection.
            api.current?.setActiveTool({ type: 'custom', customType: 'uml' });
            setPanel(true);
          }}
        >
          <label className="field" htmlFor="class-name">
            <span>Name</span>
            <Input
              id="class-name"
              required
              maxLength={100}
              value={editClass.name}
              onChange={(e) =>
                setEditClass({ ...editClass, name: e.target.value })
              }
            />
          </label>
          <Choice
            label="Type"
            value={editClass.kind}
            onChange={(v) =>
              setEditClass({ ...editClass, kind: v as Classifier['kind'] })
            }
            options={[
              { value: 'class', label: 'Class' },
              { value: 'interface', label: 'Interface' },
              { value: 'abstract', label: 'Abstract class' },
            ]}
          />
          <MemberEditor
            key={`${editClass.id}-attributes`}
            kind="attributes"
            value={editClass.attributes}
            onChange={(attributes) =>
              setEditClass({ ...editClass, attributes })
            }
          />
          <MemberEditor
            key={`${editClass.id}-operations`}
            kind="operations"
            value={editClass.operations}
            onChange={(operations) =>
              setEditClass({ ...editClass, operations })
            }
          />
          <label className="field" htmlFor="class-description">
            <span>Description</span>
            <Textarea
              id="class-description"
              rows={2}
              value={editClass.description}
              onChange={(e) =>
                setEditClass({ ...editClass, description: e.target.value })
              }
            />
          </label>
          <p className="arx-hint">
            Shown on{' '}
            {project.diagrams
              .filter((d) => d.classIds.includes(editClass.id))
              .map((d) => d.name)
              .join(', ') || 'no diagrams'}
            .
          </p>
          <div className="arx-form-actions">
            <Button type="submit" size="sm" disabled={!classDirty}>
              {classDirty ? 'Apply' : 'Applied'}
            </Button>
            {classDirty && modelClass && (
              <button
                type="button"
                className="arx-row"
                onClick={() => setEditClass({ ...modelClass })}
              >
                Revert
              </button>
            )}
          </div>
          {classDirty && (
            <output className="arx-dirty">
              Unapplied changes. Press Enter or Apply.
            </output>
          )}
          {active.classIds.includes(editClass.id) ? (
            <button
              type="button"
              className="arx-row"
              onClick={() => {
                const p = ref.current;
                commit({
                  ...p,
                  diagrams: p.diagrams.map((d) =>
                    d.id === p.activeDiagramId
                      ? {
                          ...d,
                          classIds: d.classIds.filter(
                            (id) => id !== editClass.id,
                          ),
                        }
                      : d,
                  ),
                });
                openUml('model');
              }}
            >
              Remove from diagram
            </button>
          ) : (
            <button
              type="button"
              className="arx-row"
              onClick={() => showClass(editClass.id)}
            >
              <Plus size={14} />
              Add to this diagram
            </button>
          )}
          <button
            type="button"
            className="arx-delete"
            onClick={() => {
              const name = editClass.name;
              commit(removeClassifier(ref.current, editClass.id));
              openUml('model');
              flash(`“${name}” deleted from the model.`, {
                action: { label: 'Undo', run: () => undo() },
              });
            }}
          >
            Delete from model
          </button>
        </form>
      )}
      {rel && (
        <form
          className="arx-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveRelationship();
          }}
        >
          <Choice
            label="Type"
            value={rel.kind}
            onChange={(v) => {
              const kind = relationshipKinds.find((value) => value === v);
              if (kind)
                setRel({
                  ...rel,
                  kind,
                  navigable: kind === 'association' ? rel.navigable : undefined,
                });
            }}
            options={relationshipKinds.map((v) => ({
              value: v,
              label: v[0].toUpperCase() + v.slice(1),
            }))}
          />
          <Choice
            label={
              ['aggregation', 'composition'].includes(rel.kind)
                ? 'Whole'
                : 'From'
            }
            value={rel.from}
            onChange={(v) => setRel({ ...rel, from: v })}
            options={options}
          />
          <Choice
            label={
              ['inheritance', 'realization'].includes(rel.kind)
                ? 'Parent / interface'
                : 'To'
            }
            value={rel.to}
            onChange={(v) => setRel({ ...rel, to: v })}
            options={options}
          />
          <button
            type="button"
            className="arx-row"
            onClick={() =>
              setRel({
                ...rel,
                from: rel.to,
                to: rel.from,
                sourceMultiplicity: rel.targetMultiplicity,
                targetMultiplicity: rel.sourceMultiplicity,
              })
            }
          >
            Reverse direction
          </button>
          {rel.kind === 'association' && (
            <label className="arx-navigable">
              <input
                type="checkbox"
                checked={rel.navigable === 'target'}
                onChange={(event) =>
                  setRel({
                    ...rel,
                    navigable: event.target.checked ? 'target' : undefined,
                  })
                }
              />
              <span>Navigate toward target (arrow)</span>
            </label>
          )}
          <label className="field" htmlFor="relationship-label">
            <span>Label</span>
            <Input
              id="relationship-label"
              value={rel.label}
              onChange={(e) => setRel({ ...rel, label: e.target.value })}
            />
          </label>
          <label className="field" htmlFor="source-multiplicity">
            <span>Source multiplicity</span>
            <Input
              id="source-multiplicity"
              placeholder="e.g. 1, 0..*"
              value={rel.sourceMultiplicity}
              onChange={(e) =>
                setRel({ ...rel, sourceMultiplicity: e.target.value })
              }
            />
          </label>
          <label className="field" htmlFor="target-multiplicity">
            <span>Target multiplicity</span>
            <Input
              id="target-multiplicity"
              placeholder="e.g. 1, 0..*"
              value={rel.targetMultiplicity}
              onChange={(e) =>
                setRel({ ...rel, targetMultiplicity: e.target.value })
              }
            />
          </label>
          {!(
            active.classIds.includes(rel.from) &&
            active.classIds.includes(rel.to)
          ) && (
            <p className="arx-hint">
              Both classes must be on this diagram for it to be drawn here.
            </p>
          )}
          <div className="arx-form-actions">
            <Button type="submit" size="sm" disabled={!relDirty}>
              {modelRel ? (relDirty ? 'Apply' : 'Applied') : 'Create'}
            </Button>
            {relDirty && modelRel && (
              <button
                type="button"
                className="arx-row"
                onClick={() => setRel({ ...modelRel })}
              >
                Revert
              </button>
            )}
          </div>
          {relDirty && modelRel && (
            <output className="arx-dirty">
              Unapplied changes. Press Enter or Apply.
            </output>
          )}
          {modelRel && (
            <button
              type="button"
              className="arx-delete"
              onClick={() => {
                const p = ref.current;
                commit({
                  ...p,
                  relationships: p.relationships.filter((r) => r.id !== rel.id),
                  diagrams: p.diagrams.map((d) => ({
                    ...d,
                    relationshipIds: d.relationshipIds.filter(
                      (id) => id !== rel.id,
                    ),
                  })),
                });
                openUml('model');
                flash('Relationship deleted.', {
                  action: { label: 'Undo', run: () => undo() },
                });
              }}
            >
              Delete relationship
            </button>
          )}
        </form>
      )}
      {nativeEdit && (
        <form
          className="arx-form"
          onSubmit={(e) => {
            e.preventDefault();
            const patch = {
              name: nativeEdit.name.trim(),
              description: nativeEdit.description,
            };
            commit(
              isNativeLink(nativeEdit)
                ? updateNativeUmlRelationship(ref.current, nativeEdit.id, patch)
                : updateNativeUmlElement(ref.current, nativeEdit.id, patch),
            );
            setNativeEdit({ ...nativeEdit, ...patch });
            // Keep the panel open after the scene redraw clears the selection.
            api.current?.setActiveTool({ type: 'custom', customType: 'uml' });
            setPanel(true);
          }}
        >
          <label className="field" htmlFor="native-name">
            <span>{isNativeLink(nativeEdit) ? 'Label' : 'Name'}</span>
            <Input
              id="native-name"
              maxLength={200}
              value={nativeEdit.name}
              onChange={(e) =>
                setNativeEdit({ ...nativeEdit, name: e.target.value })
              }
            />
          </label>
          <label className="field" htmlFor="native-description">
            <span>Description</span>
            <Textarea
              id="native-description"
              rows={3}
              value={nativeEdit.description}
              onChange={(e) =>
                setNativeEdit({ ...nativeEdit, description: e.target.value })
              }
            />
          </label>
          <p className="arx-hint">
            Shown on{' '}
            {project.diagrams
              .filter((d) =>
                (isNativeLink(nativeEdit)
                  ? d.nativeRelationshipIds
                  : d.nativeElementIds
                )?.includes(nativeEdit.id),
              )
              .map((d) => d.name)
              .join(', ') || 'no diagrams'}
            . Renaming updates every view.
          </p>
          <div className="arx-form-actions">
            <Button type="submit" size="sm" disabled={!nativeDirty}>
              {nativeDirty ? 'Apply' : 'Applied'}
            </Button>
            {nativeDirty && modelNative && (
              <button
                type="button"
                className="arx-row"
                onClick={() => setNativeEdit({ ...modelNative })}
              >
                Revert
              </button>
            )}
          </div>
          {nativeDirty && (
            <output className="arx-dirty">
              Unapplied changes. Press Enter or Apply.
            </output>
          )}
          {nativeOnActive ? (
            <button
              type="button"
              className="arx-row"
              onClick={() => {
                const p = ref.current;
                commit(
                  isNativeLink(nativeEdit)
                    ? removeNativeUmlRelationship(
                        p,
                        p.activeDiagramId,
                        nativeEdit.id,
                      )
                    : removeNativeUmlElement(
                        p,
                        p.activeDiagramId,
                        nativeEdit.id,
                      ),
                );
                openUml('model');
              }}
            >
              Remove from diagram
            </button>
          ) : (
            !isNativeLink(nativeEdit) && (
              <button
                type="button"
                className="arx-row"
                onClick={() => addNativeView(nativeEdit.id)}
              >
                <Plus size={14} />
                Add to this diagram
              </button>
            )
          )}
          <button
            type="button"
            className="arx-delete"
            onClick={() => {
              const p = ref.current;
              const name = nativeEdit.name || nativeKindLabel(nativeEdit.kind);
              commit(
                isNativeLink(nativeEdit)
                  ? removeNativeUmlRelationship(
                      p,
                      p.activeDiagramId,
                      nativeEdit.id,
                      true,
                    )
                  : removeNativeUmlElement(
                      p,
                      p.activeDiagramId,
                      nativeEdit.id,
                      true,
                    ),
              );
              openUml('model');
              flash(`“${name}” deleted from the model and all diagrams.`, {
                action: { label: 'Undo', run: () => undo() },
              });
            }}
          >
            Delete from model
          </button>
        </form>
      )}
    </section>
  );
  /** Project-level shortcuts; runs before Excalidraw's document handlers. */
  function handleKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    // Keys in dialogs outside the editor keep project-level undo, but
    // Escape and navigation belong to the dialog. Focus can fall back to
    // <body> after a dialog closes; that is still the editor.
    const inDialog =
      !root.current?.contains(target) &&
      target !== document.body &&
      target !== document.documentElement;
    if (target.matches('input,textarea,[contenteditable="true"]')) return;
    if (!inDialog && e.altKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
      e.preventDefault();
      e.stopPropagation();
      stepDiagram(e.key === 'PageUp' ? -1 : 1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopPropagation();
      undo(e.shiftKey);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      e.stopPropagation();
      undo(true);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      saveFile();
    }
    const pending = nativeConnector.current;
    if (
      pending?.arrowId &&
      !inDialog &&
      (e.key === 'Escape' || e.key === 'Enter')
    ) {
      // Excalidraw finishes the arrow on this key; reconcile afterwards.
      const arrowId = pending.arrowId;
      nativeConnector.current = null;
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          finishGesture(pending, (id) => id === arrowId),
        ),
      );
      return;
    }
    if (e.key === 'Escape' && !inDialog) {
      nativeConnector.current = null;
      if (styleMode) setStyleMode(false);
      else if (panel) closeUml();
    }
  }
  useEffect(() => {
    keyHandler.current = handleKey;
  });
  useEffect(() => {
    const listen = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listen, true);
    return () => window.removeEventListener('keydown', listen, true);
  }, []);
  return (
    <div
      ref={root}
      className={`arx-app ${panel && !styleMode ? 'arx-uml-visible' : ''}`}
    >
      <Excalidraw
        excalidrawAPI={(instance) => {
          api.current = instance;
          const d = ref.current.diagrams.find(
            (d) => d.id === ref.current.activeDiagramId,
          )!;
          if (!d.viewport)
            setTimeout(
              () =>
                instance.scrollToContent(d.elements as ExcalidrawElement[], {
                  fitToViewport: true,
                  viewportZoomFactor: 0.78,
                }),
              100,
            );
        }}
        initialData={{
          elements: active.elements as ExcalidrawElement[],
          appState: { ...canvasViewport(active), currentItemFontFamily: 3 },
          files: project.files as BinaryFiles,
          scrollToContent: !active.viewport,
        }}
        onChange={onChange}
        theme={dark ? 'dark' : 'light'}
        name={`${project.name} — ${active.name}`}
        onPointerDown={(activeTool, state) => {
          if (activeTool.type !== 'arrow') nativeConnector.current = null;
          if (activeTool.type === 'custom' && placement) {
            addClass(placement, state.origin);
          } else if (activeTool.type === 'custom' && practicePlacement) {
            addPracticeSymbol(practicePlacement, state.origin);
          }
        }}
        onPointerUp={(activeTool, state) => {
          const connector =
            activeTool.type === 'arrow' ? nativeConnector.current : null;
          nativeConnector.current = null;
          const movedGenerated =
            activeTool.type === 'selection' &&
            (state.drag.hasOccurred || state.resize.isResizing) &&
            (!!state.hit.element?.customData?.arxdraw ||
              state.hit.allHitElements.some((e) => e.customData?.arxdraw));
          // Reconcile once the gesture is over, when bindings are final.
          requestAnimationFrame(() => {
            const live = api.current?.getAppState();
            if (live?.multiElement) {
              // A click-by-click arrow continues until its last point.
              if (connector)
                nativeConnector.current = {
                  ...connector,
                  arrowId: live.multiElement.id,
                };
              return;
            }
            if (live?.newElement || live?.editingTextElement) return;
            const arrowId = connector?.arrowId;
            finishGesture(
              connector,
              arrowId
                ? (id) => id === arrowId
                : (id) => !state.originalElements.has(id),
              movedGenerated,
            );
          });
        }}
        renderTopRightUI={(isMobile) => (
          <div className="arx-top-right">
            <button
              type="button"
              className="arx-diagram-switch arx-labs-entry"
              aria-label="COMP371 labs"
              title="COMP371 lab manual exercises and self-checklists"
              onClick={() => setLabsOpen(true)}
            >
              <BookOpen size={16} aria-hidden="true" />
              {!isMobile && <span>COMP371 labs</span>}
            </button>
            <button
              type="button"
              className="arx-diagram-switch"
              aria-label={`Diagrams: ${active.name}, ${activeIndex + 1} of ${project.diagrams.length}`}
              title={`${active.name} · ${kindLabel(active.kind)} diagram. Alt+PgUp / Alt+PgDn switches diagrams.`}
              onClick={() => openUml('diagrams')}
            >
              <Network size={14} aria-hidden="true" />
              {!isMobile && <span>{active.name}</span>}
              <small>
                {activeIndex + 1}/{project.diagrams.length}
              </small>
            </button>
            {saveState === 'error' ? (
              <button
                type="button"
                className="arx-save-state"
                data-state="error"
                title={saveTitles.error}
                onClick={saveFile}
              >
                <CircleAlert size={14} aria-hidden="true" />
                <span className={isMobile ? 'sr-only' : undefined}>
                  {saveLabels.error}
                </span>
              </button>
            ) : (
              <span
                className="arx-save-state"
                data-state={saveState}
                title={saveTitles[saveState]}
              >
                {saveState === 'saving' ? (
                  <span className="arx-save-dot" aria-hidden="true" />
                ) : saveState === 'downloaded' ? (
                  <Download size={14} aria-hidden="true" />
                ) : (
                  <Check size={14} aria-hidden="true" />
                )}
                <span className={isMobile ? 'sr-only' : undefined}>
                  {saveLabels[saveState]}
                </span>
              </span>
            )}
          </div>
        )}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: true,
          },
        }}
      >
        <MainMenu>
          <div className="arx-menu-name">ArxDraw</div>
          <MainMenu.Item
            icon={<FilePlus2 size={16} />}
            onSelect={() => setNewProjectOpen(true)}
          >
            New
          </MainMenu.Item>
          <MainMenu.Item
            icon={<FolderOpen size={16} />}
            onSelect={() => chooseFile(false)}
          >
            Open
          </MainMenu.Item>
          <MainMenu.Item
            icon={<Plus size={16} />}
            onSelect={() => chooseFile(true)}
          >
            Add from project file
          </MainMenu.Item>
          <MainMenu.Item
            icon={<Download size={16} />}
            onSelect={saveFile}
            shortcut="Ctrl+S"
          >
            Save project
          </MainMenu.Item>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.Item onSelect={() => exportImage('png')}>
            Export PNG
          </MainMenu.Item>
          <MainMenu.Item onSelect={() => exportImage('svg')}>
            Export SVG
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.Item
            icon={<Network size={16} />}
            onSelect={() => openUml('diagrams')}
          >
            Diagrams
          </MainMenu.Item>
          <MainMenu.Item
            icon={<Box size={16} />}
            onSelect={() => openUml('model')}
          >
            UML model
          </MainMenu.Item>
          <MainMenu.Item
            icon={<Pencil size={16} />}
            onSelect={() => {
              setRenameTarget('project');
              setText(ref.current.name);
              setDialog('rename');
            }}
          >
            Rename project
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.Item
            icon={<BookOpen size={16} />}
            onSelect={() => setLabsOpen(true)}
          >
            COMP371 labs
          </MainMenu.Item>
          <MainMenu.Item
            icon={<Network size={16} />}
            onSelect={addPracticeExamples}
          >
            Practice examples
          </MainMenu.Item>
          <MainMenu.Item
            icon={<Braces size={16} />}
            onSelect={() => setCodeOpen(true)}
          >
            Model code &amp; XMI
          </MainMenu.Item>
          <MainMenu.Item
            icon={<CircleAlert size={16} />}
            onSelect={() => setCheckResults(projectDiagnostics(ref.current))}
          >
            Check model
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.CommandPalette />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme
            onSelect={(theme) => setDark(theme === 'dark')}
          />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Logo>
              <span className="arx-welcome-name">ArxDraw</span>
            </WelcomeScreen.Center.Logo>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItem
                icon={<BookOpen size={16} />}
                onSelect={() => setLabsOpen(true)}
              >
                COMP371 labs
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItem
                icon={<FolderOpen size={16} />}
                onSelect={() => chooseFile(false)}
              >
                Open
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItem
                icon={<Network size={16} />}
                onSelect={addPracticeExamples}
              >
                Practice examples
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.HelpHint />
        </WelcomeScreen>
      </Excalidraw>
      {slots.helpHeader &&
        createPortal(
          <a
            className="HelpDialog__btn arx-help-link"
            href="https://github.com/xntsO/arxdraw"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="HelpDialog__link-icon">
              <GitBranch size={20} />
            </span>
            GitHub
          </a>,
          slots.helpHeader,
        )}
      {slots.toolbar &&
        createPortal(
          <label className="ToolIcon Shape arx-uml-tool" title="UML">
            <input
              className="ToolIcon_type_radio ToolIcon_size_medium"
              type="radio"
              name="arxdraw-uml-tool"
              aria-label="UML"
              checked={tool === 'custom'}
              onChange={() => openUml()}
            />
            <div className="ToolIcon__icon">
              <Network size={20} />
              <span className="ToolIcon__keybinding">UML</span>
            </div>
          </label>,
          slots.toolbar,
        )}
      {panel &&
        slots.properties &&
        createPortal(panelContent, slots.properties)}
      {slots.history &&
        createPortal(
          <div className="arx-history">
            <button
              className="ToolIcon ToolIcon_type_button ToolIcon_size_medium"
              aria-label="Undo"
              title="Undo"
              disabled={!historyState.past}
              onClick={() => undo()}
            >
              <div className="ToolIcon__icon">
                <Undo2 size={18} />
              </div>
            </button>
            <button
              className="ToolIcon ToolIcon_type_button ToolIcon_size_medium"
              aria-label="Redo"
              title="Redo"
              disabled={!historyState.future}
              onClick={() => undo(true)}
            >
              <div className="ToolIcon__icon">
                <Redo2 size={18} />
              </div>
            </button>
          </div>,
          slots.history,
        )}
      <input
        ref={fileInput}
        type="file"
        accept=".arxdraw,.json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Open project file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openFile(f, mergeFile.current);
          e.target.value = '';
        }}
      />
      {notice && (
        <div
          className="arx-notice"
          data-tone={notice.tone}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.tone === 'error' && (
            <CircleAlert size={18} aria-hidden="true" />
          )}
          <span>{notice.message}</span>
          {notice.action && (
            <button
              className="arx-notice-action"
              onClick={() => {
                notice.action?.run();
                setNotice(null);
              }}
            >
              {notice.action.label}
            </button>
          )}
          <button aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      <CourseLabs
        key={active.labId ?? 'workspace'}
        preferredLabId={active.labId}
        open={labsOpen}
        onOpenChange={setLabsOpen}
        onStart={(lab, mode) => {
          const incoming = createCourseLab(lab.id, mode);
          commit(mergeProjects(ref.current, incoming), true);
          flash(
            `Added ${lab.title} ${mode === 'blank' ? 'blank practice' : 'worked example'} with ${incoming.diagrams.length} diagram${incoming.diagrams.length === 1 ? '' : 's'}.`,
            { action: { label: 'Undo', run: () => undo() } },
          );
        }}
      />
      <AlertDialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New project</AlertDialogTitle>
            <AlertDialogDescription>
              Save a copy of “{project.name}” first? You can also undo to return
              to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => startNewProject(false)}>
              Start new
            </Button>
            <AlertDialogAction onClick={() => startNewProject(true)}>
              Save &amp; start new
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === 'diagram' ? 'New diagram' : `Rename ${renameTarget}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter a name.
            </DialogDescription>
          </DialogHeader>
          <form
            className="arx-form"
            onSubmit={(e) => {
              e.preventDefault();
              const name = text.trim();
              if (!name && dialog !== 'diagram') return;
              const p = ref.current;
              setDialog(null);
              if (dialog === 'diagram') {
                createDiagram(
                  newDiagramKind,
                  name,
                  newDiagramContent === 'example',
                );
                openUml('tools');
              } else if (renameTarget === 'project') {
                if (name !== p.name) commit({ ...p, name });
              } else if (
                p.diagrams.some((d) => d.id === renameId && d.name !== name)
              ) {
                commit({
                  ...p,
                  diagrams: p.diagrams.map((d) =>
                    d.id === renameId ? { ...d, name } : d,
                  ),
                });
              }
            }}
          >
            {dialog === 'diagram' && (
              <>
                <Choice
                  label="Type"
                  value={newDiagramKind}
                  onChange={(value) => setNewDiagramKind(value as DiagramKind)}
                  options={[
                    { value: 'class', label: 'Class' },
                    ...diagramKinds.map((kind) => ({
                      value: kind.id,
                      label: kind.label,
                    })),
                  ]}
                />
                <Choice
                  label="Start with"
                  value={newDiagramContent}
                  onChange={setNewDiagramContent}
                  options={[
                    { value: 'blank', label: 'Blank diagram' },
                    { value: 'example', label: 'Example diagram' },
                  ]}
                />
              </>
            )}
            <label className="field" htmlFor="diagram-name">
              <span>Name</span>
              <Input
                id="diagram-name"
                required={dialog !== 'diagram'}
                placeholder={
                  dialog === 'diagram'
                    ? `${kindLabel(newDiagramKind)} diagram`
                    : 'Name'
                }
                maxLength={100}
                onFocus={(e) => e.currentTarget.select()}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <Button type="submit">
              {dialog === 'diagram' ? 'Create' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <CodeTools
        project={project}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        onImport={(imported) => {
          // mergeProjects throws on limits; CodeTools shows the message.
          commit(mergeProjects(ref.current, imported), true);
          setPaletteKind('class');
          openUml('model');
          flash(
            `Added ${imported.classes.length} classifier${imported.classes.length === 1 ? '' : 's'} in a new diagram.`,
            { action: { label: 'Undo', run: () => undo() } },
          );
        }}
      />
      <Dialog
        open={checkResults !== null}
        onOpenChange={(open) => {
          if (!open) setCheckResults(null);
        }}
      >
        <DialogContent className="arx-check-dialog">
          <DialogHeader>
            <DialogTitle>Model check</DialogTitle>
            <DialogDescription>
              {checkResults?.length
                ? `${checkResults.length} finding${checkResults.length === 1 ? '' : 's'}. Choose Show to find one on a diagram.`
                : 'Structural checks for class models, native UML symbols and data-flow diagrams. Use the lab self-checklist to review the scenario and diagram meaning.'}
            </DialogDescription>
          </DialogHeader>
          {checkResults?.length ? (
            <ul className="arx-check-list">
              {checkResults.map((issue) => (
                <li key={issue.id} data-severity={issue.severity}>
                  <span className="arx-severity">{issue.severity}</span>
                  <div>
                    <p>{issue.message}</p>
                    {issue.suggestion && <small>{issue.suggestion}</small>}
                  </div>
                  {(issue.classIds.length > 0 ||
                    issue.relationshipIds.length > 0 ||
                    (issue.nativeElementIds?.length ?? 0) > 0 ||
                    (issue.nativeRelationshipIds?.length ?? 0) > 0 ||
                    issue.diagramIds.length > 0) && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Show: ${issue.message}`}
                      onClick={() => showDiagnostic(issue)}
                    >
                      Show
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No supported structural issues found.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
