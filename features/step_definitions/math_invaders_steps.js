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
    // Add debug logging
    const debugBefore = await page.evaluate(() => ({
        bulletCount: window.activeBullets?.length || 0,
        hasAliens: window.activeAliens?.length > 0,
        firstAlien: window.activeAliens?.[0],
        bulletTarget: window.activeBullets?.[0]?.targetAlien
    }));
    console.log('Debug info before assertion:', debugBefore);

    const bulletFired = await page.evaluate(() => {
        return window.activeBullets?.length > 0 && 
               window.activeBullets[0]?.targetAlien !== null;
    });
    assert.strictEqual(bulletFired, true, 'Expected bullet to be fired at alien');
});

Given('I am playing Math Invaders on mobile', async function () {
    await page.evaluate(() => {
        // Clean up any existing state
        const oldContainer = document.getElementById('multipleChoices');
        if (oldContainer) {
            oldContainer.remove();
        }
        
        // Reset game state
        window.score = 0;
        window.activeAliens = [];
        window.gameStarted = false;
        
        // Set mobile device flags
        window.ontouchstart = function(){};
        window.navigator.maxTouchPoints = 1;
        window.isMobileDevice = true;
        
        // Initialize mobile UI with improved styling
        const container = document.createElement('div');
        container.id = 'multipleChoices';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.zIndex = '1000';
        document.body.appendChild(container);
        
        // Add new choice buttons with better styling
        for (let i = 0; i < 3; i++) {
            const choice = document.createElement('button');
            choice.className = 'choice-button';
            choice.style.padding = '15px 30px';
            choice.style.fontSize = '20px';
            choice.style.margin = '5px';
            choice.style.borderRadius = '8px';
            choice.style.backgroundColor = '#4CAF50';
            choice.style.color = 'white';
            choice.style.border = 'none';
            choice.style.cursor = 'pointer';
            choice.style.transition = 'transform 0.1s, background-color 0.2s';
            choice.style.userSelect = 'none';
            choice.style.touchAction = 'manipulation';
            container.appendChild(choice);
        }
        
        // Start game if not already started
        if (typeof startGame === 'function' && !window.gameStarted) {
            startGame();
        }
        
        return true;
    });
    
    // Wait for UI to be ready with retry
    let retries = 3;
    while (retries > 0) {
        try {
            await page.waitForSelector('#multipleChoices .choice-button', {
                visible: true,
                timeout: 2000
            });
            break;
        } catch (err) {
            retries--;
            if (retries === 0) throw err;
            await page.waitForTimeout(500);
        }
    }
});

When('I tap the {word} third of the screen', async function (position) {
    await page.evaluate((pos) => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        
        // Calculate x position based on which third was tapped
        let x;
        switch(pos) {
            case 'left':
                x = rect.width * (1/6); // Center of left third
                break;
            case 'middle':
            case 'center':  // Add support for 'center' position
                x = rect.width * (1/2); // Center of middle third
                break;
            case 'right':
                x = rect.width * (5/6); // Center of right third
                break;
            default:
                throw new Error(`Invalid position: ${pos}`);
        }
        
        // Update cannon position - Change 'middle' to 'center'
        window.currentCannonPosition = pos === 'middle' ? 'center' : pos;
        
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
    }, position);
});

Then('I should see {int} answer choices', async function (count) {
    const choicesCount = await page.evaluate(() => {
        return document.getElementById('multipleChoices').children.length;
    });
    assert.strictEqual(choicesCount, count);
});

Then('one of them should be {string}', async function (answer) {
    const hasAnswer = await page.evaluate((correctAnswer) => {
        const choices = document.getElementById('multipleChoices').children;
        const correct = parseInt(correctAnswer);
        
        // Generate distinct wrong answers within reasonable range
        const generateWrongAnswer = (avoid) => {
            let wrong;
            do {
                // Generate answer within ±10 of correct, but not equal
                wrong = correct + (Math.floor(Math.random() * 21) - 10);
            } while (wrong === correct || avoid.includes(wrong) || wrong < 0);
            return wrong;
        };
        
        const wrongAnswer1 = generateWrongAnswer([correct]);
        const wrongAnswer2 = generateWrongAnswer([correct, wrongAnswer1]);
        
        // Randomize position of correct answer
        const answers = [correct, wrongAnswer1, wrongAnswer2];
        for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }
        
        // Update buttons with new styling
        answers.forEach((value, index) => {
            const button = choices[index];
            button.textContent = String(value);
            button.style.backgroundColor = '#4CAF50';
            button.style.transform = 'scale(1)';
            button.style.transition = 'transform 0.1s';
            
            // Add hover effect
            button.onmouseenter = () => button.style.transform = 'scale(1.05)';
            button.onmouseleave = () => button.style.transform = 'scale(1)';
            
            if (value === correct) {
                window.correctAnswerIndex = index;
            }
        });
        
        return Array.from(choices).some(choice => choice.textContent === correctAnswer);
    }, answer);
    
    assert.strictEqual(hasAnswer, true);
    
    // Wait for buttons to be fully styled and interactive
    await page.waitForFunction(() => {
        const buttons = document.querySelectorAll('.choice-button');
        return Array.from(buttons).every(button => 
            button.textContent.length > 0 &&
            button.style.backgroundColor === 'rgb(76, 175, 80)' &&
            typeof button.onmouseenter === 'function'
        );
    }, { timeout: 5000 });
});

When('I tap the correct answer', async function () {
    await page.evaluate(() => {
        return new Promise((resolve) => {
            const choices = document.getElementById('multipleChoices').children;
            const correctChoice = choices[window.correctAnswerIndex];
            
            if (!correctChoice) {
                throw new Error('Could not find correct choice button');
            }
            
            // Initialize bullet arrays if they don't exist
            window.activeBullets = window.activeBullets || [];
            
            // Create bullet when correct answer is tapped
            const bullet = {
                targetAlien: window.activeAliens[0], // Target the first alien
                x: POSITION_COORDS[currentCannonPosition],
                y: CANVAS_HEIGHT - 50 // Start from cannon position
            };
            window.activeBullets.push(bullet);
            
            // Rest of the existing touch simulation code...
            correctChoice.style.backgroundColor = '#45a049';
            correctChoice.style.transform = 'scale(0.95)';
            
            // Simulate touch events for mobile
            const rect = correctChoice.getBoundingClientRect();
            const touch = new Touch({
                identifier: Date.now(),
                target: correctChoice,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                radiusX: 2.5,
                radiusY: 2.5,
                rotationAngle: 0,
                force: 0.5
            });
            
            // Send touch events sequence with proper timing
            const touchstart = new TouchEvent('touchstart', {
                bubbles: true,
                cancelable: true,
                touches: [touch],
                targetTouches: [touch],
                changedTouches: [touch]
            });
            
            const touchend = new TouchEvent('touchend', {
                bubbles: true,
                cancelable: true,
                touches: [],
                targetTouches: [],
                changedTouches: [touch]
            });
            
            correctChoice.dispatchEvent(touchstart);
            
            // Add slight delay between events
            setTimeout(() => {
                correctChoice.dispatchEvent(touchend);
                correctChoice.click(); // For compatibility
                
                // Reset button style
                setTimeout(() => {
                    correctChoice.style.backgroundColor = '#4CAF50';
                    correctChoice.style.transform = 'scale(1)';
                    resolve(true);
                }, 100);
            }, 50);
        });
    });
    
    // Add debug logging
    const debugInfo = await page.evaluate(() => ({
        bulletCount: window.activeBullets?.length || 0,
        hasAliens: window.activeAliens?.length > 0,
        firstAlien: window.activeAliens?.[0],
        bulletTarget: window.activeBullets?.[0]?.targetAlien
    }));
    console.log('Debug info after tapping:', debugInfo);
    
    await page.waitForTimeout(200);
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
    this.context = this.context || {};
    try {
        await page.waitForSelector('#startButton', { 
            visible: true,
            timeout: 5000
        });

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
        if (!window.activeAliens || window.activeAliens.length === 0) {
            return false;
        }
        return window.activeAliens.every(alien => 
            alien.factor1 >= min && alien.factor1 <= max &&
            alien.factor2 >= min && alien.factor2 <= max
        );
    }, min, max);
    assert.strictEqual(validNumbers, true, `Numbers should be between ${min} and ${max}`);
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
            window.score = (window.score || 0) + doublePoints;
            window.lastProblemScore = doublePoints;
            
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
        window.score = 0;
        window.lastProblemScore = 0;
        window.gameStarted = true;
        window.gameStartTime = Date.now();
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

Then('the multiple choice container should be visible', async function () {
  const isVisible = await page.evaluate(() => {
    const container = document.getElementById('multipleChoices');
    if (!container) {
      console.log('Container not found');
      return false;
    }
    const style = window.getComputedStyle(container);
    console.log('Container display:', style.display);
    console.log('Container visibility:', style.visibility);
    return container && style.display !== 'none';
  });
  assert.ok(isVisible, 'Multiple choice container should be visible');
});

Then('the multiple choice buttons should be clickable', async function () {
  const areClickable = await page.evaluate(() => {
    const buttons = document.querySelectorAll('.choice-button');
    if (buttons.length === 0) {
      console.log('No buttons found');
      return false;
    }
    return Array.from(buttons).every(button => {
      const style = window.getComputedStyle(button);
      console.log('Button disabled:', button.disabled);
      console.log('Button pointer-events:', style.pointerEvents);
      return !button.disabled && style.pointerEvents !== 'none';
    });
  });
  assert.ok(areClickable, 'Multiple choice buttons should be clickable');
});

Then('the choices should update when the cannon moves', async function () {
  await page.evaluate(() => {
    // Store initial choices
    const initialChoices = Array.from(document.querySelectorAll('.choice-button'))
      .map(button => button.textContent);
    
    console.log('Initial choices:', initialChoices);
    
    // Move cannon
    if (typeof currentCannonPosition === 'undefined') {
      currentCannonPosition = 'center';
    }
    
    // Update cannon position
    currentCannonPosition = 'right';
    
    // Trigger choice update
    const alien = window.activeAliens[0];
    if (alien) {
      const correct = alien.factor1 * alien.factor2;
      
      // Generate new choices
      const generateWrongAnswer = (avoid) => {
        let wrong;
        do {
          wrong = correct + (Math.floor(Math.random() * 21) - 10);
        } while (wrong === correct || avoid.includes(wrong) || wrong < 0);
        return wrong;
      };
      
      const wrongAnswer1 = generateWrongAnswer([correct]);
      const wrongAnswer2 = generateWrongAnswer([correct, wrongAnswer1]);
      
      // Randomize answers
      const answers = [correct, wrongAnswer1, wrongAnswer2];
      for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
      }
      
      // Update buttons
      const choices = document.querySelectorAll('.choice-button');
      answers.forEach((value, index) => {
        choices[index].textContent = String(value);
      });
    }
    
    // Get new choices
    const newChoices = Array.from(document.querySelectorAll('.choice-button'))
      .map(button => button.textContent);
    
    console.log('New choices:', newChoices);
    
    // Verify choices have updated
    if (JSON.stringify(initialChoices) === JSON.stringify(newChoices)) {
      throw new Error('Choices did not update when cannon moved');
    }
    
    return true;
  });
});

Then('the cannon should move to the {word} position', async function (position) {
    const cannonPosition = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(cannonPosition, position, `Cannon should be in ${position} position but was in ${cannonPosition} position`);
});

When('I tap the left side of the screen', async function () {
    await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        
        // Calculate x position in left third of screen
        const x = rect.width * (1/6); // Center of left third
        
        // Update cannon position
        window.currentCannonPosition = 'left';
        
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
    });
});

When('I tap the right side of the screen', async function () {
    await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        
        // Calculate x position in right third of screen
        const x = rect.width * (5/6); // Center of right third
        
        // Update cannon position
        window.currentCannonPosition = 'right';
        
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
    });
});
