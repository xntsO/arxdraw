# ArxDraw

A UML drawing workspace using the Excalidraw editor.

[Open ArxDraw](https://arxdraw.fhas.sa)

## Start practicing

Open the main menu and choose **Practice examples** to add editable examples for all ten diagram types. Use **UML → Diagrams** to switch between them.

To start from scratch, choose **New diagram**, select a type, and choose **Blank diagram** or **Example diagram**. In **UML → Tools**, select the diagram toolset and a symbol, then click the canvas. Connector tools use native click-and-drag arrows with the matching UML notation. Double-click labels to edit them.

## Working features

- Class, use-case, sequence, activity, state, component, deployment, object, package, and communication diagram tools and examples.
- Shared class/interface/abstract-class model with attributes, operations, visibility, types, and parameters. Both structured fields and raw signatures are editable.
- Association, aggregation, composition, inheritance, dependency, and realization. Endpoint multiplicities, parallel relationships, self-associations, and editable routing.
- Independent diagram layouts, add/delete diagrams, browser autosave, full `.arxdraw` save/open, project undo/redo, and native images/drawing tools.
- Native duplicated class groups become independent model classes.
- PNG/SVG export, PlantUML class-diagram import/export, Java source skeleton generation, and basic class-model checks.

Class diagrams use the shared semantic model. The other diagram types use native editable symbols and connectors; they are saved in each diagram's canvas. Removing a class from a diagram preserves its shared model object. Deleting it from the Model removes it from all diagrams. Deleting the final diagram opens a new blank canvas.

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

## Architecture

`lib/model.ts` owns project data and import validation. `lib/diagram.ts` renders shared classes and relationships. `lib/practice.ts` generates native symbols and example diagrams. `lib/scene.ts` converts skeletons into Excalidraw elements. `lib/scene-model.ts` reconciles native class duplication. `lib/interchange.ts` handles PlantUML and Java. The main editor coordinates history, autosave, and native UI extensions.

## Limits

ArxDraw is not full ArgoUML parity. Non-class diagrams do not yet have a shared semantic model or UML validation. PlantUML import supports class-diagram syntax and reports unsupported constructs. Java generation creates declarations and method stubs, not application behavior. XMI/ArgoUML project interchange, OCL, profiles, advanced design critics, source-code reverse engineering, and collaboration are not implemented. Save project files to move work between browsers.

ArgoUML is the feature reference; no ArgoUML Java source has been incorporated. Excalidraw is an upstream npm dependency under its MIT license. This app does not claim affiliation with either project.
