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
  let icons = {
    'sunny': '☀️',
    'cloudy': '☁️',
    'rainy': '🌧️',
    'snowy': '❄️',
    'partly-cloudy': '⛅',
    'thunderstorm': '⛈️',
    'foggy': '🌫️'
  };
  return icons[condition] || '🌈';
}

// 获取天气提示语
function getWeatherTip(condition) {
  let tips = {
    'rainy': '带伞了吗 不要淋雨',
    'snowy': '记得保暖 路面滑',
    'thunderstorm': '注意安全 减少外出',
    'foggy': '出行注意安全',
    'sunny': '注意防晒',
    'cloudy': '今天天气不错',
    'partly-cloudy': '出门逛逛吧'
  };
  return tips[condition] || '';
}

// 获取位置和天气
async function fetchWeather() {
  try {
    // 获取位置
    let position = await new Promise(function(resolve, reject) {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 10000,
        maximumAge: 600000 // 缓存10分钟
      });
    });

    let lat = position.coords.latitude;
    let lon = position.coords.longitude;

    // 使用wttr.in API获取天气（免费无需API key）
    let response = await fetch('https://wttr.in/' + lat + ',' + lon + '?format=j1');
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
    // 使用默认天气
    weatherData = {
      temp: '',
      condition: 'sunny',
      location: ''
    };
    renderWeather();
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
let weatherEffectActive = false;

function startWeatherEffect(condition) {
  if (weatherEffectActive) {
    stopWeatherEffect();
  }

  weatherCanvas = document.getElementById('weatherCanvas');
  if (!weatherCanvas) return;

  weatherCtx = weatherCanvas.getContext('2d');
  resizeWeatherCanvas();

  if (condition === 'rainy' || condition === 'thunderstorm') {
    initRainDrops();
    weatherEffectActive = true;
    animateRain();
  } else if (condition === 'snowy') {
    initSnowflakes();
    weatherEffectActive = true;
    animateSnow();
  } else {
    weatherCanvas.style.display = 'none';
  }
}

function stopWeatherEffect() {
  weatherEffectActive = false;
  rainDrops = [];
  snowflakes = [];
}

function resizeWeatherCanvas() {
  if (weatherCanvas) {
    weatherCanvas.width = window.innerWidth;
    weatherCanvas.height = window.innerHeight;
  }
}

function initRainDrops() {
  rainDrops = [];
  let count = window.innerHeight > 600 ? 150 : 80;
  for (let i = 0; i < count; i++) {
    rainDrops.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      length: Math.random() * 20 + 10,
      speed: Math.random() * 10 + 15,
      opacity: Math.random() * 0.3 + 0.2
    });
  }
  if (weatherCanvas) weatherCanvas.style.display = 'block';
}

function animateRain() {
  if (!weatherEffectActive || !weatherCtx) return;

  weatherCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);

  for (let i = 0; i < rainDrops.length; i++) {
    let drop = rainDrops[i];

    weatherCtx.beginPath();
    weatherCtx.moveTo(drop.x, drop.y);
    weatherCtx.lineTo(drop.x + 1, drop.y + drop.length);
    weatherCtx.strokeStyle = 'rgba(150, 180, 255, ' + drop.opacity + ')';
    weatherCtx.lineWidth = 1;
    weatherCtx.stroke();

    drop.y += drop.speed;
    if (drop.y > weatherCanvas.height) {
      drop.y = -drop.length;
      drop.x = Math.random() * weatherCanvas.width;
    }
  }

  requestAnimationFrame(animateRain);
}

function initSnowflakes() {
  snowflakes = [];
  let count = window.innerHeight > 600 ? 100 : 50;
  for (let i = 0; i < count; i++) {
    snowflakes.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 3 + 1,
      speed: Math.random() * 2 + 1,
      wind: Math.random() * 0.5 - 0.25,
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
    weatherCtx.fillStyle = 'rgba(255, 255, 255, ' + flake.opacity + ')';
    weatherCtx.fill();

    flake.y += flake.speed;
    flake.x += flake.wind;

    if (flake.y > weatherCanvas.height) {
      flake.y = -flake.radius;
      flake.x = Math.random() * weatherCanvas.width;
    }
  }

  requestAnimationFrame(animateSnow);
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