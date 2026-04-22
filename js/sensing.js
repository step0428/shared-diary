// 时间感知问候语
function getTimeGreeting() {
  let hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return '早安';
  } else if (hour >= 11 && hour < 14) {
    return '中午好，吃饭了吗';
  } else if (hour >= 14 && hour < 18) {
    return '下午好';
  } else if (hour >= 18 && hour < 23) {
    return '晚上好';
  } else {
    return '该睡觉啦';
  }
}

function renderGreeting() {
  let el = document.getElementById('greetingSection');
  if (el) {
    el.textContent = getTimeGreeting();
  }
}

// 天气相关变量
let weatherData = {
  temp: null,
  condition: null, // sunny, cloudy, rainy, snowy
  location: null
};

// 天气图标映射
function getWeatherIcon(condition) {
  let hour = new Date().getHours();
  let isNight = hour >= 19 || hour < 5;

  let icons = {
    'sunny': isNight ? '🌙' : '☀️',
    'cloudy': '☁️',
    'rainy': '🌧️',
    'snowy': '❄️',
    'partly-cloudy': isNight ? '☁️' : '⛅',
    'thunderstorm': '⛈️',
    'foggy': '🌫️'
  };
  return icons[condition] || '🌈';
}

// 获取天气提示语
function getWeatherTip(condition) {
  let hour = new Date().getHours();
  let isNight = hour >= 19 || hour < 5;

  let tips = {
    'rainy': '带伞了吗 不要淋雨',
    'snowy': '记得保暖 路面滑',
    'thunderstorm': '注意安全 减少外出',
    'foggy': '出行注意安全',
    'sunny': isNight ? '夜色真美，可能看到流星哦' : '注意防晒',
    'cloudy': '今天天气不错',
    'partly-cloudy': isNight ? '夜深了，早点休息' : '出门逛逛吧'
  };
  return tips[condition] || '';
}

// 获取位置和天气
async function fetchWeather() {
  try {
    // 先尝试用IP获取位置（无需用户授权）
    let response = await fetch('https://wttr.in/?format=j1');
    let data = await response.json();

    if (data && data.current_condition && data.current_condition[0]) {
      let current = data.current_condition[0];

      // 解析天气条件
      let weatherCode = current.weatherCode;
      let temp = current.temp_C + '°C';

      // 根据天气码判断天气类型
      let condition = 'sunny';
      if (weatherCode.includes('200') || weatherCode.includes('119')) {
        condition = 'cloudy';
      } else if (weatherCode.includes('308') || weatherCode.includes('359') || weatherCode.includes('302')) {
        condition = 'rainy';
      } else if (weatherCode.includes('317') || weatherCode.includes('320') || weatherCode.includes('371') || weatherCode.includes('377')) {
        condition = 'snowy';
      } else if (weatherCode.includes('116') || weatherCode.includes('176') || weatherCode.includes('263')) {
        condition = 'partly-cloudy';
      }

      // 强制雨天测试（把下面一行注释掉可恢复正常天气）
      // condition = 'rainy';

      weatherData = {
        temp: temp,
        condition: condition,
        location: data.nearest_area ? data.nearest_area[0].areaName[0].value : ''
      };

      renderWeather();
      startWeatherEffect(condition);
    }
  } catch (e) {
    console.error('获取天气失败:', e);
    // 使用默认天气（强制雨天）
    weatherData = {
      temp: '',
      condition: 'rainy',
      location: ''
    };
    renderWeather();
    startWeatherEffect('rainy');
  }
}

function renderWeather() {
  let iconEl = document.getElementById('weatherIcon');
  let tempEl = document.getElementById('weatherTemp');
  let tipEl = document.getElementById('weatherTip');

  if (iconEl) iconEl.textContent = getWeatherIcon(weatherData.condition);
  if (tempEl) tempEl.textContent = weatherData.temp;
  if (tipEl) tipEl.textContent = getWeatherTip(weatherData.condition);
}

// 天气效果
let weatherCanvas = null;
let weatherCtx = null;
let rainDrops = [];
let snowflakes = [];
let meteors = [];
let stars = [];
let weatherEffectActive = false;
let weatherAnimationId = null;

function startWeatherEffect(condition) {
  stopWeatherEffect();

  weatherCanvas = document.getElementById('weatherCanvas');
  if (!weatherCanvas) return;

  weatherCtx = weatherCanvas.getContext('2d');
  resizeWeatherCanvas();
  weatherEffectActive = true;

  let hour = new Date().getHours();
  let isNight = hour >= 19 || hour < 5;
  if (condition === 'rainy' || condition === 'thunderstorm') {
    initRainDrops();
    animateRain();
  } else if (condition === 'snowy') {
    initSnowflakes();
    animateSnow();
  } else if (isNight && condition !== 'rainy' && condition !== 'snowy') {
    initMeteors();
    animateMeteors();
  } else {
    weatherCanvas.style.display = 'none';
    weatherEffectActive = false;
  }
}

function stopWeatherEffect() {
  weatherEffectActive = false;
  if (weatherAnimationId) {
    cancelAnimationFrame(weatherAnimationId);
    weatherAnimationId = null;
  }
  rainDrops = [];
  snowflakes = [];
  meteors = [];
  stars = [];
  if (weatherCtx && weatherCanvas) {
    weatherCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);
  }
}

function resizeWeatherCanvas() {
  if (weatherCanvas) {
    weatherCanvas.width = window.innerWidth;
    weatherCanvas.height = window.innerHeight;
  }
}

function initRainDrops() {
  rainDrops = [];
  let count = window.innerWidth < 768 ? 100 : 250; // 根据屏幕宽度响应式生成
  for (let i = 0; i < count; i++) {
    rainDrops.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      length: Math.random() * 20 + 15, // 雨滴长度
      speedY: Math.random() * 10 + 15, // 垂直速度
      speedX: Math.random() * 2 - 1,   // 水平风速
      opacity: Math.random() * 0.4 + 0.1,
      width: Math.random() * 1.5 + 0.5 // 雨滴粗细
    });
  }
  if (weatherCanvas) weatherCanvas.style.display = 'block';
}

function animateRain() {
  if (!weatherEffectActive || !weatherCtx) return;

  weatherCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);
  weatherCtx.lineCap = 'round';

  for (let i = 0; i < rainDrops.length; i++) {
    let drop = rainDrops[i];

    weatherCtx.beginPath();
    weatherCtx.moveTo(drop.x, drop.y);
    // 添加风向倾斜
    weatherCtx.lineTo(drop.x + drop.speedX * 2, drop.y + drop.length);
    weatherCtx.strokeStyle = 'rgba(174, 194, 224, ' + drop.opacity + ')';
    weatherCtx.lineWidth = drop.width;
    weatherCtx.stroke();

    drop.y += drop.speedY;
    drop.x += drop.speedX;

    if (drop.y > weatherCanvas.height) {
      drop.y = -drop.length;
      drop.x = Math.random() * weatherCanvas.width;
    }
  }

  weatherAnimationId = requestAnimationFrame(animateRain);
}

function initSnowflakes() {
  snowflakes = [];
  let count = window.innerWidth < 768 ? 80 : 150;
  for (let i = 0; i < count; i++) {
    snowflakes.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 3 + 1,
      speed: Math.random() * 1.5 + 0.5,
      wind: Math.random() * 1 - 0.5, // 基础风向
      swing: Math.random() * Math.PI * 2, // 摇摆相位
      swingSpeed: Math.random() * 0.03 + 0.01,
      opacity: Math.random() * 0.5 + 0.3
    });
  }
  if (weatherCanvas) weatherCanvas.style.display = 'block';
}

function animateSnow() {
  if (!weatherEffectActive || !weatherCtx) return;

  weatherCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);

  for (let i = 0; i < snowflakes.length; i++) {
    let flake = snowflakes[i];

    weatherCtx.beginPath();
    weatherCtx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
    
    // 添加柔和的雪花发光边缘
    let gradient = weatherCtx.createRadialGradient(flake.x, flake.y, 0, flake.x, flake.y, flake.radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, ' + flake.opacity + ')');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    weatherCtx.fillStyle = gradient;
    weatherCtx.fill();

    flake.y += flake.speed;
    // 结合基础风向和正弦摇摆，呈现飘落感
    flake.x += flake.wind + Math.sin(flake.swing) * 0.5;
    flake.swing += flake.swingSpeed;

    if (flake.y > weatherCanvas.height) {
      flake.y = -flake.radius;
      flake.x = Math.random() * weatherCanvas.width;
    }
    if (flake.x > weatherCanvas.width) flake.x = 0;
    if (flake.x < 0) flake.x = weatherCanvas.width;
  }

  weatherAnimationId = requestAnimationFrame(animateSnow);
}

// 初始化流星雨和星空 (夜晚晴天独享)
function initMeteors() {
  meteors = [];
  stars = [];
  // 背景繁星
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 1.5,
      alpha: Math.random(),
      twinkleSpeed: (Math.random() * 0.05) + 0.01
    });
  }
  if (weatherCanvas) weatherCanvas.style.display = 'block';
}

function animateMeteors() {
  if (!weatherEffectActive || !weatherCtx) return;
  weatherCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);

  // 绘制闪烁的星星
  stars.forEach(function(star) {
    star.alpha += star.twinkleSpeed;
    if (star.alpha > 1 || star.alpha < 0) star.twinkleSpeed *= -1;
    weatherCtx.beginPath();
    weatherCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    weatherCtx.fillStyle = 'rgba(255, 255, 255, ' + Math.abs(star.alpha) + ')';
    weatherCtx.fill();
  });

  // 随机生成流星
  if (Math.random() < 0.02) { // 约2%的概率每帧产生流星
    meteors.push({
      x: Math.random() * window.innerWidth + window.innerWidth / 2, // 从偏右侧上方出现
      y: Math.random() * (window.innerHeight / 2) - 100,
      length: Math.random() * 100 + 40,
      speed: Math.random() * 15 + 10,
      opacity: 1
    });
  }

  // 绘制并移动流星
  for (let i = meteors.length - 1; i >= 0; i--) {
    let m = meteors[i];
    let tailX = m.x + m.length; // 尾巴在右侧
    let tailY = m.y - m.length; // 尾巴在上方

    let gradient = weatherCtx.createLinearGradient(m.x, m.y, tailX, tailY);
    gradient.addColorStop(0, 'rgba(255, 255, 255, ' + m.opacity + ')');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    weatherCtx.beginPath();
    weatherCtx.moveTo(m.x, m.y);
    weatherCtx.lineTo(tailX, tailY);
    weatherCtx.strokeStyle = gradient;
    weatherCtx.lineWidth = 1.5;
    weatherCtx.stroke();

    // 流星向左下方坠落
    m.x -= m.speed;
    m.y += m.speed;
    m.opacity -= 0.015;

    if (m.opacity <= 0 || m.y > weatherCanvas.height || m.x < 0) {
      meteors.splice(i, 1);
    }
  }

  weatherAnimationId = requestAnimationFrame(animateMeteors);
}

// 初始化天气和问候
function initSensing() {
  renderGreeting();
  fetchWeather();

  // 每分钟更新问候语
  setInterval(renderGreeting, 60000);

  // 窗口大小改变时重新调整画布
  window.addEventListener('resize', function() {
    if (weatherEffectActive) {
      resizeWeatherCanvas();
    }
  });
}

// 强制雨天效果（可手动调用测试）
window.forceRain = function() {
  setWeatherEffect('rainy');
};

// 强制雪天效果
window.forceSnow = function() {
  setWeatherEffect('snowy');
};

// 停止天气效果
window.stopWeather = function() {
  stopWeatherEffect();
};