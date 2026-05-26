const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const muteButton = document.getElementById("muteButton");
const touchLeftButton = document.getElementById("touchLeft");
const touchRightButton = document.getElementById("touchRight");
const touchShootButton = document.getElementById("touchShoot");

const gameState = {
  score: 0,
  highScore: 0,
  lives: 3,
  level: 1,
  gameOver: false,
  changingLevel: false,
  gameStarted: false,
  paused: false,
  muted: false
};

const player = {
  width: 54,
  height: 34,
  x: canvas.width / 2 - 27,
  y: canvas.height - 58,
  speed: 320
};

const keys = {
  left: false,
  right: false,
  shoot: false
};

const bullets = [];
const enemyBullets = [];
const explosionParticles = [];

let shootCooldown = 0;
let enemyShootTimer = 1;
let playerHitTimer = 0;
let levelMessageTimer = 0;
let enemyDiveTimer = 2.5;
let screenShakeTimer = 0;
let titlePulseTimer = 0;
let fadeAlpha = 0;
let fadeDirection = 0;
let audioContext = null;

const bulletSettings = {
  width: 6,
  height: 16,
  speed: 520,
  cooldownTime: 0.25
};

const enemyBulletSettings = {
  width: 6,
  height: 14,
  speed: 220,
  minShootDelay: 0.7,
  maxShootDelay: 1.8
};

const playerHitDuration = 1;
const levelMessageDuration = 1.8;
const screenShakeDuration = 0.35;
const fadeSpeed = 1.7;
const maxExplosionParticles = 120;

const enemyDiveSettings = {
  minDelay: 2.2,
  maxDelay: 4.2,
  diveDuration: 1.4,
  returnSpeed: 260
};

const enemies = [];

const enemySettings = {
  rows: 3,
  columns: 8,
  width: 34,
  height: 24,
  gapX: 22,
  gapY: 18,
  startX: 110,
  startY: 180,
  speed: 70,
  dropDistance: 18
};

let enemyDirection = 1;

const pointsPerEnemy = 100;
const startingEnemySpeed = enemySettings.speed;
const startingEnemyMinShootDelay = enemyBulletSettings.minShootDelay;
const startingEnemyMaxShootDelay = enemyBulletSettings.maxShootDelay;
const highScoreStorageKey = "retroArcadeHighScore";

function updateHud() {
  scoreElement.textContent = String(gameState.score).padStart(6, "0");
  highScoreElement.textContent = String(gameState.highScore).padStart(6, "0");
  livesElement.textContent = gameState.lives;
  levelElement.textContent = gameState.level;

  pauseButton.textContent = gameState.paused ? "Resume" : "Pause";
  muteButton.textContent = gameState.muted ? "Sound Off" : "Sound On";
}

function loadHighScore() {
  let savedHighScore = 0;

  try {
    savedHighScore = Number(window.localStorage.getItem(highScoreStorageKey));
  } catch (error) {
    savedHighScore = 0;
  }

  if (!Number.isNaN(savedHighScore)) {
    gameState.highScore = savedHighScore;
  }
}

function saveHighScore() {
  try {
    window.localStorage.setItem(highScoreStorageKey, String(gameState.highScore));
  } catch (error) {
    return;
  }
}

function checkHighScore() {
  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score;
    saveHighScore();
  }
}

function startAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(startFrequency, endFrequency, duration, type, volume) {
  if (!audioContext || gameState.muted) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playShootSound() {
  playTone(720, 220, 0.08, "square", 0.12);
}

function playExplosionSound() {
  playTone(150, 45, 0.35, "sawtooth", 0.18);
}

function playPlayerHitSound() {
  playTone(260, 70, 0.22, "triangle", 0.2);
}

function playGameOverSound() {
  playTone(220, 55, 0.75, "sawtooth", 0.22);
}

function startGame() {
  if (gameState.gameStarted) {
    return;
  }

  startAudio();
  gameState.gameStarted = true;
  gameState.paused = false;
  fadeAlpha = 1;
  fadeDirection = -1;
  updateHud();
}

function resetGame() {
  gameState.score = 0;
  gameState.lives = 3;
  gameState.level = 1;
  gameState.gameOver = false;
  gameState.changingLevel = false;
  gameState.gameStarted = true;
  gameState.paused = false;

  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - 58;

  keys.left = false;
  keys.right = false;
  keys.shoot = false;

  bullets.length = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  explosionParticles.length = 0;

  shootCooldown = 0;
  playerHitTimer = 0;
  levelMessageTimer = 0;
  screenShakeTimer = 0;
  fadeAlpha = 1;
  fadeDirection = -1;
  enemyDirection = 1;

  setLevelDifficulty();
  enemyShootTimer = getRandomShootDelay();
  enemyDiveTimer = getRandomDiveDelay();
  createEnemyWave();
  updateHud();
}

function togglePause() {
  if (!gameState.gameStarted || gameState.gameOver) {
    return;
  }

  gameState.paused = !gameState.paused;
  keys.left = false;
  keys.right = false;
  keys.shoot = false;
  updateHud();
}

function toggleMute() {
  gameState.muted = !gameState.muted;
  updateHud();
}

function createEnemyWave() {
  for (let row = 0; row < enemySettings.rows; row += 1) {
    for (let column = 0; column < enemySettings.columns; column += 1) {
      const x = enemySettings.startX + column * (enemySettings.width + enemySettings.gapX);
      const y = enemySettings.startY + row * (enemySettings.height + enemySettings.gapY);

      enemies.push({
        x: x,
        y: y,
        homeX: x,
        homeY: y,
        width: enemySettings.width,
        height: enemySettings.height,
        state: "formation",
        diveTime: 0,
        diveStartX: x,
        diveStartY: y,
        diveControlX: x,
        diveControlY: y,
        diveTargetX: x,
        diveTargetY: y
      });
    }
  }
}

function setLevelDifficulty() {
  const levelSpeedBonus = (gameState.level - 1) * 12;
  const levelShootBonus = (gameState.level - 1) * 0.08;

  enemySettings.speed = startingEnemySpeed + levelSpeedBonus;
  enemyBulletSettings.minShootDelay = Math.max(0.25, startingEnemyMinShootDelay - levelShootBonus);
  enemyBulletSettings.maxShootDelay = Math.max(0.7, startingEnemyMaxShootDelay - levelShootBonus);
}

function clearWaveBullets() {
  bullets.length = 0;
  enemyBullets.length = 0;
}

function startLevelComplete() {
  gameState.changingLevel = true;
  levelMessageTimer = levelMessageDuration;
  fadeAlpha = 0.45;
  fadeDirection = -1;
  clearWaveBullets();
}

function startNextLevel() {
  gameState.level += 1;
  gameState.changingLevel = false;
  enemyDirection = 1;

  setLevelDifficulty();
  enemyShootTimer = getRandomShootDelay();
  enemyDiveTimer = getRandomDiveDelay();
  fadeAlpha = 0.65;
  fadeDirection = -1;
  createEnemyWave();
  updateHud();
}

function updateLevelProgression(deltaTime) {
  if (gameState.changingLevel) {
    levelMessageTimer -= deltaTime;

    if (levelMessageTimer <= 0) {
      startNextLevel();
    }
  }
}

function checkLevelComplete() {
  if (enemies.length === 0 && !gameState.changingLevel) {
    startLevelComplete();
  }
}

function handleKeyDown(event) {
  if (!gameState.gameStarted) {
    if (event.code === "Space" || event.key === "Enter") {
      event.preventDefault();
      startGame();
    }

    return;
  }

  startAudio();

  if (event.key.toLowerCase() === "p") {
    togglePause();
    return;
  }

  if (event.key.toLowerCase() === "r") {
    resetGame();
    return;
  }

  if (event.key.toLowerCase() === "m") {
    toggleMute();
    return;
  }

  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    keys.left = true;
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    keys.right = true;
  }

  if (event.code === "Space") {
    keys.shoot = true;
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    keys.left = false;
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    keys.right = false;
  }

  if (event.code === "Space") {
    keys.shoot = false;
    event.preventDefault();
  }
}

function keepPlayerInsideCanvas() {
  if (player.x < 0) {
    player.x = 0;
  }

  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
  }
}

function updatePlayer(deltaTime) {
  if (keys.left) {
    player.x -= player.speed * deltaTime;
  }

  if (keys.right) {
    player.x += player.speed * deltaTime;
  }

  keepPlayerInsideCanvas();
}

function createBullet() {
  bullets.push({
    x: player.x + player.width / 2 - bulletSettings.width / 2,
    y: player.y - bulletSettings.height,
    width: bulletSettings.width,
    height: bulletSettings.height,
    speed: bulletSettings.speed
  });

  playShootSound();
}

function updateShooting(deltaTime) {
  if (shootCooldown > 0) {
    shootCooldown -= deltaTime;
  }

  if (keys.shoot && shootCooldown <= 0) {
    createBullet();
    shootCooldown = bulletSettings.cooldownTime;
  }
}

function updateBullets(deltaTime) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    bullets[i].y -= bullets[i].speed * deltaTime;

    if (bullets[i].y + bullets[i].height < 0) {
      bullets.splice(i, 1);
    }
  }
}

function createExplosion(x, y) {
  if (explosionParticles.length > maxExplosionParticles) {
    explosionParticles.splice(0, explosionParticles.length - maxExplosionParticles);
  }

  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 180;

    explosionParticles.push({
      x: x,
      y: y,
      size: 3 + Math.random() * 5,
      speedX: Math.cos(angle) * speed,
      speedY: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.35,
      maxLife: 0.8,
      color: i % 3 === 0 ? "#facc15" : i % 3 === 1 ? "#ff2d75" : "#22d3ee"
    });
  }
}

function updateExplosionParticles(deltaTime) {
  for (let i = explosionParticles.length - 1; i >= 0; i -= 1) {
    const particle = explosionParticles[i];

    particle.x += particle.speedX * deltaTime;
    particle.y += particle.speedY * deltaTime;
    particle.speedY += 80 * deltaTime;
    particle.life -= deltaTime;

    if (particle.life <= 0) {
      explosionParticles.splice(i, 1);
    }
  }
}

function getRandomShootDelay() {
  const delayRange = enemyBulletSettings.maxShootDelay - enemyBulletSettings.minShootDelay;
  return enemyBulletSettings.minShootDelay + Math.random() * delayRange;
}

function createEnemyBullet(enemy) {
  enemyBullets.push({
    x: enemy.x + enemy.width / 2 - enemyBulletSettings.width / 2,
    y: enemy.y + enemy.height,
    width: enemyBulletSettings.width,
    height: enemyBulletSettings.height,
    speed: enemyBulletSettings.speed
  });
}

function updateEnemyShooting(deltaTime) {
  if (enemies.length === 0) {
    return;
  }

  enemyShootTimer -= deltaTime;

  if (enemyShootTimer <= 0) {
    const randomEnemyIndex = Math.floor(Math.random() * enemies.length);
    createEnemyBullet(enemies[randomEnemyIndex]);
    enemyShootTimer = getRandomShootDelay();
  }
}

function updateEnemyBullets(deltaTime) {
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    enemyBullets[i].y += enemyBullets[i].speed * deltaTime;

    if (enemyBullets[i].y > canvas.height) {
      enemyBullets.splice(i, 1);
    }
  }
}

function getRandomDiveDelay() {
  const delayRange = enemyDiveSettings.maxDelay - enemyDiveSettings.minDelay;
  return enemyDiveSettings.minDelay + Math.random() * delayRange;
}

function startEnemyDive(enemy) {
  const playerCenterX = player.x + player.width / 2;

  enemy.state = "diving";
  enemy.diveTime = 0;
  enemy.diveStartX = enemy.x;
  enemy.diveStartY = enemy.y;
  enemy.diveControlX = (enemy.x + playerCenterX) / 2 + enemyDirection * 90;
  enemy.diveControlY = enemy.y + 120;
  enemy.diveTargetX = playerCenterX - enemy.width / 2;
  enemy.diveTargetY = player.y - enemy.height - 8;
}

function updateEnemyDiveTimer(deltaTime) {
  let availableEnemyCount = 0;

  for (let i = 0; i < enemies.length; i += 1) {
    if (enemies[i].state === "formation") {
      availableEnemyCount += 1;
    }
  }

  if (availableEnemyCount === 0) {
    return;
  }

  enemyDiveTimer -= deltaTime;

  if (enemyDiveTimer <= 0) {
    let randomEnemyIndex = Math.floor(Math.random() * availableEnemyCount);

    for (let i = 0; i < enemies.length; i += 1) {
      if (enemies[i].state === "formation") {
        if (randomEnemyIndex === 0) {
          startEnemyDive(enemies[i]);
          break;
        }

        randomEnemyIndex -= 1;
      }
    }

    enemyDiveTimer = getRandomDiveDelay();
  }
}

function getCurvePosition(startX, startY, controlX, controlY, endX, endY, progress) {
  const reverseProgress = 1 - progress;

  return {
    x: reverseProgress * reverseProgress * startX + 2 * reverseProgress * progress * controlX + progress * progress * endX,
    y: reverseProgress * reverseProgress * startY + 2 * reverseProgress * progress * controlY + progress * progress * endY
  };
}

function updateDivingEnemy(enemy, deltaTime) {
  enemy.diveTime += deltaTime;

  const progress = Math.min(enemy.diveTime / enemyDiveSettings.diveDuration, 1);
  const curvePosition = getCurvePosition(
    enemy.diveStartX,
    enemy.diveStartY,
    enemy.diveControlX,
    enemy.diveControlY,
    enemy.diveTargetX,
    enemy.diveTargetY,
    progress
  );

  enemy.x = curvePosition.x;
  enemy.y = curvePosition.y;

  if (progress >= 1) {
    enemy.state = "returning";
  }
}

function updateReturningEnemy(enemy, deltaTime) {
  const distanceX = enemy.homeX - enemy.x;
  const distanceY = enemy.homeY - enemy.y;
  const distance = Math.hypot(distanceX, distanceY);
  const moveDistance = enemyDiveSettings.returnSpeed * deltaTime;

  if (distance <= moveDistance) {
    enemy.x = enemy.homeX;
    enemy.y = enemy.homeY;
    enemy.state = "formation";
    return;
  }

  enemy.x += (distanceX / distance) * moveDistance;
  enemy.y += (distanceY / distance) * moveDistance;
}

function updateEnemyDives(deltaTime) {
  for (let i = 0; i < enemies.length; i += 1) {
    if (enemies[i].state === "diving") {
      updateDivingEnemy(enemies[i], deltaTime);
    }

    if (enemies[i].state === "returning") {
      updateReturningEnemy(enemies[i], deltaTime);
    }
  }
}

function moveEnemiesDown() {
  for (let i = 0; i < enemies.length; i += 1) {
    enemies[i].homeY += enemySettings.dropDistance;

    if (enemies[i].state === "formation") {
      enemies[i].y = enemies[i].homeY;
    }
  }
}

function updateEnemies(deltaTime) {
  let shouldChangeDirection = false;

  for (let i = 0; i < enemies.length; i += 1) {
    enemies[i].homeX += enemySettings.speed * enemyDirection * deltaTime;

    if (enemies[i].state === "formation") {
      enemies[i].x = enemies[i].homeX;
      enemies[i].y = enemies[i].homeY;
    }

    if (enemies[i].homeX <= 0 || enemies[i].homeX + enemies[i].width >= canvas.width) {
      shouldChangeDirection = true;
    }
  }

  if (shouldChangeDirection) {
    enemyDirection *= -1;
    moveEnemiesDown();
  }
}

function rectanglesOverlap(firstRectangle, secondRectangle) {
  return (
    firstRectangle.x < secondRectangle.x + secondRectangle.width &&
    firstRectangle.x + firstRectangle.width > secondRectangle.x &&
    firstRectangle.y < secondRectangle.y + secondRectangle.height &&
    firstRectangle.y + firstRectangle.height > secondRectangle.y
  );
}

function checkBulletEnemyCollisions() {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      if (rectanglesOverlap(bullets[bulletIndex], enemies[enemyIndex])) {
        createExplosion(
          enemies[enemyIndex].x + enemies[enemyIndex].width / 2,
          enemies[enemyIndex].y + enemies[enemyIndex].height / 2
        );
        playExplosionSound();
        bullets.splice(bulletIndex, 1);
        enemies.splice(enemyIndex, 1);
        gameState.score += pointsPerEnemy;
        checkHighScore();
        updateHud();
        break;
      }
    }
  }
}

function damagePlayer() {
  gameState.lives -= 1;
  playerHitTimer = playerHitDuration;
  screenShakeTimer = screenShakeDuration;
  playPlayerHitSound();

  if (gameState.lives <= 0) {
    gameState.lives = 0;
    gameState.gameOver = true;
    fadeAlpha = 0.85;
    fadeDirection = 0;
    playGameOverSound();
  }

  updateHud();
}

function checkEnemyBulletPlayerCollisions() {
  if (playerHitTimer > 0) {
    return;
  }

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    if (rectanglesOverlap(enemyBullets[i], player)) {
      enemyBullets.splice(i, 1);
      damagePlayer();
      break;
    }
  }
}

function updatePlayerHitFeedback(deltaTime) {
  if (playerHitTimer > 0) {
    playerHitTimer -= deltaTime;
  }
}

function updateScreenShake(deltaTime) {
  if (screenShakeTimer > 0) {
    screenShakeTimer -= deltaTime;
  }
}

function updateFade(deltaTime) {
  if (fadeDirection === 0) {
    return;
  }

  fadeAlpha += fadeDirection * fadeSpeed * deltaTime;

  if (fadeAlpha <= 0) {
    fadeAlpha = 0;
    fadeDirection = 0;
  }

  if (fadeAlpha >= 1) {
    fadeAlpha = 1;
    fadeDirection = 0;
  }
}

function updateVisualEffects(deltaTime) {
  titlePulseTimer += deltaTime;
  updateExplosionParticles(deltaTime);
  updateScreenShake(deltaTime);
  updateFade(deltaTime);
}

function clearCanvas() {
  context.fillStyle = "#020617";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function setGlow(color, blur) {
  context.shadowColor = color;
  context.shadowBlur = blur;
}

function clearGlow() {
  context.shadowBlur = 0;
  context.shadowColor = "transparent";
}

function drawBackgroundText() {
  context.fillStyle = "#67e8f9";
  context.font = "bold 32px Courier New";
  context.textAlign = "center";
  context.fillText("RETRO ARCADE", canvas.width / 2, 90);

  context.fillStyle = "#facc15";
  context.font = "18px Courier New";
  context.fillText("Move: ArrowLeft / A and ArrowRight / D", canvas.width / 2, 124);
  context.fillText("Shoot: Space", canvas.width / 2, 150);
}

function drawPlayer() {
  if (playerHitTimer > 0 && Math.floor(playerHitTimer * 12) % 2 === 0) {
    return;
  }

  const centerX = player.x + player.width / 2;
  const topY = player.y;

  context.fillStyle = "#d1d5db";
  context.fillRect(centerX - 6, topY + 4, 12, 24);

  context.fillStyle = "#f8fafc";
  context.fillRect(centerX - 3, topY, 6, 8);
  context.fillRect(centerX - 9, topY + 22, 18, 8);

  context.fillStyle = "#38bdf8";
  context.fillRect(centerX - 4, topY + 9, 8, 7);

  context.fillStyle = "#d1d5db";
  context.fillRect(player.x + 2, topY + 8, 18, 6);
  context.fillRect(player.x + 2, topY + 25, 18, 6);
  context.fillRect(player.x + player.width - 20, topY + 8, 18, 6);
  context.fillRect(player.x + player.width - 20, topY + 25, 18, 6);

  context.fillStyle = "#ef4444";
  context.fillRect(player.x, topY + 6, 8, 4);
  context.fillRect(player.x, topY + 29, 8, 4);
  context.fillRect(player.x + player.width - 8, topY + 6, 8, 4);
  context.fillRect(player.x + player.width - 8, topY + 29, 8, 4);

  context.fillStyle = "#facc15";
  context.fillRect(player.x + 8, topY + 13, 7, 5);
  context.fillRect(player.x + 8, topY + 20, 7, 5);
  context.fillRect(player.x + player.width - 15, topY + 13, 7, 5);
  context.fillRect(player.x + player.width - 15, topY + 20, 7, 5);

  context.fillStyle = "#94a3b8";
  context.fillRect(centerX - 10, topY + 30, 6, 4);
  context.fillRect(centerX + 4, topY + 30, 6, 4);
}

function drawBullets() {
  for (let i = 0; i < bullets.length; i += 1) {
    const bullet = bullets[i];

    setGlow("#facc15", 12);
    context.fillStyle = "#facc15";
    context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

    context.fillStyle = "#fef3c7";
    context.fillRect(bullet.x + 2, bullet.y, 2, bullet.height - 4);

    context.fillStyle = "#ef4444";
    context.fillRect(bullet.x, bullet.y + bullet.height - 4, bullet.width, 4);
    clearGlow();
  }
}

function drawEnemyBullets() {
  for (let i = 0; i < enemyBullets.length; i += 1) {
    const bullet = enemyBullets[i];

    setGlow("#ff2d75", 10);
    context.fillStyle = "#ff2d75";
    context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

    context.fillStyle = "#fb923c";
    context.fillRect(bullet.x + 1, bullet.y + 2, bullet.width - 2, bullet.height - 4);
    clearGlow();
  }
}

function drawEnemies() {
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    const centerX = enemy.x + enemy.width / 2;
    const topY = enemy.y;
    const isDiving = enemy.state === "diving" || enemy.state === "returning";

    setGlow(isDiving ? "#fb923c" : "#c084fc", isDiving ? 16 : 8);
    context.fillStyle = isDiving ? "#fb923c" : "#c084fc";
    context.fillRect(centerX - 5, topY, 10, 4);
    context.fillRect(centerX - 11, topY + 4, 22, 5);
    context.fillRect(centerX - 15, topY + 9, 30, 6);
    context.fillRect(centerX - 9, topY + 15, 18, 5);

    context.fillStyle = isDiving ? "#facc15" : "#ff2d75";
    context.fillRect(enemy.x, topY + 7, 8, 5);
    context.fillRect(enemy.x + enemy.width - 8, topY + 7, 8, 5);
    context.fillRect(enemy.x + 4, topY + 13, 7, 5);
    context.fillRect(enemy.x + enemy.width - 11, topY + 13, 7, 5);

    context.fillStyle = isDiving ? "#ff2d75" : "#fb923c";
    context.fillRect(enemy.x + 2, topY + 18, 6, 4);
    context.fillRect(enemy.x + enemy.width - 8, topY + 18, 6, 4);

    context.fillStyle = "#22d3ee";
    context.fillRect(centerX - 4, topY + 7, 8, 6);
    context.fillRect(centerX - 2, topY + 13, 4, 6);

    context.fillStyle = "#facc15";
    context.fillRect(centerX - 1, topY + 9, 2, 2);
    clearGlow();
  }
}

function drawExplosionParticles() {
  for (let i = 0; i < explosionParticles.length; i += 1) {
    const particle = explosionParticles[i];
    const alpha = Math.max(particle.life / particle.maxLife, 0);

    context.globalAlpha = alpha;
    setGlow(particle.color, 12);
    context.fillStyle = particle.color;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
    clearGlow();
    context.globalAlpha = 1;
  }
}

function drawGameOver() {
  if (!gameState.gameOver) {
    return;
  }

  context.fillStyle = "rgba(2, 6, 23, 0.78)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#ff2d75";
  context.font = "bold 52px Courier New";
  context.textAlign = "center";
  context.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 12);

  context.fillStyle = "#facc15";
  context.font = "20px Courier New";
  context.fillText("Final Score: " + String(gameState.score).padStart(6, "0"), canvas.width / 2, canvas.height / 2 + 32);

  context.fillStyle = "#94a3b8";
  context.font = "16px Courier New";
  context.fillText("Press R or Restart", canvas.width / 2, canvas.height / 2 + 66);
}

function drawLevelMessage() {
  if (!gameState.changingLevel) {
    return;
  }

  context.fillStyle = "rgba(2, 6, 23, 0.65)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#22d3ee";
  context.font = "bold 42px Courier New";
  context.textAlign = "center";
  context.fillText("LEVEL COMPLETE", canvas.width / 2, canvas.height / 2 - 18);

  context.fillStyle = "#facc15";
  context.font = "22px Courier New";
  context.fillText("Next Wave: Level " + (gameState.level + 1), canvas.width / 2, canvas.height / 2 + 24);
}

function drawPauseOverlay() {
  if (!gameState.paused || gameState.gameOver || !gameState.gameStarted) {
    return;
  }

  context.fillStyle = "rgba(2, 6, 23, 0.72)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#facc15";
  context.font = "bold 46px Courier New";
  context.textAlign = "center";
  context.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 12);

  context.fillStyle = "#67e8f9";
  context.font = "18px Courier New";
  context.fillText("Press P or Resume", canvas.width / 2, canvas.height / 2 + 30);
}

function drawTitleScreen() {
  if (gameState.gameStarted) {
    return;
  }

  const pulse = 0.65 + Math.sin(titlePulseTimer * 5) * 0.35;

  context.fillStyle = "rgba(2, 6, 23, 0.92)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  setGlow("#22d3ee", 18);
  context.fillStyle = "#22d3ee";
  context.font = "bold 54px Courier New";
  context.textAlign = "center";
  context.fillText("STAR RAIDERS", canvas.width / 2, canvas.height / 2 - 84);
  clearGlow();

  context.fillStyle = "#ff2d75";
  context.font = "bold 28px Courier New";
  context.fillText("RETRO ARCADE", canvas.width / 2, canvas.height / 2 - 42);

  context.globalAlpha = pulse;
  context.fillStyle = "#facc15";
  context.font = "22px Courier New";
  context.fillText("PRESS SPACE OR ENTER", canvas.width / 2, canvas.height / 2 + 24);
  context.globalAlpha = 1;

  context.fillStyle = "#94a3b8";
  context.font = "16px Courier New";
  context.fillText("Move: A / Arrow Keys   Fire: Space", canvas.width / 2, canvas.height / 2 + 64);

  context.fillStyle = "#facc15";
  context.fillText("High Score: " + String(gameState.highScore).padStart(6, "0"), canvas.width / 2, canvas.height / 2 + 96);
}

function drawFadeOverlay() {
  if (fadeAlpha <= 0) {
    return;
  }

  context.fillStyle = "rgba(2, 6, 23, " + fadeAlpha + ")";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGame() {
  const shakeAmount = screenShakeTimer > 0 ? 5 : 0;
  const shakeX = (Math.random() - 0.5) * shakeAmount;
  const shakeY = (Math.random() - 0.5) * shakeAmount;

  clearCanvas();
  context.save();
  context.translate(shakeX, shakeY);
  drawBackgroundText();
  drawEnemies();
  drawBullets();
  drawEnemyBullets();
  drawExplosionParticles();
  drawPlayer();
  drawFadeOverlay();
  drawLevelMessage();
  drawPauseOverlay();
  drawGameOver();
  drawTitleScreen();
  context.restore();
}

let lastTime = 0;

function gameLoop(currentTime) {
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
  lastTime = currentTime;

  updateVisualEffects(deltaTime);

  if (gameState.gameStarted && !gameState.paused && !gameState.gameOver) {
    updatePlayer(deltaTime);
    updatePlayerHitFeedback(deltaTime);

    if (gameState.changingLevel) {
      updateLevelProgression(deltaTime);
    } else {
      updateShooting(deltaTime);
      updateBullets(deltaTime);
      updateEnemies(deltaTime);
      updateEnemyDiveTimer(deltaTime);
      updateEnemyDives(deltaTime);
      updateEnemyShooting(deltaTime);
      updateEnemyBullets(deltaTime);
      checkBulletEnemyCollisions();
      checkEnemyBulletPlayerCollisions();
      checkLevelComplete();
    }
  }

  drawGame();

  requestAnimationFrame(gameLoop);
}

function pressTouchControl(controlName) {
  startGame();
  startAudio();
  keys[controlName] = true;
}

function releaseTouchControl(controlName) {
  keys[controlName] = false;
}

function addTouchControl(button, controlName) {
  button.addEventListener("pointerdown", function(event) {
    event.preventDefault();
    pressTouchControl(controlName);
  });

  button.addEventListener("pointerup", function(event) {
    event.preventDefault();
    releaseTouchControl(controlName);
  });

  button.addEventListener("pointerleave", function() {
    releaseTouchControl(controlName);
  });

  button.addEventListener("pointercancel", function() {
    releaseTouchControl(controlName);
  });
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", function() {
  startAudio();
  resetGame();
});
muteButton.addEventListener("click", toggleMute);

addTouchControl(touchLeftButton, "left");
addTouchControl(touchRightButton, "right");
addTouchControl(touchShootButton, "shoot");

loadHighScore();
updateHud();
setLevelDifficulty();
enemyShootTimer = getRandomShootDelay();
enemyDiveTimer = getRandomDiveDelay();
createEnemyWave();
requestAnimationFrame(gameLoop);
