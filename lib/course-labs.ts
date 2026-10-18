import type { DiagramKind } from './model.ts';

export type CourseLab = {
  id: string;
  number: string;
  title: string;
  kind: DiagramKind;
  page: number;
  practice: boolean;
  objectives: string[];
  checklist: string[];
};

const checks: Partial<Record<DiagramKind, string[]>> = {
  'use-case': [
    'Keep actors outside the system boundary.',
    'Name use cases as goals or actions.',
    'Connect actors only to the use cases they participate in.',
  ],
  class: [
    'Separate class names, attributes and operations.',
    'Point generalization toward the parent class.',
    'Place aggregation/composition diamonds at the whole; check multiplicities.',
  ],
  object: [
    'Use an underlined instance : Class header.',
    'Show concrete slot values rather than attribute types.',
    'Connect instances with links.',
  ],
  sequence: [
    'Read time from top to bottom on participant lifelines.',
    'Distinguish calls, replies and activations.',
    'Check each message sender, receiver and order.',
  ],
  state: [
    'Use an initial node and reachable states.',
    'Label transitions with events and guards where needed.',
    'Final nodes must have no outgoing transitions.',
  ],
  activity: [
    'Connect actions in execution order.',
    'Label alternative branches with guards.',
    'Use fork/join bars for concurrent paths and reconnect branches.',
  ],
  communication: [
    'Show objects and the links they communicate over.',
    'Number messages to make their ordering explicit.',
    'Check message direction and any branch conditions.',
  ],
  component: [
    'Name components by their responsibility.',
    'Distinguish provided interfaces from required interfaces.',
    'Check dependency direction and connected interface names.',
  ],
  'data-flow': [
    'Use processes, external entities, data stores and named one-way data flows.',
    'Every data flow must touch a process; never connect two stores or two external entities directly.',
    'Compare levels manually: preserve external inputs/outputs and number decomposed processes consistently.',
  ],
};

function lab(
  number: string,
  title: string,
  kind: DiagramKind,
  page: number,
  objective: string,
  practice = false,
): CourseLab {
  return {
    id: `comp371-${number.toLowerCase()}`,
    number,
    title,
    kind,
    page,
    practice,
    objectives: [
      objective,
      kind === 'data-flow'
        ? 'Build separate context/level 0, level 1 and level 2 views.'
        : 'Build the diagram from a blank canvas, then compare it with the editable worked example.',
    ],
    checklist: [
      ...(checks[kind] ?? []),
      'Save a .arxdraw copy and export the diagram image for review.',
    ],
  };
}

/** Exercise numbers follow the supplied 2026–27 manual, which skips number 13. */
export const courseLabs: readonly CourseLab[] = [
  lab(
    '1',
    'Banking operations',
    'use-case',
    4,
    'Model the customer goals for a banking service.',
  ),
  lab(
    '2',
    'Air-ticket booking',
    'use-case',
    6,
    'Separate customer, airline staff and payment-system responsibilities.',
  ),
  lab(
    '3',
    'Online shopping',
    'use-case',
    8,
    'Model browsing and purchasing alongside catalog administration.',
  ),
  lab(
    '4',
    'Online ordering',
    'use-case',
    9,
    'Show customer ordering and staff fulfillment goals.',
  ),
  lab(
    'UC-P1',
    'JU student academic portal',
    'use-case',
    9,
    'Model student access to registration, schedules, grades and academic records.',
    true,
  ),
  lab(
    'UC-P2',
    'Shared file storage',
    'use-case',
    9,
    'Model storing, retrieving and sharing files with a cloud service.',
    true,
  ),
  lab(
    'UC-P3',
    'Digital library',
    'use-case',
    9,
    'Model reader access to search, borrowing and digital resources.',
    true,
  ),
  lab(
    '5',
    'Geometrical shapes',
    'class',
    11,
    'Use generalization for two-dimensional and three-dimensional shapes.',
  ),
  lab(
    '6',
    'Building structure',
    'class',
    12,
    'Distinguish furniture aggregation from room composition and specialize both.',
  ),
  lab(
    '7',
    'Banking system',
    'class',
    13,
    'Model accounts, customers, transactions and account specializations.',
  ),
  lab(
    '8',
    'Hotel management',
    'class',
    14,
    'Model rooms, guests, bookings and staff responsibilities.',
  ),
  lab(
    'CL-P1',
    'Vehicle company',
    'class',
    14,
    'Model cars and jeeps, replaceable parts, technicians and inspections.',
    true,
  ),
  lab(
    'CL-P2',
    'Library management',
    'class',
    14,
    'Specialize book and reader types and record the course-book borrowing constraint.',
    true,
  ),
  lab(
    '9',
    'Customer and orders',
    'object',
    15,
    'Show one customer and concrete order instances with slot values.',
  ),
  lab(
    '10',
    'College management',
    'object',
    16,
    'Show a consistent snapshot of student, course, professor and college records.',
  ),
  lab(
    '11',
    'Restaurant food order',
    'sequence',
    17,
    'Order the interactions among customer, waiter, chef and cashier.',
  ),
  lab(
    '12',
    'Online examination',
    'sequence',
    18,
    'Show exam preparation, invitation, submission and results in time order.',
  ),
  lab(
    '14',
    'Payment transaction',
    'sequence',
    19,
    'Show duplicate-payment checking, status lookup, a self-call and replies.',
  ),
  lab(
    'SQ-P1',
    'Mobile shopping',
    'sequence',
    19,
    'Trace checkout through the mobile app, order service and payment service.',
    true,
  ),
  lab(
    'SQ-P2',
    'Library book loan',
    'sequence',
    19,
    'Trace membership validation, availability checking and loan recording.',
    true,
  ),
  lab(
    'SQ-P3',
    'Graduation-project registration',
    'sequence',
    19,
    'Trace a proposal from student to project committee and supervisor.',
    true,
  ),
  lab(
    '15',
    'Online bookstore lifecycle',
    'state',
    20,
    'Show browsing, checkout, payment and logout states.',
  ),
  lab(
    '16',
    'Toaster lifecycle',
    'state',
    21,
    'Model heating, idle thresholds and shutdown with event labels.',
  ),
  lab(
    '17',
    'Library borrowing lifecycle',
    'state',
    22,
    'Model availability and membership alternatives before issuing a book.',
  ),
  lab(
    '18',
    'ATM workflow',
    'activity',
    23,
    'Show PIN validation, transactions, repetition and card return.',
  ),
  lab(
    '19',
    'Document creation workflow',
    'activity',
    24,
    'Show optional graphics and table editing before saving and printing.',
  ),
  lab(
    '20',
    'Order-processing workflow',
    'activity',
    25,
    'Run delivery preparation and payment collection concurrently.',
  ),
  lab(
    '21',
    'Shared printer messages',
    'communication',
    26,
    'Route numbered print requests directly or through a queue.',
  ),
  lab(
    '22',
    'Ticket-support messages',
    'communication',
    27,
    'Trace an issue between the user, ticket system, support and records.',
  ),
  lab(
    '23',
    'Library messages',
    'communication',
    27,
    'Number membership, issue, fine and record-update interactions.',
  ),
  lab(
    '24',
    'Student-registration components',
    'component',
    28,
    'Separate admissions, registration, student affairs and book-bank responsibilities.',
  ),
  lab(
    '25',
    'Shopping components',
    'component',
    28,
    'Connect storefront, customer, order, persistence and security services.',
  ),
  lab(
    '26',
    'Order-processing components',
    'component',
    29,
    'Connect storefront, order processing, shipping, service and analytics interfaces.',
  ),
  lab(
    '27',
    'Ticket-selling components',
    'component',
    29,
    'Connect kiosk and clerk interfaces to ticket sales, inventory and payment services.',
  ),
  lab(
    '28',
    'Railway-reservation data flows',
    'data-flow',
    33,
    'Decompose inquiry, reservation, cancellation and ticket generation.',
  ),
  lab(
    '29',
    'Mobile-shop data flows',
    'data-flow',
    35,
    'Decompose customer registration, catalog, ordering and tracking.',
  ),
  lab(
    '30',
    'Hotel-reservation data flows',
    'data-flow',
    37,
    'Decompose room search, booking, cancellation and confirmation.',
  ),
];

export function courseLab(id: string): CourseLab {
  const item = courseLabs.find((entry) => entry.id === id);
  if (!item) throw new Error('Unknown COMP371 exercise.');
  return item;
}
