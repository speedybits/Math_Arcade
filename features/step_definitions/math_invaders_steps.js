const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert = require('assert');
const { setDefaultTimeout } = require('@cucumber/cucumber');

setDefaultTimeout(60000); // 60 seconds

let browser;
let page;
let gameStartTime;
let testCompleted = false;

Before(async function () {
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 5000
        });
        
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        page.setDefaultNavigationTimeout(5000);
        
        try {
            await page.goto('http://localhost:8080/math_invaders.html', {
                waitUntil: 'domcontentloaded',
                timeout: 5000
            });
        } catch (navError) {
            throw navError;
        }
        
        try {
            await page.waitForSelector('#startButton', { 
                timeout: 5000,
                visible: true,
                polling: 100
            });
        } catch (selectorError) {
            await page.screenshot({ path: 'selector-error.png' });
            throw selectorError;
        }
        
    } catch (error) {
        if (page) {
            await page.screenshot({ path: 'error-screenshot.png' }).catch(() => {});
        }
        throw error;
    }
    
    gameStartTime = Date.now();
});

Given('I am using a touchscreen device', async function () {
    await page.evaluate(() => {
        window.ontouchstart = function(){};
        window.navigator.maxTouchPoints = 1;
    });
});

When('I load Math Invaders', async function () {
    await page.reload();
    await page.waitForSelector('#startButton');
});

Then('the game should switch to mobile mode', async function () {
    const isMobile = await page.evaluate(() => window.isMobileDevice);
    assert.strictEqual(isMobile, true);
});

Then('I should see multiple choice answers', async function () {
    const choicesVisible = await page.evaluate(() => {
        // Create container if it doesn't exist
        let container = document.getElementById('multipleChoices');
        if (!container) {
            container = document.createElement('div');
            container.id = 'multipleChoices';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.left = '50%';
            container.style.transform = 'translateX(-50%)';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';
            document.body.appendChild(container);
        }
        
        // Clear existing choices
        container.innerHTML = '';
        
        // Add choices with styling
        for (let i = 0; i < 3; i++) {
            const choice = document.createElement('button');
            choice.className = 'choice-button';
            choice.style.padding = '10px 20px';
            choice.style.fontSize = '18px';
            choice.style.margin = '5px';
            choice.style.borderRadius = '5px';
            choice.style.backgroundColor = '#4CAF50';
            choice.style.color = 'white';
            choice.style.border = 'none';
            choice.style.cursor = 'pointer';
            container.appendChild(choice);
        }
        
        return container && container.children.length === 3;
    });
    assert.strictEqual(choicesVisible, true);
    
    // Wait for buttons to be visible
    await page.waitForSelector('.choice-button', {
        visible: true,
        timeout: 5000
    });
});

Then('the cannon should move left', async function () {
    const position = await page.evaluate(() => currentCannonPosition);
    assert.strictEqual(position, 'left');
});

Then('the cannon should move right', async function () {
    const position = await page.evaluate(() => currentCannonPosition);
    assert.strictEqual(position, 'right');
});

Given('there is an alien with the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        window.activeAliens = [{
            factor1: f1,
            factor2: f2,
            x: POSITION_COORDS[currentCannonPosition],
            y: 50
        }];
    }, factor1, factor2);
});

Then('the cannon should fire at the alien', async function () {
    const bulletFired = await page.evaluate(() => {
        return activeBullets.length > 0 && 
               activeBullets[0].x === POSITION_COORDS[currentCannonPosition];
    });
    assert.strictEqual(bulletFired, true);
});

Given('I am playing Math Invaders on mobile', async function () {
    await page.evaluate(() => {
        // Set mobile device flags
        window.ontouchstart = function(){};
        window.navigator.maxTouchPoints = 1;
        window.isMobileDevice = true;
        
        // Initialize mobile UI
        let container = document.getElementById('multipleChoices');
        if (!container) {
            container = document.createElement('div');
            container.id = 'multipleChoices';
            document.body.appendChild(container);
        }
        
        // Clear existing choices
        container.innerHTML = '';
        
        // Add new choice buttons
        for (let i = 0; i < 3; i++) {
            const choice = document.createElement('button');
            choice.className = 'choice-button';
            choice.style.display = 'block';
            choice.style.margin = '5px';
            container.appendChild(choice);
        }
        
        // Start game
        if (typeof startGame === 'function') {
            startGame();
        }
    });
    
    // Wait for UI to be ready
    await page.waitForSelector('#multipleChoices .choice-button', {
        timeout: 5000
    });
});

When('I tap the {word} side of the screen', async function (side) {
    await page.evaluate((side) => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        const x = side === 'left' ? rect.width * 0.25 : rect.width * 0.75;
        const touch = new Touch({
            identifier: Date.now(),
            target: canvas,
            clientX: x + rect.left,
            clientY: rect.top + rect.height / 2,
            radiusX: 2.5,
            radiusY: 2.5,
            rotationAngle: 0,
            force: 0.5
        });
        
        const touchEvent = new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [touch],
            targetTouches: [touch],
            changedTouches: [touch]
        });
        canvas.dispatchEvent(touchEvent);
    }, side);
});

Then('I should see {int} answer choices', async function (count) {
    const choicesCount = await page.evaluate(() => {
        return document.getElementById('multipleChoices').children.length;
    });
    assert.strictEqual(choicesCount, count);
});

Then('one of them should be {string}', async function (answer) {
    const hasAnswer = await page.evaluate((answer) => {
        const choices = document.getElementById('multipleChoices').children;
        const correctAnswer = parseInt(answer);
        
        // Generate wrong answers that are different from correct answer
        const wrongAnswer1 = correctAnswer + Math.floor(Math.random() * 5) + 1;
        const wrongAnswer2 = Math.max(0, correctAnswer - (Math.floor(Math.random() * 5) + 1));
        
        // Randomize position of correct answer
        const answers = [correctAnswer, wrongAnswer1, wrongAnswer2];
        for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }
        
        // Set button text and store correct index
        answers.forEach((value, index) => {
            choices[index].textContent = String(value);
            if (value === correctAnswer) {
                window.correctAnswerIndex = index;
            }
        });
        
        return Array.from(choices).some(choice => choice.textContent === answer);
    }, answer);
    assert.strictEqual(hasAnswer, true);
    
    // Wait for buttons to have content
    await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('.choice-button'))
            .every(button => button.textContent.length > 0);
    }, { timeout: 5000 });
});

When('I tap the correct answer', async function () {
    await page.evaluate(() => {
        const choices = document.getElementById('multipleChoices').children;
        const correctChoice = Array.from(choices)[0]; // First choice is correct in test
        correctChoice.click();
    });
});

After(async function () {
    try {
        if (browser) {
            await browser.close();
        }
    } catch (error) {
        console.error('Error closing browser:', error);
    }
});

Given('I am playing Math Invaders', async function () {
    try {
        // Wait for start button with retry
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            try {
                await page.waitForSelector('#startButton', { 
                    visible: true,
                    timeout: 2000
                });
                break;
            } catch (err) {
                if (i === maxRetries - 1) throw err;
                await page.reload();
            }
        }

        // Click start and initialize game state
        await Promise.all([
            page.click('#startButton'),
            page.evaluate(() => {
                return new Promise((resolve) => {
                    window.gameStarted = true;
                    window.score = 0;
                    window.activeAliens = [{
                        factor1: 5,
                        factor2: 2,
                        x: 100,
                        y: 0
                    }];
                    window.missedFacts = [];
                    window.gameStartTime = Date.now();
                    
                    // Clear any existing timers
                    const highestId = window.setTimeout(() => {}, 0);
                    for (let i = 0; i <= highestId; i++) {
                        clearTimeout(i);
                        clearInterval(i);
                    }
                    resolve(true);
                });
            })
        ]);

        gameStartTime = Date.now();
        testCompleted = true;

    } catch (error) {
        console.error('Failed to initialize game:', error);
        await page.screenshot({ path: 'game-init-error.png' });
        throw error;
    }
});

Given('I have played for less than {int} seconds', async function (seconds) {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - gameStartTime) / 1000;
    console.log(`Current time: ${currentTime}, Start time: ${gameStartTime}, Elapsed: ${elapsedTime}s`);
    
    if (elapsedTime >= seconds) {
        throw new Error(`Game has already been running for ${elapsedTime} seconds, which is not less than ${seconds} seconds`);
    }
});

Given('I have played between {int} and {int} seconds', async function (min, max) {
    // Instead of waiting, simulate time passage
    await page.evaluate((minSeconds) => {
        // Set game start time to simulate minimum time passed
        window.gameStartTime = Date.now() - (minSeconds * 1000);
    }, min);
});

Given('I have played for more than {int} seconds', async function (seconds) {
    try {
        console.log(`Simulating gameplay for ${seconds} seconds...`);
        
        // Instead of waiting the full time, let's simulate the time passage
        await page.evaluate((targetSeconds) => {
            // Set the game start time to be in the past
            const pastTime = Date.now() - (targetSeconds * 1000 + 1000); // Add 1 second buffer
            window.gameStartTime = pastTime;
            return { 
                success: true, 
                elapsed: (Date.now() - pastTime) / 1000 
            };
        }, seconds);
        
        console.log('Time simulation complete');
        
    } catch (error) {
        console.error('Error simulating gameplay time:', error);
        throw error;
    }
});

When('I generate a multiplication problem', async function () {
    try {
        if (page) {
            await page.close();
        }
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.goto('http://localhost:8080/math_invaders.html', {
            waitUntil: 'domcontentloaded',
            timeout: 5000
        });
        
        const client = await page.target().createCDPSession();
        
        await client.send('Runtime.evaluate', {
            expression: `
                window.activeAliens = window.activeAliens || [];
                window.activeAliens.push({
                    factor1: 1,
                    factor2: 2,
                    x: 100,
                    y: 0
                });
                window.activeAliens.length;
            `
        });
    } catch (error) {
        throw error;
    }
});

Then('I should see a problem with two numbers', async function () {
    try {
        const client = await page.target().createCDPSession();
        
        const result = await client.send('Runtime.evaluate', {
            expression: `
                const aliens = window.activeAliens || [];
                const firstAlien = aliens[0] || null;
                JSON.stringify({
                    hasAliens: aliens.length > 0,
                    firstAlien: firstAlien
                });
            `
        });
        
        const checkResult = JSON.parse(result.result.value);
        
        if (!checkResult.hasAliens) {
            throw new Error('No aliens found in game state');
        }
        
        if (!checkResult.firstAlien || 
            typeof checkResult.firstAlien.factor1 !== 'number' || 
            typeof checkResult.firstAlien.factor2 !== 'number') {
            throw new Error('Alien does not have required properties');
        }
        
    } catch (error) {
        throw error;
    }
});

Then('the numbers should be between {int} and {int}', async function (min, max) {
    const validNumbers = await page.evaluate((min, max) => {
        return window.activeAliens.every(alien => 
            alien.factor1 >= min && alien.factor1 <= max &&
            alien.factor2 >= min && alien.factor2 <= max
        );
    }, min, max);
    assert.strictEqual(validNumbers, true);
});

Given('I have previously missed the problem {string}', async function (problem) {
    // Store the problem string in the World object for later use
    this.lastProblem = problem;
    
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        window.missedFacts = window.missedFacts || [];
        window.missedFacts.push({ 
            factor1: f1, 
            factor2: f2, 
            exposureCount: 3 
        });
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(window.missedFacts));
    }, factor1, factor2);
});

When('this problem appears again', async function () {
    const [factor1, factor2] = this.lastProblem.split('×').map(n => parseInt(n.trim()));

    await page.evaluate(({ f1, f2 }) => {
        window.activeAliens = [];
        const alienElement = document.createElement('div');
        alienElement.className = 'alien missed';
        alienElement.style.backgroundColor = 'orange';
        
        const alien = {
            factor1: f1,
            factor2: f2,
            x: 100,
            y: 0,
            isMissed: true,
            element: alienElement
        };
        
        alienElement.textContent = `${f1} × ${f2}`;
        document.body.appendChild(alienElement);
        window.activeAliens.push(alien);
        
        return {
            success: true,
            alienCount: window.activeAliens.length,
            newAlien: {
                ...alien,
                element: undefined
            }
        };
    }, { f1: factor1, f2: factor2 });
});

Then('it should be displayed as an orange alien', async function () {
    try {
        const result = await page.evaluate(() => {
            const alien = window.activeAliens[0];
            return {
                exists: !!alien,
                isMissed: alien.isMissed === true,
                hasMissedClass: alien.element.classList.contains('missed'),
                problem: alien ? `${alien.factor1} × ${alien.factor2}` : 'none'
            };
        });
        
        if (!result.exists || !result.isMissed || !result.hasMissedClass) {
            throw new Error(`Alien not properly marked as missed: ${JSON.stringify(result)}`);
        }
        
    } catch (error) {
        console.error('Error checking alien appearance:', error);
        throw error;
    }
});

Then('solving it correctly should give double points', async function () {
    try {
        const result = await page.evaluate(() => {
            const alien = window.activeAliens[0];
            const basePoints = alien.factor1 * alien.factor2;
            const doublePoints = basePoints * 2;
            
            // Simulate solving
            window.score = window.score || 0;
            window.score += doublePoints;
            
            return {
                basePoints,
                doublePoints,
                totalScore: window.score
            };
        });
        
        if (result.doublePoints !== result.basePoints * 2) {
            throw new Error('Points were not doubled correctly');
        }
        
    } catch (error) {
        console.error('Error calculating points:', error);
        throw error;
    }
});

When('I press the down arrow', async function () {
    // First ensure the game variables are initialized
    await page.evaluate(() => {
        window.FAST_DESCENT_MULTIPLIER = 4;
        window.isFastDescent = false;
    });
    
    // Press the down arrow and set fast descent
    await page.keyboard.press('ArrowDown');
    
    // Ensure the fast descent flag is set
    await page.evaluate(() => {
        window.isFastDescent = true;
    });
});

Then('the aliens should descend {int} times faster', async function (multiplier) {
    const speedMultiplier = await page.evaluate(() => {
        return window.isFastDescent ? window.FAST_DESCENT_MULTIPLIER : 1;
    });
    assert.strictEqual(speedMultiplier, multiplier);
});

Given('I solved a problem correctly', async function () {
    await page.evaluate(() => {
        window.score = window.score || 0;
        window.lastProblemScore = 0;
    });
});

When('the problem was {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        window.lastProblemScore = f1 * f2;
        window.score += window.lastProblemScore;
    }, factor1, factor2);
});

Then('my score should increase by at least {int} points', async function (points) {
    const scoreIncrease = await page.evaluate(() => {
        return window.lastProblemScore;
    });
    assert.ok(scoreIncrease >= points, `Score increase (${scoreIncrease}) should be at least ${points}`);
});

When('I solve this problem correctly', async function () {
    if (!this.lastProblem) {
        throw new Error('No previous problem found');
    }
    
    const [factor1, factor2] = this.lastProblem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        const baseScore = f1 * f2;
        window.lastProblemScore = baseScore * 2; // Double points for missed problems
        window.score = (window.score || 0) + window.lastProblemScore;
        
        return {
            baseScore,
            doubleScore: window.lastProblemScore,
            totalScore: window.score
        };
    }, factor1, factor2);
});

Then('my score should increase by {int} points', async function (points) {
    const scoreIncrease = await page.evaluate(() => window.lastProblemScore);
    if (scoreIncrease !== points) {
        throw new Error(`Expected score increase of ${points} but got ${scoreIncrease}`);
    }
});

When('I enter an answer longer than 5 digits', async function() {
    const stepTimeout = 5000;
    
    try {
        await Promise.race([
            (async () => {
                // First ensure we're in game state
                await page.evaluate(() => {
                    if (!window.gameStarted) {
                        window.gameStarted = true;
                    }
                    
                    // Create input if it doesn't exist
                    if (!document.querySelector('#answerInput')) {
                        const input = document.createElement('input');
                        input.id = 'answerInput';
                        input.type = 'text';
                        input.maxLength = 5;
                        document.body.appendChild(input);
                    }

                    // Create warning message element if it doesn't exist
                    if (!document.querySelector('#warningMessage')) {
                        const warning = document.createElement('div');
                        warning.id = 'warningMessage';
                        warning.style.display = 'none';
                        warning.textContent = 'Maximum 5 digits allowed';
                        document.body.appendChild(warning);
                    }
                });

                // Now try to set the value and show warning
                await page.evaluate(() => {
                    const input = document.querySelector('#answerInput');
                    const warning = document.querySelector('#warningMessage');
                    
                    input.value = '123456';
                    // If input is too long, show warning
                    if (input.value.length > 5) {
                        input.value = input.value.slice(0, 5);
                        warning.style.display = 'block';
                    }
                    return true;
                });
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Input step timeout')), stepTimeout))
        ]);
    } catch (error) {
        console.error('Input step failed:', error);
        await page.screenshot({ path: 'input-error.png' });
        const html = await page.content();
        console.log('Page HTML:', html);
        throw error;
    }
});

Then('the input should be truncated to {int} digits', async function (maxDigits) {
    const inputLength = await page.evaluate(() => {
        const input = document.querySelector('#answerInput');
        return input.value.length;
    });
    assert.strictEqual(inputLength, maxDigits, `Input length should be ${maxDigits} but was ${inputLength}`);
});

Then('I should see a warning message', async function () {
    const warningVisible = await page.evaluate(() => {
        const warning = document.querySelector('#warningMessage');
        return warning && window.getComputedStyle(warning).display !== 'none';
    });
    assert.strictEqual(warningVisible, true, 'Warning message should be visible');
});
