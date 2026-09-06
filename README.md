# ArxDraw

A web UML workspace built around the real Excalidraw React editor. This is the first milestone, not full ArgoUML parity.

## Included

- Excalidraw canvas, drawing tools, styling, pan/zoom, images, and PNG/SVG export.
- Shared class, abstract-class, and interface model with names, attributes, operations, and descriptions.
- Association, aggregation, composition, inheritance, dependency, and realization relationships.
- Multiple class diagrams with independent layouts referencing the same model.
- Browser autosave and complete `.arxdraw` project import/export, including embedded images.
- Project undo/redo and basic model checks.

Choose UML in the Excalidraw toolbar. Select Class or Interface and click the canvas to place it. Select a UML object to edit its properties. The UML panel also provides Model and Diagrams tabs. Open/save, diagrams, and project naming are in the hamburger menu. Existing `.arxdraw` projects and browser autosaves remain compatible.

## Development

```sh
npm install
npm run dev
npm run build
npm test
```

## Architecture

`lib/model.ts` owns the versioned UML model and validates project files. `lib/scene.ts` projects each diagram into grouped Excalidraw elements, connecting representations through `customData.modelId`. `components/arxdraw.tsx` coordinates project history, persistence, canvas editing, and the model inspector.

## Current limits and next milestones

Class diagrams are supported; the remaining UML diagram families, XMI/ArgoUML project interchange, profiles, full OCL validation, ArgoUML critics, code generation/reverse engineering, and real-time collaboration are not implemented. Basic attribute and operation signatures are stored as text. Project storage is local to the browser unless downloaded. Model redraws rebuild class compartments and UML relationship routes; freehand elements are preserved.

ArgoUML is the feature reference. No ArgoUML Java source has been incorporated. Excalidraw remains an upstream npm dependency under its MIT license; this app does not claim affiliation with either project.
