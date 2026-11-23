import type { Lesson3State } from './lesson3Logic';
import type { Lesson4State } from './lesson4Logic';

/** 테스트용: 3차시 모든 문항을 맞힌 학생 */
export function fullLesson3(): Lesson3State {
  return {
    microDay1: '2', microDay2: '4', microDay3: '8', microDay4: '16', microDay5: '32', microExpr: '2×2×2×2×2', openVerified: true,
    read23: 'cube2', bogiBase34: '3', bogiExp34: '4', bogiExp5: '3', bogiExp7: '2',
    blankPower: 'power', blankBase: 'base', blankExp: 'exponent', conceptVerified: true,
    p1a: '4³', p1b: '2⁴×7³', c1a: '3^6', c1b: '2³ × 5²', p1Verified: true,
    mis23: '8', mis32: '9', misBigger: 'b', mis33: '27', misReason: '밑과 지수를 바꿔서 3×3으로 계산했다', misVerified: true,
    chDay: '10', chExpr: '2^10', chVerified: true,
    reflection1: '같은 수를 여러 번 곱하면 거듭제곱으로 쓴다는 것을 알았다',
  };
}

/** 테스트용: 4차시 모든 문항을 맞힌 학생 */
export function fullLesson4(): Lesson4State {
  return {
    openB2: '6', openB3: '4', openDiv12: '1, 2, 3, 4, 6, 12', openPrime12: '2, 3', openVerified: true,
    p2_16: '2', p2_33: '3, 11', p2_42: '2, 3, 7', p2_80: '2, 5', p2Verified: true,
    tree1: [2, 2, 2], tree2: [3, 2, 2], tree1Result: '2³×3', tree2Result: '2^3×3', treeSame: 'same', treeVerified: true,
    ladder90: [2, 3, 3], result90: '2×3²×5', ex1Verified: true,
    p3_32: '2⁵', p3_63: '3²×7', p3_98: '2×7²', p3_150: '2×3×5²', p3Verified: true,
    t75a: '1', t75b: '5', t75c: '25', t75d: '3', t75e: '15', t75f: '75', div75: '1, 3, 5, 15, 25, 75', tableVerified: true,
    talk6: '4', talk9: '3', talkAlways: 'no', talkVerified: true,
    p4a: '1, 2, 4, 5, 10, 20, 25, 50, 100', p4b: '1, 2, 3, 6, 9, 18, 27, 54', p4Verified: true,
    cnt40: '8', cnt40Reason: '40=2³×5라서 4개와 2개를 곱했다', cntVerified: true,
    code5239: '13²×31', codeNum: '600', codeResult: '2³×3×5²', codeVerified: true,
    rvBlank1: 'power', rvBlank2a: 'base', rvBlank2b: 'exponent', rvBlank3: 'primeFactor', rvBlank4: 'factorization', rvConceptVerified: true,
    rv2_18: '2, 3', rv2_26: '2, 13', rv2_35: '5, 7', rv2_84: '2, 3, 7',
    rv3_45: '3²×5', rv3_56: '2³×7', rv3_125: '5³', rv3_132: '2²×3×11', rv23Verified: true,
    rv5Picks: ['3^2', '2^2x3^2'], rv5Verified: true,
    rv4Answer: '7', rv4Reason: '28=2²×7이므로 7의 지수가 짝수가 되도록 7을 곱한다', rv4Verified: true,
    reflection1: '소인수분해는 순서와 상관없이 결과가 하나뿐이라는 것을 알았다',
  };
}
