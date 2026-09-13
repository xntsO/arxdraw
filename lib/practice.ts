/** Native, editable UML symbols. These deliberately stay outside the shared class model. */
export type PracticeDiagramKind =
  | 'use-case'
  | 'activity'
  | 'state'
  | 'sequence'
  | 'component'
  | 'deployment'
  | 'object'
  | 'package'
  | 'communication';

export type PracticeSkeleton = {
  id: string;
  type: 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  points?: number[][];
  groupIds?: string[];
  start?: { id: string };
  end?: { id: string };
  label?: {
    text: string;
    fontSize?: number;
    fontFamily?: number;
    verticalAlign?: string;
  };
  [key: string]: unknown;
};
export type PracticeTool = { id: string; label: string };
export const diagramKinds: readonly {
  id: PracticeDiagramKind;
  label: string;
  description: string;
}[] = [
  {
    id: 'use-case',
    label: 'Use case',
    description: 'Actors, use cases, and system boundaries',
  },
  {
    id: 'activity',
    label: 'Activity',
    description: 'Actions, decisions, and parallel flows',
  },
  { id: 'state', label: 'State', description: 'States and event transitions' },
  {
    id: 'sequence',
    label: 'Sequence',
    description: 'Participants and ordered messages',
  },
  {
    id: 'component',
    label: 'Component',
    description: 'Components, interfaces, and dependencies',
  },
  {
    id: 'deployment',
    label: 'Deployment',
    description: 'Devices, execution environments, and artifacts',
  },
  {
    id: 'object',
    label: 'Object',
    description: 'Instances, values, and links',
  },
  {
    id: 'package',
    label: 'Package',
    description: 'Packages and their dependencies',
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Objects and numbered messages',
  },
];
const catalog: Record<PracticeDiagramKind, PracticeTool[]> = {
  'use-case': [
    { id: 'actor', label: 'Actor' },
    { id: 'use-case', label: 'Use case' },
    { id: 'system', label: 'System boundary' },
    { id: 'association', label: 'Association' },
    { id: 'include', label: 'Include' },
    { id: 'extend', label: 'Extend' },
    { id: 'generalization', label: 'Generalization' },
  ],
  activity: [
    { id: 'initial', label: 'Start' },
    { id: 'action', label: 'Action' },
    { id: 'decision', label: 'Decision / merge' },
    { id: 'fork', label: 'Fork / join' },
    { id: 'final', label: 'End' },
    { id: 'flow', label: 'Control flow' },
    { id: 'swimlane', label: 'Swimlane' },
  ],
  state: [
    { id: 'initial', label: 'Initial state' },
    { id: 'state', label: 'State' },
    { id: 'choice', label: 'Choice' },
    { id: 'final', label: 'Final state' },
    { id: 'transition', label: 'Transition' },
  ],
  sequence: [
    { id: 'participant', label: 'Participant' },
    { id: 'activation', label: 'Activation' },
    { id: 'message', label: 'Call message' },
    { id: 'async-message', label: 'Async message' },
    { id: 'return', label: 'Return message' },
    { id: 'fragment', label: 'Alternative fragment' },
    { id: 'loop-fragment', label: 'Loop fragment' },
  ],
  component: [
    { id: 'component', label: 'Component' },
    { id: 'provided-interface', label: 'Provided interface' },
    { id: 'required-interface', label: 'Required interface' },
    { id: 'port', label: 'Port' },
    { id: 'dependency', label: 'Dependency' },
    { id: 'assembly', label: 'Assembly connector' },
  ],
  deployment: [
    { id: 'device', label: 'Device' },
    { id: 'environment', label: 'Execution environment' },
    { id: 'artifact', label: 'Artifact' },
    { id: 'communication-path', label: 'Communication path' },
    { id: 'deploy', label: 'Deploy dependency' },
  ],
  object: [
    { id: 'object', label: 'Object' },
    { id: 'link', label: 'Link' },
  ],
  package: [
    { id: 'package', label: 'Package' },
    { id: 'dependency', label: 'Dependency' },
    { id: 'import', label: 'Import' },
    { id: 'merge', label: 'Merge' },
  ],
  communication: [
    { id: 'object', label: 'Object' },
    { id: 'actor', label: 'Actor' },
    { id: 'link', label: 'Link' },
    { id: 'numbered-message', label: 'Numbered message' },
  ],
};
export function practiceTools(kind: PracticeDiagramKind): PracticeTool[] {
  return catalog[kind].map((tool) => ({ ...tool }));
}
const uid = () => crypto.randomUUID();
const ink = '#1e1e1e';
function shape(
  type: PracticeSkeleton['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  text?: string,
  extra: Record<string, unknown> = {},
): PracticeSkeleton {
  return {
    id: uid(),
    type,
    x,
    y,
    width,
    height,
    strokeColor: ink,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1.5,
    roughness: 0,
    roundness: null,
    ...(text ? { label: { text, fontSize: 18, fontFamily: 2 } } : {}),
    ...extra,
  };
}
function text(
  x: number,
  y: number,
  value: string,
  extra: Record<string, unknown> = {},
): PracticeSkeleton {
  return {
    id: uid(),
    type: 'text',
    x,
    y,
    text: value,
    fontSize: 18,
    fontFamily: 2,
    strokeColor: ink,
    ...extra,
  };
}
function line(
  x: number,
  y: number,
  points: number[][],
  extra: Record<string, unknown> = {},
): PracticeSkeleton {
  return {
    id: uid(),
    type: 'line',
    x,
    y,
    width:
      Math.max(...points.map(([px]) => px)) -
      Math.min(...points.map(([px]) => px)),
    height:
      Math.max(...points.map(([, py]) => py)) -
      Math.min(...points.map(([, py]) => py)),
    points,
    strokeColor: ink,
    strokeWidth: 1.5,
    roughness: 0,
    ...extra,
  };
}
function grouped(elements: PracticeSkeleton[]): PracticeSkeleton[] {
  const id = uid();
  return elements.map((element) => ({ ...element, groupIds: [id] }));
}
const connectorIds = new Set([
  'association',
  'include',
  'extend',
  'generalization',
  'flow',
  'transition',
  'message',
  'async-message',
  'return',
  'dependency',
  'assembly',
  'communication-path',
  'deploy',
  'link',
  'import',
  'merge',
  'numbered-message',
]);
export function isPracticeConnector(toolId: string): boolean {
  return connectorIds.has(toolId);
}
export function connectorSkeleton(
  toolId: string,
  x: number,
  y: number,
  endX: number,
  endY: number,
  label?: string,
  startId?: string,
  endId?: string,
): PracticeSkeleton {
  const plain = [
    'association',
    'assembly',
    'communication-path',
    'link',
  ].includes(toolId);
  const dashed = [
    'include',
    'extend',
    'return',
    'dependency',
    'deploy',
    'import',
    'merge',
  ].includes(toolId);
  const defaultLabel: Record<string, string> = {
    include: '«include»',
    extend: '«extend»',
    transition: 'event [guard] / action',
    message: 'message()',
    'async-message': 'signal()',
    return: 'result',
    deploy: '«deploy»',
    import: '«import»',
    merge: '«merge»',
    'numbered-message': '1: message()',
  };
  const caption = label ?? defaultLabel[toolId];
  return {
    ...line(x, y, [
      [0, 0],
      [endX - x, endY - y],
    ]),
    type: 'arrow',
    startArrowhead: null,
    endArrowhead: plain
      ? null
      : toolId === 'generalization'
        ? 'triangle_outline'
        : toolId === 'message'
          ? 'triangle'
          : 'arrow',
    strokeStyle: dashed ? 'dashed' : 'solid',
    ...(caption
      ? { label: { text: caption, fontSize: 15, fontFamily: 2 } }
      : {}),
    ...(startId ? { start: { id: startId } } : {}),
    ...(endId ? { end: { id: endId } } : {}),
  };
}
/** x/y is the top-left corner. All text is ordinary Excalidraw text or bound labels. */
export function symbolSkeletons(
  toolId: string,
  x: number,
  y: number,
  label?: string,
): PracticeSkeleton[] {
  if (isPracticeConnector(toolId))
    return [connectorSkeleton(toolId, x, y, x + 220, y, label)];
  switch (toolId) {
    case 'actor':
      return grouped([
        shape('rectangle', x, y, 90, 150, undefined, {
          strokeColor: 'transparent',
        }),
        shape('ellipse', x + 30, y, 30, 30),
        line(x + 45, y + 30, [
          [0, 0],
          [0, 54],
        ]),
        line(x + 10, y + 51, [
          [0, 0],
          [70, 0],
        ]),
        line(x + 15, y + 120, [
          [0, 0],
          [30, -36],
          [60, 0],
        ]),
        text(x, y + 128, label ?? 'Actor', { width: 90, textAlign: 'center' }),
      ]);
    case 'use-case':
      return [shape('ellipse', x, y, 200, 90, label ?? 'Use case')];
    case 'system':
      return grouped([
        shape('rectangle', x, y, 480, 400),
        text(x + 16, y + 14, label ?? 'System'),
      ]);
    case 'initial':
      return [
        shape('ellipse', x, y, 26, 26, undefined, { backgroundColor: ink }),
      ];
    case 'final':
      return grouped([
        shape('ellipse', x, y, 36, 36),
        shape('ellipse', x + 7, y + 7, 22, 22, undefined, {
          backgroundColor: ink,
        }),
      ]);
    case 'action':
      return [
        shape('rectangle', x, y, 200, 70, label ?? 'Action', {
          roundness: { type: 3 },
        }),
      ];
    case 'decision':
      return [shape('diamond', x, y, 130, 100, label ?? 'Condition?')];
    case 'choice':
      return [shape('diamond', x, y, 50, 50)];
    case 'fork':
      return [
        shape('rectangle', x, y, 220, 10, undefined, { backgroundColor: ink }),
      ];
    case 'swimlane':
      return grouped([
        shape('rectangle', x, y, 280, 500),
        text(x + 14, y + 14, label ?? 'Responsibility'),
        line(x, y + 48, [
          [0, 0],
          [280, 0],
        ]),
      ]);
    case 'state':
      return [
        shape('rectangle', x, y, 200, 90, label ?? 'State', {
          roundness: { type: 3 },
        }),
      ];
    case 'participant':
      return grouped([
        shape('rectangle', x, y, 170, 60, label ?? 'Participant'),
        line(
          x + 85,
          y + 60,
          [
            [0, 0],
            [0, 400],
          ],
          { strokeStyle: 'dashed' },
        ),
      ]);
    case 'activation':
      return [
        shape('rectangle', x, y, 18, 180, undefined, {
          backgroundColor: '#ffffff',
        }),
      ];
    case 'loop-fragment':
      return grouped([
        shape('rectangle', x, y, 520, 240),
        shape('rectangle', x, y, 90, 34, label ?? 'loop'),
        text(x + 112, y + 9, '[condition]', { fontSize: 15 }),
      ]);
    case 'fragment':
      return grouped([
        shape('rectangle', x, y, 520, 240),
        shape('rectangle', x, y, 90, 34, label ?? 'alt', { fontSize: 16 }),
        text(x + 112, y + 9, '[condition]', { fontSize: 15 }),
        line(
          x,
          y + 125,
          [
            [0, 0],
            [520, 0],
          ],
          { strokeStyle: 'dashed' },
        ),
        text(x + 14, y + 136, '[else]', { fontSize: 15 }),
      ]);
    case 'component':
      return grouped([
        shape(
          'rectangle',
          x + 14,
          y,
          200,
          110,
          `«component»\n${label ?? 'Component'}`,
        ),
        shape('rectangle', x, y + 24, 28, 18, undefined, {
          backgroundColor: '#ffffff',
        }),
        shape('rectangle', x, y + 66, 28, 18, undefined, {
          backgroundColor: '#ffffff',
        }),
      ]);
    case 'provided-interface':
      return grouped([
        shape('ellipse', x + 54, y + 10, 28, 28),
        line(x, y + 24, [
          [0, 0],
          [54, 0],
        ]),
        text(x + 14, y + 48, label ?? 'Interface', { fontSize: 15 }),
      ]);
    case 'required-interface':
      return grouped([
        line(x, y + 24, [
          [0, 0],
          [54, 0],
        ]),
        line(x + 80, y + 4, [
          [0, 0],
          [-10, 3],
          [-18, 10],
          [-21, 20],
          [-18, 30],
          [-10, 37],
          [0, 40],
        ]),
        text(x + 14, y + 53, label ?? 'Interface', { fontSize: 15 }),
      ]);
    case 'port':
      return [
        shape('rectangle', x, y, 20, 20, undefined, {
          backgroundColor: '#ffffff',
        }),
      ];
    case 'device':
    case 'environment':
      return grouped([
        shape(
          'rectangle',
          x,
          y + 22,
          240,
          140,
          `«${toolId === 'device' ? 'device' : 'executionEnvironment'}»\n${label ?? (toolId === 'device' ? 'Server' : 'Runtime')}`,
        ),
        line(x, y + 22, [
          [0, 0],
          [26, -22],
          [266, -22],
          [240, 0],
        ]),
        line(x + 240, y + 22, [
          [0, 0],
          [26, -22],
          [26, 118],
          [0, 140],
        ]),
      ]);
    case 'artifact':
      return [
        shape(
          'rectangle',
          x,
          y,
          190,
          100,
          `«artifact»\n${label ?? 'application.jar'}`,
        ),
      ];
    case 'object':
      return grouped([
        shape('rectangle', x, y, 220, 110),
        text(x + 14, y + 14, label ?? 'object : Class'),
        line(x + 14, y + 37, [
          [0, 0],
          [190, 0],
        ]),
        line(x, y + 48, [
          [0, 0],
          [220, 0],
        ]),
        text(x + 14, y + 62, 'attribute = value', { fontSize: 16 }),
      ]);
    case 'package':
      return grouped([
        shape('rectangle', x, y + 28, 230, 140, label ?? 'Package'),
        shape('rectangle', x, y, 94, 28),
      ]);
    default:
      throw new Error(`Unknown UML tool: ${toolId}`);
  }
}
const titles: Record<PracticeDiagramKind, string> = {
  'use-case': 'Online checkout',
  activity: 'Order processing',
  state: 'Order lifecycle',
  sequence: 'Sign in',
  component: 'Shop components',
  deployment: 'Web deployment',
  object: 'Order instances',
  package: 'Application packages',
  communication: 'Checkout messages',
};
export function exampleTitle(kind: PracticeDiagramKind): string {
  return titles[kind];
}
/** Examples are new instances on every call, so they can be inserted repeatedly. */
export function exampleSkeletons(
  kind: PracticeDiagramKind,
  x = 100,
  y = 100,
): PracticeSkeleton[] {
  const elements: PracticeSkeleton[] = [];
  const add = (tool: string, px: number, py: number, label?: string) => {
    const parts = symbolSkeletons(tool, x + px, y + py, label);
    elements.push(...parts);
    return parts[0];
  };
  const edge = (
    tool: string,
    from: PracticeSkeleton,
    to: PracticeSkeleton,
    label?: string,
    vertical = false,
  ) => {
    const fw = from.width ?? 0,
      fh = from.height ?? 0,
      tw = to.width ?? 0,
      th = to.height ?? 0;
    const forward = vertical ? to.y >= from.y : to.x >= from.x;
    elements.push(
      connectorSkeleton(
        tool,
        vertical ? from.x + fw / 2 : from.x + (forward ? fw + 4 : -4),
        vertical ? from.y + (forward ? fh + 4 : -4) : from.y + fh / 2,
        vertical ? to.x + tw / 2 : to.x + (forward ? -4 : tw + 4),
        vertical ? to.y + (forward ? -4 : th + 4) : to.y + th / 2,
        label,
        from.id,
        to.id,
      ),
    );
  };
  switch (kind) {
    case 'use-case': {
      const boundary = add('system', 190, 0, 'Online shop');
      boundary.width = 610;
      boundary.height = 470;
      const customer = add('actor', 0, 145, 'Customer');
      const checkout = add('use-case', 260, 190, 'Checkout');
      const payment = add('use-case', 555, 190, 'Pay order');
      const coupon = add('use-case', 260, 45, 'Apply coupon');
      const browse = add('use-case', 260, 345, 'Browse products');
      edge('association', customer, checkout);
      edge('association', customer, browse);
      edge('include', checkout, payment);
      edge('extend', coupon, checkout, '«extend»\n[coupon entered]', true);
      break;
    }
    case 'activity': {
      const initial = add('initial', 307, 0);
      const submit = add('action', 220, 65, 'Submit order');
      const decision = add('decision', 255, 180, 'In stock?');
      const reject = add('action', 520, 195, 'Notify customer');
      const fork = add('fork', 210, 325);
      const charge = add('action', 50, 405, 'Charge payment');
      const reserve = add('action', 390, 405, 'Reserve stock');
      const join = add('fork', 210, 525);
      const ship = add('action', 220, 590, 'Ship order');
      const final = add('final', 302, 720);
      edge('flow', initial, submit, '', true);
      edge('flow', submit, decision, '', true);
      edge('flow', decision, reject, '[no]');
      edge('flow', decision, fork, '[yes]', true);
      edge('flow', fork, charge, '', true);
      edge('flow', fork, reserve, '', true);
      edge('flow', charge, join, '', true);
      edge('flow', reserve, join, '', true);
      edge('flow', join, ship, '', true);
      edge('flow', ship, final, '', true);
      const rejectedEnd = add('final', 602, 325);
      edge('flow', reject, rejectedEnd, '', true);
      break;
    }
    case 'state': {
      const initial = add('initial', 0, 32);
      const draft = add('state', 110, 0, 'Draft');
      const paid = add('state', 440, 0, 'Paid');
      const shipped = add('state', 770, 0, 'Shipped');
      const final = add('final', 1070, 27);
      const cancelled = add('state', 270, 220, 'Cancelled');
      edge('flow', initial, draft, '');
      edge('transition', draft, paid, 'pay [approved]');
      edge('transition', paid, shipped, 'dispatch / notify()');
      edge('transition', shipped, final, 'deliver');
      edge('transition', draft, cancelled, 'cancel', true);
      const cancelledEnd = add('final', 352, 390);
      edge('flow', cancelled, cancelledEnd, '', true);
      break;
    }
    case 'sequence': {
      add('participant', 0, 0, 'User');
      add('participant', 300, 0, 'Web app');
      add('participant', 650, 0, 'Auth service');
      const user = add('activation', 76, 110);
      user.height = 260;
      const web = add('activation', 376, 130);
      web.height = 200;
      const auth = add('activation', 726, 190);
      auth.height = 85;
      const message = (
        tool: string,
        sx: number,
        sy: number,
        ex: number,
        label: string,
        startId: string,
        endId: string,
      ) =>
        elements.push(
          connectorSkeleton(
            tool,
            x + sx,
            y + sy,
            x + ex,
            y + sy,
            label,
            startId,
            endId,
          ),
        );
      message(
        'message',
        98,
        145,
        372,
        'signIn(email, password)',
        user.id,
        web.id,
      );
      message('message', 398, 205, 722, 'authenticate()', web.id, auth.id);
      message('return', 722, 265, 398, 'token', auth.id, web.id);
      message('return', 372, 320, 98, 'show dashboard', web.id, user.id);
      break;
    }
    case 'component': {
      const ui = add('component', 0, 100, 'Web UI');
      const api = add('component', 350, 100, 'Order API');
      const payment = add('component', 710, 100, 'Payment service');
      const data = add('component', 350, 340, 'Order repository');
      edge('dependency', ui, api, 'HTTPS');
      edge('dependency', api, payment, 'payments');
      edge('dependency', api, data, 'persistence', true);
      add('provided-interface', 398, 30, 'IOrders');
      break;
    }
    case 'deployment': {
      const browser = add('device', 0, 0, 'Client');
      const server = add('device', 400, 0, 'Application server');
      const database = add('device', 800, 0, 'Database server');
      edge('communication-path', browser, server, 'HTTPS');
      edge('communication-path', server, database, 'SQL / TLS');
      const app = add('artifact', 425, 270, 'shop.war');
      edge('deploy', app, server, '«deploy»', true);
      break;
    }
    case 'object': {
      const customer = add('object', 0, 0, 'alice : Customer');
      const order = add('object', 360, 0, 'order42 : Order');
      const item = add('object', 360, 250, 'line1 : OrderItem');
      edge('link', customer, order, 'orders');
      edge('link', order, item, 'items', true);
      const values = elements.filter(
        (element) =>
          element.type === 'text' && element.text === 'attribute = value',
      );
      ['name = "Alice"', 'status = "paid"', 'quantity = 2'].forEach(
        (value, index) => {
          values[index].text = value;
        },
      );
      break;
    }
    case 'package': {
      const ui = add('package', 0, 0, 'presentation');
      const domain = add('package', 380, 0, 'domain');
      const infra = add('package', 760, 0, 'infrastructure');
      edge('import', ui, domain);
      edge('import', infra, domain);
      const common = add('package', 380, 300, 'shared');
      edge('import', domain, common, '«import»', true);
      break;
    }
    case 'communication': {
      const customer = add('object', 0, 0, 'customer : Customer');
      const checkout = add('object', 410, 0, 'checkout : Checkout');
      const payment = add('object', 410, 260, 'payment : Payment');
      const order = add('object', 0, 260, 'order : Order');
      edge('numbered-message', customer, checkout, '1: submitOrder()');
      edge('numbered-message', checkout, payment, '1.1: authorize()', true);
      edge('numbered-message', payment, order, '1.2: confirm()');
      edge('numbered-message', order, customer, '1.3: receipt()', true);
      break;
    }
  }
  return elements;
}
