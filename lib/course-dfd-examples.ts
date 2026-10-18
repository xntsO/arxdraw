import { e, graph, n } from './course-builders.ts';
import type { CourseEdge, CourseNode } from './course-builders.ts';
import { isNativeUmlMetadata } from './native-model-types.ts';
import type { PracticeSkeleton } from './practice.ts';

type Side = 'top' | 'right' | 'bottom' | 'left';
type Route = { exit: Side; enter: Side; via: [number, number][] };
type Flow = CourseEdge & { route?: Route };
type Example = { name: string; elements: PracticeSkeleton[] };

const flow = (from: string, to: string, name: string, route?: Route): Flow => ({
  ...e(from, to, 'data-flow', name),
  ...(route ? { route } : {}),
});
const process = (key: string, name: string, x: number, y: number) =>
  n(key, 'dfd-process', name, x, y);
const entity = (key: string, name: string, x: number, y: number) =>
  n(key, 'dfd-entity', name, x, y);
const store = (key: string, name: string, x: number, y: number) =>
  n(key, 'dfd-store', name, x, y);

function port(box: PracticeSkeleton, side: Side): [number, number] {
  const cx = box.x + (box.width ?? 0) / 2,
    cy = box.y + (box.height ?? 0) / 2;
  switch (side) {
    case 'top':
      return [cx, box.y - 5];
    case 'right':
      return [box.x + (box.width ?? 0) + 5, cy];
    case 'bottom':
      return [cx, box.y + (box.height ?? 0) + 5];
    case 'left':
      return [box.x - 5, cy];
  }
}

/** Keep opposite flows distinct and route long returns around the process rows. */
function drawing(nodes: CourseNode[], flows: Flow[]): PracticeSkeleton[] {
  const elements = graph(nodes, flows);
  const boxes = elements.filter((element) => {
    const data = element.customData;
    return (
      typeof data === 'object' &&
      data !== null &&
      'uml' in data &&
      isNativeUmlMetadata(data.uml) &&
      data.uml.role === 'node'
    );
  });
  const byKey = new Map(nodes.map((node, index) => [node.key, boxes[index]]));
  const arrows = elements.filter((element) => element.type === 'arrow');
  const pair = (item: Flow) => [item.from, item.to].sort().join('|');
  flows.forEach((item, index) => {
    const arrow = arrows[index],
      source = byKey.get(item.from),
      target = byKey.get(item.to);
    if (!arrow || !source || !target)
      throw new Error('Missing DFD flow or endpoint.');
    let points: [number, number][];
    if (item.route) {
      points = [
        port(source, item.route.exit),
        ...item.route.via,
        port(target, item.route.enter),
      ];
    } else {
      const siblings = flows.filter(
        (candidate) => !candidate.route && pair(candidate) === pair(item),
      );
      if (siblings.length < 2) return;
      const lane = siblings.indexOf(item) - (siblings.length - 1) / 2;
      const offset = lane * Math.min(28, 64 / siblings.length);
      const horizontal =
        Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
      const forward = horizontal ? target.x > source.x : target.y > source.y;
      const start = port(
        source,
        horizontal ? (forward ? 'right' : 'left') : forward ? 'bottom' : 'top',
      );
      const end = port(
        target,
        horizontal ? (forward ? 'left' : 'right') : forward ? 'top' : 'bottom',
      );
      points = horizontal
        ? [
            [start[0], start[1] + offset],
            [end[0], end[1] + offset],
          ]
        : [
            [start[0] + offset, start[1]],
            [end[0] + offset, end[1]],
          ];
    }
    const first = points[0];
    arrow.x = first[0];
    arrow.y = first[1];
    arrow.points = points.map(([x, y]) => [x - first[0], y - first[1]]);
    arrow.width =
      Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
    arrow.height =
      Math.max(...points.map(([, y]) => y)) -
      Math.min(...points.map(([, y]) => y));
  });
  return elements;
}

function context(
  system: string,
  user: string,
  userInputs: string[],
  userOutputs: string[],
  adminInputs: string[],
  adminOutputs: string[],
): Example {
  return {
    name: 'Level 0 (context)',
    elements: drawing(
      [
        entity('user', user, 40, 220),
        process('system', `0\n${system}`, 700, 200),
        entity('admin', 'Admin', 1400, 220),
      ],
      [
        ...userInputs.map((name) => flow('user', 'system', name)),
        ...userOutputs.map((name) => flow('system', 'user', name)),
        ...adminInputs.map((name) => flow('admin', 'system', name)),
        ...adminOutputs.map((name) => flow('system', 'admin', name)),
      ],
    ),
  };
}

function railway(): Example[] {
  const passenger = entity('passenger', 'Passenger', 40, 230);
  const admin = entity('admin', 'Admin', 2200, 750);
  const siblings = [
    process('cancel', '2.0\nCancel reservation', 500, 750),
    process('timetable', '3.0\nMaintain timetable', 1600, 750),
    process('report', '4.0\nReport bookings', 1050, 750),
    store('reservations', 'D1 Reservations', 1050, 440),
    store('trains', 'D2 Train timetable', 1600, 440),
  ];
  const common = [
    flow('passenger', 'cancel', 'Cancellation request'),
    flow('cancel', 'passenger', 'Cancellation confirmation', {
      exit: 'left',
      enter: 'bottom',
      via: [
        [300, 810],
        [130, 810],
      ],
    }),
    flow('reservations', 'cancel', 'Reservation details'),
    flow('cancel', 'reservations', 'Cancellation record'),
    flow('admin', 'timetable', 'Timetable update'),
    flow('timetable', 'trains', 'Published timetable'),
    flow('reservations', 'report', 'Booking history'),
    flow('report', 'admin', 'Reservation report'),
    flow('report', 'admin', 'Passenger list'),
  ];
  return [
    context(
      'Railway\nreservation',
      'Passenger',
      ['Reservation request', 'Cancellation request'],
      ['Ticket information', 'Cancellation confirmation'],
      ['Timetable update'],
      ['Reservation report', 'Passenger list'],
    ),
    {
      name: 'Level 1',
      elements: drawing(
        [
          passenger,
          process('reserve', '1.0\nReserve ticket', 500, 130),
          admin,
          ...siblings,
        ],
        [
          flow('passenger', 'reserve', 'Reservation request'),
          flow('reserve', 'passenger', 'Ticket information'),
          flow('trains', 'reserve', 'Train availability'),
          flow('reserve', 'reservations', 'Confirmed reservation'),
          ...common,
        ],
      ),
    },
    {
      name: 'Level 2 (whole system; expands 1.0)',
      elements: drawing(
        [
          passenger,
          process('validate', '1.1\nValidate journey', 500, 130),
          process('allocate', '1.2\nAllocate seat', 1050, 130),
          process('ticket', '1.3\nIssue ticket', 1600, 130),
          admin,
          ...siblings,
        ],
        [
          flow('passenger', 'validate', 'Reservation request'),
          flow('validate', 'allocate', 'Validated journey'),
          flow('trains', 'allocate', 'Train availability'),
          flow('allocate', 'reservations', 'Confirmed reservation'),
          flow('allocate', 'ticket', 'Ticket details'),
          flow('ticket', 'passenger', 'Ticket information', {
            exit: 'top',
            enter: 'top',
            via: [
              [1705, -80],
              [130, -80],
            ],
          }),
          ...common,
        ],
      ),
    },
  ];
}

function mobileShop(): Example[] {
  const customer = entity('customer', 'Customer', 40, 240);
  const admin = entity('admin', 'Admin', 2300, 720);
  const siblings = [
    process('register', '2.0\nRegister customer', 500, 740),
    process('stock', '3.0\nMaintain catalogue', 1700, 740),
    process('track', '4.0\nTrack order', 1100, 1040),
    store('customers', 'D1 Customers', 500, 1040),
    store('catalogue', 'D2 Mobile catalogue', 1700, 440),
    store('orders', 'D3 Orders', 1100, 740),
    store('tracking', 'D4 Tracking history', 1700, 1040),
  ];
  const common = [
    flow('customer', 'register', 'Registration details'),
    flow('register', 'customers', 'Customer record'),
    flow('register', 'admin', 'Customer list', {
      exit: 'bottom',
      enter: 'bottom',
      via: [
        [605, 1300],
        [2390, 1300],
      ],
    }),
    flow('admin', 'stock', 'Stock update'),
    flow('stock', 'catalogue', 'Catalogue record'),
    flow('admin', 'track', 'Tracking update', {
      exit: 'right',
      enter: 'bottom',
      via: [
        [2590, 760],
        [2590, 1460],
        [1205, 1460],
      ],
    }),
    flow('orders', 'track', 'Dispatch details'),
    flow('track', 'tracking', 'Tracking event'),
    flow('track', 'customer', 'Tracking number', {
      exit: 'left',
      enter: 'bottom',
      via: [
        [300, 1100],
        [130, 1100],
      ],
    }),
  ];
  return [
    context(
      'Online mobile\nshop',
      'Customer',
      ['Registration details', 'Cart selection', 'Checkout details'],
      ['Tracking number'],
      ['Stock update', 'Tracking update'],
      ['Customer list', 'Sales report'],
    ),
    {
      name: 'Level 1',
      elements: drawing(
        [
          customer,
          process('order', '1.0\nProcess order', 1100, 160),
          admin,
          ...siblings,
        ],
        [
          flow('customer', 'order', 'Cart selection'),
          flow('customer', 'order', 'Checkout details'),
          flow('customers', 'order', 'Customer profile'),
          flow('catalogue', 'order', 'Mobile availability'),
          flow('order', 'orders', 'Confirmed order'),
          flow('order', 'admin', 'Sales report', {
            exit: 'right',
            enter: 'top',
            via: [[2390, 220]],
          }),
          ...common,
        ],
      ),
    },
    {
      name: 'Level 2 (whole system; expands 1.0)',
      elements: drawing(
        [
          customer,
          process('cart', '1.1\nBuild cart', 500, 130),
          process('checkout', '1.2\nValidate checkout', 1100, 130),
          process('confirm', '1.3\nConfirm order', 1700, 130),
          admin,
          ...siblings,
        ],
        [
          flow('customer', 'cart', 'Cart selection'),
          flow('cart', 'checkout', 'Priced cart'),
          flow('customer', 'checkout', 'Checkout details', {
            exit: 'top',
            enter: 'top',
            via: [
              [130, -80],
              [1205, -80],
            ],
          }),
          flow('customers', 'checkout', 'Customer profile'),
          flow('catalogue', 'cart', 'Mobile availability', {
            exit: 'top',
            enter: 'bottom',
            via: [
              [1825, 350],
              [605, 350],
            ],
          }),
          flow('checkout', 'confirm', 'Validated order'),
          flow('confirm', 'orders', 'Confirmed order'),
          flow('confirm', 'admin', 'Sales report', {
            exit: 'right',
            enter: 'top',
            via: [[2390, 190]],
          }),
          ...common,
        ],
      ),
    },
  ];
}

function hotel(): Example[] {
  const guest = entity('guest', 'Guest', 40, 230);
  const admin = entity('admin', 'Admin', 2200, 750);
  const siblings = [
    process('cancel', '2.0\nCancel booking', 500, 750),
    process('rooms', '3.0\nMaintain rooms', 1600, 750),
    process('report', '4.0\nReport reservations', 1050, 750),
    store('bookings', 'D1 Reservations', 1050, 440),
    store('inventory', 'D2 Room inventory', 1600, 440),
  ];
  const common = [
    flow('guest', 'cancel', 'Cancellation form'),
    flow('cancel', 'guest', 'Cancellation confirmation', {
      exit: 'left',
      enter: 'bottom',
      via: [
        [300, 810],
        [130, 810],
      ],
    }),
    flow('bookings', 'cancel', 'Booking details'),
    flow('cancel', 'bookings', 'Cancellation record'),
    flow('admin', 'rooms', 'Hotel information'),
    flow('rooms', 'inventory', 'Room catalogue'),
    flow('bookings', 'report', 'Reservation history'),
    flow('report', 'admin', 'Reservation report'),
    flow('report', 'admin', 'Guest list'),
  ];
  return [
    context(
      'Hotel\nreservation',
      'Guest',
      ['Reservation form', 'Cancellation form'],
      ['Room confirmation', 'Cancellation confirmation'],
      ['Hotel information'],
      ['Reservation report', 'Guest list'],
    ),
    {
      name: 'Level 1',
      elements: drawing(
        [
          guest,
          process('reserve', '1.0\nReserve room', 500, 130),
          admin,
          ...siblings,
        ],
        [
          flow('guest', 'reserve', 'Reservation form'),
          flow('reserve', 'guest', 'Room confirmation'),
          flow('inventory', 'reserve', 'Room availability'),
          flow('reserve', 'bookings', 'Confirmed booking'),
          ...common,
        ],
      ),
    },
    {
      name: 'Level 2 (whole system; expands 1.0)',
      elements: drawing(
        [
          guest,
          process('validate', '1.1\nValidate request', 500, 130),
          process('select', '1.2\nSelect room', 1050, 130),
          process('confirm', '1.3\nConfirm booking', 1600, 130),
          admin,
          ...siblings,
        ],
        [
          flow('guest', 'validate', 'Reservation form'),
          flow('validate', 'select', 'Validated stay'),
          flow('inventory', 'select', 'Room availability'),
          flow('select', 'confirm', 'Selected room'),
          flow('confirm', 'bookings', 'Confirmed booking'),
          flow('confirm', 'guest', 'Room confirmation', {
            exit: 'top',
            enter: 'top',
            via: [
              [1705, -80],
              [130, -80],
            ],
          }),
          ...common,
        ],
      ),
    },
  ];
}

/** Original editable answers, with an unchanged external boundary across levels. */
export function dfdExample(
  number: string,
): { name: string; elements: PracticeSkeleton[] }[] {
  switch (number) {
    case '28':
      return railway();
    case '29':
      return mobileShop();
    case '30':
      return hotel();
    default:
      throw new Error(`Unknown DFD lab: ${number}.`);
  }
}
