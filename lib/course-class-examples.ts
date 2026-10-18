import { c, r, classBlueprint } from './course-builders.ts';
import type { CourseBlueprint } from './course-builders.ts';
import type { CourseLab } from './course-labs.ts';

export function courseClassExample(
  lab: CourseLab,
  blank: boolean,
): CourseBlueprint {
  const title = `${lab.number}. ${lab.title}`;
  switch (lab.number) {
    case '5':
      return classBlueprint(
        title,
        [
          {
            ...c(
              'shape',
              'Shape',
              650,
              70,
              '- caption: String',
              '+ draw(): void\n+ scale(factor: double): void\n+ move(x: double, y: double): void',
            ),
            kind: 'abstract',
          },
          {
            ...c('2d', 'Shape2D', 280, 370, '- area: double'),
            kind: 'abstract',
          },
          {
            ...c('3d', 'Shape3D', 1020, 370, '- volume: double'),
            kind: 'abstract',
          },
          c(
            'triangle',
            'Triangle',
            50,
            650,
            '- sideA: double\n- sideB: double\n- sideC: double',
          ),
          c('rect', 'Rectangle', 390, 650, '- length: double\n- width: double'),
          c('circle', 'Circle', 730, 650, '- radius: double'),
          c('cube', 'Cube', 1070, 650, '- side: double'),
          c('sphere', 'Sphere', 1410, 650, '- radius: double'),
        ],
        [
          r('2d', 'shape', 'inheritance'),
          r('3d', 'shape', 'inheritance'),
          r('triangle', '2d', 'inheritance'),
          r('rect', '2d', 'inheritance'),
          r('circle', '2d', 'inheritance'),
          r('cube', '3d', 'inheritance'),
          r('sphere', '3d', 'inheritance'),
        ],
        blank,
      );
    case '6':
      return classBlueprint(
        title,
        [
          c(
            'building',
            'Building',
            650,
            60,
            '- area: double\n- address: String',
          ),
          c('furniture', 'Furniture', 280, 360, '- style: String'),
          c('room', 'Room', 1020, 360, '- number: String\n- area: double'),
          c('steel', 'SteelFurniture', 80, 660),
          c('wood', 'WoodFurniture', 440, 660),
          c('living', 'LivingRoom', 900, 660),
          c('bed', 'Bedroom', 1260, 660),
        ],
        [
          r('building', 'furniture', 'aggregation', 'contains', '0..1', '0..*'),
          r('building', 'room', 'composition', 'contains', '1', '1..*'),
          r('steel', 'furniture', 'inheritance'),
          r('wood', 'furniture', 'inheritance'),
          r('living', 'room', 'inheritance'),
          r('bed', 'room', 'inheritance'),
        ],
        blank,
      );
    case '7':
      return classBlueprint(
        title,
        [
          c(
            'bank',
            'Bank',
            600,
            50,
            '- code: String\n- address: String',
            '+ openAccount(): Account',
          ),
          c(
            'customer',
            'Customer',
            80,
            360,
            '- id: String\n- name: String',
            '+ verifyIdentity(): boolean',
          ),
          c(
            'account',
            'Account',
            600,
            360,
            '- number: String\n- balance: double',
            '+ deposit(amount: double): void\n+ withdraw(amount: double): boolean',
          ),
          c(
            'atm',
            'ATM',
            1120,
            360,
            '- location: String',
            '+ checkBalance(): double',
          ),
          c('saving', 'SavingsAccount', 320, 720, '- interestRate: double'),
          c(
            'checking',
            'CheckingAccount',
            750,
            720,
            '- overdraftLimit: double',
          ),
          c(
            'txn',
            'Transaction',
            1180,
            720,
            '- id: String\n- amount: double\n- date: Date',
            '+ post(): void',
          ),
        ],
        [
          r('bank', 'account', 'aggregation', 'holds', '1', '0..*'),
          r('bank', 'atm', 'aggregation', 'operates', '1', '0..*'),
          r('customer', 'account', 'association', 'owns', '1..*', '1..*'),
          r('saving', 'account', 'inheritance'),
          r('checking', 'account', 'inheritance'),
          r('account', 'txn', 'association', 'records', '1', '0..*'),
          r('atm', 'txn', 'association', 'initiates'),
        ],
        blank,
      );
    case '8':
      return classBlueprint(
        title,
        [
          c(
            'guest',
            'Guest',
            70,
            80,
            '- id: String\n- name: String\n- email: String',
            '+ requestBooking(): Booking',
          ),
          c(
            'booking',
            'Booking',
            530,
            80,
            '- id: String\n- start: Date\n- end: Date',
            '+ cancel(): void\n+ confirm(): void',
          ),
          c(
            'room',
            'Room',
            990,
            80,
            '- number: String\n- price: double\n- status: String',
            '+ updateStatus(status: String): void',
          ),
          c(
            'reception',
            'Receptionist',
            530,
            430,
            '- name: String',
            '+ checkIn(booking: Booking): void\n+ checkOut(booking: Booking): void',
          ),
          c(
            'admin',
            'Administrator',
            990,
            430,
            '- username: String',
            '+ addRoom(room: Room): void',
          ),
          c(
            'accountant',
            'Accountant',
            70,
            430,
            '- name: String',
            '+ generateBill(booking: Booking): void',
          ),
        ],
        [
          r('guest', 'booking', 'association', 'makes', '1', '0..*'),
          r('booking', 'room', 'association', 'reserves', '0..*', '1'),
          r('reception', 'booking', 'association', 'manages'),
          r('admin', 'room', 'association', 'maintains'),
          r('accountant', 'booking', 'association', 'bills'),
        ],
        blank,
      );
    case 'CL-P1':
      return classBlueprint(
        title,
        [
          c('company', 'VehicleCompany', 650, 40, '- name: String'),
          c(
            'vehicle',
            'Vehicle',
            650,
            340,
            '- vin: String',
            '+ testDrive(): void',
          ),
          c('car', 'Car', 280, 660, '- seats: int'),
          c('jeep', 'Jeep', 650, 660, '- fourWheelDrive: boolean'),
          c('part', 'SparePart', 1080, 340, '- serial: String'),
          c('engine', 'Engine', 1080, 660),
          c('brake', 'Brake', 1430, 660),
          c('light', 'Light', 1780, 660),
          c(
            'tech',
            'Technician',
            1450,
            40,
            '- name: String',
            '+ repair(part: SparePart): void',
          ),
          c(
            'engineer',
            'Engineer',
            160,
            340,
            '- name: String',
            '+ inspect(vehicle: Vehicle): boolean',
          ),
        ],
        [
          r('company', 'vehicle', 'aggregation', 'stocks', '1', '0..*'),
          r('car', 'vehicle', 'inheritance'),
          r('jeep', 'vehicle', 'inheritance'),
          r('vehicle', 'part', 'aggregation', 'has', '0..1', '1..*'),
          r('engine', 'part', 'inheritance'),
          r('brake', 'part', 'inheritance'),
          r('light', 'part', 'inheritance'),
          r('tech', 'part', 'association', 'repairs'),
          r('engineer', 'vehicle', 'association', 'inspects'),
        ],
        blank,
      );
    case 'CL-P2':
      return classBlueprint(
        title,
        [
          c('library', 'Library', 650, 40, '- name: String'),
          c('book', 'Book', 300, 340, '- isbn: String\n- title: String'),
          c('member', 'Member', 1080, 340, '- id: String\n- name: String'),
          c('course', 'CourseBook', 90, 660, '- courseCode: String'),
          c('general', 'GeneralBook', 460, 660, '- subject: String'),
          c('student', 'Student', 1080, 660, '- studentNumber: String'),
          {
            ...c(
              'loan',
              'Loan',
              700,
              970,
              '- issued: Date\n- due: Date',
              '+ returnBook(): void',
            ),
            description:
              'Constraint: a CourseBook may be loaned only to a Student. A GeneralBook may be loaned to any Member. This rule is documented, not executed.',
          },
        ],
        [
          r('library', 'book', 'aggregation', 'holds', '1', '0..*'),
          r('course', 'book', 'inheritance'),
          r('general', 'book', 'inheritance'),
          r('student', 'member', 'inheritance'),
          r('member', 'loan', 'association', 'borrows', '1', '0..*'),
          r('book', 'loan', 'association', 'loan history', '1', '0..*'),
        ],
        blank,
      );
    default:
      throw new Error(`No class example for lab ${lab.number}.`);
  }
}
