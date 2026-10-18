'use client';
import { useState } from 'react';
import type { Project } from '@/lib/model';
import {
  exportClassPlantUml,
  importClassPlantUml,
  generateJava,
  exportClassXmi,
  importClassXmi,
  xmiSubsetDescription,
} from '@/lib/interchange';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

function saveText(source: string, name: string, type = 'text/plain') {
  const url = URL.createObjectURL(
    new Blob([source], { type: `${type};charset=utf-8` }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const message = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;
const plantUmlSample =
  '@startuml\nclass Student {\n  - name: String\n  + enroll(): void\n}\n@enduml';

export function CodeTools({
  project,
  open,
  onOpenChange,
  onImport,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Adds the imported class model; may throw, e.g. at project limits. */
  onImport: (project: Project) => void;
}) {
  const [format, setFormat] = useState<'plantuml' | 'xmi'>('plantuml');
  const [sources, setSources] = useState({ plantuml: plantUmlSample, xmi: '' });
  const [xmiScope, setXmiScope] = useState<'model' | 'diagram'>('model');
  const [error, setError] = useState('');
  const fileName = (project.name.replace(/[^a-z0-9_-]+/gi, '-') || 'model')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  let plantUml = '',
    xmi = '',
    xmiError = '',
    java: { name: string; source: string }[] = [],
    javaError = '';
  if (open) {
    plantUml = exportClassPlantUml(project, project.activeDiagramId);
    try {
      xmi = exportClassXmi(
        project,
        xmiScope === 'diagram' ? project.activeDiagramId : undefined,
      );
    } catch (e) {
      xmiError = message(e, 'Unable to export XMI.');
    }
    try {
      java = generateJava(project);
    } catch (e) {
      javaError = message(e, 'Unable to generate Java.');
    }
  }
  function runImport() {
    try {
      const imported =
        format === 'xmi'
          ? importClassXmi(sources.xmi)
          : importClassPlantUml(sources.plantuml);
      onImport(imported);
      setError('');
      onOpenChange(false);
    } catch (e) {
      setError(message(e, 'Unable to import this source.'));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="arx-code-dialog">
        <DialogHeader>
          <DialogTitle>Class model code</DialogTitle>
          <DialogDescription>
            PlantUML and XMI interchange, and Java class definitions.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="export" onValueChange={() => setError('')}>
          <TabsList>
            <TabsTrigger value="export">PlantUML</TabsTrigger>
            <TabsTrigger value="xmi">XMI</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="java">Java</TabsTrigger>
          </TabsList>
          <TabsContent value="export" className="arx-code-content">
            <p className="text-sm">
              Classes and relationships on this diagram.
            </p>
            <Textarea
              aria-label="PlantUML source"
              readOnly
              value={plantUml}
              className="arx-code-source"
            />
            <Button onClick={() => saveText(plantUml, `${fileName}.puml`)}>
              Download .puml
            </Button>
          </TabsContent>
          <TabsContent value="xmi" className="arx-code-content">
            <fieldset className="arx-segmented">
              <legend className="sr-only">XMI export scope</legend>
              <label>
                <input
                  type="radio"
                  name="xmi-scope"
                  checked={xmiScope === 'model'}
                  onChange={() => setXmiScope('model')}
                />
                Whole class model
              </label>
              <label>
                <input
                  type="radio"
                  name="xmi-scope"
                  checked={xmiScope === 'diagram'}
                  onChange={() => setXmiScope('diagram')}
                />
                This diagram only
              </label>
            </fieldset>
            {xmiError ? (
              <p role="alert" className="arx-code-error">
                {xmiError}
              </p>
            ) : (
              <Textarea
                aria-label="XMI source"
                readOnly
                value={xmi}
                className="arx-code-source"
              />
            )}
            <Button
              disabled={!!xmiError}
              onClick={() =>
                saveText(xmi, `${fileName}.xmi`, 'application/xml')
              }
            >
              Download .xmi
            </Button>
            <p className="text-xs text-muted-foreground">
              {xmiSubsetDescription}
            </p>
          </TabsContent>
          <TabsContent value="import" className="arx-code-content">
            <fieldset className="arx-segmented">
              <legend className="sr-only">Import format</legend>
              <label>
                <input
                  type="radio"
                  name="import-format"
                  checked={format === 'plantuml'}
                  onChange={() => {
                    setFormat('plantuml');
                    setError('');
                  }}
                />
                PlantUML
              </label>
              <label>
                <input
                  type="radio"
                  name="import-format"
                  checked={format === 'xmi'}
                  onChange={() => {
                    setFormat('xmi');
                    setError('');
                  }}
                />
                XMI
              </label>
            </fieldset>
            <p className="text-sm">
              {format === 'xmi'
                ? 'Paste or choose a UML 2 XMI file.'
                : 'Paste classes, interfaces, members, and relationships.'}{' '}
              Import adds a new diagram to this project; undo removes it.
            </p>
            {format === 'xmi' && (
              <label className="arx-file-pick">
                <span>Choose XMI file</span>
                <input
                  type="file"
                  accept=".xmi,.xml,.uml,application/xml,text/xml"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (file.size > 10_000_000) {
                      setError('Choose an XMI file smaller than 10 MB.');
                      return;
                    }
                    setSources({ ...sources, xmi: await file.text() });
                    setError('');
                  }}
                />
              </label>
            )}
            <Textarea
              aria-label={
                format === 'xmi' ? 'XMI to import' : 'PlantUML to import'
              }
              value={sources[format]}
              onChange={(e) => {
                setSources({ ...sources, [format]: e.target.value });
                setError('');
              }}
              placeholder={format === 'xmi' ? '<?xml version="1.0"?>…' : ''}
              className="arx-code-source"
              spellCheck={false}
            />
            {error && (
              <p role="alert" className="arx-code-error">
                {error}
              </p>
            )}
            <Button disabled={!sources[format].trim()} onClick={runImport}>
              Add diagram
            </Button>
          </TabsContent>
          <TabsContent value="java" className="arx-code-content">
            {javaError ? (
              <p role="alert" className="arx-code-error">
                {javaError}
              </p>
            ) : java.length ? (
              java.map((file) => (
                <details key={file.name}>
                  <summary>{file.name}</summary>
                  <pre className="arx-java-source">{file.source}</pre>
                  <Button
                    size="sm"
                    onClick={() => saveText(file.source, file.name)}
                  >
                    Download {file.name}
                  </Button>
                </details>
              ))
            ) : (
              <p className="text-sm">Add a class to generate Java.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
