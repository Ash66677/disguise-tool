import { invoke } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

let cameraStream = null;
let faceDetectionInterval = null;
let fishTimeInterval = null;
let monitoringActive = false;
let loginStartTime = null;
let fishTimeLocal = 0;
let faceCount = 0;
let lastFaceDetected = false;
let consecutiveFaces = 0;
let lastImageData = null;
let autoOpenTriggered = false;

const USERS_STORAGE_KEY = 'disguise_tool_users';
const CURRENT_USER_KEY = 'disguise_tool_current_user';

// DOM elements
const toggleMonitorBtn = document.getElementById('toggle-monitor');
const disguiseBtn = document.getElementById('disguise-btn');
const settingsBtn = document.getElementById('settings-btn');
const logoutBtn = document.getElementById('logout-btn');
const cameraSection = document.getElementById('camera-section');
const cameraFeed = document.getElementById('camera-feed');
const faceCanvas = document.getElementById('face-canvas');
const faceStatus = document.getElementById('face-status');
const statusText = document.getElementById('status-text');
const timerDisplay = document.getElementById('timer');
const todayTimeDisplay = document.getElementById('today-time');
const faceCountDisplay = document.getElementById('face-count');
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const showLoginBtn = document.getElementById('show-login');
const showRegisterBtn = document.getElementById('show-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const registerUsername = document.getElementById('register-username');
const registerPassword = document.getElementById('register-password');
const authMessage = document.getElementById('auth-message');

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    initializeAuth();
    setupEventListeners();
    setupGlobalShortcut();
    
    const savedUser = localStorage.getItem('disguise_tool_session');
    const savedLoginTime = localStorage.getItem('disguise_tool_login_time');
    
    if (savedUser && savedLoginTime) {
        // 恢复登录状态，但不重置 loginStartTime
        loginStartTime = parseInt(savedLoginTime);
        showApp(savedUser);
        
        // 把离开期间的摸鱼时间一次性补上
        const now = Date.now();
        const elapsedMinutes = Math.floor((now - loginStartTime) / 60000);
        if (elapsedMinutes > 0) {
            await updateFishTime(elapsedMinutes);
            // 更新登录时间为现在，这样下次回来只计算新增加的时间
            loginStartTime = now;
            localStorage.setItem('disguise_tool_login_time', loginStartTime);
        }
    } else {
        checkAuthentication();
    }
    
    startTimer();
});

function setupEventListeners() {
    toggleMonitorBtn.addEventListener('click', toggleFaceMonitoring);
    disguiseBtn.addEventListener('click', openDisguisePage);
    settingsBtn.addEventListener('click', openSettings);
    logoutBtn.addEventListener('click', handleLogout);
    window.addEventListener('keydown', handleKeydown);
}

function handleKeydown(event) {
    if (!event.ctrlKey || !event.shiftKey || event.code !== 'KeyF') return;
    const target = event.target;
    const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return;
    event.preventDefault();
    openDisguisePage().catch(console.error);
}

async function setupGlobalShortcut() {
    try {
        await register('CommandOrControl+Shift+F', () => {
            openDisguisePage();
        });
        console.log('Global shortcut registered: Ctrl+Shift+F');
    } catch (error) {
        console.error('Failed to register global shortcut:', error);
    }
}

async function toggleFaceMonitoring() {
    if (monitoringActive) {
        stopFaceMonitoring();
    } else {
        await startFaceMonitoring();
    }
}

// startFaceMonitoring 中添加 await 和 setTimeout
async function startFaceMonitoring() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });

        cameraFeed.srcObject = cameraStream;
        await cameraFeed.play();  // 关键：等待视频播放
        
        cameraSection.style.display = 'block';
        monitoringActive = true;
        toggleMonitorBtn.textContent = '停止监控';
        statusText.textContent = '监控中...';
        lastFaceDetected = false;
        consecutiveFaces = 0;
        lastImageData = null;
        autoOpenTriggered = false;

        // 延迟启动检测
        setTimeout(() => {
            if (monitoringActive) {
                startFaceDetection();
                startFishTimeTracking();
                loadStatistics();
            }
        }, 2000);
        
    } catch (error) {
        console.error('Failed to start camera:', error);
        alert('无法访问摄像头，请检查权限设置');
    }
}

// startFaceDetection 中修改 Fallback 阈值和连续次数
// 阈值：brightness > 120 || motion > 20
// 连续次数：consecutiveFaces >= 3

function stopFaceMonitoring() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }

    // 注意：不要清除 fishTimeInterval！
    // 摸鱼时间应该持续记录

    cameraSection.style.display = 'none';
    monitoringActive = false;
    toggleMonitorBtn.textContent = '开启人脸监控';
    statusText.textContent = '已停止';
    faceStatus.textContent = '未检测到人脸';
    faceStatus.classList.remove('detected');
}

function startFishTimeTracking() {
    // 先清除已有的计时器
    if (fishTimeInterval) {
        clearInterval(fishTimeInterval);
        fishTimeInterval = null;
    }
    
    // 创建新的计时器
    fishTimeInterval = setInterval(async () => {
        await updateFishTime(1);
    }, 60000);
}

async function updateFishTime(minutes = 1) {
    try {
        await invoke('update_fish_time', { minutes });
        await loadStatistics();  // 这会更新 fishTimeLocal 并刷新显示
        return true;
    } catch (error) {
        console.error('Failed to update fish time:', error);
        fishTimeLocal += minutes;
        todayTimeDisplay.textContent = fishTimeLocal + ' 分钟';
        return false;
    }
}

function startFaceDetection() {
    const canvas = faceCanvas;
    const ctx = canvas.getContext('2d');
    const hasFaceDetector = 'FaceDetector' in window;
    const detector = hasFaceDetector ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }) : null;

    faceDetectionInterval = setInterval(async () => {
        if (!cameraFeed.videoWidth) return;

        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        ctx.drawImage(cameraFeed, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let faceDetected = false;
        let multiFaceDetected = false;

        if (detector) {
            try {
                const faces = await detector.detect(cameraFeed);
                faceDetected = faces.length > 0;
                multiFaceDetected = faces.length > 1;

                if (faces.length > 1 && !autoOpenTriggered) {
                    autoOpenTriggered = true;
                    openDisguisePage().catch(console.error);
                } else if (faces.length <= 1) {
                    autoOpenTriggered = false;
                }
            } catch (error) {
                faceDetected = false;
            }
        } else {
            const brightness = calculateAverageBrightness(imageData);
            const motion = lastImageData ? calculateFrameDifference(lastImageData, imageData) : 0;
            faceDetected = brightness > 70 || motion > 12;
            lastImageData = imageData;
            console.log('brightness', brightness.toFixed(1), 'motion', motion.toFixed(1));
        }

        if (faceDetected) {
            consecutiveFaces += 1;
            if (!lastFaceDetected) {
                faceCount += 1;
                faceCountDisplay.textContent = `${faceCount} 次`;
            }
            faceStatus.textContent = multiFaceDetected ? '检测到多人脸！' : '检测到人脸！';
            faceStatus.classList.add('detected');

            if (!detector && consecutiveFaces >= 2 && !autoOpenTriggered) {
                autoOpenTriggered = true;
                openDisguisePage().catch(console.error);
            }
        } else {
            consecutiveFaces = 0;
            autoOpenTriggered = false;
            faceStatus.textContent = '未检测到人脸';
            faceStatus.classList.remove('detected');
        }

        lastFaceDetected = faceDetected;
    }, 1000);
}

function calculateAverageBrightness(imageData) {
    const data = imageData.data;
    let total = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        total += 0.299 * r + 0.587 * g + 0.114 * b;
        count += 1;
    }

    return total / count;
}

function calculateFrameDifference(prevData, currData) {
    const prev = prevData.data;
    const curr = currData.data;
    let diff = 0;
    let count = 0;

    for (let i = 0; i < prev.length; i += 4) {
        diff += Math.abs(prev[i] - curr[i]);
        diff += Math.abs(prev[i + 1] - curr[i + 1]);
        diff += Math.abs(prev[i + 2] - curr[i + 2]);
        count += 3;
    }

    return diff / count / 255 * 100;
}

async function openDisguisePage() {
    // 直接在当前窗口跳转到知网
    window.location.href = 'https://www.cnki.net/';
}

function openSettings() {
    alert('设置功能开发中...');
}

function initializeAuth() {
    showLoginBtn.addEventListener('click', () => showAuthForm('login'));
    showRegisterBtn.addEventListener('click', () => showAuthForm('register'));
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    showAuthForm('login');
}

function showAuthForm(type) {
    if (type === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        showLoginBtn.classList.add('active');
        showRegisterBtn.classList.remove('active');
        authMessage.textContent = '';
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        showLoginBtn.classList.remove('active');
        showRegisterBtn.classList.add('active');
        authMessage.textContent = '';
    }
}

function checkAuthentication() {
    const currentUser = getCurrentUser();
    if (currentUser) {
        showApp(currentUser);
    } else {
        showAuth();
    }
}

function showApp(username) {
    authContainer.style.display = 'none';
    mainContainer.style.display = 'block';
    logoutBtn.classList.remove('hidden');
    statusText.textContent = `欢迎 ${username}`;
    
    if (!loginStartTime) {
        loginStartTime = Date.now();
    }
    
    // 保存会话
    localStorage.setItem('disguise_tool_session', username);
    localStorage.setItem('disguise_tool_login_time', loginStartTime);
    setCurrentUser(username);
    
    // 启动摸鱼时间记录（独立于监控）
    startFishTimeTracking();
    
    loadStatistics();
}

function showAuth() {
    authContainer.style.display = 'block';
    mainContainer.style.display = 'none';
    logoutBtn.classList.add('hidden');
    statusText.textContent = '监控中...';
    loginStartTime = null;
    timerDisplay.textContent = '00:00:00';
    authContainer.style.display = 'block';
    mainContainer.style.display = 'none';
    logoutBtn.classList.add('hidden');
    statusText.textContent = '监控中...';
}

function getSavedUsers() {
    return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
}

function saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    return localStorage.getItem(CURRENT_USER_KEY);
}

function setCurrentUser(username) {
    localStorage.setItem(CURRENT_USER_KEY, username);
}

function clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
}

function showAuthMessage(message, isError = true) {
    authMessage.textContent = message;
    authMessage.style.color = isError ? '#dc3545' : '#0f5132';
}

function handleLogin(event) {
    event.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    if (!username || !password) {
        showAuthMessage('用户名和密码不能为空。');
        return;
    }

    const users = getSavedUsers();
    if (!users[username] || users[username] !== password) {
        showAuthMessage('用户名或密码错误。');
        return;
    }

    setCurrentUser(username);
    showApp(username);
    showAuthMessage('登录成功！', false);
}

function handleRegister(event) {
    event.preventDefault();
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();

    if (!username || !password) {
        showAuthMessage('用户名和密码不能为空。');
        return;
    }

    const users = getSavedUsers();
    if (users[username]) {
        showAuthMessage('用户名已存在，请直接登录。');
        return;
    }

    users[username] = password;
    saveUsers(users);
    setCurrentUser(username);
    showApp(username);
    showAuthMessage('注册成功，已登录！', false);
}

function handleLogout() {
    clearCurrentUser();
    localStorage.removeItem('disguise_tool_session');
    localStorage.removeItem('disguise_tool_login_time');
    
    // 登出时停止所有计时器
    if (fishTimeInterval) {
        clearInterval(fishTimeInterval);
        fishTimeInterval = null;
    }
    
    stopFaceMonitoring();
    showAuth();
    loginForm.reset();
    registerForm.reset();
    showAuthForm('login');
}

async function loadStatistics() {
    try {
        const time = await invoke('get_fish_time');
        fishTimeLocal = parseInt(time, 10) || 0;
        updateTodayTimeDisplay();
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

function updateTodayTimeDisplay() {
    // 始终显示从数据库读取的累计时间
    todayTimeDisplay.textContent = `${fishTimeLocal} 分钟`;
}

function startTimer() {
    // 计时器显示（顶部的大计时器）
    let lastSyncMinute = -1;  // 记录上次同步的分钟数
    
    setInterval(async () => {
        if (!loginStartTime) {
            timerDisplay.textContent = '00:00:00';
            return;
        }

        // 计算本次会话的时长（用于顶部计时器）
        const elapsed = Date.now() - loginStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 只在分钟数变化时同步一次（避免每秒都调用）
        if (minutes !== lastSyncMinute) {
            lastSyncMinute = minutes;
            await loadStatistics();
        }
    }, 1000);
}

window.addEventListener('beforeunload', () => {
    stopFaceMonitoring();
    if (fishTimeInterval) {
        clearInterval(fishTimeInterval);
        fishTimeInterval = null;
    }
    unregister('CommandOrControl+Shift+F').catch(console.error);
});
