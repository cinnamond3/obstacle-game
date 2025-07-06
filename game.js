const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 디버그 모드 설정
let debugMode = false;

// 디버그 로그 함수
function debugLog(...args) {
  if (debugMode) {
    console.log(...args);
  }
}

// 디버그 에러 함수 (항상 출력)
function debugError(...args) {
  if (debugMode) {
    console.error(...args);
  }
}

// 캔버스 크기를 전체 화면으로 설정
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// 초기 크기 설정
resizeCanvas();

// 모바일 최적화
function initMobileOptimizations() {
  // 더블탭 줌 방지
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  // 터치 스크롤 방지
  document.addEventListener('touchmove', (e) => {
    if (e.target === canvas) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // 컨텍스트 메뉴 방지
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  
  // 모바일에서 캔버스 클릭으로 점프 (삭제됨)
  canvas.addEventListener('click', (e) => {
    // 터치 컨트롤 버튼이 아닌 곳을 클릭했을 때만 처리
    const touchControls = document.querySelector('.touch-controls');
    if (touchControls && !touchControls.contains(e.target)) {
      // 게임 오버 메뉴 터치 처리
      if (gameOver) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        handleGameOverTouch(x, y);
      }
      
      // 상점이 열려있으면 상점 터치 처리
      if (shopOpen && nearShop) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        handleShopTouch(x, y);
      }
    }
  });
  
  // 터치 이벤트 처리 (점프 기능 삭제됨)
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    // 터치 컨트롤 버튼이 아닌 곳을 터치했을 때만 처리
    const touchControls = document.querySelector('.touch-controls');
    if (touchControls && !touchControls.contains(e.target)) {
      // 게임 오버 메뉴 터치 처리
      if (gameOver) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handleGameOverTouch(x, y);
      }
      
      // 상점이 열려있으면 상점 터치 처리
      if (shopOpen && nearShop) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handleShopTouch(x, y);
      }
    }
  });
}

// 모바일 최적화 초기화
initMobileOptimizations();

// groundY를 함수로 정의하여 항상 현재 캔버스 크기에서 계산
function getGroundY() {
  return canvas.height * 2/3;
}

// 플레이어 초기 위치 설정
const player = {
  x: 50, // 화면 왼쪽 끝에서 시작
  y: 0, // 초기값 설정 (나중에 업데이트됨)
  width: 32,
  height: 64,
  vx: 0,
  vy: 0,
  speed: 4, // 평행 이동 속도 증가
  jumpPower: 13, // 원래 점프력으로 복구
  isOnGround: true,
  // 애니메이션 관련 속성
  animationTimer: 0,
  isFalling: false,
  fallTimer: 0,
  legAngle: 0,
  armAngle: 0,
  walkSpeed: 0.3,
  heartDeducted: false, // 하트 차감 완료 표시
  invincible: false, // 무적 상태
  invincibleTimer: 0 // 무적 타이머
};

// 플레이어 초기 위치 설정
player.y = getGroundY() - player.height/2;

// 창 크기 변경 시 캔버스 크기 조정
window.addEventListener('resize', () => {
  resizeCanvas();
  // 플레이어 위치도 업데이트
  if (player.y === 0) {
    player.y = getGroundY() - player.height/2;
  }
});

const gravity = 0.7;

let keys = {};

// 카메라 위치
let cameraX = 0;

// 장애물 배열
let obstacles = [];
let gameOver = false;
let score = 0;
let obstacleTimer = 0;
let currentStage = 1; // 현재 스테이지
let stageObstacles = []; // 현재 스테이지의 장애물들
let stageCoins = []; // 현재 스테이지의 코인들
let stageCleared = false; // 스테이지 클리어 여부
let stageStartX = 0; // 스테이지 시작 위치
let stageDoor = null; // 스테이지 끝의 문
let stageShop = null; // 스테이지 시작 지점의 상점
let coinsCollected = 0; // 현재 스테이지에서 획득한 코인 개수
let totalCoinsCollected = 0; // 전체 스테이지에서 획득한 코인 개수

// 하트 시스템
let hearts = 5; // 하트 개수 (5개로 시작)
const maxHearts = 7; // 최대 하트 개수
let nearShop = false; // 상점 근처에 있는지
let showInsufficientFunds = false; // 돈 부족 메시지 표시 여부
let insufficientFundsTimer = 0; // 돈 부족 메시지 타이머
let showMaxHeartsMessage = false; // 하트 최대 메시지 표시 여부
let maxHeartsMessageTimer = 0; // 하트 최대 메시지 타이머
let shopOpen = false; // 상점이 열려있는지
let selectedItem = 0; // 선택된 아이템 인덱스 (0: 하트, 1: 신발, 2: 고급 신발)

// 아이템 정보
const shopItems = [
  { name: '하트', price: 2, description: '생명력 +1', icon: '❤️' },
  { name: '신발', price: 20, description: '이동속도 +10%', icon: '👟', color: '#8B4513' },
  { name: '반짝신발', price: 40, description: '이동속도 +20%', icon: '👟', color: '#C0C0C0' },
  { name: '반짝반짝신발', price: 80, description: '이동속도 +30%', icon: '👟', color: '#FFD700' },
  { name: '전설신발', price: 160, description: '이동속도 +40%', icon: '👟', color: 'rainbow' }
];

// 플레이어 아이템 상태
let playerItems = {
  heartBonus: 0, // 추가 하트
  speedBonus: 0, // 이동속도 보너스 (%)
  bestShoe: 0 // 가장 높은 신발 등급 (0: 없음, 1: 신발, 2: 반짝신발, 3: 반짝반짝신발, 4: 전설신발)
};

// 스테이지 클리어 시 상태 저장
let lastStageCoins = 0; // 이전 스테이지에서 최종 획득한 코인
let lastStageHearts = 5; // 이전 스테이지에서의 하트 개수
let lastStageItems = { heartBonus: 0, speedBonus: 0, bestShoe: 0 }; // 이전 스테이지에서의 아이템 상태

// 화면 깜빡임 효과
let screenFlash = false; // 화면 깜빡임 상태
let screenFlashTimer = 0; // 화면 깜빡임 타이머

// 게임 오버 메뉴 관련 변수
let gameOverMenuOpen = false; // 게임 오버 메뉴가 열려있는지
let gameOverSelectedOption = 0; // 선택된 옵션 (0: 현재 스테이지에서 이어하기, 1: 처음부터 다시)
let gameOverTouchAreas = []; // 게임 오버 메뉴 터치 영역

// 모바일 컨트롤 설정
let mobileControlsSwapped = false; // 컨트롤 좌우 바꾸기 상태

// 거리 시스템
let actualDistance = 0; // 실제 이동 거리 (미터 단위)
let stageDistance = 0; // 현재 스테이지에서의 이동 거리 (미터 단위)
let savedTotalDistance = 0; // 저장된 전체 거리 (재시작 시 유지)

// 배경음악 관련 변수
let bgMusicEnabled = true;
let bgMusic = null;

// FPS 제한 관련 변수
let targetFPS = 60; // 기본 60FPS
let frameTime = 1000 / targetFPS; // 목표 프레임 시간 (밀리초)
let lastFrameTime = 0; // 마지막 프레임 시간
let fpsCounter = 0; // FPS 카운터
let currentFPS = 0; // 현재 FPS
let fpsUpdateTimer = 0; // FPS 업데이트 타이머
let deltaTime = 0; // 프레임 간 시간 차이 (초 단위)

// 장애물 타입
const OBSTACLE_TYPES = {
  SPIKE_SMALL: 'spike_small', // 작은 가시 (75x25)
  SPIKE_LARGE: 'spike_large', // 큰 가시 (90x30)
  TRAP: 'trap'
};

// 장애물 생성 순서를 위한 카운터
let obstacleCounter = 0;

// 스테이지별 장애물 개수 계산
function getObstacleCount(stage) {
  return Math.pow(2, stage); // 스테이지별로 2배씩 증가: 1스테이지=2개, 2스테이지=4개, 3스테이지=8개, 4스테이지=16개...
}

// 스테이지별 장애물 간격 계산
function getObstacleSpacing(stage) {
  if (stage === 1) {
    return 250; // 스테이지 1은 더 짧은 간격 (300 -> 250)
  }
  // 스테이지가 올라갈수록 간격을 더 적극적으로 줄임 (장애물 밀도 증가)
  return Math.max(200, 600 - stage * 80); // 스테이지 2: 440, 스테이지 3: 360, 스테이지 4: 280, 스테이지 5: 200, 스테이지 6: 200...
}

// 스테이지별 길이 계산 (미터 단위)
// 공식: 5 * pow(2, 스테이지-1) * (105 - 스테이지 * 5) / 100
// => 스테이지별 밀도가 5%씩 높아짐
function getStageLength(stage) {
  const baseLength = 5 * Math.pow(2, stage - 1);
  const densityFactor = (105 - stage * 5) / 100;
  return Math.round(baseLength * densityFactor);
}

// 상점 생성
function createStageShop(x) {
  stageShop = {
    x: x,
    y: getGroundY() - 115, // 땅 위에 위치 (높이 조정)
    width: 96, // 플레이어보다 크게 (80 -> 96, 20% 증가)
    height: 115, // 플레이어보다 크게 (96 -> 115, 20% 증가)
    isOpen: false // 상점이 열려있는지
  };
}

// 문 생성
function createStageDoor(x) {
  stageDoor = {
    x: x,
    y: getGroundY() - 120, // 땅 위에 위치 (높이 조정)
    width: 80, // 플레이어보다 크게 (32 -> 80)
    height: 120, // 플레이어보다 크게 (100 -> 120, 20% 증가)
    isOpen: false, // 처음에는 닫혀있음
    isOpening: false, // 열리는 중
    isClosing: false, // 닫히는 중
    openHeight: 0, // 문이 올라간 높이
    animationTimer: 0,
    playerEntered: false // 플레이어가 들어갔는지
  };
}

// 문 그리기
function drawStageDoor() {
  if (!stageDoor) return;
  
  ctx.save();
  ctx.translate(stageDoor.x - cameraX, stageDoor.y);
  
  // 문 프레임 (현대적인 금속 프레임) - 테두리 없이
  const frameGradient = ctx.createLinearGradient(-stageDoor.width/2 - 20, 0, stageDoor.width/2 + 20, 0);
  frameGradient.addColorStop(0, '#2C3E50');
  frameGradient.addColorStop(0.5, '#34495E');
  frameGradient.addColorStop(1, '#2C3E50');
  
  ctx.fillStyle = frameGradient;
  ctx.fillRect(-stageDoor.width/2 - 20, 0, stageDoor.width + 40, stageDoor.height);
  
  // 문 안쪽 (깊이감 있는 어두운 부분)
  const innerGradient = ctx.createRadialGradient(0, stageDoor.height/2, 0, 0, stageDoor.height/2, stageDoor.width/2);
  innerGradient.addColorStop(0, '#1a1a1a');
  innerGradient.addColorStop(1, '#000000');
  
  ctx.fillStyle = innerGradient;
  ctx.fillRect(-stageDoor.width/2 + 8, 8, stageDoor.width - 16, stageDoor.height - 16);
  
  // 철문 (아래에서 위로 올라가는 애니메이션)
  ctx.save();
  ctx.translate(0, -stageDoor.openHeight);
  
  // 문 메탈릭 그라데이션
  const doorGradient = ctx.createLinearGradient(-stageDoor.width/2, 0, stageDoor.width/2, 0);
  doorGradient.addColorStop(0, '#7F8C8D');
  doorGradient.addColorStop(0.3, '#95A5A6');
  doorGradient.addColorStop(0.7, '#95A5A6');
  doorGradient.addColorStop(1, '#7F8C8D');
  
  ctx.fillStyle = doorGradient;
  ctx.fillRect(-stageDoor.width/2, 0, stageDoor.width, stageDoor.height);
  
  // 문 테두리 (금속 느낌)
  ctx.strokeStyle = '#2C3E50';
  ctx.lineWidth = 4;
  ctx.strokeRect(-stageDoor.width/2, 0, stageDoor.width, stageDoor.height);
  
  // 문 내부 패널 디자인
  ctx.strokeStyle = '#34495E';
  ctx.lineWidth = 2;
  
  // 메인 패널 구분선
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, stageDoor.height);
  ctx.stroke();
  
  // 상단 패널
  ctx.fillStyle = 'rgba(52, 73, 94, 0.3)';
  ctx.fillRect(-stageDoor.width/2 + 5, 5, stageDoor.width - 10, stageDoor.height/3);
  
  // 중간 패널
  ctx.fillStyle = 'rgba(44, 62, 80, 0.4)';
  ctx.fillRect(-stageDoor.width/2 + 5, stageDoor.height/3 + 5, stageDoor.width - 10, stageDoor.height/3);
  
  // 하단 패널
  ctx.fillStyle = 'rgba(52, 73, 94, 0.3)';
  ctx.fillRect(-stageDoor.width/2 + 5, 2*stageDoor.height/3 + 5, stageDoor.width - 10, stageDoor.height/3 - 10);
  
  // 문 하이라이트 효과
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(-stageDoor.width/2 + 2, 2, stageDoor.width - 4, 8);
  
  ctx.restore();
  
  // 문이 열렸을 때 조명 효과
  if (stageDoor.isOpen) {
    // 안쪽 조명
    const lightGradient = ctx.createRadialGradient(0, stageDoor.height/2, 0, 0, stageDoor.height/2, stageDoor.width);
    lightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    lightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    lightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = lightGradient;
    ctx.fillRect(-stageDoor.width/2 + 10, 10, stageDoor.width - 20, stageDoor.height - 20);
    
    // 문 위쪽 조명 효과
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(-stageDoor.width/2 - 10, -15, stageDoor.width + 20, 10);
  }
  
  // 문 위쪽 EXIT 표시
  ctx.fillStyle = '#E74C3C';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', 0, -20);
  ctx.textAlign = 'left';
  
  ctx.restore();
}

// 상점 그리기
function drawStageShop() {
  if (!stageShop) return;
  
  ctx.save();
  ctx.translate(stageShop.x - cameraX, stageShop.y);
  
  // 상점 건물 (나무로 된 상점)
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-stageShop.width/2, 0, stageShop.width, stageShop.height);
  
  // 상점 지붕
  ctx.fillStyle = '#654321';
  ctx.beginPath();
  ctx.moveTo(-stageShop.width/2 - 10, 0);
  ctx.lineTo(0, -20);
  ctx.lineTo(stageShop.width/2 + 10, 0);
  ctx.closePath();
  ctx.fill();
  
  // 상점 문
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(-stageShop.width/4, 10, stageShop.width/2, stageShop.height - 20);
  
  // 상점 창문
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(-stageShop.width/3, 15, stageShop.width/3, 15);
  
  // 상점 간판
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(-stageShop.width/2 - 5, -25, stageShop.width + 10, 15);
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SHOP', 0, -15);
  ctx.textAlign = 'left';
  
  ctx.restore();
}

// 상점 업데이트
function updateShop() {
  if (!stageShop) return;
  
  const distanceToPlayer = Math.abs(stageShop.x - player.x);
  
  // 플레이어가 가까이 오면 상점 근처 표시 (거리 조정)
  if (distanceToPlayer < 70) {
    nearShop = true;
  } else {
    // 상점에서 멀어져도 상점이 열려있으면 닫지 않음
    if (!shopOpen) {
      nearShop = false;
    }
  }
}

// 하트 그리기 함수
function drawHearts(x, y) {
  const heartSize = 20;
  const spacing = 25;
  const boxWidth = 220;
  const boxHeight = 60;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 20, y - 20, boxWidth, boxHeight);
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 20, y - 20, boxWidth, boxHeight);
  // 하트들을 박스 왼쪽에서부터 정렬 (세로 중앙)
  const heartsStartX = x + 15;
  const heartsY = y + boxHeight / 2 - heartSize / 2 + 2; // +2로 시각적 중앙 보정
  for (let i = 0; i < maxHearts; i++) {
    const isFilled = i < hearts;
    drawHeart(heartsStartX + i * spacing, heartsY, heartSize, isFilled);
  }
  ctx.restore();
}

// 개별 하트 그리기
function drawHeart(x, y, size, isFilled = true) {
  ctx.save();
  ctx.translate(x, y);
  
  // 하트 색상 (꽉찬 하트는 빨간색, 비어있는 하트는 회색)
  if (isFilled) {
    ctx.fillStyle = '#FF0000';
    ctx.strokeStyle = '#CC0000';
  } else {
    ctx.fillStyle = '#CCCCCC';
    ctx.strokeStyle = '#999999';
  }
  ctx.lineWidth = 2;
  
  // 하트 모양 그리기
  ctx.beginPath();
  ctx.moveTo(0, size/4);
  
  // 왼쪽 곡선
  ctx.bezierCurveTo(-size/2, -size/4, -size/2, -size/2, 0, -size/2);
  
  // 오른쪽 곡선
  ctx.bezierCurveTo(size/2, -size/2, size/2, -size/4, 0, size/4);
  
  ctx.fill();
  ctx.stroke();
  
  // 하트 하이라이트 (꽉찬 하트만)
  if (isFilled) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-size/6, -size/6);
    ctx.bezierCurveTo(-size/4, -size/3, -size/6, -size/2, 0, -size/3);
    ctx.bezierCurveTo(size/6, -size/2, size/4, -size/3, size/6, -size/6);
    ctx.fill();
  }
  
  ctx.restore();
}

// 상점 터치 영역 저장용 변수
let shopTouchAreas = [];

// 상점 UI 그리기
function drawShopUI() {
  if (!shopOpen || !nearShop) return;
  
  // 터치 영역 초기화
  shopTouchAreas = [];
  
  ctx.save();
  
  // 반투명 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 상점 창
  const shopWidth = 400;
  const itemHeight = 80; // 아이템 높이
  const totalItems = shopItems.length + 1; // 아이템 + 나가기 옵션
  const shopHeight = 120 + (totalItems * itemHeight) + 40; // 제목 + 아이템들 + 조작안내
  const shopX = canvas.width/2 - shopWidth/2;
  const shopY = canvas.height/2 - shopHeight/2;
  
  // 상점 창 배경
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(shopX, shopY, shopWidth, shopHeight);
  
  // 상점 창 테두리
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 3;
  ctx.strokeRect(shopX, shopY, shopWidth, shopHeight);
  
  // 상점 제목
  ctx.fillStyle = '#FFD700';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SHOP', canvas.width/2, shopY + 30);
  
  // 현재 보유 코인 표시
  const totalCoins = totalCoinsCollected + coinsCollected;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '18px Arial';
  ctx.fillText(`보유 코인: ${totalCoins}`, canvas.width/2, shopY + 55);
  
  // 아이템 목록
  const itemStartY = shopY + 100;
  
  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    const itemY = itemStartY + i * itemHeight;
    const isSelected = i === selectedItem;
    
    // 선택된 아이템 하이라이트
    if (isSelected) {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(shopX + 10, itemY - 5, shopWidth - 20, itemHeight);
    }
    
    // 아이템 배경
    ctx.fillStyle = isSelected ? '#8B4513' : '#A0522D';
    ctx.fillRect(shopX + 15, itemY, shopWidth - 30, itemHeight - 10);
    
    // 아이템 정보
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    
    // 아이템 아이콘 (색상 적용)
    if (item.color === 'rainbow') {
      // 무지개색 효과
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
      const colorIndex = Math.floor(Date.now() / 200) % colors.length;
      ctx.fillStyle = colors[colorIndex];
    } else if (item.color) {
      ctx.fillStyle = item.color;
    } else {
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.fillText(item.icon, shopX + 25, itemY + 25);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px Arial';
    ctx.fillText(item.name, shopX + 55, itemY + 20);
    
    ctx.font = '14px Arial';
    ctx.fillText(item.description, shopX + 55, itemY + 40);
    
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${item.price} 코인`, shopX + shopWidth - 25, itemY + 30);
    
    // 터치 영역 저장
    shopTouchAreas.push({
      x: shopX + 15,
      y: itemY,
      width: shopWidth - 30,
      height: itemHeight - 10,
      type: 'item',
      index: i
    });
  }
  
  // 나가기 옵션
  const exitY = itemStartY + shopItems.length * itemHeight;
  const isExitSelected = selectedItem === shopItems.length;
  
  // 선택된 나가기 하이라이트
  if (isExitSelected) {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(shopX + 10, exitY - 5, shopWidth - 20, itemHeight);
  }
  
  // 나가기 배경
  ctx.fillStyle = isExitSelected ? '#8B4513' : '#A0522D';
  ctx.fillRect(shopX + 15, exitY, shopWidth - 30, itemHeight - 10);
  
  // 나가기 텍스트
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '18px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('나가기', shopX + 55, exitY + 30);
  
  // 나가기 터치 영역 저장
  shopTouchAreas.push({
    x: shopX + 15,
    y: exitY,
    width: shopWidth - 30,
    height: itemHeight - 10,
    type: 'exit',
    index: shopItems.length
  });
  
  // 조작 안내
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('아이템을 터치하여 구매하세요!', canvas.width/2, shopY + shopHeight - 20);
  
  ctx.restore();
}

// 상점 터치 처리 함수
function handleShopTouch(x, y) {
  if (!shopOpen || !nearShop) return false;
  
  // 터치 영역 확인
  for (let area of shopTouchAreas) {
    if (x >= area.x && x <= area.x + area.width && 
        y >= area.y && y <= area.y + area.height) {
      
      if (area.type === 'item') {
        // 아이템 선택 및 구매
        selectedItem = area.index;
        buyItem();
        return true; // 터치 처리됨
      } else if (area.type === 'exit') {
        // 나가기
        shopOpen = false;
        showMobileControls(); // 모바일 컨트롤 다시 표시
        return true;
      }
    }
  }
  
  return false;
}

// 코인 표시 함수 (우측상단)
function drawCoinDisplay() {
  const totalCoins = totalCoinsCollected + coinsCollected;
  const coinSize = 25;
  const startX = canvas.width - 230;
  const startY = 120;
  const boxWidth = 220;
  const boxHeight = 60;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(startX - 20, startY - 20, boxWidth, boxHeight);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX - 20, startY - 20, boxWidth, boxHeight);
  // 코인 아이콘과 텍스트를 박스 중앙에서 18px 위로 이동
  const centerY = startY + boxHeight / 2 - 18;
  ctx.beginPath();
  ctx.fillStyle = '#FFD700';
  ctx.arc(startX + coinSize / 2, centerY, coinSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.arc(startX + coinSize / 2, centerY, coinSize / 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#B8860B';
  ctx.beginPath();
  ctx.arc(startX + coinSize / 2, centerY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(startX + coinSize / 4, centerY - coinSize / 4, coinSize / 6, 0, Math.PI * 2);
  ctx.fill();
  // 코인 개수 텍스트 중앙 정렬
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const coinText = `x${totalCoins}`;
  ctx.fillText(coinText, startX + coinSize + 10, centerY + 7);
  // Stage 코인 텍스트를 같은 라인에 표시
  if (coinsCollected > 0) {
    ctx.font = '14px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textBaseline = 'alphabetic';
    const coinTextWidth = ctx.measureText(coinText).width;
    ctx.fillText(`Stage: +${coinsCollected}`, startX + coinSize + 10 + coinTextWidth + 22, centerY + 7);
  }
  ctx.restore();
}

// 아이템 표시 함수 (우측상단)
function drawItemDisplay() {
  const itemSize = 30;
  const startX = canvas.width - 230;
  const startY = 200;
  let itemCount = 0;
  if (playerItems.speedBonus > 0 || playerItems.heartBonus > 0) {
    ctx.save();
    const boxWidth = 220;
    const boxHeight = 60;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(startX - 20, startY - 20, boxWidth, boxHeight);
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX - 20, startY - 20, boxWidth, boxHeight);
    if (playerItems.speedBonus > 0) {
      const itemX = startX + itemCount * (itemSize + 120);
      const centerY = startY + boxHeight / 2 - 18;
      // 신발 아이콘
      ctx.fillStyle = '#8B4513';
      let shoeName = '신발';
      if (playerItems.speedBonus >= 40) {
        const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
        const colorIndex = Math.floor(Date.now() / 200) % colors.length;
        ctx.fillStyle = colors[colorIndex];
        shoeName = '전설신발';
      } else if (playerItems.speedBonus >= 30) {
        ctx.fillStyle = '#FFD700';
        shoeName = '반짝반짝신발';
      } else if (playerItems.speedBonus >= 20) {
        ctx.fillStyle = '#C0C0C0';
        shoeName = '반짝신발';
      }
      ctx.fillRect(itemX, centerY - itemSize / 2 + 2, itemSize, itemSize);
      ctx.fillStyle = '#000000';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('👟', itemX + itemSize / 2, centerY + 10);
      // 신발 이름 크게
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const nameX = itemX + itemSize + 5;
      const nameY = centerY + 10;
      ctx.fillText(shoeName, nameX, nameY);
      // 효과를 이름 우측에 표시
      ctx.font = '14px Arial';
      ctx.fillStyle = '#00FF00';
      const nameWidth = ctx.measureText(shoeName).width;
      ctx.fillText(`+${playerItems.speedBonus}% 속도`, nameX + nameWidth + 10, nameY);
      itemCount++;
    }
    if (playerItems.heartBonus > 0) {
      const itemX = startX + itemCount * (itemSize + 40);
      const centerY = startY + boxHeight / 2 - 18;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('❤️', itemX + itemSize / 2, centerY + 10);
      // 하트 이름(고정)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const nameX = itemX + itemSize + 5;
      const nameY = centerY + 10;
      ctx.fillText('하트', nameX, nameY);
      // 효과를 이름 우측에 표시
      ctx.font = '14px Arial';
      ctx.fillStyle = '#FF0000';
      const nameWidth = ctx.measureText('하트').width;
      ctx.fillText(`+${playerItems.heartBonus}`, nameX + nameWidth + 10, nameY);
      itemCount++;
    }
    ctx.restore();
  }
}

  // 돈 부족 메시지 그리기
function drawInsufficientFundsMessage() {
  if (!showInsufficientFunds) return;
  
  insufficientFundsTimer += deltaTime;
  
  // 3초 후 메시지 숨기기
  if (insufficientFundsTimer > 3.0) { // 3초
    showInsufficientFunds = false;
    return;
  }
  
  ctx.save();
  
  // 메시지 배경 (상점 UI 아래쪽에 표시)
  ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.fillRect(canvas.width/2 - 150, canvas.height - 150, 300, 100);
  
  // 메시지 테두리
  ctx.strokeStyle = '#CC0000';
  ctx.lineWidth = 3;
  ctx.strokeRect(canvas.width/2 - 150, canvas.height - 150, 300, 100);
  
  // 메시지 텍스트
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  
  // 나가기 옵션이 선택된 경우 메시지 표시하지 않음
  if (selectedItem >= shopItems.length) {
    return;
  }
  
  // 신발류 아이템이고 이미 더 좋은 신발을 가지고 있는 경우
  if (selectedItem >= 1 && selectedItem <= 4 && playerItems.bestShoe >= selectedItem) {
    ctx.fillText('Already Have Better Shoe!', canvas.width/2, canvas.height - 120);
    ctx.font = '18px Arial';
    ctx.fillText(`You already have a better shoe than ${shopItems[selectedItem].name}`, canvas.width/2, canvas.height - 90);
  } else {
    ctx.fillText('Insufficient Funds!', canvas.width/2, canvas.height - 120);
    ctx.font = '18px Arial';
    ctx.fillText(`You need ${shopItems[selectedItem].price} coins to buy ${shopItems[selectedItem].name}`, canvas.width/2, canvas.height - 90);
  }
  
  ctx.restore();
}

// 하트 최대 메시지 그리기
function drawMaxHeartsMessage() {
  if (!showMaxHeartsMessage) return;
  
  maxHeartsMessageTimer += deltaTime;
  
  // 3초 후 메시지 숨기기
  if (maxHeartsMessageTimer > 3.0) { // 3초
    showMaxHeartsMessage = false;
    return;
  }
  
  ctx.save();
  
  // 메시지 배경 (상점 UI 아래쪽에 표시) - 주황색으로 변경
  ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
  ctx.fillRect(canvas.width/2 - 150, canvas.height - 150, 300, 100);
  
  // 메시지 테두리
  ctx.strokeStyle = '#FF8C00';
  ctx.lineWidth = 3;
  ctx.strokeRect(canvas.width/2 - 150, canvas.height - 150, 300, 100);
  
  // 메시지 텍스트
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  
  ctx.fillText('Hearts Already Full!', canvas.width/2, canvas.height - 120);
  ctx.font = '18px Arial';
  ctx.fillText(`You already have maximum hearts (${maxHearts})`, canvas.width/2, canvas.height - 90);
  
  ctx.restore();
}

// 게임 오버 메뉴 그리기
function drawGameOverMenu() {
  // 터치 영역 초기화
  gameOverTouchAreas = [];
  
  ctx.save();
  
  // 완전 불투명 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 메뉴 창
  const menuWidth = 580; // 너비를 늘려서 버튼이 잘리지 않도록
  const menuHeight = 450; // 높이를 늘려서 겹침 방지
  const menuX = canvas.width/2 - menuWidth/2;
  const menuY = canvas.height/2 - menuHeight/2;
  
  // 메뉴 창 배경 (더 진한 색상)
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
  
  // 메뉴 창 테두리 (더 두껍게)
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 5;
  ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);
  
  // GAME OVER 제목 (더 크고 선명하게)
  ctx.fillStyle = '#FF0000';
  ctx.font = 'bold 52px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width/2, menuY + 60);
  
  // 게임 정보 (더 큰 폰트와 선명한 색상)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(`Final Score: ${score}`, canvas.width/2, menuY + 100);
  ctx.fillText(`Total Distance: ${Math.floor(actualDistance)}m`, canvas.width/2, menuY + 130);
  ctx.fillText(`Stage Progress: ${Math.floor(stageDistance)}m / ${getStageLength(currentStage)}m`, canvas.width/2, menuY + 160);
  ctx.fillText(`Stage Coins: ${coinsCollected}`, canvas.width/2, menuY + 190);
  ctx.fillText(`Total Coins: ${lastStageCoins}`, canvas.width/2, menuY + 220);
  ctx.fillText(`Hearts: ${lastStageHearts}`, canvas.width/2, menuY + 250);
  ctx.fillText(`Stage Reached: ${currentStage}`, canvas.width/2, menuY + 280);
  
  // 버튼 영역
  const buttonWidth = 280; // 버튼 너비를 늘림
  const buttonHeight = 50;
  const buttonStartY = menuY + 320; // 버튼 시작 위치를 아래로 조정
  const buttonSpacing = 25; // 버튼 간격을 늘림
  
  // 현재 스테이지에서 이어하기 버튼
  const restartY = buttonStartY;
  const isRestartSelected = gameOverSelectedOption === 0;
  const buttonX = canvas.width/2 - (buttonWidth - 10)/2; // 버튼을 가운데 정렬
  
  // 선택된 버튼 하이라이트
  if (isRestartSelected) {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(buttonX - 5, restartY - 5, buttonWidth, buttonHeight + 10);
  }
  
  // 버튼 배경 (더 선명한 색상)
  ctx.fillStyle = isRestartSelected ? '#4A4A4A' : '#555555';
  ctx.fillRect(buttonX, restartY, buttonWidth - 10, buttonHeight);
  
  // 버튼 테두리
  ctx.strokeStyle = isRestartSelected ? '#FFD700' : '#888888';
  ctx.lineWidth = 2;
  ctx.strokeRect(buttonX, restartY, buttonWidth - 10, buttonHeight);
  
  // 버튼 텍스트 (더 크고 선명하게)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('현재 스테이지에서 이어하기', canvas.width/2, restartY + 32);
  
  // 터치 영역 저장
  gameOverTouchAreas.push({
    x: buttonX,
    y: restartY,
    width: buttonWidth - 10,
    height: buttonHeight,
    type: 'restart'
  });
  
  // 처음부터 다시하기 버튼
  const exitY = buttonStartY + buttonHeight + buttonSpacing;
  const isExitSelected = gameOverSelectedOption === 1;
  const exitButtonX = canvas.width/2 - (buttonWidth - 10)/2; // 버튼을 가운데 정렬
  
  // 선택된 버튼 하이라이트
  if (isExitSelected) {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(exitButtonX - 5, exitY - 5, buttonWidth, buttonHeight + 10);
  }
  
  // 버튼 배경 (더 선명한 색상)
  ctx.fillStyle = isExitSelected ? '#4A4A4A' : '#555555';
  ctx.fillRect(exitButtonX, exitY, buttonWidth - 10, buttonHeight);
  
  // 버튼 테두리
  ctx.strokeStyle = isExitSelected ? '#FFD700' : '#888888';
  ctx.lineWidth = 2;
  ctx.strokeRect(exitButtonX, exitY, buttonWidth - 10, buttonHeight);
  
  // 버튼 텍스트 (더 크고 선명하게)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('처음부터 다시하기', canvas.width/2, exitY + 32);
  
  // 터치 영역 저장
  gameOverTouchAreas.push({
    x: exitButtonX,
    y: exitY,
    width: buttonWidth - 10,
    height: buttonHeight,
    type: 'exit'
  });
  
  // 조작 안내 (더 선명하게)
  ctx.fillStyle = '#CCCCCC';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('↑↓: 선택  SPACE: 확인', canvas.width/2, canvas.height - 30);
  
  ctx.restore();
}

// 게임 오버 메뉴 터치 처리
function handleGameOverTouch(x, y) {
  if (!gameOver) return false;
  
  // 터치 영역 확인
  for (let area of gameOverTouchAreas) {
    if (x >= area.x && x <= area.x + area.width && 
        y >= area.y && y <= area.y + area.height) {
      
      if (area.type === 'restart') {
        // 다시 시작
        restartGame();
        return true;
      } else if (area.type === 'exit') {
        // 처음부터 다시하기
        restartFromBeginning();
        return true;
      }
    }
  }
  
  return false;
}

// 게임 재시작 함수
function restartGame() {
  debugLog('[재시작] player.x:', player.x, 'cameraX:', cameraX, 'stageStartX:', stageStartX);
  player.x = 0; // 반드시 0 또는 100 등 명확한 숫자
  player.y = getGroundY() - player.height/2;
  player.vx = 0;
  player.vy = 0;
  // 게임 재시작 (완전한 초기화)
  gameOver = false;
  score = 0;
  actualDistance = savedTotalDistance; // 저장된 전체 거리 복원
  stageDistance = 0; // 스테이지 거리만 리셋
  obstacleTimer = 0;
  
  // 이전 스테이지 상태로 복원
  coinsCollected = 0;
  hearts = lastStageHearts;
  playerItems = { ...lastStageItems };
  totalCoinsCollected = lastStageCoins;
  
  // 플레이어 상태 완전 초기화
  player.x = 100; // 왼쪽 끝에서 시작 (안전한 시작점)
  player.y = getGroundY() - player.height/2;
  player.vx = 0;
  player.vy = 0;
  // 속도가 확실히 0이 되도록 추가 확인
  setTimeout(() => {
    player.vx = 0;
    player.vy = 0;
  }, 50);
  player.isOnGround = true;
  player.isFalling = false;
  player.fallTimer = 0;
  player.animationTimer = 0;
  player.legAngle = 0;
  player.armAngle = 0;
  player.heartDeducted = false;
  player.invincible = false;
  player.invincibleTimer = 0;
  
  // 화면 효과 초기화
  screenFlash = false;
  screenFlashTimer = 0;
  
  // 카메라 위치 초기화 (플레이어가 왼쪽에 있으므로 카메라 고정)
  cameraX = 0;
  
  // 키 입력 상태 초기화 (모든 키를 명시적으로 false로 설정)
  keys = {
    'ArrowLeft': false,
    'ArrowRight': false,
    'Space': false
  };
  
  // 스테이지 상태 초기화
  stageObstacles = [];
  stageCoins = [];
  stageCleared = false;
  stageStartX = 0;
  
  // 스테이지 초기화
  initializeStage(currentStage);
  
  // 카메라 위치 재설정 (플레이어가 왼쪽에 있으므로 카메라 고정)
  setTimeout(() => {
    cameraX = 0;
  }, 100);
}

// 처음부터 다시하기 함수
function restartFromBeginning() {
  debugLog('[처음부터 재시작] 스테이지 1부터 시작');
  
  // 게임 상태 완전 초기화
  gameOver = false;
  score = 0;
  actualDistance = 0;
  stageDistance = 0;
  savedTotalDistance = 0; // 처음부터 시작할 때는 전체 거리도 리셋
  obstacleTimer = 0;
  currentStage = 1; // 스테이지 1부터 시작
  
  // 플레이어 상태 완전 초기화
  player.x = 100;
  player.y = getGroundY() - player.height/2;
  player.vx = 0;
  player.vy = 0;
  player.isOnGround = true;
  player.isFalling = false;
  player.fallTimer = 0;
  player.animationTimer = 0;
  player.legAngle = 0;
  player.armAngle = 0;
  player.heartDeducted = false;
  player.invincible = false;
  player.invincibleTimer = 0;
  
  // 게임 데이터 초기화
  coinsCollected = 0;
  hearts = 3; // 초기 하트 수
  playerItems = { heartBonus: 0, speedBonus: 0, bestShoe: 0 }; // 아이템 초기화
  totalCoinsCollected = 0;
  
  // 화면 효과 초기화
  screenFlash = false;
  screenFlashTimer = 0;
  
  // 카메라 위치 초기화
  cameraX = 0;
  
  // 키 입력 상태 초기화
  keys = {
    'ArrowLeft': false,
    'ArrowRight': false,
    'Space': false
  };
  
  // 스테이지 상태 초기화
  stageObstacles = [];
  stageCoins = [];
  stageCleared = false;
  stageStartX = 0;
  
  // 스테이지 1 초기화
  initializeStage(1);
  
  // 카메라 위치 재설정
  setTimeout(() => {
    cameraX = 0;
  }, 100);
}

// 아이템 구매 함수
function buyItem() {
  const selectedShopItem = shopItems[selectedItem];
  const totalAvailableCoins = totalCoinsCollected + coinsCollected;
  
  // 아이템별 구매 조건 체크
  if (selectedItem === 0) { // 하트
    if (hearts >= maxHearts) {
      showMaxHeartsMessage = true;
      maxHeartsMessageTimer = 0;
      return;
    }
  } else if (selectedItem >= 1 && selectedItem <= 4) { // 신발류
    if (playerItems.bestShoe >= selectedItem) {
      showInsufficientFunds = true;
      insufficientFundsTimer = 0;
      return;
    }
  }
  
  if (totalAvailableCoins >= selectedShopItem.price) {
    // 현재 스테이지 코인에서 먼저 차감
    if (coinsCollected >= selectedShopItem.price) {
      coinsCollected -= selectedShopItem.price;
    } else {
      // 현재 스테이지 코인이 부족하면 토탈 코인에서 차감
      const remainingCost = selectedShopItem.price - coinsCollected;
      coinsCollected = 0;
      totalCoinsCollected -= remainingCost;
    }
    
    // 아이템 효과 적용
    if (selectedItem === 0) { // 하트
      hearts++;
      playerItems.heartBonus++; // 추가 하트 카운트 증가
      console.log(`[DEBUG] 하트 구매 완료. 현재 하트: ${hearts}, 추가 하트: ${playerItems.heartBonus}`);
    } else if (selectedItem === 1) { // 신발
      if (playerItems.bestShoe < 1) {
        playerItems.bestShoe = 1;
        playerItems.speedBonus = 10;
        console.log(`[DEBUG] 신발 구매 완료. bestShoe: ${playerItems.bestShoe}, speedBonus: ${playerItems.speedBonus}`);
      }
    } else if (selectedItem === 2) { // 반짝신발
      if (playerItems.bestShoe < 2) {
        playerItems.bestShoe = 2;
        playerItems.speedBonus = 20;
        console.log(`[DEBUG] 반짝신발 구매 완료. bestShoe: ${playerItems.bestShoe}, speedBonus: ${playerItems.speedBonus}`);
      }
    } else if (selectedItem === 3) { // 반짝반짝신발
      if (playerItems.bestShoe < 3) {
        playerItems.bestShoe = 3;
        playerItems.speedBonus = 30;
        console.log(`[DEBUG] 반짝반짝신발 구매 완료. bestShoe: ${playerItems.bestShoe}, speedBonus: ${playerItems.speedBonus}`);
      }
    } else if (selectedItem === 4) { // 전설신발
      if (playerItems.bestShoe < 4) {
        playerItems.bestShoe = 4;
        playerItems.speedBonus = 40;
        console.log(`[DEBUG] 전설신발 구매 완료. bestShoe: ${playerItems.bestShoe}, speedBonus: ${playerItems.speedBonus}`);
      }
    }
    
    console.log(`[DEBUG] 구매 후 playerItems:`, playerItems);
    playCoinSound(); // 구매 성공 사운드
  } else {
    // 돈이 부족할 때 메시지 표시
    showInsufficientFunds = true;
    insufficientFundsTimer = 0;
  }
}

// 문 애니메이션 업데이트
function updateDoor() {
  if (!stageDoor) return;
  
  const distanceToPlayer = Math.abs(stageDoor.x - player.x);
  
  // 플레이어가 스테이지 길이에 도달하면 문 열기
  if (distanceToPlayer < 100 && !stageDoor.isOpen && !stageDoor.isOpening) {
    stageDoor.isOpening = true;
    stageDoor.animationTimer = 0;
  }
  
  // 문 열리는 애니메이션 (아래에서 위로) - deltaTime 사용
  if (stageDoor.isOpening) {
    stageDoor.animationTimer += 0.03 * deltaTime;
    stageDoor.openHeight = Math.min(stageDoor.height, stageDoor.animationTimer * stageDoor.height);
    
    if (stageDoor.openHeight >= stageDoor.height) {
      stageDoor.isOpen = true;
      stageDoor.isOpening = false;
    }
  }
}

// 코인 생성
function createCoin(x) {
  const coin = {
    x: x,
    y: getGroundY() - 60, // 땅에서 더 높게 위치 (플레이어 머리 높이 고려)
    width: 20,
    height: 20,
    collected: false,
    animationTimer: 0,
    bounceHeight: 0
  };
  stageCoins.push(coin);
}

// 지정된 높이에 코인 생성
function createCoinAtHeight(x, y) {
  const coin = {
    x: x,
    y: y,
    width: 20,
    height: 20,
    collected: false,
    animationTimer: 0,
    bounceHeight: 0
  };
  stageCoins.push(coin);
}

// 코인 그리기
function drawCoin(coin) {
  if (coin.collected) return;
  
  ctx.save();
  ctx.translate(coin.x - cameraX, coin.y - coin.bounceHeight);
  
  // 코인 애니메이션 (위아래로 살짝 움직임) - deltaTime 사용
  coin.animationTimer += 0.1 * deltaTime;
  coin.bounceHeight = Math.sin(coin.animationTimer) * 3;
  
  // 코인 배경 (원형)
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(0, 0, coin.width/2, 0, Math.PI * 2);
  ctx.fill();
  
  // 코인 테두리
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 코인 중앙 패턴
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.arc(0, 0, coin.width/3, 0, Math.PI * 2);
  ctx.fill();
  
  // 코인 중앙 점
  ctx.fillStyle = '#B8860B';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  
  // 코인 빛나는 효과
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(-coin.width/4, -coin.height/4, coin.width/6, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

// 스테이지 초기화
function initializeStage(stage) {
  // player.x가 NaN인지 체크
  if (isNaN(player.x)) {
    debugError('[오류] initializeStage에서 player.x가 NaN입니다. 초기화합니다.');
    player.x = 100;
    player.vx = 0;
  }
  
  stageObstacles = [];
  stageCoins = [];
  stageCleared = false;
  stageStartX = player.x; // 항상 현재 플레이어 위치를 스테이지 시작점으로 설정
  stageDoor = null;
  stageShop = null;
  obstacleCounter = 0; // 장애물 카운터 리셋
  stageDistance = 0; // 스테이지 거리 리셋
  // coinsCollected는 스테이지 간에 유지되므로 초기화하지 않음
  
  // 스테이지 길이에 맞게 문 위치 먼저 계산 (미터를 픽셀로 변환)
  const stageLengthInPixels = getStageLength(stage) * 240; // 1미터 = 240픽셀 (60FPS 기준)
  const doorX = player.x + stageLengthInPixels;
  
  const obstacleCount = getObstacleCount(stage);
  const spacing = getObstacleSpacing(stage);
  
  console.log(`[DEBUG] 스테이지 ${stage} 초기화:`);
  console.log(`[DEBUG] - 플레이어 위치: ${player.x}`);
  console.log(`[DEBUG] - 스테이지 길이: ${getStageLength(stage)}m (${stageLengthInPixels}픽셀)`);
  console.log(`[DEBUG] - 문 위치: ${doorX}`);
  console.log(`[DEBUG] - 목표 장애물 개수: ${obstacleCount}`);
  console.log(`[DEBUG] - 장애물 간격: ${spacing}`);
  
  // 스테이지 전체에 고르게 장애물 분포
  const obstacleStartX = player.x + 500; // 첫 번째 장애물 가능 위치 (상점과의 간격 조정)
  const obstacleEndX = doorX - 240; // 마지막 장애물 가능 위치 (문 앞 1미터 = 240픽셀)
  const availableWidth = obstacleEndX - obstacleStartX; // 장애물을 배치할 수 있는 전체 너비
  
  let actualObstaclesCreated = 0; // 실제로 생성된 장애물 개수 추적
  
  for (let i = 0; i < obstacleCount; i++) {
    // 스테이지 전체에 고르게 분포시키기 위해 섹션별로 나누어 배치
    const sectionStart = obstacleStartX + (availableWidth / obstacleCount) * i;
    const sectionEnd = obstacleStartX + (availableWidth / obstacleCount) * (i + 1);
    
    // 각 섹션 내에서 랜덤한 위치 선택
    let currentX = sectionStart + Math.random() * (sectionEnd - sectionStart);
    
    // 장애물이 문보다 뒤에 생성되지 않도록 체크 (문 앞 1미터 제한)
    if (currentX >= doorX - 240) {
      console.log(`[DEBUG] 장애물 ${i+1}: 문 앞 1미터 제한으로 중단. currentX: ${currentX}, doorX: ${doorX}`);
      break;
    }
    
    if (createSafeObstacle(currentX, doorX)) {
      actualObstaclesCreated++; // 실제로 생성된 장애물 개수 증가
      console.log(`[DEBUG] 장애물 ${i+1} 생성 성공. 위치: ${currentX}, 총 생성: ${actualObstaclesCreated}`);
    } else {
      console.log(`[DEBUG] 장애물 ${i+1} 생성 실패. 위치: ${currentX}`);
      // 실패하면 같은 섹션 내에서 다른 위치 시도
      for (let attempt = 0; attempt < 5; attempt++) {
        currentX = sectionStart + Math.random() * (sectionEnd - sectionStart);
        if (currentX < doorX - 240 && createSafeObstacle(currentX, doorX)) {
          actualObstaclesCreated++;
          console.log(`[DEBUG] 장애물 ${i+1} 재시도 성공. 위치: ${currentX}, 총 생성: ${actualObstaclesCreated}`);
          break;
        }
      }
    }
  }
  
  console.log(`[DEBUG] 스테이지 ${stage} - 목표 장애물: ${obstacleCount}, 실제 생성: ${actualObstaclesCreated}`);
  
  // 상점을 먼저 생성 (장애물 생성 전에)
  createStageShop(player.x + 200); // 상점을 시작 지점에 더 가깝게 배치 (400 -> 200)
  
  // 문을 먼저 생성 (장애물 생성 전에)
  createStageDoor(doorX);
  
  // 코인 생성 (실제로 생성된 장애물 개수와 동일한 개수)
  const coinCount = actualObstaclesCreated; // 실제로 생성된 장애물 개수와 동일한 코인 개수
  let coinX = player.x + 350; // 코인 시작 위치 조정 (상점과의 간격 고려)
  
  for (let i = 0; i < coinCount; i++) {
    // 코인이 문보다 뒤에 생성되지 않도록 체크 (문 앞 1미터 제한)
    if (coinX >= doorX - 240) { // 문 앞 1미터 = 240픽셀 여유 공간
      break;
    }
    
    // 상점과 겹치는지 체크
    let isNearShop = false;
    if (stageShop) {
      const shopLeft = stageShop.x - stageShop.width/2;
      const shopRight = stageShop.x + stageShop.width/2;
      if (coinX > shopLeft - 30 && coinX < shopRight + 30) { // 30픽셀 여유 공간
        isNearShop = true;
      }
    }
    
    // 문과 겹치는지 체크
    let isNearDoor = false;
    if (stageDoor) {
      const doorLeft = stageDoor.x - stageDoor.width/2;
      const doorRight = stageDoor.x + stageDoor.width/2;
      if (coinX > doorLeft - 30 && coinX < doorRight + 30) { // 30픽셀 여유 공간
        isNearDoor = true;
      }
    }
    
    // 상점이나 문과 겹치지 않는 경우에만 코인 생성
    if (!isNearShop && !isNearDoor) {
      // 장애물 근처에 있는지 확인
      let isNearObstacle = false;
      let nearestObstacle = null;
      let minDistance = Infinity;
      
      for (let obstacle of stageObstacles) {
        const distance = Math.abs(obstacle.x - coinX);
        if (distance < 150 && distance < minDistance) { // 150픽셀 이내에 장애물이 있으면
          isNearObstacle = true;
          nearestObstacle = obstacle;
          minDistance = distance;
        }
      }
      
      if (isNearObstacle && nearestObstacle) {
        // 장애물 근처에 있으면 점프했을 때 먹을 수 있는 높이에 배치
        const jumpHeight = getGroundY() - 100; // 점프 최고점 근처 (플레이어 머리 높이 고려)
        createCoinAtHeight(coinX + Math.random() * 200, jumpHeight);
      } else {
        // 일반적인 위치에 배치
        createCoin(coinX + Math.random() * 200);
      }
    }
      
    coinX += Math.random() * 300 + 200;
  }
}

// 스테이지 클리어 체크 (스페이스키로 다음 스테이지 이동)
function checkStageClear() {
  if (stageDoor && stageDoor.isOpen && !stageCleared) {
    // 문이 열려있고 스페이스키를 누르면 다음 스테이지로
    if (keys['Space']) {
      stageCleared = true;
      // 현재 스테이지에서 획득한 코인을 전체 코인에 누적
      totalCoinsCollected += coinsCollected;
      lastStageCoins = totalCoinsCollected; // 스테이지 클리어 시 코인 상태 저장
      lastStageHearts = hearts; // 스테이지 클리어 시 하트 상태 저장
      lastStageItems = { ...playerItems }; // 스테이지 클리어 시 아이템 상태 저장
      savedTotalDistance = actualDistance; // 스테이지 클리어 시 전체 거리 저장
      coinsCollected = 0; // 스테이지 코인 초기화
      currentStage++;
      // 아이템 상태는 유지 (playerItems는 그대로)
      setTimeout(() => {
        initializeStage(currentStage);
      }, 1000); // 1초 후 다음 스테이지 시작
    }
  }
}

// 안전한 위치에 장애물 생성 (스테이지용)
function createSafeObstacle(x, doorX = null) {
  let safeX = x;
  let attempts = 0;
  
  // 겹치지 않는 위치를 찾을 때까지 반복
  while (isObstacleOverlapping(safeX) && attempts < 10) {
    safeX += Math.random() * 200 + 100; // 100-300 픽셀 더 뒤로
    attempts++;
  }
  
  // 문의 위치를 고려하여 장애물이 문보다 뒤에 생성되지 않도록 체크 (문 앞 1미터 제한)
  if (doorX && safeX >= doorX - 240) { // 문 앞 1미터 = 240픽셀 여유 공간
    console.log(`[DEBUG] createSafeObstacle: 문 앞 1미터 제한으로 실패. safeX: ${safeX}, doorX: ${doorX}`);
    return false;
  }
  
  // 상점과 겹치는지 체크 (상점의 실제 크기 고려)
  if (stageShop) {
    const shopLeft = stageShop.x - stageShop.width/2;
    const shopRight = stageShop.x + stageShop.width/2;
    const obstacleLeft = safeX - 45; // 장애물의 대략적인 왼쪽 경계 (가장 큰 장애물 기준)
    const obstacleRight = safeX + 45; // 장애물의 대략적인 오른쪽 경계
    
    if (obstacleRight > shopLeft - 50 && obstacleLeft < shopRight + 50) { // 50픽셀 여유 공간
      console.log(`[DEBUG] createSafeObstacle: 상점과 겹침으로 실패. safeX: ${safeX}, shopX: ${stageShop.x}, shopLeft: ${shopLeft}, shopRight: ${shopRight}`);
      return false;
    }
  }
  
  // 출구(문)와 겹치는지 체크 (문의 실제 크기 고려)
  if (stageDoor) {
    const doorLeft = stageDoor.x - stageDoor.width/2;
    const doorRight = stageDoor.x + stageDoor.width/2;
    const obstacleLeft = safeX - 45; // 장애물의 대략적인 왼쪽 경계
    const obstacleRight = safeX + 45; // 장애물의 대략적인 오른쪽 경계
    
    if (obstacleRight > doorLeft - 50 && obstacleLeft < doorRight + 50) { // 50픽셀 여유 공간
      console.log(`[DEBUG] createSafeObstacle: 출구와 겹침으로 실패. safeX: ${safeX}, doorX: ${stageDoor.x}, doorLeft: ${doorLeft}, doorRight: ${doorRight}`);
      return false;
    }
  }
  
      // 안전한 위치에 장애물 생성
    if (!isObstacleOverlapping(safeX)) {
      // 함정 50%, 가시 50% 비율로 생성 (가시는 큰 가시와 작은 가시 50:50)
      const totalObstacles = getObstacleCount(currentStage);
      const targetTraps = Math.floor(totalObstacles * 0.5); // 50%는 함정
      const currentTraps = stageObstacles.filter(obs => obs.type === OBSTACLE_TYPES.TRAP).length;
      const currentSpikes = stageObstacles.filter(obs => obs.type === OBSTACLE_TYPES.SPIKE_SMALL || obs.type === OBSTACLE_TYPES.SPIKE_LARGE).length;
      
      // 랜덤하게 장애물 타입 결정 (함정과 가시가 골고루 섞이도록)
      const remainingObstacles = totalObstacles - currentTraps - currentSpikes;
      const remainingTraps = targetTraps - currentTraps;
      const remainingSpikes = (totalObstacles - targetTraps) - currentSpikes;
      
      // 남은 장애물 중에서 랜덤하게 선택
      if (remainingTraps > 0 && remainingSpikes > 0) {
        // 함정과 가시가 모두 남아있으면 랜덤 선택
        if (Math.random() < 0.5) {
          createTrapObstacle(safeX);
        } else {
          // 가시 중에서 큰 가시와 작은 가시 50:50
          if (Math.random() < 0.5) {
            createSmallSpikeObstacle(safeX);
          } else {
            createLargeSpikeObstacle(safeX);
          }
        }
      } else if (remainingTraps > 0) {
        // 함정만 남아있으면 함정 생성
        createTrapObstacle(safeX);
      } else if (remainingSpikes > 0) {
        // 가시만 남아있으면 가시 생성
        if (Math.random() < 0.5) {
          createSmallSpikeObstacle(safeX);
        } else {
          createLargeSpikeObstacle(safeX);
        }
      } else {
        // 기본 비율: 함정 50%, 가시 50%
        if (Math.random() < 0.5) {
          createTrapObstacle(safeX);
        } else {
          // 가시 중에서 큰 가시와 작은 가시 50:50
          if (Math.random() < 0.5) {
            createSmallSpikeObstacle(safeX);
          } else {
            createLargeSpikeObstacle(safeX);
          }
        }
      }
      obstacleCounter++;
      return true;
    }
  return false;
}

// 장애물이 겹치는지 체크하는 함수 (스테이지용)
function isObstacleOverlapping(x, minDistance = 150) {
  for (let obstacle of stageObstacles) {
    if (Math.abs(obstacle.x - x) < minDistance) {
      return true;
    }
  }
  return false;
}

// 작은 가시장애물 생성 (75x25)
function createSmallSpikeObstacle(x) {
  const obstacle = {
    x: x,
    y: getGroundY(),
    width: 75,
    height: 25,
    type: OBSTACLE_TYPES.SPIKE_SMALL,
    spikes: [
      { x: 0, y: 0, width: 25, height: 25 },
      { x: 25, y: 0, width: 25, height: 25 },
      { x: 50, y: 0, width: 25, height: 25 }
    ]
  };
  stageObstacles.push(obstacle);
}

// 큰 가시장애물 생성 (90x30)
function createLargeSpikeObstacle(x) {
  const obstacle = {
    x: x,
    y: getGroundY(),
    width: 90,
    height: 30,
    type: OBSTACLE_TYPES.SPIKE_LARGE,
    spikes: [
      { x: 0, y: 0, width: 30, height: 30 },
      { x: 30, y: 0, width: 30, height: 30 },
      { x: 60, y: 0, width: 30, height: 30 }
    ]
  };
  stageObstacles.push(obstacle);
}

// 함정장애물 생성 (고정 위치)
function createTrapObstacle(x) {
  const obstacle = {
    x: x,
    y: getGroundY(),
    width: 80, // 더 넓게
    height: 60, // 더 깊게
    type: OBSTACLE_TYPES.TRAP,
    isOpen: true, // 항상 열린 상태로 시작
    openTimer: 0
  };
  stageObstacles.push(obstacle);
}

function drawPlayer() {
  const { x, y, width, height } = player;
  
  // NaN 체크 및 안전장치
  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    debugError('[오류] drawPlayer에서 NaN 감지. x:', x, 'y:', y, 'width:', width, 'height:', height);
    return; // 그리기 중단
  }
  
  ctx.save();
  
  // 안전한 카메라 오프셋 계산 (NaN 방지)
  if (isNaN(x) || isNaN(cameraX)) {
    debugError('[오류] drawPlayer에서 NaN 감지. x:', x, 'cameraX:', cameraX);
    return; // 그리기 중단
  }
  const safeCameraX = Math.max(0, cameraX || 0);
  const renderX = x - cameraX;
  // debugLog('[drawPlayer] player.x:', x, 'cameraX:', cameraX, 'renderX:', renderX);
  ctx.translate(renderX, y);
  
  // 걷기 애니메이션 계산 (움직일 때만) - deltaTime 사용
  if (player.isOnGround && !player.isFalling) {
    if (Math.abs(player.vx) > 0) { // 움직일 때만 애니메이션
      player.animationTimer += player.walkSpeed * deltaTime;
      player.legAngle = Math.sin(player.animationTimer) * 15; // 다리 움직임
      player.armAngle = Math.sin(player.animationTimer) * 10; // 팔 움직임
    } else {
      // 정지해있을 때는 기본 자세
      player.legAngle = 0;
      player.armAngle = 0;
    }
  } else if (player.isFalling) {
    // 떨어지는 애니메이션
    player.legAngle = 45; // 다리를 위로 올림
    player.armAngle = -30; // 팔을 아래로 내림
  } else {
    // 점프 중일 때
    player.legAngle = 0;
    player.armAngle = 0;
  }
  
  // 몸통
  ctx.fillStyle = '#4A90E2';
  ctx.fillRect(-width/4, -height/2, width/2, height/1.5);
  
  // 머리
  ctx.beginPath();
  ctx.arc(0, -height/1.2, width/4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD39B';
  ctx.fill();
  
  // 팔 (움직이는 애니메이션)
  ctx.strokeStyle = '#FFD39B';
  ctx.lineWidth = 6;
  ctx.save();
  ctx.translate(-width/4, -height/2 + 10);
  ctx.rotate(player.armAngle * Math.PI / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-width/4, 0);
  ctx.stroke();
  ctx.restore();
  
  ctx.save();
  ctx.translate(width/4, -height/2 + 10);
  ctx.rotate(-player.armAngle * Math.PI / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width/4, 0);
  ctx.stroke();
  ctx.restore();
  
  // 다리 (움직이는 애니메이션)
  ctx.save();
  ctx.translate(-width/8, height/3);
  ctx.rotate(player.legAngle * Math.PI / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, height/6);
  ctx.stroke();
  ctx.restore();
  
  ctx.save();
  ctx.translate(width/8, height/3);
  ctx.rotate(-player.legAngle * Math.PI / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, height/6);
  ctx.stroke();
  ctx.restore();
  
  ctx.restore();
  
  // 디버그: 충돌 영역 표시 (개발 중에만 사용)
  if (false) { // true로 바꾸면 충돌 영역이 보입니다
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - cameraX - player.width/2, y - player.height/2 - player.width/4, player.width, player.height + player.width/4);
  }
}

// 가시장애물 그리기
function drawSpikeObstacle(obstacle) {
  ctx.save();
  ctx.translate(obstacle.x - cameraX, obstacle.y); // 카메라 오프셋 적용
  
  // 장애물 타입에 따라 색상 결정
  let fillColor, strokeColor;
  if (obstacle.type === OBSTACLE_TYPES.SPIKE_SMALL) {
    // 작은 가시: 주황색 계열
    fillColor = '#FF8C00'; // 진한 주황색
    strokeColor = '#FF4500'; // 빨간 주황색
  } else if (obstacle.type === OBSTACLE_TYPES.SPIKE_LARGE) {
    // 큰 가시: 빨간색 계열
    fillColor = '#FF4444'; // 빨간색
    strokeColor = '#CC0000'; // 진한 빨간색
  } else {
    // 기본값
    fillColor = '#FF4444';
    strokeColor = '#CC0000';
  }
  
  // 3개 가시 그리기 (바닥에서 위로 솟아나오는 형태)
  for (let spike of obstacle.spikes) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(spike.x + spike.width/2, spike.y - spike.height); // 위쪽 끝
    ctx.lineTo(spike.x, spike.y); // 왼쪽 아래
    ctx.lineTo(spike.x + spike.width, spike.y); // 오른쪽 아래
    ctx.closePath();
    ctx.fill();
    
    // 가시 테두리
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  ctx.restore();
}

// 함정장애물 그리기
function drawTrapObstacle(obstacle) {
  ctx.save();
  ctx.translate(obstacle.x - cameraX, obstacle.y); // 카메라 오프셋 적용
  
  // 함정 구멍 (검은색)
  ctx.fillStyle = '#000000';
  ctx.fillRect(-obstacle.width/2, 0, obstacle.width, obstacle.height);
  
  // 함정 가장자리 (어두운 회색)
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 4;
  ctx.strokeRect(-obstacle.width/2, 0, obstacle.width, obstacle.height);
  
  // 함정 내부 그림자 효과
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-obstacle.width/2 + 5, 5, obstacle.width - 10, obstacle.height - 10);
  
  // 함정 바닥 (더 어두운 부분)
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-obstacle.width/2 + 10, obstacle.height - 15, obstacle.width - 20, 10);
  
  ctx.restore();
}

// 충돌 판정 (더 정확한 판정)
function checkCollision(rect1, rect2) {
  return rect1.x - rect1.width/2 < rect2.x + rect2.width/2 &&
         rect1.x + rect1.width/2 > rect2.x - rect2.width/2 &&
         rect1.y - rect1.height/2 < rect2.y + rect2.height/2 &&
         rect1.y + rect1.height/2 > rect2.y - rect2.height/2;
}

// 가시와의 충돌 판정 (사각형 기반으로 간단하게)
function checkSpikeCollision(player, spikeObstacle) {
  const playerLeft = player.x - player.width/2;
  const playerRight = player.x + player.width/2;
  // 플레이어의 실제 시각적 높이 (머리 포함)
  const playerTop = player.y - player.height/2 - player.width/4; // 머리까지 포함
  const playerBottom = player.y + player.height/2;
  
  // 각 가시와의 충돌 체크
  for (let spike of spikeObstacle.spikes) {
    const spikeX = spikeObstacle.x + spike.x;
    const spikeY = spikeObstacle.y;
    const spikeWidth = spike.width;
    const spikeHeight = spike.height;
    
    // 가시의 충돌 영역 (삼각형의 절반 높이만큼만)
    const spikeCollisionHeight = spikeHeight * 0.6; // 삼각형의 60% 높이만 충돌 영역으로 설정
    const spikeTopY = spikeY - spikeCollisionHeight;
    
    // 사각형 충돌 판정 (가시의 상단 부분만)
    if (playerRight > spikeX && 
        playerLeft < spikeX + spikeWidth && 
        playerBottom > spikeTopY && 
        playerTop < spikeY) {
      return true;
    }
  }
  return false;
}



// 코인 충돌 체크 (얼굴까지 포함)
function checkCoinCollision(player, coin) {
  // 플레이어의 전체 높이 (머리 포함)를 고려한 충돌 판정
  const playerTop = player.y - player.height/2 - player.width/4; // 머리까지 포함
  const playerBottom = player.y + player.height/2;
  const playerLeft = player.x - player.width/2;
  const playerRight = player.x + player.width/2;
  
  // 코인의 충돌 영역
  const coinTop = coin.y - coin.height/2;
  const coinBottom = coin.y + coin.height/2;
  const coinLeft = coin.x - coin.width/2;
  const coinRight = coin.x + coin.width/2;
  
  // 사각형 충돌 판정
  return playerRight > coinLeft && 
         playerLeft < coinRight && 
         playerBottom > coinTop && 
         playerTop < coinBottom;
}

function updatePlayer() {
  if (gameOver) return;
  
  // NaN 체크 및 초기화 (매 프레임마다)
  if (isNaN(player.x) || isNaN(player.vx) || isNaN(player.y) || isNaN(player.vy)) {
    console.error('[오류] 플레이어 위치/속도가 NaN입니다. 초기화합니다.');
    player.x = 100;
    player.y = getGroundY() - player.height/2;
    player.vx = 0;
    player.vy = 0;
    return; // 이 프레임은 건너뛰기
  }
  
  // 좌우 이동 (플레이어가 직접 조작)
  // debugLog('[디버그] player.speed:', player.speed, 'playerItems.speedBonus:', playerItems.speedBonus);
  const speedBonus = 1 + ((playerItems.speedBonus || 0) / 100);
  const actualSpeed = (player.speed || 4) * speedBonus;
  // debugLog('[디버그] speedBonus:', speedBonus, 'actualSpeed:', actualSpeed);
  
  // 속도 계산이 NaN이 되지 않도록 보호
  if (isNaN(actualSpeed)) {
    debugError('[오류] 속도 계산이 NaN입니다. 기본값 사용.');
    // debugError('[디버그] player.speed:', player.speed, 'playerItems.speedBonus:', playerItems.speedBonus, 'speedBonus:', speedBonus);
    player.vx = 0;
  } else {
    if (keys['ArrowLeft']) {
      player.vx = -actualSpeed;
    } else if (keys['ArrowRight']) {
      player.vx = actualSpeed;
    } else {
      player.vx = 0;
    }
  }
  // debugLog('[이동] player.x:', player.x, 'player.vx:', player.vx, 'keys:', keys);

  
  // 점프 (문이 열려있지 않을 때만)
  if (keys['Space'] && player.isOnGround && !player.isFalling && !stageDoor?.isOpen && !shopOpen && !nearShop) {
    player.vy = -player.jumpPower;
    player.isOnGround = false;
    debugLog('[점프] player.y:', player.y, 'player.vy:', player.vy);
  }

  // 중력 적용
  player.vy += gravity;
  
  // 속도가 NaN이 되지 않도록 보호
  if (isNaN(player.vx)) player.vx = 0;
  if (isNaN(player.vy)) player.vy = 0;
  
  player.x += player.vx;
  player.y += player.vy;

  // x좌표 제한
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
    // debugLog('[x제한] player.x가 0보다 작아 제한됨:', player.x);
  }
  // debugLog('[이동후] player.x:', player.x, 'player.vx:', player.vx);

  // 카메라 계산 (NaN 방지)
  if (isNaN(player.x)) {
    debugError('[오류] player.x가 NaN입니다. 초기화합니다.');
    player.x = 100;
    player.vx = 0;
  }
  cameraX = Math.max(0, player.x - 200);
  // debugLog('[카메라] cameraX:', cameraX, 'player.x:', player.x);

  // 실제 거리 계산 (오른쪽으로 갈 때는 증가, 왼쪽으로 갈 때는 감소)
  if (keys['ArrowRight']) {
    actualDistance += (1/60) * deltaTime; // deltaTime을 사용하여 프레임 독립적인 거리 계산
    stageDistance += (1/60) * deltaTime; // 스테이지 거리도 함께 증가
  } else if (keys['ArrowLeft']) {
    actualDistance -= (1/60) * deltaTime; // deltaTime을 사용하여 프레임 독립적인 거리 계산
    stageDistance -= (1/60) * deltaTime; // 스테이지 거리도 함께 감소
  }
  
  // 거리가 음수가 되지 않도록 보호
  if (actualDistance < 0) actualDistance = 0;
  if (stageDistance < 0) stageDistance = 0;

  // 무적 시간 처리 (deltaTime 사용)
  if (player.invincible) {
    player.invincibleTimer += deltaTime;
    if (player.invincibleTimer > 1.0) { // 1초 후 무적 해제
      player.invincible = false;
      player.invincibleTimer = 0;
    }
  }

  // 화면 깜빡임 효과 처리 (deltaTime 사용)
  if (screenFlash) {
    screenFlashTimer += deltaTime;
    if (screenFlashTimer > 0.5) { // 0.5초 후 깜빡임 종료
      screenFlash = false;
      screenFlashTimer = 0;
    }
  }

  // 플레이어가 스테이지 시작 지점보다 너무 뒤로 가지 못하도록 제한
  if (isNaN(stageStartX) || player.x < stageStartX - 50) {
    player.x = Math.max(100, stageStartX - 50);
    player.vx = 0; // 뒤로 가려는 속도도 멈춤
  }
  
  // 플레이어가 화면 왼쪽 끝을 넘어가지 않도록 제한
  if (player.x < 100) {
    player.x = 100;
    player.vx = 0;
  }

  // 바닥 충돌 (캐릭터가 땅 위에 서도록)
  if (player.y > getGroundY() - player.height/2 && !player.isFalling) {
    player.y = getGroundY() - player.height/2;
    player.vy = 0;
    player.isOnGround = true;
  }

  // 카메라가 캐릭터를 따라감 (단순하고 안정적인 시스템)
  if (isNaN(player.x) || player.x <= 200) {
    cameraX = 0; // 플레이어가 왼쪽에 있을 때는 카메라 고정
  } else {
    cameraX = player.x - 200; // 플레이어가 오른쪽으로 이동할 때 카메라 따라감
  }

  // 코인과 충돌 체크
  for (let coin of stageCoins) {
    if (!coin.collected && checkCoinCollision(player, coin)) {
      coin.collected = true;
      coinsCollected++;
      playCoinSound();
    }
  }

  // 장애물과 충돌 체크
  for (let obstacle of stageObstacles) {
    if (obstacle.type === OBSTACLE_TYPES.SPIKE_SMALL || obstacle.type === OBSTACLE_TYPES.SPIKE_LARGE) {
      // 가시장애물은 특별한 충돌 판정 사용 (무적 상태가 아닐 때만)
      if (!player.invincible && checkSpikeCollision(player, obstacle)) {
        hearts--; // 하트 감소
        if (hearts <= 0) {
          savedTotalDistance = actualDistance; // 게임 오버 시 전체 거리 저장
          gameOver = true;
        } else {
          // 하트가 남아있으면 하트만 차감하고 현재 위치 유지
          // 플레이어 위치는 리셋하지 않음
          // 잠시 무적 시간을 주어 연속 충돌 방지
          player.invincible = true;
          player.invincibleTimer = 0;
          
          // 화면 깜빡임 효과 시작
          screenFlash = true;
          screenFlashTimer = 0;
        }
      }
    } else if (obstacle.type === OBSTACLE_TYPES.TRAP) {
      // 함정장애물 충돌 체크 - 함정에 빠지면 떨어지는 애니메이션
      // 함정은 땅 위의 구멍이므로, 플레이어가 함정 위에 있을 때만 체크
      const playerBottom = player.y + player.height/2;
      const trapTop = getGroundY(); // 함정의 위쪽 경계는 땅 표시와 같음
      
      if (playerBottom >= trapTop && 
          player.x > obstacle.x - obstacle.width/2 && 
          player.x < obstacle.x + obstacle.width/2) {
        if (!player.isFalling) {
          player.isFalling = true;
          player.fallTimer = 0;
          player.vy = 3; // 천천히 떨어짐
          player.isOnGround = false; // 땅에서 떨어짐
        }
      }
    }
  }

  // 떨어지는 애니메이션 처리 (deltaTime 사용)
  if (player.isFalling) {
    player.fallTimer += deltaTime;
    player.vy += 0.5 * deltaTime; // 떨어지는 속도 증가 (프레임 독립적)
    
    // 충분히 떨어지면 바로 게임 오버 (하트 차감 없이)
    if (player.fallTimer > 2.0) { // 2초 후
      savedTotalDistance = actualDistance; // 게임 오버 시 전체 거리 저장
      gameOver = true; // 바로 게임 오버
    }
  }

  // 화면 밖으로 떨어지면 게임 오버
  if (player.y > canvas.height + 300) {
    savedTotalDistance = actualDistance; // 게임 오버 시 전체 거리 저장
    gameOver = true;
  }

  // 점수 계산 (이동 거리 + 코인 개수)
  score = Math.floor(actualDistance) + coinsCollected;
  
  // 스테이지 클리어 체크
  checkStageClear();
}

function updateObstacles() {
  // 스테이지 시작 지점보다 뒤에 있는 장애물만 제거 (플레이어가 뒤로 가도 장애물이 사라지지 않도록)
  for (let i = stageObstacles.length - 1; i >= 0; i--) {
    const obstacle = stageObstacles[i];
    if (obstacle.x < stageStartX - 200) { // 스테이지 시작 지점보다 200픽셀 뒤에 있는 것만 제거
      stageObstacles.splice(i, 1);
    }
  }
  
  // 스테이지 시작 지점보다 뒤에 있는 코인만 제거
  for (let i = stageCoins.length - 1; i >= 0; i--) {
    const coin = stageCoins[i];
    if (coin.x < stageStartX - 200) { // 스테이지 시작 지점보다 200픽셀 뒤에 있는 것만 제거
      stageCoins.splice(i, 1);
    }
  }
}

// 땅 그리기
function drawGround() {
  // 땅 표시 (가로 한 줄)
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, getGroundY());
  ctx.lineTo(canvas.width, getGroundY());
  ctx.stroke();
  
  // 낭떠러지 표시 (땅 아래 부분)
  ctx.fillStyle = '#2F4F4F'; // 어두운 회색
  ctx.fillRect(0, getGroundY() + 5, canvas.width, canvas.height - getGroundY() - 5);
  
  // 낭떠러지 테두리
  ctx.strokeStyle = '#1a2a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, getGroundY() + 5);
  ctx.lineTo(canvas.width, getGroundY() + 5);
  ctx.stroke();
}

function drawUI() {
  // 왼쪽 UI
  ctx.fillStyle = '#000';
  ctx.font = '24px Arial';
  ctx.fillText(`Score: ${score}`, 20, 40);
  ctx.fillText(`Total Distance: ${Math.floor(actualDistance)}m`, 20, 70);
  ctx.fillText(`Stage: ${currentStage}`, 20, 100);
  ctx.fillText(`Stage Progress: ${Math.floor(stageDistance)}m / ${getStageLength(currentStage)}m`, 20, 130);
  ctx.fillText(`Obstacles: ${stageObstacles.length}`, 20, 160);
  
  // 우측상단 하트 표시
  drawHearts(canvas.width - 230, 40);
  
  // 우측상단 코인 표시
  drawCoinDisplay();
  
  // 우측상단 아이템 표시
  drawItemDisplay();
  
  // 상점 근처에 있을 때 안내 메시지
  if (nearShop) {
    ctx.fillStyle = '#FFD700';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to open Shop', canvas.width/2, 50);
    ctx.textAlign = 'left';
  }
  
  // 문이 열렸을 때 안내 메시지
  if (stageDoor && stageDoor.isOpen && !stageCleared) {
    ctx.fillStyle = '#00FF00';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to enter next stage', canvas.width/2, 80);
    ctx.textAlign = 'left';
  }
  
  // 스테이지 클리어 메시지
  if (stageCleared) {
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${currentStage - 1} CLEAR!`, canvas.width/2, canvas.height/2);
    ctx.font = '24px Arial';
    ctx.fillText(`Stage Coins: ${coinsCollected}`, canvas.width/2, canvas.height/2 + 30);
    ctx.fillText(`Total Coins: ${totalCoinsCollected}`, canvas.width/2, canvas.height/2 + 60);
    ctx.fillText(`Next Stage: ${currentStage}`, canvas.width/2, canvas.height/2 + 90);
    ctx.textAlign = 'left';
  }
  
  // 치트키 안내 (화면 하단에 작게 표시)
  // ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  // ctx.font = '12px Arial';
  // ctx.textAlign = 'center';
  // ctx.fillText('F1: +10 코인 | F2: 디버그 모드', canvas.width/2, canvas.height - 10);
  // ctx.textAlign = 'left';
  
  // FPS 표시 (디버그 모드에서만)
  if (debugMode) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`FPS: ${currentFPS} (Target: ${targetFPS})`, canvas.width - 10, canvas.height - 10);
    ctx.textAlign = 'left';
  }
  
  if (gameOver) {
    drawGameOverMenu();
  }
}

window.addEventListener('keydown', (e) => {
  // 첫 번째 키 입력 시 배경음악 시작 (더 확실한 방법)
  if (!bgMusic && bgMusicEnabled) {
    debugLog('배경음악 시작 시도...');
    startBgMusic();
  }
  
  // 상점이 열려있을 때의 키 처리
  if (shopOpen) {
    if (e.code === 'ArrowUp') {
      selectedItem = (selectedItem - 1 + (shopItems.length + 1)) % (shopItems.length + 1);
      e.preventDefault();
    } else if (e.code === 'ArrowDown') {
      selectedItem = (selectedItem + 1) % (shopItems.length + 1);
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (selectedItem < shopItems.length) {
        buyItem();
      } else {
        shopOpen = false; // 나가기 선택
        showMobileControls(); // 모바일 컨트롤 다시 표시
      }
      e.preventDefault();
    }
    return; // 상점이 열려있으면 다른 키 입력 무시
  }
  
  // 일반 게임 키 처리
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
    keys[e.code] = true;
    e.preventDefault();
  }

  if (e.code === 'Space' && nearShop) {
    shopOpen = true; // 상점 열기
    hideMobileControls(); // 모바일 컨트롤 숨기기
    e.preventDefault();
  }

  if (e.code === 'F1') {
    // F1 치트키: 10코인 추가
    coinsCollected += 10;
    console.log(`[치트키] 10코인 추가! 현재 스테이지 코인: ${coinsCollected}, 전체 코인: ${totalCoinsCollected + coinsCollected}`);
    e.preventDefault();
  }

  if (e.code === 'F2') {
    // 디버그 모드 토글
    debugMode = !debugMode;
    console.log('디버그 모드:', debugMode ? '켜짐' : '꺼짐');
    e.preventDefault();
  }

  if (e.code === 'F3') {
    // FPS 조정 (30, 45, 60 순환)
    if (targetFPS === 60) {
      targetFPS = 30;
    } else if (targetFPS === 30) {
      targetFPS = 45;
    } else {
      targetFPS = 60;
    }
    frameTime = 1000 / targetFPS;
    console.log(`FPS 설정: ${targetFPS}`);
    e.preventDefault();
  }

  // 게임 오버 메뉴 키 처리
  if (gameOver) {
    if (e.code === 'ArrowUp') {
      gameOverSelectedOption = (gameOverSelectedOption - 1 + 2) % 2;
      e.preventDefault();
    } else if (e.code === 'ArrowDown') {
      gameOverSelectedOption = (gameOverSelectedOption + 1) % 2;
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (gameOverSelectedOption === 0) {
        // 현재 스테이지에서 이어하기
        restartGame();
      } else {
        // 처음부터 다시하기
        restartFromBeginning();
      }
      e.preventDefault();
    }
    return; // 게임 오버 시 다른 키 입력 무시
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
    keys[e.code] = false;
    e.preventDefault();
  }
});

// 마우스 클릭으로도 음악 시작
window.addEventListener('click', (e) => {
  // 캔버스 클릭은 점프용이므로 음악 시작하지 않음
  if (e.target === canvas) return;
  
  if (!bgMusic && bgMusicEnabled) {
    debugLog('마우스 클릭으로 배경음악 시작 시도...');
    startBgMusic();
  }
});

function gameLoop(currentTime) {
  // FPS 제한 및 측정
  if (lastFrameTime === 0) {
    lastFrameTime = currentTime;
  }
  
  const frameDeltaTime = currentTime - lastFrameTime;
  
  // 목표 프레임 시간보다 짧으면 다음 프레임까지 대기
  if (frameDeltaTime < frameTime) {
    requestAnimationFrame(gameLoop);
    return;
  }
  
  // FPS 측정
  fpsCounter++;
  fpsUpdateTimer += frameDeltaTime;
  if (fpsUpdateTimer >= 1000) { // 1초마다 FPS 업데이트
    currentFPS = fpsCounter;
    fpsCounter = 0;
    fpsUpdateTimer = 0;
  }
  
  // deltaTime 계산 (초 단위, 60FPS 기준으로 정규화)
  deltaTime = frameDeltaTime / 16.67; // 16.67ms = 60FPS의 한 프레임 시간
  
  lastFrameTime = currentTime;
  
  // 플레이어 위치가 NaN인지 체크
  if (isNaN(player.x) || isNaN(player.y)) {
    debugError('[오류] gameLoop에서 플레이어 위치가 NaN입니다. 초기화합니다.');
    player.x = 100;
    player.y = getGroundY() - player.height/2;
    player.vx = 0;
    player.vy = 0;
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 땅을 먼저 그리기
  drawGround();
  
  updatePlayer();
  updateObstacles();
  updateShop(); // 상점 업데이트
  updateDoor(); // 문 애니메이션 업데이트
  
  // 코인 그리기
  for (let coin of stageCoins) {
    drawCoin(coin);
  }
  
  // 장애물 그리기
  for (let obstacle of stageObstacles) {
    if (obstacle.type === OBSTACLE_TYPES.SPIKE_SMALL || obstacle.type === OBSTACLE_TYPES.SPIKE_LARGE) {
      drawSpikeObstacle(obstacle);
    } else if (obstacle.type === OBSTACLE_TYPES.TRAP) {
      drawTrapObstacle(obstacle);
    }
  }
  
  // 상점 그리기
  drawStageShop();
  
  // 문 그리기
  drawStageDoor();
  
  // 플레이어를 마지막에 그리기 (항상 앞에 표시)
  drawPlayer();
  
  drawUI();
  drawShopUI(); // 상점 UI 그리기
  drawInsufficientFundsMessage(); // 돈 부족 메시지 그리기
  drawMaxHeartsMessage(); // 하트 최대 메시지 그리기
  
  // 화면 깜빡임 효과 그리기
  if (screenFlash) {
    // 깜빡이는 효과 (빨간색 반투명 오버레이) - deltaTime 사용
    const flashAlpha = Math.sin(screenFlashTimer * 2.0) * 0.3 + 0.1; // 0.1 ~ 0.4 사이로 깜빡임 (2.0으로 조정)
    ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  requestAnimationFrame(gameLoop);
}

// 초기 스테이지 시작
initializeStage(currentStage);

// 배경음악 시작
startBgMusic();

// 모바일 컨트롤 표시/숨김 함수
function showMobileControls() {
  const touchControls = document.querySelector('.touch-controls');
  const mobileInstructions = document.querySelector('.mobile-instructions');
  const extraControls = document.querySelector('.extra-controls');
  const musicBtn = document.getElementById('musicBtn');
  if (touchControls) {
    touchControls.style.display = 'flex';
  }
  if (mobileInstructions) {
    mobileInstructions.style.display = 'block';
  }
  if (extraControls) {
    extraControls.style.display = 'flex';
  }
  if (musicBtn) {
    updateMusicButtonState();
  }
}

function hideMobileControls() {
  const touchControls = document.querySelector('.touch-controls');
  const mobileInstructions = document.querySelector('.mobile-instructions');
  const extraControls = document.querySelector('.extra-controls');
  if (touchControls) {
    touchControls.style.display = 'none';
  }
  if (mobileInstructions) {
    mobileInstructions.style.display = 'none';
  }
  if (extraControls) {
    extraControls.style.display = 'none';
  }
}

// 모바일 컨트롤 좌우 바꾸기 함수
function swapMobileControls() {
  mobileControlsSwapped = !mobileControlsSwapped;
  const leftControls = document.querySelector('.left-controls');
  const rightControls = document.querySelector('.right-controls');
  
  if (mobileControlsSwapped) {
    // 컨트롤 바꾸기
    leftControls.style.order = '2';
    rightControls.style.order = '1';
    debugLog('모바일 컨트롤 바꿈: 이동키 오른쪽, 점프키 왼쪽');
  } else {
    // 원래대로
    leftControls.style.order = '1';
    rightControls.style.order = '2';
    debugLog('모바일 컨트롤 원래대로: 이동키 왼쪽, 점프키 오른쪽');
  }
}

// 음악 버튼 상태 업데이트 함수
function updateMusicButtonState() {
  const musicBtn = document.getElementById('musicBtn');
  if (musicBtn) {
    console.log('음악 버튼 상태 업데이트:', bgMusicEnabled);
    if (bgMusicEnabled) {
      musicBtn.textContent = '🎵';
      musicBtn.classList.remove('muted');
    } else {
      musicBtn.textContent = '🔇';
      musicBtn.classList.add('muted');
    }
  } else {
    console.error('updateMusicButtonState: 음악 버튼을 찾을 수 없습니다!');
  }
}

// 터치 컨트롤 추가
function initTouchControls() {
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const spaceBtn = document.getElementById('spaceBtn');
  const swapBtn = document.getElementById('swapBtn');
  const musicBtn = document.getElementById('musicBtn');
  
  if (!leftBtn || !rightBtn || !spaceBtn) return;
  
  // 왼쪽 버튼
  leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = true;
  });
  
  leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = false;
  });
  
  // 오른쪽 버튼
  rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = true;
  });
  
  rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = false;
  });
  
  // 스페이스 버튼 (점프)
  spaceBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys['Space'] = true;
    
    // 상점 근처에서 스페이스 터치 시 상점 열기
    if (nearShop && !shopOpen) {
      shopOpen = true;
      hideMobileControls();
    }
  });
  
  spaceBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['Space'] = false;
  });
  
  // 마우스 이벤트도 추가 (데스크톱에서 테스트용)
  leftBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = true;
  });
  
  leftBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = false;
  });
  
  leftBtn.addEventListener('mouseleave', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = false;
  });
  
  rightBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = true;
  });
  
  rightBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = false;
  });
  
  rightBtn.addEventListener('mouseleave', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = false;
  });
  
  spaceBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    keys['Space'] = true;
    
    // 상점 근처에서 스페이스 클릭 시 상점 열기
    if (nearShop && !shopOpen) {
      shopOpen = true;
      hideMobileControls();
    }
  });
  
  spaceBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    keys['Space'] = false;
  });
  
  spaceBtn.addEventListener('mouseleave', (e) => {
    e.preventDefault();
    keys['Space'] = false;
  });
  
  // 바꾸기 버튼 이벤트
  if (swapBtn) {
    swapBtn.addEventListener('click', (e) => {
      e.preventDefault();
      swapMobileControls();
    });
    
    swapBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      swapMobileControls();
    });
  }
  
  // 음악 버튼 이벤트
  if (musicBtn) {
    console.log('음악 버튼 이벤트 리스너 등록');
    musicBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('음악 버튼 클릭됨');
      toggleBgMusic();
      updateMusicButtonState();
    });
    
    musicBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      console.log('음악 버튼 터치됨');
      toggleBgMusic();
      updateMusicButtonState();
    });
  } else {
    console.error('음악 버튼을 찾을 수 없습니다!');
  }

}

// 터치 컨트롤 초기화
initTouchControls();

// 페이지 로드 완료 후 음악 버튼 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 로드 완료, 음악 버튼 초기화');
  updateMusicButtonState();
});

// 모바일 기기 감지 및 컨트롤 표시
function detectMobileAndShowControls() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (window.innerWidth <= 768 && window.innerHeight <= 1024);
  
  // 모든 기기에서 60FPS로 통일
  targetFPS = 60;
  frameTime = 1000 / targetFPS;
  debugLog(`모든 기기에서 FPS ${targetFPS}로 설정`);
  
  if (isMobile) {
    showMobileControls();
    debugLog('모바일 기기 감지됨 - 터치 컨트롤 표시');
  } else {
    // 데스크톱에서는 터치 컨트롤만 숨기고 음악 버튼은 표시
    const touchControls = document.querySelector('.touch-controls');
    const mobileInstructions = document.querySelector('.mobile-instructions');
    const extraControls = document.querySelector('.extra-controls');
    
    if (touchControls) {
      touchControls.style.display = 'none';
    }
    if (mobileInstructions) {
      mobileInstructions.style.display = 'none';
    }
    if (extraControls) {
      extraControls.style.display = 'flex';
    }
    
    // 음악 버튼 상태 업데이트
    const musicBtn = document.getElementById('musicBtn');
    if (musicBtn) {
      updateMusicButtonState();
    }
    
    debugLog('데스크톱 기기 감지됨 - 터치 컨트롤 숨김, 음악 버튼 표시');
  }
}

// 페이지 로드 시 모바일 감지
detectMobileAndShowControls();

// 화면 크기 변경 시 모바일 감지
window.addEventListener('resize', detectMobileAndShowControls);



function playCoinSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(880, ctx.currentTime);
  o.frequency.linearRampToValueAtTime(1760, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.2, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.15);
  o.onended = () => ctx.close();
}

// 배경음악 시작
function startBgMusic() {
  if (!bgMusicEnabled) return;
  
  // 이미 음악이 재생 중이면 중복 생성하지 않음
  if (bgMusic) return;
  
  bgMusic = new Audio('./music/exploration-chiptune-rpg-adventure-theme-336428.mp3');
  bgMusic.loop = true; // 반복 재생
  bgMusic.volume = 0.3; // 볼륨 설정
  
  // 음악 로딩 완료 후 재생
  bgMusic.addEventListener('canplaythrough', () => {
    bgMusic.play().catch(e => {
      debugLog('음악 재생 실패:', e);
      // 재생 실패 시 다시 시도
      setTimeout(() => {
        if (bgMusicEnabled && bgMusic) {
          bgMusic.play().catch(e2 => debugLog('음악 재생 재시도 실패:', e2));
        }
      }, 1000);
    });
  });
  
  // 음악 로딩 실패 시 처리
  bgMusic.addEventListener('error', (e) => {
    debugLog('음악 로딩 실패:', e);
  });
}

// 배경음악 정지
function stopBgMusic() {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
}

// 배경음악 토글
function toggleBgMusic() {
  console.log('toggleBgMusic 호출됨, 현재 상태:', bgMusicEnabled);
  bgMusicEnabled = !bgMusicEnabled;
  console.log('음악 상태 변경됨:', bgMusicEnabled);
  if (bgMusicEnabled) {
    startBgMusic();
  } else {
    stopBgMusic();
  }
}

gameLoop(); 