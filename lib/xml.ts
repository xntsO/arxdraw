// A deliberately bounded XML reader for model interchange. It never resolves
// entities, external documents, processing instructions or schemas.
export type XmlNode = {
  name: string;
  attributes: Map<string, string>;
  children: XmlNode[];
  text: string;
};
export const localName = (name: string) =>
  name.slice(name.lastIndexOf(':') + 1);
export const xmlAttribute = (node: XmlNode, key: string) =>
  node.attributes.get(key);
export const xmlId = (node: XmlNode) =>
  xmlAttribute(node, 'xmi:id') ?? xmlAttribute(node, 'xmi.id');
export const xmlEscape = (value: string) =>
  value.replace(/[&<>"'\r\n\t]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      case '\r':
        return '&#13;';
      case '\n':
        return '&#10;';
      case '\t':
        return '&#9;';
      default:
        return char;
    }
  });
function xmlDecode(value: string): string {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(value))
    throw new Error('XMI contains an invalid XML entity.');
  return value.replace(
    /&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g,
    (_, entity: string) => {
      switch (entity) {
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        default: {
          const point = entity.startsWith('#x')
            ? Number.parseInt(entity.slice(2), 16)
            : Number(entity.slice(1));
          if (
            !Number.isInteger(point) ||
            point > 0x10ffff ||
            (point < 32 && ![9, 10, 13].includes(point)) ||
            (point >= 0xd800 && point <= 0xdfff) ||
            point === 0xfffe ||
            point === 0xffff
          )
            throw new Error('XMI contains an invalid XML character.');
          return String.fromCodePoint(point);
        }
      }
    },
  );
}
export function parseXml(source: string): XmlNode {
  if (source.length > 5_000_000) throw new Error('XMI source exceeds 5 MB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error('XMI DTDs and entity declarations are not supported.');
  for (let index = 0; index < source.length; index++)
    if (
      source.charCodeAt(index) < 32 &&
      !['\t', '\n', '\r'].includes(source[index])
    )
      throw new Error('XMI contains an invalid XML character.');
  const document: XmlNode = {
    name: '#document',
    attributes: new Map(),
    children: [],
    text: '',
  };
  const stack: XmlNode[] = [document];
  let position = source.charCodeAt(0) === 0xfeff ? 1 : 0,
    count = 0;
  const fail = (): never => {
    throw new Error(`Malformed XMI XML near character ${position + 1}.`);
  };
  while (position < source.length) {
    if (source.startsWith('<!--', position)) {
      const end = source.indexOf('-->', position + 4);
      if (end < 0 || source.slice(position + 4, end).includes('--')) fail();
      position = end + 3;
      continue;
    }
    if (source.startsWith('<?', position)) {
      const end = source.indexOf('?>', position + 2);
      if (
        end < 0 ||
        !/^<\?xml\s/.test(source.slice(position)) ||
        document.children.length ||
        stack.length > 1
      )
        fail();
      position = end + 2;
      continue;
    }
    if (source.startsWith('<![CDATA[', position)) {
      const end = source.indexOf(']]>', position + 9);
      if (end < 0 || stack.length === 1) fail();
      stack[stack.length - 1].text += source.slice(position + 9, end);
      position = end + 3;
      continue;
    }
    if (source[position] !== '<') {
      const end = source.indexOf('<', position),
        stop = end < 0 ? source.length : end;
      const text = source.slice(position, stop);
      if (text.includes(']]>')) fail();
      stack[stack.length - 1].text += xmlDecode(text);
      position = stop;
      continue;
    }
    const closing = /^<\/([A-Za-z_][\w.:-]*)\s*>/.exec(source.slice(position));
    if (closing) {
      if (stack.length === 1 || stack[stack.length - 1].name !== closing[1])
        fail();
      stack.pop();
      position += closing[0].length;
      continue;
    }
    const opening = /^<([A-Za-z_][\w.:-]*)/.exec(source.slice(position));
    if (!opening || ++count > 50000 || stack.length > 128) return fail();
    const node: XmlNode = {
      name: opening[1],
      attributes: new Map(),
      children: [],
      text: '',
    };
    position += opening[0].length;
    let selfClosing = false;
    while (position < source.length) {
      const whitespace = /^\s*/.exec(source.slice(position))?.[0] ?? '';
      position += whitespace.length;
      if (source.startsWith('/>', position)) {
        selfClosing = true;
        position += 2;
        break;
      }
      if (source[position] === '>') {
        position++;
        break;
      }
      if (!whitespace.length) fail();
      const attribute =
        /^([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(
          source.slice(position),
        );
      if (!attribute || node.attributes.has(attribute[1])) return fail();
      node.attributes.set(
        attribute[1],
        xmlDecode((attribute[2] ?? attribute[3]).replace(/[\r\n\t]/g, ' ')),
      );
      position += attribute[0].length;
    }
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (
    stack.length !== 1 ||
    document.children.length !== 1 ||
    document.text.trim()
  )
    fail();
  return document.children[0];
}
