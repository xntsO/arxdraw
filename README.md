# ArxDraw

A UML drawing workspace using the Excalidraw editor.

[Open ArxDraw](https://arxdraw.fhas.sa)

See [the feature checklist](FEATURES.md) for implemented workflows, release checks, and remaining ArgoUML compatibility gaps.

For COMP371 exam practice, press **Ctrl+Alt+B** or swipe with **three fingers on the touchscreen** to open the hidden lab browser. The [lab guide and checklist](LABS.md) maps all 37 manual exercises to blank starts and 43 editable worked diagrams, including DFD levels 0, 1 and 2.

## Start practicing

Open the main menu and choose **Practice examples** to add editable examples for all eleven diagram types. Use **UML → Diagrams** to switch between them.

To start from scratch, choose **New diagram**, select a type, and choose **Blank diagram** or **Example diagram**. In **UML → Tools**, select the diagram toolset and a symbol, then click the canvas. Connector tools use native click-and-drag arrows with the matching UML notation. Double-click labels to edit them.

## Working features

- Class, use-case, sequence, activity, state, component, deployment, object, package, communication, and data-flow diagram tools and examples.
- Shared class/interface/abstract-class model with attributes, operations, visibility, types, and parameters. Both structured fields and raw signatures are editable.
- Association, aggregation, composition, inheritance, dependency, and realization. Endpoint multiplicities, parallel relationships, self-associations, and editable routing.
- Independent diagram layouts, add/delete diagrams, browser autosave, full `.arxdraw` save/open, project undo/redo, and native images/drawing tools.
- Native duplicated class groups become independent model classes.
- Searchable model explorer, diagram duplication and renaming, browser save status, and persistent import errors.
- PNG/SVG export, PlantUML class-diagram import/export, Java source skeleton generation, and navigable model diagnostics.
- UML 2 XMI class-model import/export with an explicitly limited syntax. Imports merge with fresh identifiers rather than overwriting existing content.
- New non-class symbols carry shared model identities, names, and documentation. Their geometry remains editable with Excalidraw.
- Course practice includes object slots and underlines, sequence self messages and destruction markers, directed associations, notes, and DFD symbols with structural checks.

Class diagrams use the shared classifier model. New symbols in the other diagram types use a separate native UML model, with names and documentation shared across their diagram views. Older unannotated drawings remain editable drawings. Removing an element from one diagram preserves its model object. Deleting it from the model removes its views and connected relationships. Deleting the final diagram opens a new blank canvas.

The `.arxdraw` file keeps the complete workspace, including drawings and embedded images. PlantUML and XMI exports contain the supported class model; they do not preserve the complete canvas. Browser autosave is local to the browser and can run out of space. Use **Save project** to keep a portable file copy.

## Development

```sh
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover model serialization and edits, UML notation and template bindings, duplication, member editing, PlantUML round trips, and Java output. Java compilation checks run when `javac` is available.

Additional tests cover malformed project input, identifier and binding remapping, XMI round trips, native symbol identity, shared names, deletion, and converted Excalidraw fixtures. CI runs lint, type checking, tests, and a production build on pushes to `main` and pull requests. After changing rendering, run the app and paste [scripts/browser-check.js](scripts/browser-check.js) into the browser console to check the actual saved scene for clipped class text and dangling arrow bindings.

In the dev editor's browser console, `await import('/scripts/native-runtime-check.js').then(m => m.checkNativeRuntime())` exercises the native examples through the real Excalidraw converter, shared rename rendering, and new relationship labels. `await import('/scripts/course-runtime-check.js').then(m => m.checkCourseRuntime())` checks all 43 course diagrams, diagnostics, bindings, serialization, merge and duplication. Both use isolated in-memory projects and leave the open workspace untouched.

## Architecture

`lib/model.ts` defines project data. `lib/project-parse.ts` validates saved files and `lib/project-operations.ts` handles merging and diagram copies. `lib/diagram.ts` renders shared classes and relationships. `lib/practice.ts` generates native symbols and example diagrams; `lib/native-model.ts` synchronizes their semantic identities with editable scenes. `lib/scene.ts` converts skeletons into Excalidraw elements and `lib/scene-model.ts` reconciles class copies and drawn relationships. `lib/diagnostics.ts` checks the model. `lib/interchange.ts` handles PlantUML and Java, with XMI in `lib/xmi.ts`. The main editor coordinates history, autosave, and native UI extensions.

## Limits

ArxDraw does not implement full ArgoUML parity. Native UML modeling supports shared identity, names, documentation and basic connections, not the complete UML metamodel. Package ownership, typed sequence messages, profiles, tagged values, OCL, advanced design critics, source-code reverse engineering, and collaboration are not implemented. Existing unannotated practice drawings are not automatically converted into model elements.

PlantUML import supports class-diagram syntax and reports unsupported constructs. XMI accepts a self-contained UML 2 class-model subset. Files using nested packages, package imports, or references to an external UML primitive-type library are rejected. External-tool interoperability has not been certified. ArgoUML's legacy UML 1.4/XMI 1.x and `.zargo` project formats are not supported. Java generation creates declarations and method stubs, not application behavior.

Class association navigability is preserved by project files and PlantUML. The XMI subset rejects navigability and named association roles rather than dropping them. DFD decomposition and balancing remain manual checks after edits; the supplied course examples have tested boundaries.

ArgoUML is the feature reference; no ArgoUML Java source has been incorporated. Excalidraw is an upstream npm dependency under its MIT license. This app does not claim affiliation with either project.
