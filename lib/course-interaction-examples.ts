import { buildUseCaseDiagram, e, sequence, msg } from './course-builders.ts';
import type { PracticeSkeleton } from './practice.ts';

export function interactionExample(number: string): PracticeSkeleton[] {
  switch (number) {
    case '1':
      return buildUseCaseDiagram(
        '«subsystem» Banking service',
        ['Customer', 'Bank staff'],
        [
          'Open account',
          'Deposit money',
          'Withdraw money',
          'Change PIN',
          'View balance',
          'Transfer money',
          'Request credit card',
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [0, 4],
          [0, 5],
          [0, 6],
          [1, 0],
          [1, 6],
        ],
        [e('a1', 'g1', 'directed-association', 'records')],
      );
    case '2':
      return buildUseCaseDiagram(
        'Flight reservations',
        ['Customer', 'Airline staff', 'Payment service'],
        [
          'Search flights',
          'View flight details',
          'Book flight',
          'Cancel booking',
          'Pay fare',
          'Manage flight schedule',
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 5],
          [2, 4],
        ],
        [e('g2', 'g4', 'include', '«include»')],
      );
    case '3':
      return buildUseCaseDiagram(
        'Online shop',
        ['Customer', 'Administrator'],
        [
          'Browse products',
          'Search products',
          'View details',
          'Place order',
          'Pay order',
          'Maintain catalog',
          'Apply coupon',
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 5],
        ],
        [
          e('g3', 'g4', 'include', '«include»'),
          e('g6', 'g3', 'extend', '«extend» [coupon supplied]'),
        ],
      );
    case '4':
      return buildUseCaseDiagram(
        'Ordering service',
        [
          'Customer',
          'Service representative',
          'Procurement manager',
          'Menu manager',
        ],
        [
          'Create profile',
          'View menu',
          'Place order',
          'Change order',
          'Expedite order',
          'Request ingredients',
          'Update prices',
          'View reports',
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 4],
          [1, 7],
          [2, 5],
          [3, 6],
          [3, 7],
        ],
      );
    case 'UC-P1':
      return buildUseCaseDiagram(
        'JU academic portal',
        ['Student', 'Academic adviser'],
        [
          'Register courses',
          'View schedule',
          'View grades',
          'Request transcript',
          'Review study plan',
          'Approve registration',
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [0, 4],
          [1, 4],
          [1, 5],
        ],
      );
    case 'UC-P2':
      return buildUseCaseDiagram(
        'Shared file service',
        ['Member', 'Workspace administrator'],
        [
          'Upload file',
          'Download file',
          'Search files',
          'Share file',
          'Manage permissions',
          'Restore deleted file',
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 4],
          [0, 5],
          [1, 5],
        ],
      );
    case 'UC-P3':
      return buildUseCaseDiagram(
        'Digital library',
        ['Reader', 'Librarian'],
        [
          'Search resources',
          'Read digital resource',
          'Borrow resource',
          'Renew loan',
          'Maintain catalog',
          'Manage memberships',
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 4],
          [1, 5],
        ],
      );
    case '11':
      return sequence(
        ['Customer', 'Waiter', 'Chef', 'Cashier'],
        [
          msg(0, 1, 'orderFood()'),
          msg(1, 2, 'prepareOrder()'),
          msg(2, 1, 'foodReady', true),
          msg(1, 0, 'serveFood()', true),
          msg(0, 3, 'payBill()'),
          msg(3, 0, 'receipt', true),
        ],
      );
    case '12':
      return sequence(
        ['Examiner', 'Exam service', 'Student', 'Result service'],
        [
          msg(0, 1, 'prepareExam()'),
          msg(1, 0, 'examCreated', true),
          msg(0, 1, 'publishExam()'),
          msg(1, 2, 'sendInvitation()'),
          msg(2, 1, 'startExam()'),
          msg(1, 2, 'questions', true),
          msg(2, 1, 'submitAnswers()'),
          msg(1, 3, 'gradeSubmission()'),
          msg(3, 2, 'result', true),
        ],
      );
    case '14':
      return sequence(
        [
          'Order service',
          'Payment service',
          'Deduplication store',
          'Payment records',
        ],
        [
          msg(0, 1, 'pay(orderId)'),
          msg(1, 2, 'claimOrderId()'),
          msg(2, 1, 'newRequest', true),
          msg(1, 3, 'getStatus()'),
          msg(3, 1, 'unpaid', true),
          msg(1, 1, 'chargeAccount()'),
          msg(1, 3, 'recordPayment()'),
          msg(1, 0, 'paymentConfirmed', true),
          msg(0, 1, 'pay(orderId) again'),
          msg(1, 2, 'claimOrderId()'),
          msg(2, 1, 'alreadyProcessed', true),
          msg(1, 0, 'existingReceipt', true),
        ],
      );
    case 'SQ-P1':
      return sequence(
        ['Customer', 'Mobile app', 'Order service', 'Payment service'],
        [
          msg(0, 1, 'browseCatalog()'),
          msg(0, 1, 'checkout(cart)'),
          msg(1, 2, 'createOrder()'),
          msg(2, 3, 'authorizePayment()'),
          msg(3, 2, 'approved', true),
          msg(2, 1, 'orderConfirmation', true),
          msg(1, 0, 'showConfirmation()', true),
        ],
      );
    case 'SQ-P2':
      return sequence(
        ['Student', 'Librarian', 'Catalog', 'Loan register'],
        [
          msg(0, 1, 'requestBook()'),
          msg(1, 3, 'validateMember()'),
          msg(3, 1, 'validMember', true),
          msg(1, 2, 'checkAvailability()'),
          msg(2, 1, 'available', true),
          msg(1, 3, 'recordLoan()'),
          msg(1, 2, 'markOnLoan()'),
          msg(1, 0, 'issueBook(dueDate)', true),
        ],
      );
    case 'SQ-P3':
      return sequence(
        ['Student', 'Project committee', 'Supervisor', 'Project register'],
        [
          msg(0, 1, 'submitProposal()'),
          msg(1, 2, 'requestSupervision()'),
          msg(2, 1, 'acceptProposal', true),
          msg(1, 3, 'registerProject()'),
          msg(3, 1, 'projectId', true),
          msg(1, 0, 'confirmRegistration()', true),
          msg(0, 2, 'arrangeFirstMeeting()'),
        ],
      );
    default:
      throw new Error(`No interaction example for lab ${number}.`);
  }
}
