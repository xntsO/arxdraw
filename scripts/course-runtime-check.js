// Run in the dev editor console after its fonts load:
// await import('/scripts/course-runtime-check.js').then(m => m.checkCourseRuntime())
import { courseLabs } from '../lib/course-labs';
import { createCourseLab } from '../lib/course-runtime';
import { parseProject, projectDiagnostics, mergeProjects, duplicateDiagram } from '../lib/model';

export function checkCourseRuntime() {
  const results = [];
  for (const lab of courseLabs) {
    const project = createCourseLab(lab.id,'example');
    const parsed = parseProject(JSON.stringify(project));
    const failures = [];
    for (const diagram of parsed.diagrams) {
      const ids = new Set(diagram.elements.map((item) => item.id));
      for (const item of diagram.elements) {
        if (item.type === 'arrow' && item.customData?.uml?.role === 'edge' && (!item.startBinding || !item.endBinding)) failures.push(`${diagram.name}: unbound ${item.customData.uml.kind}`);
        for (const binding of [item.startBinding,item.endBinding]) if (binding && !ids.has(binding.elementId)) failures.push(`${diagram.name}: dangling binding`);
        if (![item.x,item.y,item.width,item.height].every(Number.isFinite)) failures.push(`${diagram.name}: invalid geometry`);
      }
    }
    const diagnostics = projectDiagnostics(parsed);
    for (const item of diagnostics) if (item.severity === 'error' || item.severity === 'warning') failures.push(item.message);
    const merged = mergeProjects(parsed,parsed);
    parseProject(JSON.stringify(merged));
    parseProject(JSON.stringify(duplicateDiagram(parsed,parsed.activeDiagramId)));
    results.push({id:lab.id,diagrams:parsed.diagrams.length,elements:parsed.diagrams.reduce((sum,d)=>sum+d.elements.length,0),warnings:diagnostics.filter((item)=>item.severity==='warning').map((item)=>item.code),failures});
  }
  return {pass:results.every((item)=>item.failures.length===0),scenarios:results.length,diagrams:results.reduce((sum,item)=>sum+item.diagrams,0),results};
}
