import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendMember,
  memberRows,
  parseMember,
  serializeMembers,
  updateMember,
} from '../lib/members.ts';

void test('opening the structured editor round trips arbitrary UML signatures byte for byte', () => {
  const attributes =
    '  - name : String  \n+ /total: Money {derived, readOnly}\n~ tags: List<String>\n\n# limit: Integer = 10';
  assert.equal(
    serializeMembers(memberRows(attributes, 'attributes')),
    attributes,
  );
  assert.equal(memberRows(attributes, 'attributes')[1].fields, null);
  assert.equal(memberRows(attributes, 'attributes')[4].fields, null);
  const operations =
    '+ find(id: UUID, opts: Map<String, Integer>): List<Item>\n+ map<T>(fn: (item: T) => T): T\n«signal» changed()';
  assert.equal(
    serializeMembers(memberRows(operations, 'operations')),
    operations,
  );
  assert.equal(memberRows(operations, 'operations')[1].fields, null);
});

void test('editing one attribute changes only that row and preserves its visibility and type', () => {
  const rows = memberRows(
    '- id: UUID\n# /balance: Money {readOnly}',
    'attributes',
  );
  rows[0] = updateMember(rows[0], { name: 'customerId' }, 'attributes');
  assert.equal(
    serializeMembers(rows),
    '- customerId: UUID\n# /balance: Money {readOnly}',
  );
  assert.equal(
    updateMember(rows[1], { name: 'balance' }, 'attributes'),
    rows[1],
  );
});

void test('operation fields preserve parameter syntax while changing the return type', () => {
  const row = parseMember(
    '+ find(id: UUID, options: Map<String, Integer>): Item',
    'operations',
  );
  assert.equal(
    row.fields?.parameters,
    'id: UUID, options: Map<String, Integer>',
  );
  assert.equal(
    updateMember(row, { type: 'List<Item>', visibility: '#' }, 'operations')
      .raw,
    '# find(id: UUID, options: Map<String, Integer>): List<Item>',
  );
});

void test('adding and removing members preserves unrelated advanced signatures and generates unique names', () => {
  const original = memberRows(
    '- attribute1: String\n+ /derived: Integer {readOnly}',
    'attributes',
  );
  const added = appendMember(original, 'attributes');
  assert.equal(added[2].raw, '- attribute2: String');
  assert.equal(original.length, 2);
  assert.equal(
    serializeMembers(added.filter((_, i) => i !== 0)),
    '+ /derived: Integer {readOnly}\n- attribute2: String',
  );
  assert.equal(appendMember([], 'operations')[0].raw, '+ operation1(): void');
});

void test('unspecified visibility, constructors, and temporarily blank field values remain editable', () => {
  const constructor = parseMember('Customer(id: UUID)', 'operations');
  assert.equal(constructor.fields?.visibility, '');
  assert.equal(constructor.fields?.type, '');
  const emptyName = updateMember(constructor, { name: '' }, 'operations');
  assert.ok(emptyName.fields);
  assert.equal(
    updateMember(emptyName, { name: 'Order' }, 'operations').raw,
    'Order(id: UUID)',
  );
  assert.deepEqual(memberRows('', 'attributes'), []);
});
