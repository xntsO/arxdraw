# COMP371 lab practice

ArxDraw includes all 29 numbered exercises and eight additional practice tasks from the supplied *COMP 371 SE Lab Manual 2026-27*. The manual skips exercise 13. The three DFD tasks each have levels 0, 1 and 2, giving 37 scenarios and 43 diagrams.

The worked examples are original study models, not official answers. They use the manual's topics with independent layouts and consistent notation. The original PDF is not distributed with the app.

## Practice workflow

1. Press **Ctrl+Alt+B** or swipe with **three fingers on the touchscreen** to open **COMP371 labs**. Its toolbar, menu and welcome-screen entries are hidden. Ctrl+Alt+B also closes the panel; Escape or Close dismisses it. A swipe can travel in any direction, at least 60 pixels within 1.2 seconds. Trackpad gestures handled by the operating system may not reach the browser; use the keyboard shortcut instead.
2. Search for the exercise or filter by diagram type. Read its objective and page reference.
3. Choose **Start blank** to practise, or **Open worked example** to inspect an editable model. The app adds it to your current workspace and offers Undo.
4. Use **UML → Draw** to place symbols and connectors, and **Pages** to switch diagrams. Edit model names in Properties; double-click canvas text to edit object values or annotations.
5. Use **Check model** for structural findings. Use the lab's self-checklist to review the meaning of your diagram. Checklist ticks are your own assessment, not an exam grade.
6. Save a portable **.arxdraw** file with Ctrl+S. Reopen that file to rehearse recovery, and export PNG/SVG for a printable copy.

For independent practice attempts, save your current project and start a new workspace before opening another lab. Adding several unrelated class examples to one model may produce duplicate-name warnings. The files retain full diagrams and images; class-only PlantUML, XMI and Java outputs do not contain every lab type.

## Exercise inventory

Every row has a blank start and a worked example. Page numbers refer to the supplied manual. UC-P, CL-P and SQ-P label its unnumbered practice prompts.

| Exercise | Topic | Diagram type | Manual page | Diagrams |
| --- | --- | --- | --- | --- |
| 1 | Banking operations | use-case | 4 | 1 |
| 2 | Air-ticket booking | use-case | 6 | 1 |
| 3 | Online shopping | use-case | 8 | 1 |
| 4 | Online ordering | use-case | 9 | 1 |
| UC-P1 | JU student academic portal | use-case | 9 | 1 |
| UC-P2 | Shared file storage | use-case | 9 | 1 |
| UC-P3 | Digital library | use-case | 9 | 1 |
| 5 | Geometrical shapes | class | 11 | 1 |
| 6 | Building structure | class | 12 | 1 |
| 7 | Banking system | class | 13 | 1 |
| 8 | Hotel management | class | 14 | 1 |
| CL-P1 | Vehicle company | class | 14 | 1 |
| CL-P2 | Library management | class | 14 | 1 |
| 9 | Customer and orders | object | 15 | 1 |
| 10 | College management | object | 16 | 1 |
| 11 | Restaurant food order | sequence | 17 | 1 |
| 12 | Online examination | sequence | 18 | 1 |
| 14 | Payment transaction | sequence | 19 | 1 |
| SQ-P1 | Mobile shopping | sequence | 19 | 1 |
| SQ-P2 | Library book loan | sequence | 19 | 1 |
| SQ-P3 | Graduation-project registration | sequence | 19 | 1 |
| 15 | Online bookstore lifecycle | state | 20 | 1 |
| 16 | Toaster lifecycle | state | 21 | 1 |
| 17 | Library borrowing lifecycle | state | 22 | 1 |
| 18 | ATM workflow | activity | 23 | 1 |
| 19 | Document creation workflow | activity | 24 | 1 |
| 20 | Order-processing workflow | activity | 25 | 1 |
| 21 | Shared printer messages | communication | 26 | 1 |
| 22 | Ticket-support messages | communication | 27 | 1 |
| 23 | Library messages | communication | 27 | 1 |
| 24 | Student-registration components | component | 28 | 1 |
| 25 | Shopping components | component | 28 | 1 |
| 26 | Order-processing components | component | 29 | 1 |
| 27 | Ticket-selling components | component | 29 | 1 |
| 28 | Railway-reservation data flows | data-flow | 33 | 3 |
| 29 | Mobile-shop data flows | data-flow | 35 | 3 |
| 30 | Hotel-reservation data flows | data-flow | 37 | 3 |

## Notation and checks

- Use case: actors, boundaries, ordinary/directed associations, include, extend and generalization.
- Class: compartments, members, generalization, aggregation, composition, association navigability and multiplicities.
- Object: underlined instance headers, editable slot values and links.
- Sequence: lifelines, activations, calls, returns, self messages, destruction markers and fragments. Message timing remains a drawing convention.
- State/activity: initial/final nodes, guards, decisions, loops and fork/join bars. State internal actions can be written in the state label.
- Collaboration/communication: objects, links and numbered messages, including self calls.
- Component: components, actors, provided/required interfaces and notes.
- DFD: process, external entity, data store and named one-way flow. Checks flag invalid endpoints, unnamed flows, disconnected nodes and processes missing input/output.

DFD Level 0 is the context view, following the manual's terminology. Level 2 is explicitly a whole-system view expanding process 1.0 into 1.1–1.3 while retaining sibling processes. The supplied examples preserve external flows and the expanded process boundary. After editing, compare levels yourself; the editor does not automatically validate decomposition or balancing.

Object slot values are per-view text. Sequence messages are not linked to classifier operations. These features support drawing and reviewing the labs without claiming full UML execution semantics.

## Exam rehearsal

- [x] All 37 blank starts and 43 worked diagrams construct.
- [x] All worked diagrams pass real Excalidraw conversion, binding integrity, project serialization, duplicate and merge checks.
- [x] All worked examples have no model errors or warnings when opened separately.
- [x] DFD external boundaries and process 1.0 decomposition are covered by tests.
- [x] Browser measurement checked all 757 text elements without width clipping.
- [x] All 37 scenarios reopen through the actual file loader with their models and lab references retained.
- [x] Integrated save, reopen, PNG/SVG export, undo/redo and reload rehearsal complete.
- [x] Storage-failure recovery download and successful browser-save retry verified.

Release destinations: [repository](https://github.com/xntsO/arxdraw) and [live app](https://arxdraw.fhas.sa).

Before the exam, rehearse on the same browser and computer you plan to use. Keep a downloaded .arxdraw copy and an image export of important practice diagrams. Browser autosave is local to that browser; it is not cloud backup.
