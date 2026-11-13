import type { Lesson1State } from './lesson1Logic';

/** 테스트용: 1차시 모든 문항을 맞힌 학생 */
export function fullLesson1(): Lesson1State {
  return {
    connectA: '2', connectB: '3', connectExample: '물은 수소와 산소가 결합해서 만들어진다', connectVerified: true,
    prepDiv10: '1, 2, 5, 10', prepDiv16: '1, 2, 4, 8, 16', prepMul5: '5, 10, 15', prepMul12: '12, 24, 36',
    prepGcd915: '3', prepGcd1620: '4', prepLcm410: '20', prepLcm1218: '36', prepVerified: true,
    open6Picks: [1, 2, 3, 6], open7Picks: [1, 7], openPrimes: '2, 3, 5', openVerified: true,
    talkDivisorCount: '2', oneClass: 'neither', conceptVerified: true,
    myNumber: '15', myDivisors: '1, 3, 5, 15', myClass: 'composite', myVerified: true,
    p1Class11: 'prime', p1Class14: 'composite', p1Class19: 'prime', p1Class27: 'composite',
    p1Divisor14: '7', p1Divisor27: '9', p1Verified: true,
    evenTwo: 'yes', evenTwoReason: '2의 약수는 1과 2뿐이기 때문이다', evenVerified: true,
    tile7Found: ['1x7'], tile7Count: '1', tile7Verified: true,
    tile16Found: ['1x16', '2x8', '4x4'], tile16Count: '3', tile16Verified: true,
    tileOneNumbers: '2, 3, 5, 7', tileOneFeature: '모두 소수이고 한 줄로만 놓을 수 있다', tileOneVerified: true,
    chPicks: [2, 3, 5, 7, 9], chReason: '소수는 1과 자기 자신 말고 약수가 없어서 남는 3을 9로 맞췄다', chVerified: true,
    reflection1: '소수는 약수가 2개이고 합성수는 3개 이상이다',
  };
}

