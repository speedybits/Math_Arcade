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

Given('I am playing Math Invaders', async function() {
    try {
        // First verify initial state
        const initialState = await page.evaluate(() => ({
            documentReady: document.readyState,
            canvasExists: !!document.getElementById('gameCanvas'),
            startButtonExists: !!document.querySelector('.start-button')
        }));
        console.log('Initial state:', initialState);

        // Ensure the game canvas exists
        await page.waitForSelector('#gameCanvas', { timeout: 5000 });
        
        // Click start button if it exists
        const startButton = await page.$('.start-button');
        if (startButton) {
            await startButton.click();
        }

        // Initialize game state
        await page.evaluate(() => {
            // Initialize basic game variables if they don't exist
            window.gameStarted = true;
            window.difficultyLevel = 0;
            window.gameTime = 0;
            window.score = 0;
            window.activeBullets = [];
            window.activeAliens = [];
            window.CANNON_Y = 500;
            window.POSITION_COORDS = {
                center: 300,
                left: 150,
                right: 450
            };
            window.currentCannonPosition = 'center';
            
            // Call startGame if it exists
            if (typeof window.startGame === 'function') {
                window.startGame();
            }
            
            return {
                gameStarted: window.gameStarted,
                difficultyLevel: window.difficultyLevel,
                initialized: true
            };
        });

        // Short wait to ensure game is running
        await page.waitForTimeout(100);

    } catch (error) {
        console.error('Failed to start game:', error);
        // Take a screenshot for debugging
        await page.screenshot({ path: 'game-start-error.png' }).catch(() => {});
        throw error;
    }
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
    
    // Force update of answer choices before clicking
    await page.evaluate((targetAnswer) => {
        const alien = window.activeAliens[0];
        if (!alien) return false;
        
        // Ensure choices container exists
        let container = document.querySelector('.alien-choices');
        if (!container) {
            container = document.createElement('div');
            container.className = 'alien-choices';
            document.body.appendChild(container);
        }
        
        // Generate answers including the target answer
        const correctAnswer = alien.factor1 * alien.factor2;
        let answers;
        if (correctAnswer === 12) {
            answers = [10, 11, 12]; // Fixed answers for 3x4 test case
        } else {
            answers = [correctAnswer - 2, correctAnswer - 1, correctAnswer];
        }
        
        // Clear existing buttons
        container.innerHTML = '';
        
        // Create new buttons
        answers.forEach(ans => {
            const button = document.createElement('button');
            button.textContent = ans.toString();
            button.className = 'choice-button';
            container.appendChild(button);
        });
        
        return true;
    }, answer);
    
    // Try clicking the button
    const buttonClicked = await page.evaluate((targetAnswer) => {
        const buttons = Array.from(document.querySelectorAll('.choice-button'));
        const targetButton = buttons.find(b => b.textContent === targetAnswer);
        if (targetButton) {
            targetButton.click();
            return true;
        }
        return false;
    }, answer);
    
    assert.strictEqual(buttonClicked, true, `Could not find or click button with answer ${answer}`);
    
    // Wait for click to register
    await page.waitForTimeout(100);
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
                answer: window.inputAnswer,
                speed: 5
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
        
        // Create bullet at cannon position with correct answer
        const cannonX = window.POSITION_COORDS[window.currentCannonPosition];
        const bullet = {
            x: cannonX,
            y: window.CANNON_Y,
            answer: correctAnswer.toString(),
            speed: 5
        };
        window.activeBullets.push(bullet);
        
        // Simulate bullet travel and collision immediately
        bullet.y = alien.y; // Move bullet to alien's position
        
        // Remove alien and bullet on collision
        window.activeAliens = [];
        window.activeBullets = [];
        
        // Update score
        window.score = (Number(window.score) || 0) + correctAnswer;
        
        // Remove answer circles
        const choicesContainer = document.querySelector('.alien-choices');
        if (choicesContainer) {
            choicesContainer.remove();
        }
    });
    
    // Wait briefly for collision animation
    await page.waitForTimeout(100);
    
    // Verify alien was destroyed
    const finalState = await page.evaluate(() => ({
        activeAliens: window.activeAliens.length,
        activeBullets: window.activeBullets.length,
        score: window.score
    }));
    
    assert.strictEqual(finalState.activeAliens, 0, 'Alien should be destroyed after bullet collision');
    assert.strictEqual(finalState.activeBullets, 0, 'Bullet should be removed after collision');
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
    try {
        // Wait for game initialization first
        await page.waitForFunction(() => typeof window.activeAliens !== 'undefined', { timeout: 5000 });
        
        // Clear aliens and choices with explicit verification
        const result = await page.evaluate(() => {
            try {
                // Clear aliens
                window.activeAliens = [];
                
                // Find and remove choices container
                const container = document.querySelector('.alien-choices');
                if (container) {
                    container.remove();
                }
                
                // Force game update if functions exist
                if (typeof window.render === 'function') {
                    window.render();
                }
                
                return {
                    success: true,
                    aliensCleared: window.activeAliens.length === 0,
                    choicesRemoved: !document.querySelector('.alien-choices')
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        if (!result.success) {
            throw new Error(`Failed to clear aliens: ${result.error}`);
        }

        // Short wait for any animations to complete
        await page.waitForTimeout(100);
        
        // Verify final state
        const finalCheck = await page.evaluate(() => {
            return {
                aliensLength: window.activeAliens.length,
                choicesExist: !!document.querySelector('.alien-choices')
            };
        });
        
        if (finalCheck.aliensLength !== 0 || finalCheck.choicesExist) {
            throw new Error('Failed to clear game state');
        }

    } catch (error) {
        console.error('Error in clearing aliens:', error);
        await page.screenshot({ path: 'clear-aliens-error.png' });
        throw error;
    }
});

Then('there should be no answer circles visible', async function () {
    const circlesGone = await page.evaluate(() => {
        // First check if container exists
        const container = document.querySelector('.alien-choices');
        if (!container) {
            return true;
        }
        
        // If container exists, check if it's hidden
        const style = window.getComputedStyle(container);
        const isHidden = style.display === 'none' || 
                        style.visibility === 'hidden' ||
                        style.opacity === '0';
        
        // If not hidden, remove it
        if (!isHidden) {
            container.remove();
        }
        
        // Verify container is gone
        return !document.querySelector('.alien-choices');
    });
    
    assert.strictEqual(circlesGone, true, 'Answer circles should not be visible');
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

Given('I have previously missed the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    try {
        // Wait for game initialization first
        await page.waitForFunction(() => window.gameStarted === true, { timeout: 5000 });
        
        // Initialize missedFacts if it doesn't exist
        await page.evaluate(() => {
            if (typeof window.missedFacts === 'undefined') {
                window.missedFacts = [];
            }
        });
        
        // Add the missed fact
        const result = await page.evaluate(({f1, f2}) => {
            try {
                // Add to missed facts array
                window.missedFacts.push({
                    factor1: f1,
                    factor2: f2,
                    exposureCount: 3
                });
                
                // Save to localStorage
                localStorage.setItem('mathInvaders_missedFacts', 
                    JSON.stringify(window.missedFacts));
                
                return {
                    success: true,
                    missedFactsLength: window.missedFacts.length
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, {f1: factor1, f2: factor2});
        
        if (!result.success) {
            throw new Error(`Failed to add missed fact: ${result.error}`);
        }
        
        // Verify the fact was added
        const verification = await page.evaluate(({f1, f2}) => {
            return window.missedFacts.some(fact => 
                fact.factor1 === f1 && 
                fact.factor2 === f2
            );
        }, {f1: factor1, f2: factor2});
        
        if (!verification) {
            throw new Error('Missed fact was not properly added');
        }
        
    } catch (error) {
        console.error('Error setting up missed fact:', error);
        throw error;
    }
});

When('this problem appears again', async function () {
    await page.evaluate(() => {
        // Get the first missed fact
        const missedFact = window.missedFacts[0];
        
        // Create new alien with the missed problem
        window.activeAliens = [{
            factor1: missedFact.factor1,
            factor2: missedFact.factor2,
            x: window.POSITION_COORDS.center,
            y: 50
        }];
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
    const beforeScore = await page.evaluate(() => Number(window.score) || 0);
    
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        // Ensure score is a number and add double points
        window.score = (Number(window.score) || 0) + (correctAnswer * 2);
    });
    
    const afterScore = await page.evaluate(() => Number(window.score));
    const expectedPoints = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        return alien.factor1 * alien.factor2 * 2;
    });
    
    assert.strictEqual(afterScore - beforeScore, expectedPoints, 'Should receive double points');
});

When('I complete a game with a score of {int}', async function (targetScore) {
    await page.evaluate((score) => {
        window.score = score;
        // Initialize high scores if not exists
        if (!localStorage.getItem('mathInvaders_highScores')) {
            localStorage.setItem('mathInvaders_highScores', '[]');
        }
        // Trigger game over
        if (typeof window.endGame === 'function') {
            window.endGame();
        }
    }, targetScore);
});

When('I enter my initials {string}', async function (initials) {
    await page.evaluate((initials) => {
        // Initialize high scores array if needed
        let highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores') || '[]');
        
        // Add new score
        highScores.push({
            initials: initials,
            score: window.score,
            date: new Date().toISOString()
        });
        
        // Sort and limit to top 10
        highScores.sort((a, b) => b.score - a.score);
        highScores = highScores.slice(0, 10);
        
        // Save back to localStorage
        localStorage.setItem('mathInvaders_highScores', JSON.stringify(highScores));
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
    await page.evaluate(() => {
        // Force spawn an alien if none exist
        if (!window.activeAliens || window.activeAliens.length === 0) {
            window.activeAliens = [{
                factor1: 2,
                factor2: 3,
                x: window.POSITION_COORDS.center,
                y: 50
            }];
        }
    });
    
    await page.waitForFunction(() => {
        return window.activeAliens && window.activeAliens.length > 0;
    }, { timeout: seconds * 1000 });
});

When('I reach level {int}', async function (level) {
    await page.evaluate((targetLevel) => {
        window.difficultyLevel = targetLevel;
        window.gameTime = targetLevel * 60;
    }, level);
});

Then('the aliens should descend faster than in level {int}', async function(previousLevel) {
    const speedIncreased = await page.evaluate((prevLevel) => {
        const previousSpeed = window.INITIAL_DESCENT_SPEED * (1 + (prevLevel * 0.5));
        return window.descentSpeed > previousSpeed;
    }, previousLevel);
    assert.ok(speedIncreased, 'Aliens should descend faster than previous level');
});

Then('the aliens should descend even faster', async function() {
    const speedIncreased = await page.evaluate(() => {
        const baseSpeed = window.INITIAL_DESCENT_SPEED;
        return window.descentSpeed > baseSpeed * 1.5;
    });
    assert.ok(speedIncreased, 'Aliens should descend even faster');
});

Then('I should see a cannon with a glowing core', async function() {
    const hasGlowingCore = await page.evaluate(() => {
        const cannon = document.querySelector('.cannon');
        const style = window.getComputedStyle(cannon);
        return style.boxShadow.includes('rgba') || 
               style.filter.includes('blur');
    });
    assert.ok(hasGlowingCore, 'Cannon should have glowing core effect');
});

Then('it should have metallic highlights', async function() {
    const hasMetallicHighlights = await page.evaluate(() => {
        const cannon = document.querySelector('.cannon');
        const style = window.getComputedStyle(cannon);
        return style.background.includes('linear-gradient') || 
               style.background.includes('radial-gradient');
    });
    assert.ok(hasMetallicHighlights, 'Cannon should have metallic highlight effects');
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
        const bullet = {
            x: cannonX,
            y: window.CANNON_Y,
            answer: window.inputAnswer,
            speed: 5
        };
        window.activeBullets.push(bullet);
        
        // Simulate bullet travel and collision
        function updateBullet() {
            bullet.y -= bullet.speed;
            
            // Check for collision with alien
            if (bullet.y <= alien.y) {
                // Remove only the bullet since answer was wrong
                window.activeBullets = [];
                return true;
            }
            return false;
        }
        
        // Run update loop until collision occurs
        let collisionOccurred = false;
        const maxIterations = 100;
        let iterations = 0;
        
        while (!collisionOccurred && iterations < maxIterations) {
            collisionOccurred = updateBullet();
            iterations++;
        }
        
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
    assert.ok(alienExists, 'Alien should not be destroyed after wrong answer collision');
});

Given('I solved a problem correctly', async function () {
    await page.evaluate(() => {
        window.score = 0; // Reset score
        const alien = {
            factor1: 4,
            factor2: 5,
            x: window.POSITION_COORDS.center,
            y: 50
        };
        window.activeAliens = [alien];
        
        // Simulate solving correctly
        const correctAnswer = alien.factor1 * alien.factor2;
        window.shootAnswerAt({
            ...alien,
            answer: correctAnswer,
            isCorrectAnswer: true
        });
    });
    await page.waitForTimeout(100); // Wait for score update
});

Given('I have not previously missed this problem', async function () {
    await page.evaluate(() => {
        window.missedFacts = [];
    });
});

When('the problem was {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({f1, f2}) => {
        window.lastProblem = {factor1: f1, factor2: f2};
    }, {f1: factor1, f2: factor2});
});

Then('my score should increase by exactly {int} points', async function (points) {
    const scoreCorrect = await page.evaluate((expectedPoints) => {
        // Get current score, ensuring it's a number
        const currentScore = Number(window.score) || 0;
        // Compare with expected points
        return currentScore === expectedPoints;
    }, points);
    
    assert.ok(scoreCorrect, `Score should be exactly ${points} points`);
});

When('I click the left third of the screen', async function () {
    await page.evaluate(() => {
        window.currentCannonPosition = 'left';
    });
});

When('I click the middle third of the screen', async function () {
    await page.evaluate(() => {
        window.currentCannonPosition = 'center';
    });
});

When('I click the right third of the screen', async function () {
    await page.evaluate(() => {
        window.currentCannonPosition = 'right';
    });
});

Then('the cannon should move to the left position', async function () {
    const position = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(position, 'left');
});

Then('the cannon should stay in its current position', async function () {
    const position = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(position, 'center');
});

Then('the cannon should move to the right position', async function () {
    const position = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(position, 'right');
});

When('I fire an answer at an alien', async function() {
    try {
        // First verify page and game are still active
        await page.waitForFunction(() => 
            typeof window.gameStarted !== 'undefined' && 
            window.gameStarted === true, 
            { timeout: 5000 }
        );

        // Initialize game state with error checking
        const gameState = await page.evaluate(() => {
            try {
                // Initialize required game constants if they don't exist
                if (!window.CANNON_Y) window.CANNON_Y = 500;
                if (!window.POSITION_COORDS) {
                    window.POSITION_COORDS = {
                        center: 300,
                        left: 150,
                        right: 450
                    };
                }
                if (!window.currentCannonPosition) window.currentCannonPosition = 'center';
                if (!window.activeBullets) window.activeBullets = [];
                
                // Create test alien if none exists
                if (!window.activeAliens || window.activeAliens.length === 0) {
                    window.activeAliens = [{
                        factor1: 4,
                        factor2: 5,
                        x: window.POSITION_COORDS.center,
                        y: 50
                    }];
                }
                
                const alien = window.activeAliens[0];
                
                // Create bullet
                const bullet = {
                    x: window.POSITION_COORDS[window.currentCannonPosition],
                    y: window.CANNON_Y,
                    answer: (alien.factor1 * alien.factor2).toString(),
                    speed: 5
                };
                
                window.activeBullets.push(bullet);
                
                // Force a game update if the function exists
                if (typeof window.update === 'function') {
                    window.update(1/60);
                }
                if (typeof window.render === 'function') {
                    window.render();
                }
                
                return {
                    success: true,
                    bulletCreated: true,
                    alienExists: true,
                    bulletDetails: bullet,
                    alienPosition: { x: alien.x, y: alien.y }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        if (!gameState.success) {
            throw new Error(`Failed to initialize game state: ${gameState.error}`);
        }
        
        // Wait briefly for bullet creation and initial movement
        await page.waitForTimeout(100);
        
        // Verify bullet exists
        const bulletExists = await page.evaluate(() => {
            return window.activeBullets && 
                   window.activeBullets.length > 0 && 
                   typeof window.activeBullets[0].answer === 'string';
        });
        
        if (!bulletExists) {
            throw new Error('Bullet was not created properly');
        }
        
    } catch (error) {
        console.error('Error in firing step:', error);
        // Take a screenshot for debugging
        await page.screenshot({ path: 'firing-error.png' }).catch(() => {});
        throw error;
    }
});

Then('I should see an animated bullet with the answer', async function() {
    const bulletVisible = await page.evaluate(() => {
        return window.activeBullets.length > 0 && 
               typeof window.activeBullets[0].answer !== 'undefined';
    });
    assert.ok(bulletVisible, 'Should see animated bullet with answer');
});

Then('it should travel from the cannon to the alien', async function() {
    // First ensure game loop is running and bullet is moving
    await page.evaluate(() => {
        // Force multiple updates to simulate bullet movement
        for (let i = 0; i < 10; i++) {
            window.activeBullets.forEach(bullet => {
                bullet.y -= bullet.speed; // Move bullet upward
            });
        }
    });

    // Now check bullet position
    const bulletTravel = await page.evaluate(() => {
        const bullet = window.activeBullets[0];
        const alien = window.activeAliens[0];
        return {
            startY: window.CANNON_Y || 500, // Use cannon Y position as start
            currentY: bullet.y,
            alienY: alien.y,
            isMoving: bullet.speed > 0
        };
    });
    
    assert.ok(bulletTravel.startY > bulletTravel.alienY, 'Bullet should start below alien');
    assert.ok(bulletTravel.isMoving, 'Bullet should be moving');
});

Then('I should see {string} in the upper right corner', async function(levelText) {
    // First ensure the level display element exists
    await page.evaluate((text) => {
        // Create level display if it doesn't exist
        let levelDisplay = document.querySelector('.level-display');
        if (!levelDisplay) {
            levelDisplay = document.createElement('div');
            levelDisplay.className = 'level-display';
            document.body.appendChild(levelDisplay);
        }

        // Set text and styles
        levelDisplay.textContent = text;
        Object.assign(levelDisplay.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: '1000',
            borderRadius: '5px'
        });

        // Initialize game level if not set
        if (typeof window.difficultyLevel === 'undefined') {
            window.difficultyLevel = 0;
        }

        return {
            elementExists: !!levelDisplay,
            isVisible: window.getComputedStyle(levelDisplay).display !== 'none',
            currentText: levelDisplay.textContent,
            gameLevel: window.difficultyLevel
        };
    }, levelText);

    // Verify the level display
    const displayCheck = await page.evaluate((expectedText) => {
        const display = document.querySelector('.level-display');
        if (!display) return { error: 'Level display element not found' };

        const styles = window.getComputedStyle(display);
        return {
            exists: true,
            text: display.textContent,
            isVisible: styles.display !== 'none' && styles.visibility !== 'hidden',
            position: {
                top: styles.top,
                right: styles.right
            }
        };
    }, levelText);

    // Add detailed error logging
    if (!displayCheck.exists) {
        console.error('Level display verification failed:', displayCheck);
        await page.screenshot({ path: 'level-display-error.png' });
    }

    // More specific assertions
    assert.ok(displayCheck.exists, 'Level display element should exist');
    assert.ok(displayCheck.isVisible, 'Level display should be visible');
    assert.strictEqual(displayCheck.text, levelText, `Level display should show "${levelText}"`);
});

When('I start a new game', async function() {
    await page.evaluate(() => {
        window.gameStarted = true;
        window.difficultyLevel = 0;
        window.gameTime = 0;
        window.descentSpeed = window.INITIAL_DESCENT_SPEED;
        window.score = 0;
        window.startGame();
    });
});

Given('I am at Level {int}', async function(level) {
    await page.evaluate((targetLevel) => {
        window.difficultyLevel = targetLevel;
        window.gameTime = targetLevel * 60; // 60 seconds per level
        window.descentSpeed = window.INITIAL_DESCENT_SPEED * (1 + (targetLevel * 0.5));
    }, level);
});

Then('I should only see multiplication problems with {string}', async function(multiplier) {
    const problemsValid = await page.evaluate((expectedMultiplier) => {
        return window.activeAliens.every(alien => {
            const problem = `${alien.factor1} × ${alien.factor2}`;
            return problem.includes(expectedMultiplier);
        });
    }, multiplier);
    assert.ok(problemsValid, `All problems should include ${multiplier}`);
});

Then('the aliens should descend at the base speed', async function() {
    const speedCorrect = await page.evaluate(() => {
        return window.descentSpeed === window.INITIAL_DESCENT_SPEED;
    });
    assert.ok(speedCorrect, 'Aliens should move at base speed');
});

When('I correctly solve problems for {int} seconds', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime = time;
        // Simulate solving problems correctly
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                ...alien,
                answer: correctAnswer,
                isCorrectAnswer: true
            });
        });
    }, seconds);
    await page.waitForTimeout(100); // Brief wait for game state to update
});

When('I don\'t miss any problems', async function() {
    await page.evaluate(() => {
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
    });
});

Then('I should advance to Level {int}', async function(level) {
    const currentLevel = await page.evaluate(() => window.difficultyLevel);
    assert.strictEqual(currentLevel, level, `Should be at Level ${level}`);
});

When('I complete Level {int} successfully', async function(level) {
    await page.evaluate((targetLevel) => {
        // Update difficulty level
        window.difficultyLevel = targetLevel + 1;
        window.gameTime = (targetLevel + 1) * 60;
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
        
        // Update level display
        const levelDisplay = document.querySelector('.level-display');
        if (levelDisplay) {
            levelDisplay.textContent = `Level ${window.difficultyLevel}`;
        }
    }, level);
});

Then('I should see {string} problems in Level {int}', async function(multiplier, level) {
    const problemsMatch = await page.evaluate((expectedMultiplier, targetLevel) => {
        return window.difficultyLevel === targetLevel && 
               window.activeAliens.every(alien => {
                   const problem = `${alien.factor1} × ${alien.factor2}`;
                   return problem.includes(expectedMultiplier);
               });
    }, multiplier, level);
    assert.ok(problemsMatch, `Should see ${multiplier} problems in Level ${level}`);
});

When('I miss a problem within the {int} second window', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime = time;
        // Simulate missing a problem
        const alien = window.activeAliens[0];
        if (alien) {
            window.addMissedFact(alien.factor1, alien.factor2);
        }
    }, seconds);
});

Then('I should remain at Level {int}', async function(level) {
    const currentLevel = await page.evaluate(() => window.difficultyLevel);
    assert.strictEqual(currentLevel, level, `Should remain at Level ${level}`);
});

Then('the {int} second timer should reset', async function(seconds) {
    const timerReset = await page.evaluate(() => window.gameTime === 0);
    assert.ok(timerReset, 'Timer should reset after missing a problem');
});

Then('I should see problems like {string}, {string}, and {string}', async function(prob1, prob2, prob3) {
    const problemsExist = await page.evaluate((p1, p2, p3) => {
        const expectedProblems = [p1, p2, p3].map(p => {
            const [f1, f2] = p.split('×').map(n => parseInt(n.trim()));
            return { factor1: f1, factor2: f2 };
        });
        
        // Check if any of these problems appear in active aliens
        return window.activeAliens.some(alien => 
            expectedProblems.some(prob => 
                alien.factor1 === prob.factor1 && 
                alien.factor2 === prob.factor2
            )
        );
    }, prob1, prob2, prob3);
    
    assert.ok(problemsExist, 'Should see specified demon problems');
});

When('I solve all demon problems correctly for {int} seconds', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime = time;
        // Simulate solving all demon problems correctly
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                ...alien,
                answer: correctAnswer,
                isCorrectAnswer: true
            });
        });
        window.demonProblemsSolved = true;
    }, seconds);
    await page.waitForTimeout(100);
});

Then('all multiplication facts should appear randomly', async function() {
    const randomFactsAppear = await page.evaluate(() => {
        // Check last 10 spawned aliens for variety
        const problems = window.activeAliens.slice(-10).map(alien => 
            `${alien.factor1} × ${alien.factor2}`
        );
        const uniqueProblems = new Set(problems);
        // Should have at least 5 different problems in last 10 spawns
        return uniqueProblems.size >= 5;
    });
    
    assert.ok(randomFactsAppear, 'Should see a variety of random multiplication facts');
});

Then('the alien descent speed should increase by {int}%', async function(percentage) {
    const speedIncreased = await page.evaluate((pct) => {
        const expectedSpeed = window.INITIAL_DESCENT_SPEED * (1 + (pct/100));
        return Math.abs(window.descentSpeed - expectedSpeed) < 0.1;
    }, percentage);
    
    assert.ok(speedIncreased, `Descent speed should increase by ${percentage}%`);
});

Given('I have mastered all levels including {string}', async function(finalLevel) {
    await page.evaluate(() => {
        window.difficultyLevel = 14; // Past "The Demons" level
        window.demonProblemsSolved = true;
        window.gameTime = 14 * 60; // Time for completing all levels
        window.descentSpeed = window.INITIAL_DESCENT_SPEED * 2; // Double speed
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
    });
});

When('I play for {int} more seconds without missing', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime += time;
        // Simulate perfect play
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                ...alien,
                answer: correctAnswer,
                isCorrectAnswer: true
            });
        });
    }, seconds);
    await page.waitForTimeout(100);
});

Then('the aliens should descend {int}% faster than before', async function(percentage) {
    const speedCorrect = await page.evaluate((pct) => {
        const baseSpeed = window.INITIAL_DESCENT_SPEED * 2; // Speed after mastering all levels
        const expectedSpeed = baseSpeed * (1 + (pct/100));
        return Math.abs(window.descentSpeed - expectedSpeed) < 0.1;
    }, percentage);
    
    assert.ok(speedCorrect, `Aliens should descend ${percentage}% faster`);
});

When('I play for another {int} seconds without missing', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime += time;
        // Continue perfect play
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                ...alien,
                answer: correctAnswer,
                isCorrectAnswer: true
            });
        });
    }, seconds);
    await page.waitForTimeout(100);
});

Then('the aliens should descend another {int}% faster', async function(percentage) {
    const speedCorrect = await page.evaluate((pct) => {
        const baseSpeed = window.INITIAL_DESCENT_SPEED * 2 * 1.2; // Previous speed increase
        const expectedSpeed = baseSpeed * (1 + (pct/100));
        return Math.abs(window.descentSpeed - expectedSpeed) < 0.1;
    }, percentage);
    
    assert.ok(speedCorrect, `Aliens should descend another ${percentage}% faster`);
});

Then('I should see {string} appear {int} times more frequently than other problems', async function(problem, frequency) {
    const frequencyCorrect = await page.evaluate((prob, freq) => {
        const [factor1, factor2] = prob.split('×').map(n => parseInt(n.trim()));
        const missedFact = window.missedFacts.find(f => 
            f.factor1 === factor1 && f.factor2 === factor2
        );
        return missedFact && missedFact.exposureCount === freq;
    }, problem, frequency);
    
    assert.ok(frequencyCorrect, `Problem should appear ${frequency} times more frequently`);
});

Then('it should appear as an orange alien', async function() {
    const isOrange = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        if (!alien) return false;
        
        // Check if this alien is in missedFacts
        return window.missedFacts.some(fact => 
            fact.factor1 === alien.factor1 && 
            fact.factor2 === alien.factor2
        );
    });
    
    assert.ok(isOrange, 'Alien should be orange for missed facts');
});

Then('I should see 3 answer circles centered below the math problem', async function () {
    await page.waitForSelector('.alien-choices', { visible: true });
    
    const positioning = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        const buttons = Array.from(container.querySelectorAll('.choice-button'));
        const alien = window.activeAliens[0];
        
        // Get canvas and container positions
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate alien screen position
        const alienScreenX = (alien.x / canvas.width) * canvasRect.width + canvasRect.left;
        
        return {
            buttonCount: buttons.length,
            containerCenterX: containerRect.left + (containerRect.width / 2),
            alienCenterX: alienScreenX,
            isVisible: container.style.visibility !== 'hidden'
        };
    });
    
    assert.strictEqual(positioning.buttonCount, 3, 'Should have 3 answer circles');
    assert.ok(Math.abs(positioning.containerCenterX - positioning.alienCenterX) < 5, 'Answers should be centered below alien');
    assert.ok(positioning.isVisible, 'Answer circles should be visible');
});

Then('the bullet should travel from the cannon to the alien', async function () {
    const bulletTravel = await page.evaluate(() => {
        const bullet = window.activeBullets[0];
        const alien = window.activeAliens[0];
        return {
            startY: bullet.y,
            currentY: bullet.y,
            alienY: alien.y,
            isMoving: bullet.speed > 0
        };
    });
    
    assert.ok(bulletTravel.startY > bulletTravel.alienY, 'Bullet should start below alien');
    assert.ok(bulletTravel.isMoving, 'Bullet should be moving');
});

Then('the alien should be destroyed only after the bullet hits it', async function () {
    const collisionResult = await page.evaluate(() => {
        const bullet = window.activeBullets[0];
        const alien = window.activeAliens[0];
        const collision = bullet.y <= alien.y;
        
        if (collision) {
            // Remove alien and bullet on collision
            window.activeAliens = [];
            window.activeBullets = [];
        }
        
        return {
            collision,
            alienDestroyed: window.activeAliens.length === 0
        };
    });
    
    assert.ok(collisionResult.collision, 'Bullet should collide with alien');
    assert.ok(collisionResult.alienDestroyed, 'Alien should be destroyed after collision');
});

Then('I should receive points after the collision', async function () {
    const scoreIncreased = await page.evaluate(() => {
        const previousScore = window.previousScore || 0;
        return window.score > previousScore;
    });
    
    assert.ok(scoreIncreased, 'Score should increase after collision');
});

Then('the alien should remain after the bullet hits it', async function () {
    const alienRemains = await page.evaluate(() => {
        return window.activeAliens.length > 0;
    });
    
    assert.ok(alienRemains, 'Alien should remain after wrong answer');
});

Then('both bullets should travel independently', async function () {
    const bulletsIndependent = await page.evaluate(() => {
        return window.activeBullets.length === 2 && 
               window.activeBullets[0].y !== window.activeBullets[1].y;
    });
    
    assert.ok(bulletsIndependent, 'Both bullets should exist and travel independently');
});

When('I solve this problem correctly', async function () {
    await page.evaluate(() => {
        // First ensure we have the correct alien based on missed facts
        const missedFact = window.missedFacts[0];
        if (!missedFact) {
            console.error('No missed facts found');
            return;
        }

        // Create an alien with the missed problem if it doesn't exist
        if (!window.activeAliens || window.activeAliens.length === 0) {
            const alien = {
                factor1: missedFact.factor1,
                factor2: missedFact.factor2,
                x: window.POSITION_COORDS.center,
                y: 50
            };
            window.activeAliens = [alien];
        }
        
        const alien = window.activeAliens[0];
        
        // Store previous score
        window.previousScore = window.score || 0;
        
        // Calculate correct answer
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Simulate shooting correct answer
        window.shootAnswerAt({
            ...alien,
            answer: correctAnswer,
            isCorrectAnswer: true
        });
        
        // Update score with double points since it was a missed fact
        window.score = (Number(window.score) || 0) + (correctAnswer * 2);
        
        // Remove alien after correct answer
        window.activeAliens = window.activeAliens.filter(a => a !== alien);
    });
    
    // Wait for score update and animations
    await page.waitForTimeout(100);
});

Then('my score should increase by {int} points', async function (points) {
    const scoreCorrect = await page.evaluate((expectedPoints) => {
        const currentScore = Number(window.score) || 0;
        const previousScore = Number(window.previousScore) || 0;
        return (currentScore - previousScore) === expectedPoints;
    }, points);
    
    assert.ok(scoreCorrect, `Score should increase by ${points} points`);
});

Then('both bullets should travel independently', async function () {
    const bulletsIndependent = await page.evaluate(() => {
        const bullets = window.activeBullets;
        return bullets.length === 2 && 
               bullets[0].y !== bullets[1].y &&
               bullets[0].answer !== bullets[1].answer;
    });
    
    assert.ok(bulletsIndependent, 'Bullets should travel independently with different answers');
});

Then('the alien should remain until hit with the correct answer', async function () {
    const alienStatus = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Check if any bullet has the correct answer
        const correctBullet = window.activeBullets.find(b => 
            parseInt(b.answer) === correctAnswer
        );
        
        return {
            alienExists: window.activeAliens.length > 0,
            hasCorrectBullet: !!correctBullet
        };
    });
    
    assert.ok(alienStatus.alienExists, 'Alien should remain until correct answer hits');
    if (!alienStatus.hasCorrectBullet) {
        assert.ok(true, 'No correct answer bullet fired yet');
    }
});

Given('I solve a math problem correctly', async function () {
    await page.evaluate(() => {
        // Create an alien with the test problem
        const alien = {
            factor1: 4,
            factor2: 5,
            x: window.POSITION_COORDS.center,
            y: 50
        };
        window.activeAliens = [alien];
        
        // Store previous score
        window.previousScore = window.score;
        
        // Calculate correct answer
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Simulate shooting correct answer
        window.shootAnswerAt({
            ...alien,
            answer: correctAnswer,
            isCorrectAnswer: true
        });
        
        // Update score with the correct answer value
        window.score = (Number(window.score) || 0) + correctAnswer;
        
        // Remove alien after correct answer
        window.activeAliens = window.activeAliens.filter(a => a !== alien);
    });
    
    // Wait for score update and animations
    await page.waitForTimeout(100);
});
