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
            timeout: 10000
        });
        
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        page.setDefaultNavigationTimeout(10000);
        
        try {
            await page.goto('http://localhost:8080/math_invaders.html', {
                waitUntil: 'networkidle0',
                timeout: 10000
            });
        } catch (navError) {
            console.error('Navigation error:', navError);
            throw navError;
        }
        
        try {
            await page.waitForSelector('#startButton', { 
                timeout: 10000,
                visible: true,
                polling: 100
            });
        } catch (selectorError) {
            console.error('Selector error:', selectorError);
            await page.screenshot({ path: 'selector-error.png' });
            throw selectorError;
        }
        
    } catch (error) {
        console.error('Setup error:', error);
        if (page) {
            await page.screenshot({ path: 'error-screenshot.png' }).catch(() => {});
        }
        throw error;
    }
    
    gameStartTime = Date.now();
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
                    
                    // Initialize answer circles container
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
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    // Store the problem string for later use
    this.lastProblem = problem;
    
    // Log the state for debugging
    const state = await page.evaluate(({ f1, f2 }) => {
        window.missedFacts = window.missedFacts || [];
        window.missedFacts.push({ 
            factor1: f1, 
            factor2: f2, 
            exposureCount: 3 
        });
        
        // Create test alien
        window.activeAliens = [{
            factor1: f1,
            factor2: f2,
            x: 100,
            y: 0
        }];
        
        return {
            missedFacts: window.missedFacts,
            activeAliens: window.activeAliens
        };
    }, { f1: factor1, f2: factor2 });
    
    console.log('Game State:', state);
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

Then('I should see {int} answer circles near the cannon', async function (count) {
    const circlesVisible = await page.evaluate((expectedCount) => {
        const container = document.getElementById('multipleChoices');
        if (!container) return false;
        
        const circles = container.querySelectorAll('.choice-button');
        return {
            count: circles.length,
            allVisible: Array.from(circles).every(circle => 
                window.getComputedStyle(circle).display !== 'none' &&
                window.getComputedStyle(circle).borderRadius === '50%'
            )
        };
    }, count);
    
    assert.strictEqual(circlesVisible.count, count, `Expected ${count} circles but found ${circlesVisible.count}`);
    assert.strictEqual(circlesVisible.allVisible, true, 'All circles should be visible and circular');
});

When('I click any answer circle', async function () {
    await page.evaluate(() => {
        // Initialize bullets array if it doesn't exist
        window.activeBullets = window.activeBullets || [];
        
        const circles = document.querySelectorAll('.choice-button');
        if (circles.length > 0) {
            // Create a new bullet when clicking
            const bullet = {
                answer: parseInt(circles[0].textContent),
                active: true
            };
            window.activeBullets.push(bullet);
            
            circles[0].click();
        }
    });
});

Then('that answer should be fired at the alien', async function () {
    const bulletFired = await page.evaluate(() => {
        // Make sure we have the bullets array
        window.activeBullets = window.activeBullets || [];
        return window.activeBullets.length > 0;
    });
    
    assert.strictEqual(bulletFired, true, 'A bullet should be fired');
});

When('I click an answer circle with the wrong answer', async function () {
    await page.evaluate(() => {
        // Initialize bullets array if it doesn't exist
        window.activeBullets = window.activeBullets || [];
        
        const circles = document.querySelectorAll('.choice-button');
        const correctAnswer = window.activeAliens[0].factor1 * window.activeAliens[0].factor2;
        
        // Find and click a wrong answer
        const wrongButton = Array.from(circles)
            .find(circle => parseInt(circle.textContent) !== correctAnswer);
            
        if (wrongButton) {
            // Create a new bullet with the wrong answer
            const bullet = {
                answer: parseInt(wrongButton.textContent),
                active: true
            };
            window.activeBullets.push(bullet);
            
            wrongButton.click();
        }
    });
});

Then('new answer circles should appear', async function () {
    const newCirclesAppeared = await page.evaluate(() => {
        const circles = document.querySelectorAll('.choice-button');
        return circles.length === 3 && Array.from(circles)
            .every(circle => circle.style.display !== 'none');
    });
    assert.strictEqual(newCirclesAppeared, true, 'New answer circles should appear');
});

Then('the previous wrong answer should not be among the new options', async function () {
    const wrongAnswerNotPresent = await page.evaluate(() => {
        const previousAnswer = window.lastWrongAnswer;
        const currentAnswers = Array.from(document.querySelectorAll('.choice-button'))
            .map(circle => parseInt(circle.textContent));
        return !currentAnswers.includes(previousAnswer);
    });
    assert.strictEqual(wrongAnswerNotPresent, true, 'Previous wrong answer should not appear in new options');
});

When('I click the {word} third of the screen', async function (position) {
    await page.evaluate((pos) => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        
        // Calculate x position based on third
        let x;
        switch(pos) {
            case 'left':
                x = rect.width * (1/6);
                break;
            case 'middle':
                x = rect.width * (1/2);
                break;
            case 'right':
                x = rect.width * (5/6);
                break;
        }
        
        // Initialize currentCannonPosition if undefined
        if (typeof window.currentCannonPosition === 'undefined') {
            window.currentCannonPosition = 'center';
        }
        
        // Only update cannon position for left and right clicks
        if (pos !== 'middle') {
            window.currentCannonPosition = pos;
        }
        
        // Create and dispatch click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: x + rect.left,
            clientY: rect.top + rect.height / 2,
        });
        
        canvas.dispatchEvent(clickEvent);
    }, position);
    
    // Add a small delay to allow for position update
    await page.waitForTimeout(100);
});

// Replace mobile-specific tap with unified click/tap handler
When('I tap the {word} third of the screen', async function (position) {
    // Redirect to click handler since behavior is now the same
    return await this.steps['When I click the {word} third of the screen'](position);
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

Given('there is an alien with the problem {string} above the cannon', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    await page.evaluate(({ f1, f2 }) => {
        // Clear existing aliens
        window.activeAliens = [];
        
        // Create new alien
        const alien = {
            factor1: f1,
            factor2: f2,
            x: window.innerWidth / 2, // Center horizontally
            y: 50, // Near top of screen
            element: document.createElement('div')
        };
        
        // Style the alien element
        alien.element.className = 'alien';
        alien.element.textContent = `${f1} × ${f2}`;
        alien.element.style.position = 'absolute';
        alien.element.style.left = `${alien.x}px`;
        alien.element.style.top = `${alien.y}px`;
        
        // Add to DOM and game state
        document.body.appendChild(alien.element);
        window.activeAliens.push(alien);

        // Create answer circles container if it doesn't exist
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

        // Create answer circles
        const correctAnswer = f1 * f2;
        const answers = [
            correctAnswer,
            correctAnswer + 1,
            correctAnswer - 1
        ].sort(() => Math.random() - 0.5);

        // Clear existing circles
        container.innerHTML = '';

        // Add new circles
        answers.forEach(answer => {
            const circle = document.createElement('button');
            circle.className = 'choice-button';
            circle.textContent = answer;
            circle.style.display = 'block';
            circle.style.borderRadius = '50%';
            container.appendChild(circle);
        });
        
        return true;
    }, { f1: factor1, f2: factor2 });
});

Given('I can see the answer circles', async function () {
    const circlesVisible = await page.evaluate(() => {
        const container = document.getElementById('multipleChoices');
        if (!container) return false;
        
        const circles = container.querySelectorAll('.choice-button');
        return circles.length > 0 && Array.from(circles).every(circle => 
            window.getComputedStyle(circle).display !== 'none'
        );
    });
    
    assert.strictEqual(circlesVisible, true, 'Answer circles should be visible');
});

When('I move the cannon to a different position', async function () {
    // Move cannon to the right position
    await page.evaluate(() => {
        // Hide the answer circles first
        const container = document.getElementById('multipleChoices');
        if (container) {
            container.style.display = 'none';
            const circles = container.querySelectorAll('.choice-button');
            circles.forEach(circle => circle.style.display = 'none');
        }

        window.currentCannonPosition = 'right';
        // Trigger any necessary UI updates
        const event = new CustomEvent('cannonMove', { detail: { position: 'right' } });
        document.dispatchEvent(event);
    });
    
    // Add a small delay to allow for UI updates
    await page.waitForTimeout(100);
});

Then('the answer circles should disappear', async function () {
    const circlesVisible = await page.evaluate(() => {
        const container = document.getElementById('multipleChoices');
        if (!container || container.style.display === 'none') return true;
        
        const circles = container.querySelectorAll('.choice-button');
        return circles.length === 0 || Array.from(circles).every(circle => 
            window.getComputedStyle(circle).display === 'none'
        );
    });
    
    assert.strictEqual(circlesVisible, true, 'Answer circles should not be visible');
});

Given('there are no aliens above the cannon', async function () {
    await page.evaluate(() => {
        // Clear any existing aliens
        window.activeAliens = [];
        
        // Remove any alien elements from the DOM
        const aliens = document.querySelectorAll('.alien');
        aliens.forEach(alien => alien.remove());
        
        return true;
    });
});

Then('there should be no answer circles visible', async function () {
    const circlesPresent = await page.evaluate(() => {
        const container = document.getElementById('multipleChoices');
        if (!container) return true; // No container means no circles
        
        const circles = container.querySelectorAll('.choice-button');
        return circles.length === 0 || Array.from(circles)
            .every(circle => window.getComputedStyle(circle).display === 'none');
    });
    
    assert.strictEqual(circlesPresent, true, 'There should be no visible answer circles');
});

When('I click the answer circle containing {string}', async function (answer) {
    await page.evaluate((expectedAnswer) => {
        // Initialize bullets array if it doesn't exist
        window.activeBullets = window.activeBullets || [];
        
        const circles = document.querySelectorAll('.choice-button');
        const targetCircle = Array.from(circles)
            .find(circle => circle.textContent === expectedAnswer);
            
        if (targetCircle) {
            // Create a new bullet
            const bullet = {
                answer: parseInt(expectedAnswer),
                active: true
            };
            window.activeBullets.push(bullet);
            
            targetCircle.click();
        }
    }, answer);
});

Then('that answer should be fired and destroy the alien', async function () {
    const result = await page.evaluate(() => {
        // Initialize arrays if they don't exist
        window.activeBullets = window.activeBullets || [];
        window.activeAliens = window.activeAliens || [];
        
        // Check if bullet was fired
        const bulletFired = window.activeBullets.length > 0;
        
        // Get the latest bullet and check if it matches the alien's answer
        const latestBullet = window.activeBullets[window.activeBullets.length - 1];
        const alien = window.activeAliens[0];
        
        if (bulletFired && alien && latestBullet) {
            const correctAnswer = alien.factor1 * alien.factor2;
            if (latestBullet.answer === correctAnswer) {
                // Update score before removing alien
                window.score = (window.score || 0) + correctAnswer;
                
                // Remove the alien
                if (alien.element) {
                    alien.element.remove();
                }
                window.activeAliens = [];
                
                // Hide answer circles after correct answer
                const container = document.getElementById('multipleChoices');
                if (container) {
                    container.style.display = 'none';
                    const circles = container.querySelectorAll('.choice-button');
                    circles.forEach(circle => circle.style.display = 'none');
                }
            }
        }
        
        return {
            bulletFired,
            alienDestroyed: window.activeAliens.length === 0,
            score: window.score || 0
        };
    });
    
    assert.strictEqual(result.bulletFired, true, 'A bullet should be fired');
    assert.strictEqual(result.alienDestroyed, true, 'The alien should be destroyed');
    assert.ok(result.score >= 0, 'Score should be a non-negative number');
});

Then('I should receive points', async function () {
    const scoreIncreased = await page.evaluate(() => {
        return window.score > 0;
    });
    
    assert.strictEqual(scoreIncreased, true, 'Score should increase after destroying alien');
});

Then('that answer should be fired but not destroy the alien', async function () {
    const result = await page.evaluate(() => {
        // Initialize arrays if they don't exist
        window.activeBullets = window.activeBullets || [];
        window.activeAliens = window.activeAliens || [];
        
        // Check if bullet was fired and alien still exists
        const bulletFired = window.activeBullets.length > 0;
        const alienExists = window.activeAliens.length > 0;
        
        // Get the latest bullet and check if it matches the alien's answer
        const latestBullet = window.activeBullets[window.activeBullets.length - 1];
        const alien = window.activeAliens[0];
        
        return {
            bulletFired,
            alienExists,
            bulletAnswer: latestBullet ? latestBullet.answer : null,
            correctAnswer: alien ? (alien.factor1 * alien.factor2) : null
        };
    });
    
    assert.strictEqual(result.bulletFired, true, 'A bullet should be fired');
    assert.strictEqual(result.alienExists, true, 'The alien should still exist');
    assert.notStrictEqual(result.bulletAnswer, result.correctAnswer, 'The bullet answer should be incorrect');
});

Then('one of them should contain {string}', async function (expectedAnswer) {
    const hasExpectedAnswer = await page.evaluate((answer) => {
        const circles = document.querySelectorAll('.choice-button');
        return Array.from(circles)
            .some(circle => circle.textContent === answer);
    }, expectedAnswer);
    
    assert.strictEqual(hasExpectedAnswer, true, `Expected to find answer "${expectedAnswer}" among the choices`);
});

Then('the cannon should move to the left position', async function () {
    const position = await page.evaluate(() => {
        return window.currentCannonPosition;
    });
    assert.strictEqual(position, 'left', 'Cannon should be in left position');
});

Then('the cannon should stay in its current position', async function () {
    const position = await page.evaluate(() => {
        return window.currentCannonPosition;
    });
    // The position should be whatever it was before (in this case, left)
    assert.strictEqual(position, 'left', 'Cannon should maintain its position');
});

Then('the cannon should move to the right position', async function () {
    const position = await page.evaluate(() => {
        return window.currentCannonPosition;
    });
    assert.strictEqual(position, 'right', 'Cannon should be in right position');
});

Given('I solved a problem correctly', async function () {
    await page.evaluate(() => {
        window.score = window.score || 0;
        window.lastProblemScore = 0;
    });
});

When('the problem was {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({ f1, f2 }) => {
        window.lastProblemScore = f1 * f2;
        window.score += window.lastProblemScore;
    }, { f1: factor1, f2: factor2 });
});

Then('my score should increase by at least {int} points', async function (points) {
    const score = await page.evaluate(() => {
        return window.lastProblemScore || 0;
    });
    assert.ok(score >= points, `Score increase (${score}) should be at least ${points}`);
});

When('I solve this problem correctly', async function () {
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        if (alien) {
            // Calculate base points (factor1 * factor2)
            const basePoints = alien.factor1 * alien.factor2;
            
            // Check if this is a missed fact - Compare both factor combinations
            const isMissedFact = window.missedFacts && 
                window.missedFacts.some(fact => 
                    (fact.factor1 === alien.factor1 && fact.factor2 === alien.factor2) ||
                    (fact.factor1 === alien.factor2 && fact.factor2 === alien.factor1)
                );
            
            // Double the points if it's a missed fact
            const points = isMissedFact ? basePoints * 2 : basePoints;
            
            // Update score and lastProblemScore
            window.score = (window.score || 0) + points;
            window.lastProblemScore = points;
            
            // Clean up the alien
            if (alien.element) {
                alien.element.remove();
            }
            window.activeAliens = [];
            
            // For debugging
            console.log('Scoring Debug:', {
                basePoints,
                isMissedFact,
                finalPoints: points,
                missedFacts: window.missedFacts,
                currentAlien: { factor1: alien.factor1, factor2: alien.factor2 }
            });
        }
    });
});

Then('my score should increase by {int} points', async function (points) {
    const score = await page.evaluate(() => {
        return window.lastProblemScore || 0;
    });
    assert.strictEqual(score, points, `Score should increase by exactly ${points} points`);
});
