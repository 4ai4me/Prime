import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { purgeLegacyLocalData } from './utils/studentIdentity';

// 2026-11-28 가상 정보 가입으로 바꾸면서, 이 기기에 남은 예전 로그인 정보(실명·학번)와
// 실명이 담긴 활동지 보관본을 화면을 그리기 전에 지웁니다 → 예전 정보로 자동 입장 불가
try {
  purgeLegacyLocalData(window.localStorage);
} catch (err) {
  console.warn('Legacy local data purge skipped:', err);
}

createRoot(document.getElementById('root')!).render(<App />);
