// Run in the browser console after opening an ArxDraw project.
// Read-only: checks the actual autosaved scene, including font measurements.
(() => {
  const raw = localStorage.getItem('arxdraw.project.v1');
  if (!raw) throw new Error('No autosaved ArxDraw project is available.');
  const project = JSON.parse(raw);
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Canvas text measurement is unavailable.');
  const failures = [];
  let measuredText = 0;
  for (const diagram of project.diagrams) {
    const visible = diagram.elements.filter((element) => !element.isDeleted);
    const ids = new Set(diagram.elements.map((element) => element.id));
    if (ids.size !== diagram.elements.length)
      failures.push({ diagram: diagram.name, problem: 'Duplicate scene IDs' });
    for (const element of visible) {
      for (const key of ['startBinding', 'endBinding']) {
        if (element[key] && !ids.has(element[key].elementId))
          failures.push({ diagram: diagram.name, element: element.id, problem: `Missing ${key} target` });
      }
      if (element.type !== 'text' || element.fontFamily !== 3 || !element.customData?.arxdraw) continue;
      context.font = `${element.fontSize}px Cascadia`;
      const measured = Math.max(...element.text.split('\n').map((line) => context.measureText(line).width));
      measuredText++;
      if (measured > element.width + 2)
        failures.push({ diagram: diagram.name, element: element.id, problem: 'Clipped UML text', width: element.width, measured });
    }
  }
  if (!project.diagrams.some((diagram) => diagram.id === project.activeDiagramId))
    failures.push({ problem: 'Missing active diagram' });
  return {
    pass: failures.length === 0,
    diagrams: project.diagrams.length,
    classes: project.classes.length,
    relationships: project.relationships.length,
    nativeElements: project.nativeModel?.elements.length ?? 0,
    nativeRelationships: project.nativeModel?.relationships.length ?? 0,
    measuredText,
    failures,
  };
})();
