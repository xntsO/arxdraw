import { e, graph, n } from './course-builders.ts';
import type { CourseEdge, CourseNode } from './course-builders.ts';
import type { PracticeSkeleton } from './practice.ts';

export function structureExample(number: string): PracticeSkeleton[] {
  switch (number) {
    case '9':
      return graph(
        [
          n(
            'customer',
            'object',
            'ali : Customer',
            450,
            60,
            'id = C001\nname = Ali\nphone = 0550123456',
          ),
          n(
            'one',
            'object',
            'order1 : Order',
            80,
            370,
            'number = 001\namount = 500',
          ),
          n(
            'two',
            'object',
            'order2 : Order',
            450,
            370,
            'number = 002\namount = 478',
          ),
          n(
            'three',
            'object',
            'order3 : Order',
            820,
            370,
            'number = 003\namount = 300',
          ),
        ],
        [
          e('customer', 'one', 'link', 'places'),
          e('customer', 'two', 'link', 'places'),
          e('customer', 'three', 'link', 'places'),
        ],
      );
    case '10':
      return graph(
        [
          n(
            'student',
            'object',
            'sara : Student',
            500,
            50,
            'id = S001\nprogram = Computer Science\nyear = 3',
          ),
          n(
            'course',
            'object',
            'se : Course',
            100,
            380,
            'code = COMP371\ncredits = 3',
          ),
          n(
            'room',
            'object',
            'lab4 : Classroom',
            500,
            380,
            'capacity = 30\nbuilding = Computing',
          ),
          n(
            'library',
            'object',
            'central : Library',
            900,
            380,
            'name = College Library',
          ),
          n(
            'prof',
            'object',
            'instructor : Professor',
            100,
            710,
            'id = P012\ndepartment = CS',
          ),
          n(
            'result',
            'object',
            'exam1 : Result',
            500,
            710,
            'mark = 85\ngrade = B+',
          ),
          n(
            'book',
            'object',
            'copy7 : Book',
            900,
            710,
            'title = Software Engineering\nstatus = available',
          ),
        ],
        [
          e('student', 'course', 'link', 'enrolled in'),
          e('course', 'room', 'link', 'scheduled in'),
          e('student', 'library', 'link', 'member of'),
          e('course', 'prof', 'link', 'taught by'),
          e('student', 'result', 'link', 'receives'),
          e('library', 'book', 'link', 'holds'),
        ],
      );
    case '15':
      return graph(
        [
          n('start', 'initial', 'Start', 70, 110),
          n('in', 'state', 'Logged in', 200, 80),
          n('browse', 'state', 'Browsing books', 540, 80),
          n('detail', 'state', 'Viewing book details', 880, 80),
          n('checkout', 'state', 'Checking out', 880, 370),
          n('pay', 'state', 'Paying', 540, 370),
          n('out', 'state', 'Logged out', 200, 650),
          n('end', 'final', 'Finished', 280, 900),
        ],
        [
          e('start', 'in', 'transition', 'login'),
          e('in', 'browse', 'transition', 'browse'),
          e('browse', 'detail', 'transition', 'select book'),
          e('detail', 'checkout', 'transition', 'add to cart'),
          e('checkout', 'pay', 'transition', 'confirm order'),
          e('pay', 'browse', 'transition', 'payment approved'),
          e('in', 'out', 'transition', 'logout'),
          e('browse', 'out', 'transition', 'logout'),
          e('out', 'end', 'transition', 'close session'),
        ],
      );
    case '16':
      return graph(
        [
          n('start', 'initial', 'Start', 70, 105),
          n('on', 'state', 'Toaster on', 200, 70),
          n('heat', 'state', 'Heating', 560, 70),
          n('idle', 'state', 'Idle\ndo / turn heater off', 560, 370),
          n('off', 'state', 'Shut down', 960, 70),
          n('end', 'final', 'Finished', 1290, 100),
        ],
        [
          e('start', 'on', 'transition', 'power on'),
          e('on', 'heat', 'transition', 'start'),
          e('heat', 'idle', 'transition', 'temperature [upper limit]'),
          e('idle', 'heat', 'transition', 'temperature [lower limit]'),
          e('heat', 'off', 'transition', 'shutdown'),
          e('idle', 'off', 'transition', 'shutdown'),
          e('off', 'end', 'transition', 'power off'),
        ],
      );
    case '17':
      return graph(
        [
          n('start', 'initial', 'Start', 417, 30),
          n('request', 'state', 'Book requested', 330, 120),
          n('stock', 'choice', 'Availability', 405, 310),
          n('membership', 'state', 'Checking membership', 100, 450),
          n('missing', 'state', 'Waiting for stock', 700, 450),
          n('member', 'choice', 'Membership', 175, 650),
          n('register', 'state', 'Registering reader', 50, 820),
          n('issue', 'state', 'Issuing book', 400, 820),
          n('update', 'state', 'Updating book status', 400, 1060),
          n('end', 'final', 'Loan recorded', 482, 1260),
          n('notify', 'state', 'Notifying reader', 800, 730),
          n('end2', 'final', 'Waitlist recorded', 882, 960),
        ],
        [
          e('start', 'request', 'transition', 'request'),
          e('request', 'stock', 'transition', 'check availability'),
          e('stock', 'membership', 'transition', '[available]'),
          e('stock', 'missing', 'transition', '[unavailable]'),
          e('membership', 'member', 'transition', 'check reader'),
          e('member', 'issue', 'transition', '[member]'),
          e('member', 'register', 'transition', '[not member]'),
          e('register', 'issue', 'transition', 'registration complete'),
          e('issue', 'update', 'transition', 'issue successful'),
          e('update', 'end', 'transition', 'save'),
          e('missing', 'notify', 'transition', 'stock update'),
          e('notify', 'end2', 'transition', 'notification sent'),
        ],
      );
    case '18':
      return graph(
        [
          n('start', 'initial', 'Start', 417, 30),
          n('card', 'action', 'Insert card', 330, 120),
          n('pin', 'action', 'Enter PIN', 330, 290),
          n('valid', 'decision', 'PIN valid?', 365, 460),
          n('choose', 'action', 'Select transaction', 330, 650),
          n('perform', 'action', 'Perform transaction', 330, 830),
          n('again', 'decision', 'Another transaction?', 365, 1010),
          n('return', 'action', 'Take card', 330, 1210),
          n('end', 'final', 'Finished', 412, 1400),
        ],
        [
          e('start', 'card', 'flow'),
          e('card', 'pin', 'flow'),
          e('pin', 'valid', 'flow'),
          e('valid', 'pin', 'flow', '[no]'),
          e('valid', 'choose', 'flow', '[yes]'),
          e('choose', 'perform', 'flow'),
          e('perform', 'again', 'flow'),
          e('again', 'choose', 'flow', '[yes]'),
          e('again', 'return', 'flow', '[no]'),
          e('return', 'end', 'flow'),
        ],
      );
    case '19':
      return graph(
        [
          n('start', 'initial', 'Start', 357, 30),
          n('open', 'action', 'Open word processor', 270, 120),
          n('create', 'action', 'Create document', 270, 280),
          n('type', 'action', 'Type content', 270, 440),
          n('graphics', 'decision', 'Graphics needed?', 305, 620),
          n('draw', 'action', 'Edit graphics', 700, 640),
          n('table', 'decision', 'Table needed?', 305, 840),
          n('sheet', 'action', 'Edit table', 700, 860),
          n('save', 'action', 'Save document', 270, 1070),
          n('print', 'action', 'Print document', 270, 1240),
          n('end', 'final', 'Finished', 352, 1420),
        ],
        [
          e('start', 'open', 'flow'),
          e('open', 'create', 'flow'),
          e('create', 'type', 'flow'),
          e('type', 'graphics', 'flow'),
          e('graphics', 'draw', 'flow', '[yes]'),
          e('graphics', 'table', 'flow', '[no]'),
          e('draw', 'table', 'flow'),
          e('table', 'sheet', 'flow', '[yes]'),
          e('table', 'save', 'flow', '[no]'),
          e('sheet', 'save', 'flow'),
          e('save', 'print', 'flow'),
          e('print', 'end', 'flow'),
        ],
      );
    case '20':
      return graph(
        [
          n('start', 'initial', 'Start', 487, 30),
          n('receive', 'action', 'Receive order', 400, 120),
          n('fork', 'fork', 'Parallel work', 390, 300),
          n('fill', 'action', 'Fill order', 140, 420),
          n('invoice', 'action', 'Send invoice', 740, 420),
          n('rush', 'decision', 'Rush order?', 175, 610),
          n('fast', 'action', 'Arrange overnight delivery', 20, 820),
          n('regular', 'action', 'Arrange regular delivery', 370, 820),
          n('payment', 'action', 'Receive payment', 740, 820),
          n('merge', 'choice', 'Delivery merge', 225, 1030),
          n('join', 'fork', 'Synchronization', 390, 1160),
          n('end', 'final', 'Fulfilled', 482, 1300),
        ],
        [
          e('start', 'receive', 'flow'),
          e('receive', 'fork', 'flow'),
          e('fork', 'fill', 'flow'),
          e('fork', 'invoice', 'flow'),
          e('fill', 'rush', 'flow'),
          e('rush', 'fast', 'flow', '[urgent]'),
          e('rush', 'regular', 'flow', '[else]'),
          e('fast', 'merge', 'flow'),
          e('regular', 'merge', 'flow'),
          e('invoice', 'payment', 'flow'),
          e('merge', 'join', 'flow'),
          e('payment', 'join', 'flow'),
          e('join', 'end', 'flow'),
        ],
      );
    case '21':
      return graph(
        [
          n('person', 'actor', 'User', 40, 180),
          n(
            'pc',
            'object',
            'workstation : Computer',
            290,
            180,
            'file = report.pdf',
          ),
          n(
            'server',
            'object',
            'server : PrintServer',
            690,
            180,
            'status = ready',
          ),
          n('print', 'object', 'printer : Printer', 1080, 30, 'status = idle'),
          n('queue', 'object', 'jobs : PrintQueue', 1080, 400, 'pending = 2'),
        ],
        [
          e('person', 'pc', 'numbered-message', '1: print(file)'),
          e('pc', 'server', 'numbered-message', '2: submit(file)'),
          e('server', 'print', 'numbered-message', '3: [free] print(file)'),
          e('server', 'queue', 'numbered-message', '3: [busy] enqueue(file)'),
          e('queue', 'print', 'numbered-message', '4: [free] printNext()'),
        ],
      );
    case '22':
      return graph(
        [
          n('user', 'actor', 'User', 40, 170),
          n(
            'ticket',
            'object',
            'desk : TicketSystem',
            320,
            140,
            'status = open',
          ),
          n(
            'support',
            'object',
            'team : Support',
            740,
            140,
            'queue = assigned',
          ),
          n(
            'records',
            'object',
            'records : TicketStore',
            1130,
            140,
            'ticket = T001',
          ),
          n(
            'feedback',
            'object',
            'survey : FeedbackService',
            740,
            480,
            'rating = pending',
          ),
        ],
        [
          e('user', 'ticket', 'numbered-message', '1: reportIssue()'),
          e('ticket', 'support', 'numbered-message', '2: assignTicket()'),
          e('support', 'records', 'numbered-message', '3: saveResolution()'),
          e('support', 'ticket', 'numbered-message', '4: resolveTicket()'),
          e('ticket', 'user', 'numbered-message', '5: notifyResolution()'),
          e('support', 'feedback', 'numbered-message', '6: requestFeedback()'),
        ],
      );
    case '23':
      return graph(
        [
          n('staff', 'object', 'desk : Librarian', 530, 340, 'name = Amal'),
          n(
            'member',
            'object',
            'reader : MemberRecord',
            1040,
            100,
            'id = M001',
          ),
          n('book', 'object', 'copy : Book', 1040, 620, 'status = on loan'),
          n('txn', 'object', 'loan : Transaction', 60, 100, 'due = 2027-03-12'),
          n('bill', 'object', 'fine : Bill', 60, 620, 'amount = 10'),
        ],
        [
          e('staff', 'member', 'numbered-message', '1: validateMember()'),
          e('staff', 'txn', 'numbered-message', '2: getLoan()'),
          e('staff', 'book', 'numbered-message', '3: checkBook()'),
          e('staff', 'staff', 'numbered-message', '4: calculateFine()'),
          e('staff', 'bill', 'numbered-message', '5: createFine()'),
          e('bill', 'staff', 'numbered-message', '6: finePaid'),
          e('staff', 'book', 'numbered-message', '7: updateStatus()'),
          e('staff', 'member', 'numbered-message', '8: updateRecord()'),
        ],
      );
    case '24':
      return componentGraph(
        ['Admissions portal', 'Registration', 'Student affairs', 'Book bank'],
        [
          [0, 1, 'IRegistration'],
          [1, 2, 'IStudentRecord'],
          [2, 3, 'IBookAccess'],
        ],
        'Applicant',
      );
    case '25':
      return componentGraph(
        ['Storefront', 'Order service', 'Persistence', 'Security'],
        [
          [0, 1, 'IOrders'],
          [1, 2, 'IOrderData'],
          [0, 3, 'IAuthentication'],
        ],
        'Customer',
      );
    case '26':
      return componentGraph(
        [
          'Storefront',
          'Order processor',
          'Shipping',
          'Customer service',
          'Analytics',
        ],
        [
          [0, 1, 'IOrders'],
          [1, 2, 'IShipping'],
          [3, 1, 'IOrderStatus'],
          [1, 4, 'IOrderEvents'],
        ],
        'Customer',
      );
    case '27':
      return componentGraph(
        [
          'Kiosk interface',
          'Ticket seller',
          'Ticket inventory',
          'Card payments',
          'Clerk interface',
        ],
        [
          [0, 1, 'ITicketSales'],
          [1, 2, 'IAvailability'],
          [1, 3, 'ICharge'],
          [4, 1, 'ITicketSales'],
        ],
        'Customer',
        'Clerk',
      );
    default:
      throw new Error(`No structure example for lab ${number}.`);
  }
}

function componentGraph(
  names: string[],
  dependencies: [number, number, string][],
  actor: string,
  secondActor?: string,
): PracticeSkeleton[] {
  type Point = [number, number];
  type Direction = 'right' | 'left' | 'down';
  type Contract = {
    root: Point;
    direction: Direction;
    consumerPort?: Point;
    ownerPort?: Point;
    before?: Point[];
    after?: Point[];
  };
  const registration = names[0] === 'Admissions portal';
  const shopping = names[1] === 'Order service';
  const ticketing = names[1] === 'Ticket seller';
  // The chain folds once for registration. Shopping branches downward.
  // The two larger systems put their shared service between four clients.
  const positions: Point[] = registration
    ? [
        [300, 80],
        [1000, 80],
        [1000, 620],
        [300, 620],
      ]
    : shopping
      ? [
          [300, 80],
          [1000, 80],
          [1700, 80],
          [300, 620],
        ]
      : ticketing
        ? [
            [300, 80],
            [1000, 365],
            [1700, 80],
            [1700, 650],
            [300, 650],
          ]
        : [
            [300, 80],
            [1000, 365],
            [1700, 80],
            [300, 650],
            [1700, 650],
          ];
  const contracts: Contract[] = registration
    ? [
        { root: [550, 135], direction: 'right' },
        { root: [1114, 270], direction: 'down' },
        { root: [950, 675], direction: 'left' },
      ]
    : shopping
      ? [
          { root: [550, 135], direction: 'right' },
          { root: [1250, 135], direction: 'right' },
          { root: [414, 270], direction: 'down' },
        ]
      : [
          {
            root: [550, 135],
            direction: 'right',
            ownerPort: [1009, 395],
            after: [
              [900, 135],
              [900, 395],
            ],
          },
          {
            root: [1350, 135],
            direction: 'right',
            consumerPort: [1219, 395],
            before: [
              [1280, 395],
              [1280, 135],
            ],
          },
          ...(ticketing
            ? ([
                {
                  root: [1350, 705],
                  direction: 'right',
                  consumerPort: [1219, 445],
                  before: [
                    [1280, 445],
                    [1280, 705],
                  ],
                },
                {
                  root: [550, 705],
                  direction: 'right',
                  ownerPort: [1009, 445],
                  after: [
                    [900, 705],
                    [900, 445],
                  ],
                },
              ] satisfies Contract[])
            : ([
                {
                  root: [550, 705],
                  direction: 'right',
                  ownerPort: [1009, 445],
                  after: [
                    [900, 705],
                    [900, 445],
                  ],
                },
                {
                  root: [1350, 705],
                  direction: 'right',
                  consumerPort: [1219, 445],
                  before: [
                    [1280, 445],
                    [1280, 705],
                  ],
                },
              ] satisfies Contract[])),
        ];
  const nodes: CourseNode[] = names.map((name, i) => {
    const position = positions[i];
    if (!position) throw new Error('Missing component position.');
    return n(`c${i}`, 'component', name, ...position);
  });
  const edges: CourseEdge[] = [];
  // Each contract retains its consumer/socket, socket/ball and ball/provider
  // edges. The symbols sit on that path, beside the components they describe.
  dependencies.forEach(([from, to, name], i) => {
    const contract = contracts[i];
    if (!contract || !names[from] || !names[to])
      throw new Error('Invalid component contract.');
    const [x, y] = contract.root;
    nodes.push(
      n(
        `required${i}`,
        'required-interface',
        `${name}\nfor ${names[from]}`,
        x,
        y - 24,
      ),
      n(
        `provided${i}`,
        'provided-interface',
        `${name}\nfrom ${names[to]}\nto ${names[from]}`,
        x + 200,
        y - 24,
      ),
    );
    edges.push(
      e(`c${from}`, `required${i}`, 'assembly'),
      e(`required${i}`, `provided${i}`, 'assembly'),
      e(`provided${i}`, `c${to}`, 'assembly'),
    );
  });
  nodes.push(n('actor', 'actor', actor, 60, 60));
  edges.push(e('actor', 'c0', 'association'));
  if (secondActor) {
    nodes.push(n('clerk', 'actor', secondActor, 60, 630));
    edges.push(e('clerk', `c${names.length - 1}`, 'association'));
  }
  if (registration) {
    nodes.push(
      n(
        'note',
        'note',
        'Registration assigns\na unique student ID.',
        1000,
        -200,
      ),
    );
    edges.push(e('note', 'c1', 'note-link'));
  }
  const elements = graph(nodes, edges);
  const boxes = elements.filter((element) => {
    const data = element.customData;
    if (typeof data !== 'object' || data === null || !('uml' in data))
      return false;
    const uml = data.uml;
    return (
      typeof uml === 'object' &&
      uml !== null &&
      'role' in uml &&
      uml.role === 'node'
    );
  });
  const byKey = new Map(nodes.map((node, i) => [node.key, boxes[i]]));
  const arrows = elements.filter((element) => element.type === 'arrow');
  const port = (
    box: PracticeSkeleton,
    direction: Direction,
    end: boolean,
  ): Point => {
    const w = box.width ?? 0,
      h = box.height ?? 0;
    if (direction === 'down')
      return [box.x + w / 2, box.y + (end ? -5 : h + 5)];
    const right = direction === 'right' ? !end : end;
    return [box.x + (right ? w + 5 : -5), box.y + h / 2];
  };
  const route = (arrow: PracticeSkeleton, points: Point[]) => {
    const first = points[0];
    if (!first) throw new Error('A component connection needs a route.');
    arrow.x = first[0];
    arrow.y = first[1];
    arrow.points = points.map(([x, y]) => [x - first[0], y - first[1]]);
    arrow.width =
      Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
    arrow.height =
      Math.max(...points.map(([, y]) => y)) -
      Math.min(...points.map(([, y]) => y));
  };
  contracts.forEach((contract, i) => {
    const [from, to] = dependencies[i];
    const consumer = byKey.get(`c${from}`),
      owner = byKey.get(`c${to}`);
    const required = byKey.get(`required${i}`),
      provided = byKey.get(`provided${i}`);
    if (!consumer || !owner || !required || !provided)
      throw new Error('Missing component interface.');
    required.width = 90;
    required.height = 48;
    const orient = (box: PracticeSkeleton, providedSymbol: boolean) => {
      const group = box.groupIds?.[0];
      const originalX = contract.root[0] + (providedSymbol ? 200 : 0);
      const originalY = contract.root[1] - 24;
      const map = (x: number, y: number): Point => {
        const localX = providedSymbol
          ? 200 + 82 - (x - originalX)
          : x - originalX;
        const localY = y - originalY - 24;
        const [rx, ry] = contract.root;
        if (contract.direction === 'left') return [rx - localX, ry + localY];
        if (contract.direction === 'down') return [rx - localY, ry + localX];
        return [rx + localX, ry + localY];
      };
      for (const part of elements.filter(
        (item) => group && item.groupIds?.includes(group),
      )) {
        if (part.type === 'text') {
          const [rx, ry] = contract.root;
          part.x =
            contract.direction === 'down'
              ? rx + 40
              : contract.direction === 'left'
                ? rx - (providedSymbol ? 350 : 150)
                : rx + (providedSymbol ? 180 : 5);
          part.y =
            contract.direction === 'down'
              ? ry + (providedSymbol ? 210 : 30)
              : ry + 65;
        } else if (part.points) {
          const points = part.points.map(([x, y]) =>
            map(part.x + x, part.y + y),
          );
          route(part, points);
        } else {
          const [ax, ay] = map(part.x, part.y);
          const [bx, by] = map(
            part.x + (part.width ?? 0),
            part.y + (part.height ?? 0),
          );
          part.x = Math.min(ax, bx);
          part.y = Math.min(ay, by);
          part.width = Math.abs(bx - ax);
          part.height = Math.abs(by - ay);
        }
      }
    };
    orient(required, false);
    orient(provided, true);
    const incoming = arrows[i * 3],
      assembly = arrows[i * 3 + 1],
      outgoing = arrows[i * 3 + 2];
    if (!incoming || !assembly || !outgoing)
      throw new Error('Missing component connection.');
    route(incoming, [
      contract.consumerPort ?? port(consumer, contract.direction, false),
      ...(contract.before ?? []),
      port(required, contract.direction, true),
    ]);
    route(assembly, [
      port(required, contract.direction, false),
      port(provided, contract.direction, true),
    ]);
    route(outgoing, [
      port(provided, contract.direction, false),
      ...(contract.after ?? []),
      contract.ownerPort ?? port(owner, contract.direction, true),
    ]);
  });
  return elements;
}
