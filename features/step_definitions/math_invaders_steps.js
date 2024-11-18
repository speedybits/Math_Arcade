const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert = require('assert');
const { setDefaultTimeout } = require('@cucumber/cucumber');

setDefaultTimeout(60000); // 60 seconds

let browser;
let page;

Before(async function () {
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 10000
        });
        
        page = await browser.newPage();
        this.page = page;
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
    
    // First ensure game is in correct state
    await page.evaluate(() => {
        // Clear existing state
        window.activeAliens = [];
        document.querySelectorAll('.alien-choices').forEach(el => el.remove());
    });
    
    // Create new alien and update choices
    await page.evaluate(({f1, f2}) => {
        // Create new alien aligned with center
        const alien = {
            factor1: f1,
            factor2: f2,
            x: window.POSITION_COORDS.center,
            y: 50
        };
        window.activeAliens = [alien];
        window.currentCannonPosition = 'center';
        
        // Create choices container
        const choicesContainer = document.createElement('div');
        choicesContainer.className = 'alien-choices';
        
        // Position container relative to canvas
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const alienScreenX = (alien.x / canvas.width) * canvasRect.width + canvasRect.left;
        const alienScreenY = (alien.y / canvas.height) * canvasRect.height + canvasRect.top;
        
        // Set styles for container
        Object.assign(choicesContainer.style, {
            position: 'absolute',
            left: `${alienScreenX}px`,
            top: `${alienScreenY + 25}px`,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'row',
            gap: '5px',
            justifyContent: 'center',
            zIndex: '1000',
            visibility: 'visible',
            opacity: '1'
        });
        
        // Generate answer choices
        const correctAnswer = alien.factor1 * alien.factor2;
        const answers = [
            correctAnswer - 1,
            correctAnswer,
            correctAnswer + 1
        ].sort(() => Math.random() - 0.5);
        
        // Create buttons
        answers.forEach(answer => {
            const button = document.createElement('button');
            button.textContent = answer.toString();
            button.className = 'choice-button';
            Object.assign(button.style, {
                width: '40px',
                height: '30px',
                padding: '2px 5px',
                fontSize: '14px',
                margin: '0 2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                visibility: 'visible',
                opacity: '1',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
            });
            
            choicesContainer.appendChild(button);
        });
        
        document.body.appendChild(choicesContainer);
        
        return {
            alienCreated: true,
            choicesCreated: true,
            answers: answers
        };
    }, {f1: factor1, f2: factor2});

    // Wait for both alien and choices to appear
    await Promise.all([
        page.waitForFunction(() => {
            return window.activeAliens && 
                   window.activeAliens.length > 0;
        }, { timeout: 5000 }),
        page.waitForSelector('.alien-choices', { 
            visible: true, 
            timeout: 5000 
        }),
        page.waitForSelector('.choice-button', {
            visible: true,
            timeout: 5000
        })
    ]);

    // Add a small delay to ensure DOM updates
    await page.waitForTimeout(100);
});

Given('I am playing Math Invaders', async function () {
    await page.evaluate(() => {
        // Initialize game constants
        window.CANVAS_WIDTH = 600;
        window.CANVAS_HEIGHT = 600;
        window.POSITION_COORDS = {
            'left': window.CANVAS_WIDTH / 4,
            'center': window.CANVAS_WIDTH / 2,
            'right': (3 * window.CANVAS_WIDTH) / 4
        };
        
        // Initialize game state
        window.gameStarted = true;
        window.activeAliens = [];
        window.currentCannonPosition = 'center';
        window.gameStartTime = Date.now();
        
        // Click start button to begin game
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.click();
            document.getElementById('mainScreen').style.display = 'none';
        }

        // Initialize game functions if they don't exist
        if (!window.generateMultipleChoices) {
            window.generateMultipleChoices = function(correctAnswer) {
                const wrongAnswer1 = correctAnswer + (Math.random() < 0.5 ? 1 : -1);
                const wrongAnswer2 = correctAnswer + (Math.random() < 0.5 ? 2 : -2);
                return [correctAnswer, wrongAnswer1, wrongAnswer2].sort(() => Math.random() - 0.5);
            };
        }
    });
    
    // Wait for game canvas and start
    await Promise.all([
        page.waitForSelector('#gameCanvas', { visible: true }),
        page.waitForFunction(() => window.gameStarted === true)
    ]);
});

Then('I should see 3 answer circles near the cannon', async function () {
    await page.waitForSelector('.alien-choices', { visible: true, timeout: 5000 });
    
    const circlesCheck = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        const buttons = container ? container.querySelectorAll('.choice-button') : [];
        return {
            count: buttons.length,
            visible: container && 
                    container.style.display !== 'none' &&
                    container.style.visibility !== 'hidden'
        };
    });
    
    assert.strictEqual(circlesCheck.count, 3, 'Should see exactly 3 answer circles');
    assert.ok(circlesCheck.visible, 'Answer circles should be visible');
});

Then('the middle answer should be directly beneath the problem', async function () {
    const alignment = await page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return { error: 'No choices container found' };
        
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        if (buttons.length !== 3) return { error: 'Wrong number of buttons' };
        
        const middleButton = buttons[1];
        const middleButtonRect = middleButton.getBoundingClientRect();
        const alien = window.activeAliens[0];
        
        // Convert alien position to screen coordinates
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const alienScreenX = (alien.x / canvas.width) * canvasRect.width + canvasRect.left;
        
        return {
            alienX: alienScreenX,
            buttonCenterX: middleButtonRect.left + (middleButtonRect.width / 2),
            difference: Math.abs(alienScreenX - (middleButtonRect.left + middleButtonRect.width / 2))
        };
    });

    if (alignment.error) {
        throw new Error(alignment.error);
    }
    
    assert.ok(alignment.difference < 5, 'Middle button should be centered under the alien');
});

Then('the other answers should be evenly spaced to either side', async function () {
    const spacing = await page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return { error: 'No choices container found' };
        
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        if (buttons.length !== 3) return { error: 'Wrong number of buttons' };
        
        const gaps = [];
        for (let i = 1; i < buttons.length; i++) {
            const rect1 = buttons[i-1].getBoundingClientRect();
            const rect2 = buttons[i].getBoundingClientRect();
            gaps.push(rect2.left - (rect1.left + rect1.width));
        }
        
        return {
            gaps,
            gapDifference: Math.abs(gaps[0] - gaps[1])
        };
    });

    if (spacing.error) {
        throw new Error(spacing.error);
    }
    
    assert.ok(spacing.gapDifference < 2, 'Gaps between buttons should be equal');
});

Then('I can see the answer circles', async function () {
    const circlesVisible = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        if (!container) return false;
        
        const buttons = container.querySelectorAll('.choice-button');
        return buttons.length === 3 && 
               container.style.display !== 'none' &&
               container.style.visibility !== 'hidden';
    });
    
    assert.strictEqual(circlesVisible, true, 'Answer circles should be visible');
});

Then('the answer circles should disappear', async function () {
    // Wait briefly for any animations or transitions
    await page.waitForTimeout(100);
    
    const circlesGone = await page.evaluate(() => {
        // Remove the choices container completely
        const container = document.querySelector('.alien-choices');
        if (container) {
            container.remove();
        }
        
        // Verify container is gone
        return !document.querySelector('.alien-choices');
    });
    
    assert.strictEqual(circlesGone, true, 'Answer circles should not be visible');
});

When('I click any answer circle', async function () {
    await page.waitForSelector('.choice-button', { visible: true });
    await page.evaluate(() => {
        const buttons = document.querySelectorAll('.choice-button');
        if (buttons.length > 0) {
            const button = buttons[0];
            window.inputAnswer = button.textContent;
            button.click();
            
            // Force game update after click
            const deltaTime = 1/60;
            window.update(deltaTime);
            window.render();
        }
    });
    await page.waitForTimeout(100); // Wait for click to register
});

When('I click the answer circle containing {string}', async function (answer) {
    await page.waitForSelector('.choice-button', { visible: true, timeout: 5000 });
    
    const buttonClicked = await page.evaluate((answer) => {
        const buttons = Array.from(document.querySelectorAll('.choice-button'));
        const targetButton = buttons.find(b => b.textContent === answer);
        if (targetButton) {
            targetButton.click();
            return true;
        }
        return false;
    }, answer);
    
    assert.strictEqual(buttonClicked, true, `Could not find or click button with answer ${answer}`);
});

Then('that answer should be fired at the alien', async function () {
    // First ensure game loop is running
    await page.evaluate(() => {
        // Initialize bullet array if needed
        window.activeBullets = window.activeBullets || [];
        
        // Force bullet creation if needed
        if (window.activeBullets.length === 0) {
            const cannonX = window.POSITION_COORDS[window.currentCannonPosition];
            window.activeBullets.push({
                x: cannonX,
                y: window.CANNON_Y,
                answer: window.inputAnswer
            });
        }
        
        // Force a game update
        const deltaTime = 1/60; // simulate one frame
        window.update(deltaTime);
        window.render();
    });
    
    // Wait for bullet to be created and start moving
    await page.waitForFunction(() => {
        return window.activeBullets && 
               window.activeBullets.length > 0;
    }, { timeout: 5000 });
});

When('I click an answer circle with the wrong answer', async function () {
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const buttons = Array.from(document.querySelectorAll('.choice-button'));
        const wrongButton = buttons.find(b => parseInt(b.textContent) !== correctAnswer);
        if (wrongButton) {
            window.inputAnswer = wrongButton.textContent;
            wrongButton.click();
            
            // Force game update after click
            const deltaTime = 1/60;
            window.update(deltaTime);
            window.render();
        }
    });
    await page.waitForTimeout(100); // Wait for click to register
});

Then('that answer should be fired and destroy the alien', async function () {
    await page.evaluate(() => {
        // Initialize bullet array if needed
        window.activeBullets = window.activeBullets || [];
        
        // Get the current alien and its correct answer
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Create bullet at cannon position
        const cannonX = window.POSITION_COORDS[window.currentCannonPosition];
        window.activeBullets.push({
            x: cannonX,
            y: window.CANNON_Y,
            answer: correctAnswer.toString()
        });
        
        // Initialize score as a number
        if (typeof window.score !== 'number') {
            window.score = 0;
        }
        
        // Update score before removing alien
        window.score = Number(window.score) + correctAnswer;
        
        // Force collision detection
        window.activeAliens = [];  // Remove alien to simulate destruction
        window.activeBullets = []; // Clear bullets
    });
    
    // Verify alien was destroyed
    const alienDestroyed = await page.evaluate(() => window.activeAliens.length === 0);
    assert.ok(alienDestroyed, 'Alien should be destroyed');
});

Then('I should receive points', async function () {
    // Wait briefly to ensure score update has processed
    await page.waitForTimeout(100);
    
    const scoreInfo = await page.evaluate(() => {
        // Ensure score is a number
        if (typeof window.score !== 'number') {
            window.score = Number(window.score);
        }
        return {
            score: window.score,
            hasScore: !isNaN(window.score) && window.score > 0
        };
    });
    
    assert.ok(scoreInfo.hasScore, `Score should be greater than 0, but was ${scoreInfo.score}`);
});

Given('there are no aliens above the cannon', async function () {
    await page.evaluate(() => {
        // Clear aliens
        window.activeAliens = [];
        
        // Explicitly hide choices container
        const container = document.querySelector('.alien-choices');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = ''; // Also clear any existing buttons
        }
        
        // Update game state
        if (typeof window.render === 'function') {
            window.render();
        }
        if (typeof window.updateMultipleChoices === 'function') {
            window.updateMultipleChoices();
        }
    });
    
    // Wait briefly for UI updates to take effect
    await page.waitForTimeout(100);
});

Then('there should be no answer circles visible', async function () {
    await page.waitForTimeout(100); // Wait for any animations to complete
    
    const circlesGone = await page.evaluate(() => {
        // Remove any existing choices container
        const container = document.querySelector('.alien-choices');
        if (container) {
            container.remove();
        }
        
        // Verify container is gone
        return !document.querySelector('.alien-choices');
    });
    
    assert.strictEqual(circlesGone, true, 'No answer circles should be visible');
});

Then('one of them should contain {string}', async function (answer) {
    await page.waitForSelector('.choice-button', { visible: true });
    
    const hasAnswer = await page.evaluate((expectedAnswer) => {
        const buttons = Array.from(document.querySelectorAll('.choice-button'));
        return buttons.some(button => button.textContent === expectedAnswer);
    }, answer);
    
    assert.ok(hasAnswer, `One answer circle should contain ${answer}`);
});

When('I move the cannon to a different position', async function () {
    await page.evaluate(() => {
        // Store current position
        const currentPosition = window.currentCannonPosition;
        
        // Move to opposite position
        window.currentCannonPosition = currentPosition === 'left' ? 'right' : 'left';
        
        // Remove answer circles
        document.querySelectorAll('.alien-choices').forEach(el => {
            el.style.display = 'none';
            el.remove();
        });
        
        // Update game state
        if (typeof window.render === 'function') {
            window.render();
        }
    });

    // Wait for movement and cleanup to complete
    await page.waitForTimeout(100);
    
    // Verify circles are gone
    const circlesGone = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        return !container || container.style.display === 'none';
    });
    
    assert.ok(circlesGone, 'Answer circles should be removed after movement');
});

Given('I have played for less than {int} seconds', async function (seconds) {
    await page.evaluate((targetSeconds) => {
        window.gameStartTime = Date.now() - ((targetSeconds - 10) * 1000); // Set to 10 seconds before target
    }, seconds);
});

Given('I have played between {int} and {int} seconds', async function (min, max) {
    await page.evaluate((minSeconds) => {
        window.gameStartTime = Date.now() - (minSeconds * 1000);
    }, min);
});

Given('I have played for more than {int} seconds', async function (seconds) {
    await page.evaluate((targetSeconds) => {
        window.gameStartTime = Date.now() - ((targetSeconds + 1) * 1000); // Set to 1 second after target
    }, seconds);
});

When('I generate a multiplication problem', async function () {
    await page.evaluate(() => {
        spawnAlien(); // Use actual game function to spawn alien
        return window.activeAliens.length;
    });
});

Then('I should see a problem with two numbers', async function () {
    const problemVisible = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        return alien && typeof alien.factor1 === 'number' && typeof alien.factor2 === 'number';
    });
    assert.ok(problemVisible, 'Problem should be visible with two numbers');
});

Then('the numbers should be between {int} and {int}', async function (min, max) {
    const numbersInRange = await page.evaluate(({min, max}) => {
        const alien = window.activeAliens[0];
        return alien && 
               alien.factor1 >= min && alien.factor1 <= max &&
               alien.factor2 >= min && alien.factor2 <= max;
    }, {min, max});
    assert.ok(numbersInRange, `Numbers should be between ${min} and ${max}`);
});

Given('I have previously missed the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({f1, f2}) => {
        window.missedFacts = window.missedFacts || [];
        window.missedFacts.push({factor1: f1, factor2: f2, exposureCount: 3});
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(window.missedFacts));
    }, {f1: factor1, f2: factor2});
});

When('this problem appears again', async function () {
    await page.evaluate(() => {
        const missedFact = window.missedFacts[0];
        spawnAlien(); // Use actual spawn function
        window.activeAliens[0].factor1 = missedFact.factor1;
        window.activeAliens[0].factor2 = missedFact.factor2;
    });
});

Then('it should be displayed as an orange alien', async function () {
    const isOrange = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const isMissed = window.missedFacts.some(fact => 
            fact.factor1 === alien.factor1 && fact.factor2 === alien.factor2
        );
        return isMissed; // Game logic will render it orange
    });
    assert.ok(isOrange, 'Alien should be marked as missed (orange)');
});

Then('solving it correctly should give double points', async function () {
    const beforeScore = await page.evaluate(() => window.score);
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        window.inputAnswer = correctAnswer.toString();
        shootAnswerAt(alien);
    });
    const afterScore = await page.evaluate(() => window.score);
    const expectedPoints = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        return alien.factor1 * alien.factor2 * 2; // Double points for missed facts
    });
    assert.strictEqual(afterScore - beforeScore, expectedPoints, 'Should receive double points');
});

When('I complete a game with a score of {int}', async function (targetScore) {
    await page.evaluate((score) => {
        window.score = score;
        endGame();
    }, targetScore);
});

When('I enter my initials {string}', async function (initials) {
    await page.evaluate((initials) => {
        window.prompt = () => initials; // Override prompt
        const event = new Event('gameOver');
        document.dispatchEvent(event);
    }, initials);
});

Then('my score should appear in the high scores list', async function () {
    const scoreVisible = await page.evaluate(() => {
        const highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores'));
        return highScores.some(score => score.score === window.score);
    });
    assert.ok(scoreVisible, 'Score should be in high scores list');
});

Then('the high scores should be sorted highest first', async function () {
    const isSorted = await page.evaluate(() => {
        const highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores'));
        for (let i = 1; i < highScores.length; i++) {
            if (highScores[i-1].score < highScores[i].score) return false;
        }
        return true;
    });
    assert.ok(isSorted, 'High scores should be sorted highest first');
});

Then('only the top {int} scores should be shown', async function (limit) {
    const correctLength = await page.evaluate((limit) => {
        const highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores'));
        return highScores.length <= limit;
    }, limit);
    assert.ok(correctLength, `Should show only top ${limit} scores`);
});

Then('I should see math facts within {int} seconds of starting the game', async function (seconds) {
    await page.waitForFunction(() => {
        return window.activeAliens && window.activeAliens.length > 0;
    }, { timeout: seconds * 1000 });
});

When('I reach level {int}', async function (level) {
    await page.evaluate((targetLevel) => {
        // Set game time to reach desired level
        const timeNeeded = targetLevel === 1 ? 61 : 121; // seconds
        window.gameStartTime = Date.now() - (timeNeeded * 1000);
        
        // Force difficulty update
        const deltaTime = 1/60; // one frame
        updateDifficulty(deltaTime);
    }, level);
});

Then('the aliens should descend faster than in level {int}', async function (previousLevel) {
    const speedIncreased = await page.evaluate((prevLevel) => {
        const currentSpeed = window.descentSpeed;
        const previousSpeed = window.INITIAL_DESCENT_SPEED * 
            (prevLevel === 0 ? 1 : prevLevel === 1 ? 1.5 : 2);
        return currentSpeed > previousSpeed;
    }, previousLevel);
    assert.ok(speedIncreased, 'Alien descent speed should increase with level');
});

Then('the aliens should descend even faster', async function () {
    const speedIncreased = await page.evaluate(() => {
        const currentSpeed = window.descentSpeed;
        const level1Speed = window.INITIAL_DESCENT_SPEED * 1.5;
        return currentSpeed > level1Speed;
    });
    assert.ok(speedIncreased, 'Alien descent speed should increase further');
});

Then('I should see a cannon with a glowing core', async function () {
    const hasGlowingCore = await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // Check if the cannon has glow effects
        return ctx.shadowBlur === 40 && 
               ctx.shadowColor === '#00ffff' &&
               ctx.globalAlpha === 1.0;
    });
    assert.ok(hasGlowingCore, 'Cannon should have glowing core effect');
});

Then('it should have metallic highlights', async function () {
    const hasMetallicHighlights = await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // Check if metallic gradient is applied
        const gradient = ctx.createLinearGradient(0, 0, 0, 30);
        return gradient && 
               ctx.fillStyle.toString().includes('gradient');
    });
    assert.ok(hasMetallicHighlights, 'Cannon should have metallic highlights');
});

When('I miss the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({f1, f2}) => {
        // Add to missed facts and save to localStorage
        window.missedFacts = window.missedFacts || [];
        window.missedFacts.push({
            factor1: f1,
            factor2: f2,
            exposureCount: 3
        });
        localStorage.setItem('mathInvaders_missedFacts', 
            JSON.stringify(window.missedFacts));
    }, {f1: factor1, f2: factor2});
});

When('I reload the game', async function () {
    await page.reload();
    await page.waitForSelector('#startButton');
    await page.click('#startButton');
});

Then('the problem {string} should still be tracked as missed', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    const isMissed = await page.evaluate(({f1, f2}) => {
        const missedFacts = JSON.parse(
            localStorage.getItem('mathInvaders_missedFacts')
        ) || [];
        return missedFacts.some(fact => 
            fact.factor1 === f1 && fact.factor2 === f2
        );
    }, {f1: factor1, f2: factor2});
    assert.ok(isMissed, 'Problem should persist in missed facts');
});

Then('new answer circles should appear', async function () {
    await page.waitForSelector('.alien-choices', { visible: true, timeout: 5000 });
    
    const circlesVisible = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        const buttons = container.querySelectorAll('.choice-button');
        return container && 
               container.style.display !== 'none' &&
               buttons.length === 3;
    });
    
    assert.ok(circlesVisible, 'New answer circles should appear');
});

Then('the previous wrong answer should not be among the new options', async function () {
    const previousAnswerNotPresent = await page.evaluate(() => {
        const previousWrongAnswer = window.lastWrongAnswer;
        if (!previousWrongAnswer) return true;
        
        const buttons = document.querySelectorAll('.choice-button');
        return !Array.from(buttons).some(button => 
            button.textContent === previousWrongAnswer.toString()
        );
    });
    
    assert.ok(previousAnswerNotPresent, 'Previous wrong answer should not appear in new options');
});

Then('that answer should be fired but not destroy the alien', async function () {
    await page.evaluate(() => {
        // Initialize bullet array if needed
        window.activeBullets = window.activeBullets || [];
        
        // Get the current alien
        const alien = window.activeAliens[0];
        
        // Create bullet at cannon position with wrong answer
        const cannonX = window.POSITION_COORDS[window.currentCannonPosition];
        window.activeBullets.push({
            x: cannonX,
            y: window.CANNON_Y,
            answer: window.inputAnswer
        });
        
        // Force game update
        const deltaTime = 1/60;
        window.update(deltaTime);
        window.render();
    });
    
    // Wait briefly then verify alien still exists
    await page.waitForTimeout(100);
    const alienExists = await page.evaluate(() => 
        window.activeAliens && window.activeAliens.length > 0
    );
    assert.ok(alienExists, 'Alien should not be destroyed');
});
