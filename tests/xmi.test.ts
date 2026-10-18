import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankProject,
  createProject,
  parseProject,
  relationshipKinds,
} from '../lib/model.ts';
import type { Project } from '../lib/model.ts';
import { exportClassXmi, importClassXmi } from '../lib/interchange.ts';
import { parseXml } from '../lib/xml.ts';

const semantics = (project: Project) => ({
  classes: project.classes.map(({ id: _id, ...classifier }) => classifier),
  relationships: project.relationships
    .map(({ id: _id, from, to, ...relationship }) => ({
      ...relationship,
      from: project.classes.find((item) => item.id === from)?.name,
      to: project.classes.find((item) => item.id === to)?.name,
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind)),
});
void test('XMI round trip preserves all six class relationships and exact member notation', () => {
  const project = createProject();
  project.classes[0].name = 'A "quoted" <name> & 雪';
  project.classes[0].kind = 'abstract';
  project.classes[0].attributes =
    '  - id : UUID\n# items: Map<String, Order>\n';
  project.classes[0].operations =
    '+ execute(orders: List<Order>, count: Integer): Boolean';
  project.classes[0].description = 'First\nSecond <&> "quotes"';
  project.relationships = relationshipKinds.map((kind, index) => ({
    id: String(index),
    from: 'user',
    to: 'payment',
    kind,
    label: `${kind} <&>`,
    sourceMultiplicity: '0..1',
    targetMultiplicity: '1..*',
  }));
  project.diagrams.forEach((diagram) => {
    diagram.relationshipIds = [];
  });
  const exported = exportClassXmi(project);
  assert.match(exported, /uml:Association/);
  assert.match(exported, /aggregation="composite"/);
  assert.match(exported, /interfaceRealization/);
  assert.match(exported, /generalization/);
  const imported = importClassXmi(exported);
  assert.deepEqual(semantics(imported), semantics(project));
  assert.deepEqual(parseProject(JSON.stringify(imported)), imported);
});
void test('XMI export supports selected-diagram and empty-model round trips', () => {
  const imported = importClassXmi(exportClassXmi(createProject(), 'domain'));
  assert.deepEqual(
    imported.classes.map((item) => item.name),
    ['User', 'Order', 'OrderItem'],
  );
  assert.equal(imported.relationships.length, 2);
  assert.throws(() => exportClassXmi(createProject(), 'missing'), /not found/);
  assert.deepEqual(
    importClassXmi(exportClassXmi(createBlankProject())).classes,
    [],
  );
});

const wrap = (content: string) =>
  `<?xml version="1.0"?><xmi:XMI xmlns:xmi="http://www.omg.org/XMI" xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"><uml:Model xmi:id="m" name="External">${content}</uml:Model></xmi:XMI>`;
void test('external UML2 XMI reads ordinary members, generalization, comments and reversed composite ends', () => {
  const imported = importClassXmi(
    wrap(`
    <packagedElement xmi:type="uml:PrimitiveType" xmi:id="string" name="String"/>
    <packagedElement xmi:type="uml:Class" xmi:id="base" name="Base" isAbstract="true"/>
    <packagedElement xmi:type="uml:Class" xmi:id="child" name="Child">
      <ownedAttribute xmi:id="f" name="name" visibility="private" type="string"/>
      <ownedOperation xmi:id="o" name="run" visibility="public"><ownedParameter direction="in" name="value" type="string"/><ownedParameter direction="return" type="base"/></ownedOperation>
      <ownedComment><body>A &amp; B</body></ownedComment>
      <generalization xmi:id="g" general="base"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="a" memberEnd="e1 e2">
      <ownedEnd xmi:id="e1" type="child"><lowerValue value="0"/><upperValue value="*"/></ownedEnd>
      <ownedEnd xmi:id="e2" type="base" aggregation="composite"><lowerValue value="1"/><upperValue value="1"/></ownedEnd>
    </packagedElement>`),
  );
  assert.equal(imported.classes[1].attributes, '- name: String');
  assert.equal(imported.classes[1].operations, '+ run(value: String): Base');
  assert.equal(imported.classes[1].description, 'A & B');
  const composition = imported.relationships[1];
  assert.equal(composition.kind, 'composition');
  assert.equal(composition.from, imported.classes[1].id);
  assert.equal(composition.to, imported.classes[0].id);
  assert.equal(composition.sourceMultiplicity, '0..*');
  assert.equal(composition.targetMultiplicity, '1');
});

void test('XMI rejects unknown constructs and unresolved references instead of returning partial models', () => {
  for (const content of [
    '<packagedElement xmi:type="uml:Actor" xmi:id="a" name="Actor"/>',
    '<packagedElement xmi:type="uml:Package" xmi:id="p"/>',
    '<packagedElement xmi:type="uml:Class" xmi:id="c"/><packagedElement xmi:type="uml:Class" xmi:id="c"/>',
    '<packagedElement xmi:type="uml:Class" xmi:id="c"><ownedAttribute name="x" type="missing"/></packagedElement>',
    '<packagedElement xmi:type="uml:Class" xmi:id="c"><generalization general="missing"/></packagedElement>',
    '<packagedElement xmi:type="uml:Class" xmi:id="c"><ownedBehavior/></packagedElement>',
    '<packagedElement xmi:type="uml:Class" xmi:id="c"><ownedAttribute name="x"><type href="file:///secret"/></ownedAttribute></packagedElement>',
    '<packagedElement xmi:type="uml:Association" xmi:id="a" memberEnd="x y z"/>',
  ])
    assert.throws(() => importClassXmi(wrap(content)), /XMI/);
  assert.throws(() => importClassXmi('<XMI xmi.version="1.2"/>'), /UML 1/);
  const project = createProject();
  project.classes[0].attributes = '- name: String = "default"';
  assert.throws(() => exportClassXmi(project), /unsupported XMI attribute/);
  project.classes[0].attributes = '';
  project.relationships[0].sourceMultiplicity = 'many';
  assert.throws(() => exportClassXmi(project), /multiplicity/);
});

void test('XML reader rejects XXE, malformed XML, duplicate attributes and invalid entities', () => {
  for (const source of [
    '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///secret">]><a>&x;</a>',
    '<a><b></a>',
    '<a id="1" id="2"/>',
    '<a>&unknown;</a>',
    '<a>&#0;</a>',
    '<a>&#xD800;</a>',
    '<a/><b/>',
    '<a attr="unterminated>',
    '<a>plain & invalid</a>',
    '<a><![CDATA[unterminated</a>',
    '<a>]]></a>',
  ])
    assert.throws(() => parseXml(source), /XMI/);
  const parsed = parseXml('<a label="&amp;lt;">&#x1F600;<![CDATA[<&>]]></a>');
  assert.equal(parsed.attributes.get('label'), '&lt;');
  assert.equal(parsed.text, '😀<&>');
});

void test('exported composition aggregation is on the part-typed property opposite the whole', () => {
  const exported = parseXml(exportClassXmi(createProject()));
  const model = exported.children[0];
  const association = model.children.find(
    (node) => node.attributes.get('xmi:id') === 'r2',
  )!;
  const source = association.children.find(
    (node) => node.attributes.get('xmi:id') === 'r2_source',
  )!;
  const target = association.children.find(
    (node) => node.attributes.get('xmi:id') === 'r2_target',
  )!;
  assert.equal(source.attributes.get('type'), 'c2'); // Order, the whole.
  assert.equal(source.attributes.get('aggregation'), undefined);
  assert.equal(target.attributes.get('type'), 'c3'); // OrderItem, the part.
  assert.equal(target.attributes.get('aggregation'), 'composite');
});

void test('external UML member edits take precedence over stale raw notation annotations', () => {
  const project = createProject();
  project.classes[0].attributes = '  - email : String  ';
  const exported = exportClassXmi(project);
  assert.equal(
    importClassXmi(exported).classes[0].attributes,
    project.classes[0].attributes,
  );
  const edited = exported
    .replace('name="email"', 'name="address"')
    .replace('name="signIn"', 'name="authenticate"');
  const imported = importClassXmi(edited);
  assert.equal(imported.classes[0].attributes, '- address: String');
  assert.match(imported.classes[0].operations, /authenticate\(\)/);
  assert.doesNotMatch(imported.classes[0].operations, /signIn\(\)/);
});

void test('XMI rejects named association roles, navigability and out-of-diagram class type references', () => {
  const source = wrap(
    '<packagedElement xmi:type="uml:Class" xmi:id="a" name="A"/><packagedElement xmi:type="uml:Class" xmi:id="b" name="B"/><packagedElement xmi:type="uml:Association" xmi:id="link" memberEnd="s t"><ownedEnd xmi:id="s" type="a"/><ownedEnd xmi:id="t" type="b" name="children"/></packagedElement>',
  );
  assert.throws(() => importClassXmi(source), /association end roles/);
  assert.throws(
    () =>
      importClassXmi(source.replace('name="children"', 'isNavigable="true"')),
    /navigability/,
  );
  const project = createProject();
  project.classes[0].attributes += '\n- payment: PaymentService';
  assert.throws(
    () => exportClassXmi(project, 'domain'),
    /outside the selected diagram/,
  );
  assert.equal(
    importClassXmi(exportClassXmi(project)).classes[0].attributes,
    project.classes[0].attributes,
  );
});
