import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  createBlankProject,
  parseProject,
  relationshipKinds,
} from '../lib/model.ts';
import {
  exportClassPlantUml,
  importClassPlantUml,
  generateJava,
} from '../lib/interchange.ts';
import type { Project } from '../lib/model.ts';

const semantics = (p: Project) => ({
  classes: p.classes.map(({ id: _id, ...c }) => c),
  relationships: p.relationships.map(({ id: _id, from, to, ...r }) => ({
    ...r,
    from: p.classes.find((c) => c.id === from)!.name,
    to: p.classes.find((c) => c.id === to)!.name,
  })),
});
void test('PlantUML round trip preserves classifier kinds, members, descriptions and all relationship kinds', () => {
  const project = createProject();
  project.classes[0].kind = 'abstract';
  project.classes[0].name = 'A "quoted" <name> \\ 雪';
  project.classes[0].description = 'First line\nSecond "line" <U+0041>';
  project.classes[0].attributes = '- names: List<String>\n- literal: "{}"';
  project.relationships = relationshipKinds.map((kind, i) => ({
    id: String(i),
    from: 'user',
    to: 'payment',
    kind,
    label: 'a "label" <x>\nnext',
    sourceMultiplicity: '0..1',
    targetMultiplicity: '1..*',
  }));
  const imported = importClassPlantUml(exportClassPlantUml(project));
  assert.deepEqual(semantics(imported), semantics(project));
  assert.deepEqual(parseProject(JSON.stringify(imported)), imported);
});
void test('PlantUML export respects the selected diagram and rejects an unknown ID', () => {
  const project = createProject();
  const result = importClassPlantUml(exportClassPlantUml(project, 'domain'));
  assert.deepEqual(
    result.classes.map((c) => c.name),
    ['User', 'Order', 'OrderItem'],
  );
  assert.deepEqual(
    result.relationships.map((r) => r.kind),
    ['association', 'composition'],
  );
  assert.throws(() => exportClassPlantUml(project, 'missing'), /not found/);
});
void test('PlantUML imports common handwritten forward and reverse UML links', () => {
  const project = importClassPlantUml(`@startuml
abstract class Base {
  # id: Integer
  + save(): void
}
class Child
interface Service
Base <|-- Child
Service <|.. Child
Child "many" --* "one" Base : owns
Child : + run(input: String): Boolean
@enduml`);
  const rels = semantics(project).relationships;
  assert.equal(rels[0].from, 'Child');
  assert.equal(rels[0].to, 'Base');
  assert.equal(rels[1].kind, 'realization');
  assert.equal(rels[1].to, 'Service');
  assert.equal(rels[2].from, 'Base');
  assert.equal(rels[2].sourceMultiplicity, 'one');
  assert.equal(rels[2].targetMultiplicity, 'many');
  assert.equal(project.classes[1].operations, '+ run(input: String): Boolean');
});
void test('PlantUML import rejects unsupported syntax and broken references without returning partial data', () => {
  for (const source of [
    '@startuml\nactor User\n@enduml',
    '@startuml\n!include https://example.com/a\n@enduml',
    'package Demo {\nclass A\n}',
    'class A\nA --> Missing',
    'class A {\n- id: int',
    'class A\nclass A',
    '@startuml\nclass A',
    'class A <<entity>>',
  ])
    assert.throws(() => importClassPlantUml(source), /Line \d+:/);
});
void test('Java export maps UML primitives and containers and retains shared model references', () => {
  const project = createProject();
  project.classes[0].attributes +=
    '\n- items: List<OrderItem>\n- flags: Map<String, Boolean>';
  const files = generateJava(project);
  assert.equal(files.length, 4);
  const user = files.find((f) => f.name === 'User.java')!.source;
  assert.match(user, /private java.util.UUID id;/);
  assert.match(user, /private java.util.List<OrderItem> items;/);
  assert.match(user, /private java.util.Map<String, Boolean> flags;/);
  assert.match(user, /public boolean signIn\(\)/);
  assert.match(user, /public Order placeOrder\(\)/);
  assert.match(
    files.find((f) => f.name === 'PaymentService.java')!.source,
    /public Object charge\(Order order\);/,
  );
});
void test('Java export generates interface implementation stubs and superclass declarations', () => {
  const project = importClassPlantUml(`abstract class Base {
{abstract} + save(): void
}
interface Runnable {
+ run(): void
}
class Worker
Worker --|> Base
Worker ..|> Runnable`);
  const worker = generateJava(project).find(
    (f) => f.name === 'Worker.java',
  )!.source;
  assert.match(worker, /public class Worker extends Base implements Runnable/);
  assert.match(worker, /public void save\(\)/);
  assert.match(worker, /public void run\(\)/);
  assert.match(worker, /throw new UnsupportedOperationException/);
});
void test('Java rejects cycles, invalid member syntax, duplicate signatures and multiple class parents', () => {
  assert.throws(
    () =>
      generateJava(importClassPlantUml('class A\nclass B\nA --|> B\nB --|> A')),
    /cycle/,
  );
  assert.throws(
    () =>
      generateJava(
        importClassPlantUml('class A\nclass B\nclass C\nA --|> B\nA --|> C'),
      ),
    /one superclass/,
  );
  const p = createProject();
  p.classes[0].attributes = 'untyped field';
  assert.throws(() => generateJava(p), /unsupported attribute/);
  p.classes[0].attributes = '';
  p.classes[0].operations = '+ run(): void\n+ run(): void';
  assert.throws(() => generateJava(p), /duplicate operation/);
});
void test('an empty project exports and imports without adding sample content', () => {
  const p = importClassPlantUml(exportClassPlantUml(createBlankProject()));
  assert.equal(p.classes.length, 0);
  assert.equal(p.relationships.length, 0);
  assert.deepEqual(generateJava(p), []);
});

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
void test('generated Java compiles for the sample model and inherited interface methods', async (t) => {
  if (spawnSync('javac', ['-version']).error)
    return t.skip('Java compiler is not installed.');
  for (const project of [
    createProject(),
    importClassPlantUml(`abstract class Base {
{abstract} + save(): void
+ Base(id: Integer)
}
interface Runnable {
+ run(): void
}
class Worker {
- flags: Map<String, Boolean>
+ Worker(name: String)
}
Worker --|> Base
Worker ..|> Runnable`),
  ]) {
    const dir = await mkdtemp(join(tmpdir(), 'arxdraw-java-'));
    try {
      const files = generateJava(project);
      await Promise.all(
        files.map((f) => writeFile(join(dir, f.name), f.source)),
      );
      const result = spawnSync(
        'javac',
        files.map((f) => f.name),
        { cwd: dir, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stderr);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

void test('Java rejects erased overload conflicts and incompatible interface implementations', () => {
  assert.throws(
    () =>
      generateJava(
        importClassPlantUml(`class A {
+ run(a: List<String>): void
+ run(a: List<Integer>): void
}`),
      ),
    /duplicate operation/,
  );
  assert.throws(
    () =>
      generateJava(
        importClassPlantUml(`interface Service {
+ run(): String
}
class Worker {
+ run(): Integer
}
Worker ..|> Service`),
      ),
    /incompatible inherited/,
  );
  assert.throws(
    () =>
      generateJava(
        importClassPlantUml(`class Base {
- Base()
}
class Child
Child --|> Base`),
      ),
    /private no-argument constructor/,
  );
});
