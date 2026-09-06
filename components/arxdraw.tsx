'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Excalidraw,
  MainMenu,
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
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Download,
  FolderOpen,
  GitBranch,
  Moon,
  Plus,
  Redo2,
  Settings2,
  Sun,
  Undo2,
  X,
  ArrowUpRight,
  CircleHelp,
  Pencil,
  Scan,
  Check,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  createProject,
  parseProject,
  projectIssues,
  removeClassifier,
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
export default function Arxdraw() {
  const [workspace] = useState(loadWorkspace);
  const [project, setProject] = useState<Project>(workspace.project);
  const ref = useRef(project);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const ready = true;
  const [dark, setDark] = useState(workspace.dark);
  const [selected, setSelected] = useState('');
  const [editClass, setEditClass] = useState<Classifier | null>(null);
  const [rel, setRel] = useState<Relationship | null>(null);
  const [dialog, setDialog] = useState<
    'diagram' | 'rename' | 'help' | 'validation' | null
  >(null);
  const [text, setText] = useState('');
  const [renameTarget, setRenameTarget] = useState<'project' | 'diagram'>(
    'diagram',
  );
  const [notice, setNotice] = useState(workspace.error);
  const [saveStatus, setSaveStatus] = useState('Saved locally');
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
    setSaveStatus('Saving…');
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(ref.current));
        setSaveStatus('Saved locally');
      } catch {
        setSaveStatus('Download to save');
        flash(
          'Browser storage is full or unavailable. Download your project to keep your work.',
        );
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
      setSelected('');
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
      const chosen = elements.find(
        (e) => state.selectedElementIds[e.id] && !e.isDeleted,
      );
      setSelected(
        chosen?.customData?.modelId || chosen?.customData?.relationshipId || '',
      );
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
    flash('Project downloaded — includes every diagram and the shared model.');
  }
  async function openFile(file: File) {
    try {
      if (file.size > 40_000_000)
        throw new Error('Choose a project smaller than 40 MB.');
      const p = renderProject(parseProject(await file.text()));
      commit(p, true);
      flash('Project opened. Undo will restore your previous workspace.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Unable to open this project.');
    }
  }
  function addClass(kind: Classifier['kind'] = 'class') {
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
          ? { ...d, classIds: [...d.classIds, id] }
          : d,
      ),
    };
    commit(next, true);
    setEditClass(c);
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
      flash('Shared class added to this diagram.');
      return;
    }
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
    setSelected(id);
  }
  function newRelationship() {
    const p = ref.current;
    const d = p.diagrams.find((d) => d.id === p.activeDiagramId)!;
    if (d.classIds.length < 2) {
      flash('Add at least two classes to this diagram first.');
      return;
    }
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
  const selectedClass = project.classes.find((c) => c.id === selected),
    selectedRel = project.relationships.find((r) => r.id === selected);
  const issues = projectIssues(project);
  const options = project.classes
    .filter((c) => active.classIds.includes(c.id))
    .map((c) => ({ value: c.id, label: c.name }));
  return (
    <div
      className={`arx-app ${dark ? 'dark' : ''}`}
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
      }}
    >
      <SidebarProvider
        defaultOpen
        style={{ '--sidebar-width': '236px' } as React.CSSProperties}
        className="arx-layout"
      >
        <Sidebar className="model-sidebar">
          <SidebarHeader className="brand-row">
            <span className="brand" aria-label="Arxdraw">
              arxdraw<span>✳</span>
            </span>
            <span className="beta">UML</span>
            <SidebarTrigger
              aria-label="Collapse model explorer"
              className="ml-auto"
            />
          </SidebarHeader>
          <SidebarContent className="explorer">
            <div className="section-label">WORKSPACE</div>
            <button
              className="project-button"
              onClick={() => {
                setRenameTarget('project');
                setText(ref.current.name);
                setDialog('rename');
              }}
            >
              <span className="project-icon">
                <FolderOpen size={18} />
              </span>
              <span>
                {project.name}
                <small>Local project</small>
              </span>
              <ChevronDown size={14} />
            </button>
            <div className="section-label section-heading">
              DIAGRAMS
              <button
                aria-label="New diagram"
                onClick={() => {
                  setText('');
                  setDialog('diagram');
                }}
              >
                <Plus size={15} />
              </button>
            </div>
            <nav aria-label="Diagrams">
              {project.diagrams.map((d) => (
                <button
                  key={d.id}
                  className={`explorer-row ${active.id === d.id ? 'active' : ''}`}
                  onClick={() => switchDiagram(d.id)}
                >
                  <Network size={16} />
                  <span>{d.name}</span>
                  <span className="count">{d.classIds.length}</span>
                </button>
              ))}
            </nav>
            <div className="section-label section-heading">
              SHARED MODEL
              <button
                aria-label="Add class to model"
                onClick={() => addClass()}
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="package-label">
              <ChevronDown size={13} />
              <FolderOpen size={14} /> {project.name.split(' ')[0]}
            </div>
            {project.classes.map((c) => (
              <div
                className={`class-row ${selected === c.id ? 'selected' : ''}`}
                key={c.id}
              >
                <button
                  className="class-main"
                  onClick={() => showClass(c.id)}
                  title={
                    active.classIds.includes(c.id)
                      ? 'Select class'
                      : 'Add shared class to this diagram'
                  }
                >
                  <span
                    className={`class-symbol ${c.kind === 'interface' ? 'interface' : ''}`}
                  >
                    {c.kind === 'interface' ? 'I' : 'C'}
                  </span>
                  <span>{c.name}</span>
                  {!active.classIds.includes(c.id) && <Plus size={13} />}
                </button>
                <button
                  className="edit-small"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => setEditClass({ ...c })}
                >
                  <Pencil size={13} />
                </button>
              </div>
            ))}
            <div className="model-note">
              <GitBranch size={15} />
              <p>
                One model. Multiple views.
                <br />
                Class edits stay in sync.
              </p>
            </div>
            <div className="section-label section-heading">
              RELATIONSHIPS
              <button aria-label="Add relationship" onClick={newRelationship}>
                <Plus size={15} />
              </button>
            </div>
            {project.relationships
              .filter(
                (r) =>
                  active.relationshipIds.includes(r.id) &&
                  active.classIds.includes(r.from) &&
                  active.classIds.includes(r.to),
              )
              .map((r) => (
                <button
                  key={r.id}
                  className="relationship-row"
                  onClick={() => setRel({ ...r })}
                >
                  <ArrowUpRight size={15} />
                  <span>
                    {project.classes.find((c) => c.id === r.from)?.name} →{' '}
                    {project.classes.find((c) => c.id === r.to)?.name}
                    <small>{r.kind}</small>
                  </span>
                </button>
              ))}
            <div className="sidebar-spacer" />
            <button
              className="validation"
              onClick={() => setDialog('validation')}
            >
              <CircleCheck
                size={17}
                className={issues.length ? 'warning' : 'success'}
              />
              <span>
                {issues.length
                  ? `${issues.length} model checks to review`
                  : 'Model checks passed'}
              </span>
              <ChevronRight size={14} />
            </button>
          </SidebarContent>
          <SidebarFooter className="sidebar-footer">
            <span>Arxdraw · Early preview</span>
            <button aria-label="Help" onClick={() => setDialog('help')}>
              <CircleHelp size={17} />
            </button>
          </SidebarFooter>
        </Sidebar>
        <main className="workspace">
          <header className="workspace-header">
            <div className="header-left">
              <SidebarTrigger aria-label="Toggle model explorer" />
              <span className="breadcrumb">Workspace</span>
              <ChevronRight size={14} />
              <button
                className="diagram-title"
                onClick={() => {
                  setRenameTarget('diagram');
                  setText(active.name);
                  setDialog('rename');
                }}
              >
                {active.name}
              </button>
              <span className="type-badge">Class diagram</span>
            </div>
            <div className="header-actions">
              <span className="save-status">
                <span
                  className={
                    saveStatus === 'Saved locally' ? 'saved-dot' : 'saving-dot'
                  }
                />
                {saveStatus}
              </span>
              <button
                className="icon-button"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!historyState.past}
                onClick={() => undo()}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!historyState.future}
                onClick={() => undo(true)}
              >
                <Redo2 size={17} />
              </button>
              <span className="header-divider" />
              <button
                className="icon-button"
                aria-label={
                  dark ? 'Switch to light mode' : 'Switch to dark mode'
                }
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                <FolderOpen size={15} />
                <span className="button-label">Open</span>
              </Button>
              <Button size="sm" onClick={saveFile}>
                <Download size={15} />
                <span className="button-label">Save project</span>
              </Button>
            </div>
          </header>
          <div className="canvas-shell">
            {ready && (
              <Excalidraw
                excalidrawAPI={(instance) => {
                  api.current = instance;
                  const d = ref.current.diagrams.find(
                    (d) => d.id === ref.current.activeDiagramId,
                  )!;
                  if (!d.viewport)
                    setTimeout(
                      () =>
                        instance.scrollToContent(
                          d.elements as ExcalidrawElement[],
                          { fitToViewport: true, viewportZoomFactor: 0.78 },
                        ),
                      100,
                    );
                }}
                initialData={{
                  elements: active.elements as ExcalidrawElement[],
                  appState: {
                    ...canvasViewport(active),
                    viewBackgroundColor:
                      active.viewport?.viewBackgroundColor || '#ffffff',
                    currentItemFontFamily: 3,
                  },
                  files: project.files as BinaryFiles,
                  scrollToContent: !active.viewport,
                }}
                theme={dark ? 'dark' : 'light'}
                onChange={onChange}
                name={`${project.name} — ${active.name}`}
                UIOptions={{
                  canvasActions: {
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                  },
                }}
              >
                <MainMenu>
                  <MainMenu.Item
                    onSelect={() => fileInput.current?.click()}
                    icon={<FolderOpen size={16} />}
                  >
                    Open Arxdraw project
                  </MainMenu.Item>
                  <MainMenu.Item
                    onSelect={saveFile}
                    icon={<Download size={16} />}
                  >
                    Save Arxdraw project
                  </MainMenu.Item>
                  <MainMenu.Separator />
                  <MainMenu.Item onSelect={() => exportImage('png')}>
                    Export diagram as PNG
                  </MainMenu.Item>
                  <MainMenu.Item onSelect={() => exportImage('svg')}>
                    Export diagram as SVG
                  </MainMenu.Item>
                  <MainMenu.DefaultItems.SaveAsImage />
                  <MainMenu.Separator />
                  <MainMenu.DefaultItems.ChangeCanvasBackground />
                  <MainMenu.Item onSelect={() => setDialog('help')}>
                    About this workspace
                  </MainMenu.Item>
                </MainMenu>
              </Excalidraw>
            )}
            <div className="uml-palette" aria-label="UML tools">
              <span className="palette-label">UML</span>
              <button onClick={() => addClass()} title="Add UML class">
                <Box size={17} />
                <span>Class</span>
              </button>
              <button
                onClick={() => addClass('interface')}
                title="Add UML interface"
              >
                <Braces size={17} />
                <span>Interface</span>
              </button>
              <i />
              <button onClick={newRelationship}>
                <GitBranch size={17} />
                <span>Relationship</span>
              </button>
            </div>
            {selectedClass && (
              <div className="selection-card">
                <span className="class-symbol">
                  {selectedClass.kind === 'interface' ? 'I' : 'C'}
                </span>
                <div>
                  <strong>{selectedClass.name}</strong>
                  <small>
                    Shared in{' '}
                    {
                      project.diagrams.filter((d) =>
                        d.classIds.includes(selectedClass.id),
                      ).length
                    }{' '}
                    diagrams
                  </small>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditClass({ ...selectedClass })}
                >
                  <Settings2 size={14} />
                  Edit model
                </Button>
              </div>
            )}
            {selectedRel && (
              <div className="selection-card">
                <GitBranch size={18} />
                <div>
                  <strong>{selectedRel.label || selectedRel.kind}</strong>
                  <small>UML relationship</small>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRel({ ...selectedRel })}
                >
                  Edit relationship
                </Button>
              </div>
            )}
            <button
              className="fit-button"
              onClick={() =>
                api.current?.scrollToContent(undefined, {
                  fitToViewport: true,
                  viewportZoomFactor: 0.8,
                })
              }
              aria-label="Fit diagram to screen"
              title="Fit diagram"
            >
              <Scan size={17} />
            </button>
          </div>
          <footer className="diagram-bar">
            <Tabs
              value={active.id}
              onValueChange={(v) => switchDiagram(String(v))}
            >
              <TabsList variant="line" className="diagram-tabs">
                {project.diagrams.map((d) => (
                  <TabsTrigger value={d.id} key={d.id}>
                    <Network size={14} />
                    {d.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <button
              className="new-diagram-button"
              aria-label="Add diagram"
              onClick={() => {
                setText('');
                setDialog('diagram');
              }}
            >
              <Plus size={16} />
            </button>
            <span className="diagram-meta">
              {active.classIds.length} classifiers<span>·</span>
              {
                active.relationshipIds.filter((id) => {
                  const r = project.relationships.find((r) => r.id === id);
                  return (
                    r &&
                    active.classIds.includes(r.from) &&
                    active.classIds.includes(r.to)
                  );
                }).length
              }{' '}
              relationships
            </span>
            <span className="powered">Built with Excalidraw</span>
          </footer>
        </main>
      </SidebarProvider>
      <input
        ref={fileInput}
        type="file"
        accept=".arxdraw,.json"
        className="sr-only"
        aria-label="Open Arxdraw project file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openFile(f);
          e.target.value = '';
        }}
      />
      {notice && (
        <output className="notice">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </output>
      )}
      <Sheet
        open={!!editClass}
        onOpenChange={(open) => {
          if (!open) setEditClass(null);
        }}
      >
        <SheetContent className="model-sheet">
          <SheetHeader>
            <SheetTitle>Edit classifier</SheetTitle>
            <SheetDescription>
              Changes apply to every diagram using this class.
            </SheetDescription>
          </SheetHeader>
          {editClass && (
            <form
              className="model-form"
              onSubmit={(e) => {
                e.preventDefault();
                commit(
                  updateClassifier(ref.current, editClass.id, {
                    ...editClass,
                    name: editClass.name.trim(),
                  }),
                );
                setEditClass(null);
                flash('Shared model updated across all diagrams.');
              }}
            >
              <label className="field" htmlFor="classifier-name">
                <span>Name</span>
                <Input
                  id="classifier-name"
                  required
                  maxLength={100}
                  value={editClass.name}
                  onChange={(e) =>
                    setEditClass({ ...editClass, name: e.target.value })
                  }
                />
              </label>
              <Choice
                label="Classifier type"
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
              <label className="field" htmlFor="classifier-attributes">
                <span>Attributes</span>
                <Textarea
                  id="classifier-attributes"
                  rows={5}
                  value={editClass.attributes}
                  onChange={(e) =>
                    setEditClass({ ...editClass, attributes: e.target.value })
                  }
                  placeholder="- name: String"
                />
                <small>One per line · + public · - private · # protected</small>
              </label>
              <label className="field" htmlFor="classifier-operations">
                <span>Operations</span>
                <Textarea
                  id="classifier-operations"
                  rows={5}
                  value={editClass.operations}
                  onChange={(e) =>
                    setEditClass({ ...editClass, operations: e.target.value })
                  }
                  placeholder="+ method(): Type"
                />
              </label>
              <label className="field" htmlFor="classifier-description">
                <span>Description</span>
                <Textarea
                  id="classifier-description"
                  rows={3}
                  value={editClass.description}
                  onChange={(e) =>
                    setEditClass({ ...editClass, description: e.target.value })
                  }
                  placeholder="What does this class represent?"
                />
              </label>
              <Button type="submit">
                <Check size={16} />
                Apply to all diagrams
              </Button>
              <Button
                type="button"
                variant="outline"
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
                  setEditClass(null);
                  flash(
                    'Removed from this view. The shared class is still in your model.',
                  );
                }}
              >
                Remove from this diagram
              </Button>
              <button
                type="button"
                className="delete-link"
                onClick={() => {
                  commit(removeClassifier(ref.current, editClass.id));
                  setEditClass(null);
                  flash(
                    'Class and its relationships deleted from the model. Undo is available.',
                  );
                }}
              >
                Delete from entire model
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!rel}
        onOpenChange={(open) => {
          if (!open) setRel(null);
        }}
      >
        <DialogContent className="relationship-dialog">
          <DialogHeader>
            <DialogTitle>UML relationship</DialogTitle>
            <DialogDescription>
              Connect two classifiers in this diagram.
            </DialogDescription>
          </DialogHeader>
          {rel && (
            <form
              className="model-form"
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
                    ? 'Whole (diamond end)'
                    : 'From'
                }
                value={rel.from}
                onChange={(v) => setRel({ ...rel, from: v })}
                options={options}
              />
              <Choice
                label={
                  ['inheritance', 'realization'].includes(rel.kind)
                    ? 'To (parent / interface)'
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
                  placeholder="e.g. places"
                />
              </label>
              <div className="field-pair">
                <label className="field" htmlFor="source-multiplicity">
                  <span>Source multiplicity</span>
                  <Input
                    id="source-multiplicity"
                    value={rel.sourceMultiplicity}
                    onChange={(e) =>
                      setRel({ ...rel, sourceMultiplicity: e.target.value })
                    }
                    placeholder="1"
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
                    placeholder="0..*"
                  />
                </label>
              </div>
              <Button type="submit">Save relationship</Button>
              {project.relationships.some((r) => r.id === rel.id) && (
                <button
                  type="button"
                  className="delete-link"
                  onClick={() => {
                    const p = ref.current;
                    commit({
                      ...p,
                      relationships: p.relationships.filter(
                        (r) => r.id !== rel.id,
                      ),
                      diagrams: p.diagrams.map((d) => ({
                        ...d,
                        relationshipIds: d.relationshipIds.filter(
                          (id) => id !== rel.id,
                        ),
                      })),
                    });
                    setRel(null);
                  }}
                >
                  Delete relationship from model
                </button>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="info-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'diagram'
                ? 'New class diagram'
                : dialog === 'rename'
                  ? `Rename ${renameTarget}`
                  : dialog === 'validation'
                    ? 'Model checks'
                    : 'Welcome to Arxdraw'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'diagram'
                ? 'Start a new view of your shared model.'
                : dialog === 'rename'
                  ? 'Give your workspace or diagram a clear name.'
                  : dialog === 'validation'
                    ? 'Basic checks for names, inheritance cycles, and realizations.'
                    : 'An Excalidraw canvas with a shared UML model.'}
            </DialogDescription>
          </DialogHeader>
          {(dialog === 'diagram' || dialog === 'rename') && (
            <form
              className="model-form"
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
                } else {
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
                }
                setDialog(null);
              }}
            >
              <label className="field" htmlFor="diagram-name">
                <span>Name</span>
                <Input
                  id="diagram-name"
                  required
                  value={text}
                  maxLength={100}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <Button type="submit">
                {dialog === 'diagram' ? 'Create diagram' : 'Save name'}
              </Button>
            </form>
          )}
          {dialog === 'validation' && (
            <div className="help-copy">
              {issues.length ? (
                <ul>
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="check-result">
                  <CircleCheck size={20} /> All basic model checks passed.
                </p>
              )}
              <p>
                These checks cover the first class-diagram milestone. Full UML
                validation and ArgoUML design critics are planned.
              </p>
            </div>
          )}
          {dialog === 'help' && (
            <div className="help-copy">
              <p>
                <strong>Sketch</strong> with the familiar Excalidraw toolbar.
                Add structured classes and connections from the UML palette.
              </p>
              <p>
                <strong>Edit a class</strong> using the pencil in the shared
                model or “Edit model” after selecting it. Edits appear in every
                diagram.
              </p>
              <p>
                <strong>Reuse a class</strong> by opening another diagram and
                clicking it in the shared model. Its position is independent in
                each view.
              </p>
              <p>
                <strong>Save your work</strong> with Save project. An .arxdraw
                file contains all diagrams, model data, and images. Browser
                autosave stays on this device.
              </p>
              <p>
                <strong>Undo / redo</strong> works across model and canvas
                changes with Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
              </p>
              <p className="scope-note">
                Early preview: class diagrams and shared models. XMI, code
                engineering, collaboration, and the remaining ArgoUML features
                are not available yet.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
