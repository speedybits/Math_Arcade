function handleCollision(bullet, asteroid) {
    console.log('Collision detected:', {
        bullet: {
            x: bullet.x,
            y: bullet.y,
            answer: window.currentAnswer
        },
        asteroid: {
            x: asteroid.x,
            y: asteroid.y,
            problem: `${asteroid.a} × ${asteroid.b}`,
            isMissed: asteroid.isMissed
        }
    });

    const answer = asteroid.a * asteroid.b;
    const points = asteroid.isMissed ? answer * 2 : answer;
    window.score += points;

    console.log('Score updated:', {
        answer,
        isMissed: asteroid.isMissed,
        points,
        newScore: window.score
    });
    
    // ... rest of collision handling
} 