'use client';
import { useState } from 'react';
import type { Project } from '@/lib/model';
import {
  exportClassPlantUml,
  importClassPlantUml,
  generateJava,
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

function saveText(source: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([source], { type: 'text/plain;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CodeTools({
  project,
  open,
  onOpenChange,
  onImport,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (project: Project) => void;
}) {
  const [source, setSource] = useState(
    '@startuml\nclass Student {\n  - name: String\n  + enroll(): void\n}\n@enduml',
  );
  const [error, setError] = useState('');
  let plantUml = '',
    java: { name: string; source: string }[] = [],
    javaError = '';
  if (open) {
    plantUml = exportClassPlantUml(project, project.activeDiagramId);
    try {
      java = generateJava(project);
    } catch (e) {
      javaError = e instanceof Error ? e.message : 'Unable to generate Java.';
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="arx-code-dialog">
        <DialogHeader>
          <DialogTitle>Class diagram code</DialogTitle>
          <DialogDescription>
            PlantUML class diagrams and Java class definitions.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="export" onValueChange={() => setError('')}>
          <TabsList>
            <TabsTrigger value="export">PlantUML</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="java">Java</TabsTrigger>
          </TabsList>
          <TabsContent value="export" className="arx-code-content">
            <Textarea
              aria-label="PlantUML source"
              readOnly
              value={plantUml}
              className="arx-code-source"
            />
            <Button onClick={() => saveText(plantUml, 'diagram.puml')}>
              Download .puml
            </Button>
          </TabsContent>
          <TabsContent value="import" className="arx-code-content">
            <p className="text-sm">
              Paste classes, interfaces, members, and relationships. Import adds
              a new diagram to this project.
            </p>
            <Textarea
              aria-label="PlantUML to import"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="arx-code-source"
              spellCheck={false}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              onClick={() => {
                try {
                  const imported = importClassPlantUml(source);
                  onImport(imported);
                  setError('');
                  onOpenChange(false);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'Unable to import this source.',
                  );
                }
              }}
            >
              Add diagram
            </Button>
          </TabsContent>
          <TabsContent value="java" className="arx-code-content">
            {javaError ? (
              <p role="alert" className="text-sm text-destructive">
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
