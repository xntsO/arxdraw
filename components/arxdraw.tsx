'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  CaptureUpdateAction,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw';
import type {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles,
  BinaryFileData,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
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
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNativeSlots } from './native-slots';
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
  uid,
} from '@/lib/model';
import type { Project, Classifier, Relationship, Diagram } from '@/lib/model';
import { renderProject } from '@/lib/scene';
import './arxdraw.css';

const STORAGE = 'arxdraw.project.v1';
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
      'The saved project could not be opened. An example workspace is open.';
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
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const slots = useNativeSlots(root);
  const [panel, setPanel] = useState(false);
  const [tool, setTool] = useState('selection');
  const [panelTab, setPanelTab] = useState<'tools' | 'model' | 'diagrams'>(
    'tools',
  );
  const [placement, setPlacement] = useState<Classifier['kind'] | null>(null);
  const [dark, setDark] = useState(workspace.dark);
  const [editClass, setEditClass] = useState<Classifier | null>(null);
  const [rel, setRel] = useState<Relationship | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [dialog, setDialog] = useState<'diagram' | 'rename' | null>(null);
  const [text, setText] = useState('');
  const [renameTarget, setRenameTarget] = useState<'project' | 'diagram'>(
    'diagram',
  );
  const [notice, setNotice] = useState(workspace.error);
  const [historyState, setHistoryState] = useState({ past: 0, future: 0 });
  const past = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    baseline = useRef<Project | null>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applying = useRef(false),
    loaded = useRef(true),
    lastSignature = useRef('');
  const fileInput = useRef<HTMLInputElement>(null);
  const sync = useCallback(
    () =>
      setHistoryState({
        past: past.current.length,
        future: future.current.length,
      }),
    [],
  );
  const flash = useCallback((message: string) => {
    setNotice(message);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(ref.current));
      } catch {
        flash('Browser storage unavailable. Save your project to a file.');
      }
    }, 650);
  }, [flash]);
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
    (next: Project, fit = false) => {
      applying.current = true;
      ref.current = next;
      setProject(next);
      lastSignature.current = '';
      const d = next.diagrams.find((d) => d.id === next.activeDiagramId)!;
      api.current?.updateScene({
        elements: d.elements as ExcalidrawElement[],
        appState: { ...canvasViewport(d), selectedElementIds: {} },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
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
      apply(renderProject(next), fit);
    },
    [apply, flushHistory, sync],
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
      const customTool = state.activeTool.type === 'custom';
      const modelSelected =
        state.activeTool.type === 'selection' && !!(modelId || relationshipId);
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
      } else if (!customTool) {
        setEditClass(null);
        setRel(null);
        setPlacement(null);
      }
      const signature =
        elements
          .map((e) => `${e.id}:${e.versionNonce}:${e.isDeleted}`)
          .join('|') + JSON.stringify(cleanViewport(state));
      if (signature === lastSignature.current) return;
      lastSignature.current = signature;
      const prev = ref.current;
      if (!baseline.current) baseline.current = structuredClone(prev);
      if (historyTimer.current) clearTimeout(historyTimer.current);
      historyTimer.current = setTimeout(flushHistory, 450);
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
        for (const e of elements) {
          const data = e.customData;
          if (data?.relationshipId && e.isDeleted) {
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
      persist();
      if (modelChanged) {
        queueMicrotask(() => apply(renderProject(next)));
      }
    },
    [apply, flushHistory, persist],
  );
  function switchDiagram(id: string) {
    if (id === ref.current.activeDiagramId) return;
    flushHistory();
    const next = renderProject({ ...ref.current, activeDiagramId: id });
    apply(next, !next.diagrams.find((d) => d.id === id)?.viewport);
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
    flash('Project saved.');
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
    setNotice('');
  }
  async function openFile(file: File) {
    try {
      if (file.size > 40_000_000)
        throw new Error('Choose a project smaller than 40 MB.');
      const p = renderProject(parseProject(await file.text()));
      commit(p, true);
      flash('Project opened.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Unable to open this project.');
    }
  }
  function addClass(
    kind: Classifier['kind'] = 'class',
    position?: { x: number; y: number },
  ) {
    const p = ref.current;
    const id = uid();
    let n = p.classes.length + 1;
    while (p.classes.some((c) => c.name === `Class${n}`)) n++;
    const c: Classifier = {
      id,
      name: kind === 'interface' ? `Interface${n}` : `Class${n}`,
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
    api.current?.setActiveTool({ type: 'selection' });
    setTool('selection');
    const els =
      api.current
        ?.getSceneElements()
        .filter((e) => e.customData?.modelId === id) || [];
    api.current?.updateScene({
      appState: {
        selectedElementIds: Object.fromEntries(els.map((e) => [e.id, true])),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.current?.scrollToContent(els, { animate: true });
  }
  function newRelationship() {
    const p = ref.current;
    const d = p.diagrams.find((d) => d.id === p.activeDiagramId)!;
    if (d.classIds.length < 2) {
      flash('Add at least two classes to this diagram first.');
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
      to: d.classIds[1],
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
      diagrams: p.diagrams.map((d) =>
        d.id === p.activeDiagramId
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
      flash('Image export failed. Try downloading the project instead.');
    }
  }
  const active = project.diagrams.find(
    (d) => d.id === project.activeDiagramId,
  )!;
  const options = project.classes
    .filter((c) => active.classIds.includes(c.id))
    .map((c) => ({ value: c.id, label: c.name }));
  function openUml(tab: 'tools' | 'model' | 'diagrams' = 'tools') {
    setTool('custom');
    setPanelTab(tab);
    setPanel(true);
    setEditClass(null);
    setRel(null);
    setPlacement(null);
    api.current?.updateScene({
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.current?.setActiveTool({ type: 'custom', customType: 'uml' });
  }
  function closeUml() {
    setTool('selection');
    setPanel(false);
    setPlacement(null);
    setEditClass(null);
    setRel(null);
    api.current?.updateScene({
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.current?.setActiveTool({ type: 'selection' });
  }
  function place(kind: Classifier['kind']) {
    setTool('custom');
    setPlacement(kind);
    setEditClass(null);
    setRel(null);
    api.current?.setActiveTool({ type: 'custom', customType: `uml-${kind}` });
  }
  const panelContent = (
    <section className="Island arx-properties" aria-label="UML properties">
      <div className="arx-panel-heading">
        <span>{editClass ? editClass.name : rel ? 'Relationship' : 'UML'}</span>
        <button
          className="arx-close"
          aria-label="Close UML properties"
          onClick={closeUml}
        >
          <X size={16} />
        </button>
      </div>
      {!editClass && !rel && (
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
            <fieldset>
              <legend>Classifier</legend>
              <div className="arx-tool-list">
                <button
                  className={placement === 'class' ? 'active' : ''}
                  onClick={() => place('class')}
                >
                  <Box size={16} />
                  Class
                </button>
                <button
                  className={placement === 'interface' ? 'active' : ''}
                  onClick={() => place('interface')}
                >
                  <Braces size={16} />
                  Interface
                </button>
                <button
                  className={placement === 'abstract' ? 'active' : ''}
                  onClick={() => place('abstract')}
                >
                  <Box size={16} />
                  Abstract class
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend>Connection</legend>
              <button className="arx-row" onClick={newRelationship}>
                <GitBranch size={16} />
                Relationship
              </button>
            </fieldset>
            {placement && (
              <p className="arx-hint">Click on the canvas to place.</p>
            )}
          </TabsContent>
          <TabsContent value="model">
            <div className="arx-list">
              {project.classes.map((c) => (
                <div className="arx-model-row" key={c.id}>
                  <button onClick={() => showClass(c.id)}>
                    <span className="arx-class-letter">
                      {c.kind === 'interface' ? 'I' : 'C'}
                    </span>
                    <span>{c.name}</span>
                    {!active.classIds.includes(c.id) && <Plus size={13} />}
                  </button>
                  <button
                    aria-label={`Edit ${c.name}`}
                    onClick={() => {
                      setEditClass({ ...c });
                      setRel(null);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              ))}
            </div>
            <fieldset>
              <legend>Relationships</legend>
              {project.relationships
                .filter((r) => active.relationshipIds.includes(r.id))
                .map((r) => (
                  <button
                    className="arx-row"
                    key={r.id}
                    onClick={() => {
                      setRel({ ...r });
                      setEditClass(null);
                    }}
                  >
                    <GitBranch size={14} />
                    <span>
                      {project.classes.find((c) => c.id === r.from)?.name} →{' '}
                      {project.classes.find((c) => c.id === r.to)?.name}
                    </span>
                  </button>
                ))}
            </fieldset>
          </TabsContent>
          <TabsContent value="diagrams">
            <div className="arx-list">
              {project.diagrams.map((d) => (
                <div className="arx-model-row" key={d.id}>
                  <button
                    className={d.id === active.id ? 'active' : ''}
                    onClick={() => switchDiagram(d.id)}
                  >
                    <Network size={15} />
                    <span>{d.name}</span>
                  </button>
                  <button
                    aria-label={`Rename ${d.name}`}
                    onClick={() => {
                      switchDiagram(d.id);
                      setRenameTarget('diagram');
                      setText(d.name);
                      setDialog('rename');
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="arx-diagram-delete"
                    aria-label={`Delete ${d.name}`}
                    title={`Delete ${d.name}`}
                    onClick={() => {
                      const next = removeDiagram(ref.current, d.id);
                      const active = next.diagrams.find(
                        (diagram) => diagram.id === next.activeDiagramId,
                      )!;
                      commit(
                        next,
                        !active.viewport && active.elements.length > 0,
                      );
                      flash(`“${d.name}” deleted. Undo to restore.`);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="arx-row"
              onClick={() => {
                setText('');
                setDialog('diagram');
              }}
            >
              <Plus size={16} />
              New diagram
            </button>
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
          <label className="field" htmlFor="class-attributes">
            <span>Attributes</span>
            <Textarea
              id="class-attributes"
              rows={4}
              value={editClass.attributes}
              onChange={(e) =>
                setEditClass({ ...editClass, attributes: e.target.value })
              }
            />
          </label>
          <label className="field" htmlFor="class-operations">
            <span>Operations</span>
            <Textarea
              id="class-operations"
              rows={4}
              value={editClass.operations}
              onChange={(e) =>
                setEditClass({ ...editClass, operations: e.target.value })
              }
            />
          </label>
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
          <Button type="submit" size="sm">
            Apply
          </Button>
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
          <button
            type="button"
            className="arx-delete"
            onClick={() => {
              commit(removeClassifier(ref.current, editClass.id));
              openUml('model');
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
            onChange={(v) =>
              setRel({ ...rel, kind: v as Relationship['kind'] })
            }
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
              value={rel.targetMultiplicity}
              onChange={(e) =>
                setRel({ ...rel, targetMultiplicity: e.target.value })
              }
            />
          </label>
          <Button type="submit" size="sm">
            Apply
          </Button>
          {project.relationships.some((r) => r.id === rel.id) && (
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
              }}
            >
              Delete relationship
            </button>
          )}
        </form>
      )}
    </section>
  );
  return (
    <div
      ref={root}
      className={`arx-app ${panel ? 'arx-uml-visible' : ''}`}
      onKeyDownCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target.matches('input,textarea,[contenteditable="true"]')) return;
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
        if (e.key === 'Escape' && panel) closeUml();
      }}
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
          if (activeTool.type === 'custom' && placement) {
            addClass(placement, state.origin);
          }
        }}
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
            onSelect={() => fileInput.current?.click()}
          >
            Open
          </MainMenu.Item>
          <MainMenu.Item icon={<Download size={16} />} onSelect={saveFile}>
            Save project
          </MainMenu.Item>
          <MainMenu.DefaultItems.SaveAsImage />
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
            onSelect={() => {
              setRenameTarget('project');
              setText(ref.current.name);
              setDialog('rename');
            }}
          >
            Rename project
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
                icon={<FolderOpen size={16} />}
                onSelect={() => fileInput.current?.click()}
              >
                Open
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
        accept=".arxdraw,.json"
        className="sr-only"
        aria-label="Open project file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openFile(f);
          e.target.value = '';
        }}
      />
      {notice && (
        <output className="arx-notice">
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </output>
      )}
      <AlertDialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New project</AlertDialogTitle>
            <AlertDialogDescription>
              Save a copy of “{project.name}” first?
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
              if (!text.trim()) return;
              const p = ref.current;
              if (dialog === 'diagram') {
                const id = uid();
                commit({
                  ...p,
                  activeDiagramId: id,
                  diagrams: [
                    ...p.diagrams,
                    {
                      id,
                      name: text.trim(),
                      classIds: [],
                      relationshipIds: [],
                      elements: [],
                    },
                  ],
                });
              } else
                commit(
                  renameTarget === 'project'
                    ? { ...p, name: text.trim() }
                    : {
                        ...p,
                        diagrams: p.diagrams.map((d) =>
                          d.id === p.activeDiagramId
                            ? { ...d, name: text.trim() }
                            : d,
                        ),
                      },
                );
              setDialog(null);
              openUml('diagrams');
            }}
          >
            <label className="field" htmlFor="diagram-name">
              <span>Name</span>
              <Input
                id="diagram-name"
                required
                maxLength={100}
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
    </div>
  );
}
