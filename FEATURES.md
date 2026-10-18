# ArxDraw feature checklist

This checklist distinguishes drawing support from model semantics. A shape on the canvas does not by itself mean the corresponding UML model, validation, or interchange is implemented.

## Drawing and editing

- [x] Native Excalidraw shapes, text, arrows, freehand drawing, images, library, pan and zoom.
- [x] Ten UML diagram toolsets with editable examples.
- [x] Data-flow diagram tools and level 0/1/2 course examples.
- [x] Class compartments, member editing, six relationship notations and endpoint multiplicities.
- [x] Separate diagram layouts, shared classifiers, project undo and redo.
- [x] Project save/open and browser autosave.
- [x] PNG and SVG export.
- [x] Searchable model explorer and diagram list.
- [x] Duplicate, rename, reorder and switch diagrams without losing layout or bindings.
- [x] Visible browser save state and persistent import errors.
- [x] Native drawn class connections become model relationships.
- [x] Cross-diagram class copies retain model identity.

## Modeling and interchange

- [x] Shared classes, interfaces and abstract classes.
- [x] Attributes and operations with raw and structured member editing.
- [x] Remove a class from one diagram or delete it from the shared model.
- [x] PlantUML class-diagram import and export.
- [x] Java declaration and method-stub generation.
- [x] Structured, navigable model diagnostics.
- [x] Safe project merging with identifier and image remapping.
- [x] Explicit UML 2 XMI class-model import/export subset.
- [x] Semantic identity and editable properties for non-class symbols.
- [x] Shared non-class names and documentation across diagrams.
- [x] Non-class connector semantics and diagram checks.
- [x] Directed associations, sequence self messages/destruction, notes, and editable object slots.

## COMP371 practice

- [x] All 29 numbered manual exercises and eight additional practice prompts.
- [x] 37 blank practice starts and 43 original editable worked diagrams.
- [x] Searchable lab browser, manual page references and persistent self-checklists.
- [x] All worked diagrams pass real converter, binding, serialization, duplication and merge checks.
- [x] DFD examples preserve external flows and the expanded process boundary across levels.

See [LABS.md](LABS.md) for the full exercise inventory, usage and exam rehearsal checklist. Worked examples are possible answers; structural checks and self-checklists are not grading.

## Model coverage

All eleven diagram types have drawing tools and examples. The model coverage differs by type.

| Diagram type | Model support | Limits |
| --- | --- | --- |
| Class | Shared classifiers, members, six relationship kinds and multiplicities; PlantUML, XMI subset and Java export | No profiles, OCL or reverse engineering |
| Use case | Shared symbols and connections; include/extend endpoint checks and disconnected-actor warnings | No complete use-case specification model |
| Activity and state | Shared nodes and flows; initial-node, reachability, final-node and branch-label checks | No execution engine or nested state-machine semantics |
| Sequence and communication | Shared symbols and named connections | Messages do not reference classifier operations; timing is visual |
| Component and deployment | Shared symbols and connections | No complete deployment or provided/required-interface metamodel |
| Object and package | Shared symbols and connections | No instance-slot typing or package ownership hierarchy |
| Data flow | Named processes, entities, stores and flows; endpoint, naming and input/output checks | Decomposition and balancing after edits require manual review |

For non-class diagrams, shared properties are identity, kind, name, description and relationship endpoints. Geometry stays in each diagram. These diagrams are saved in `.arxdraw` files; the class-only interchange formats do not export them. Legacy shapes without UML metadata stay editable drawings.

Class diagnostics also check duplicate or missing names, missing endpoints, inheritance cycles, realization targets, multiplicities and composition ownership. The checks identify common modeling mistakes; they do not establish full UML conformance.

## Compatibility gaps

These remain separate from the core release checks. They must not be advertised as implemented without their own tests.

- [ ] Full ArgoUML UML 1.4 metamodel compatibility.
- [ ] ArgoUML `.zargo` project and XMI 1.x interchange, including PGML layouts.
- [ ] OCL evaluation, custom profiles, tagged values and the complete design-critic catalog.
- [ ] Java reverse engineering and additional source-generation languages.
- [ ] Sequence messages linked to classifier operations.
- [ ] Real-time multi-user collaboration.

ArgoUML's [feature reference](https://argouml-tigris-org.github.io/tigris/argouml/features.html) and [interchange FAQ](https://argouml-tigris-org.github.io/tigris/argouml/faqs/users.html) describe the comparison target. Its legacy XMI format is distinct from a UML 2 XMI subset.

The XMI subset requires a self-contained class model. Nested packages, package imports, and external primitive-type library references are rejected. Interoperability with Papyrus, EMF, or other UML tools has not been certified.

## Release verification

- [x] Lint and TypeScript checks pass.
- [x] Automated tests pass: 110 passed; one Java compilation check skipped because local `javac` is unavailable.
- [x] Production build succeeds.
- [x] Browser checks cover drawing, model editing, diagnostics, import, duplication, undo and reload.
- [x] Existing v1 project data remains readable.
- [x] All 37 course scenarios reopen through the actual project file input.
- [x] PNG/SVG exports and downloadable recovery during browser-storage failure are verified.

Verified on 18 October 2026. Release destinations: [GitHub](https://github.com/xntsO/arxdraw) and the [public Site](https://arxdraw.fhas.sa). Unchecked compatibility entries remain outside this release.
